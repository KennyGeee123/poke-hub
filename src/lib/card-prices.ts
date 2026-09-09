// Client wrapper for /api/public/card-prices
import { supabase } from "@/integrations/supabase/client";

export type Listing = {
  source: string;
  title: string;
  price: number;
  priceRaw: string;
  currency: string;
  url: string;
  image: string | null;
  condition?: string | null;
  shipping?: number | null;
  variant?: string | null;
  kind?: "listing" | "shop";
  listingId?: string | null;
};

export type SourceResult = {
  source: string;
  ok: boolean;
  count: number;
  lowest: Listing | null;
  listings: Listing[];
  error?: string;
  shopUrl?: string;
  kind?: "price" | "shop";
};

export type AggregateResponse = {
  query: string;
  cheapest: Listing | null;
  queue?: Listing[];
  sources: SourceResult[];
  generatedAt: string;
};

const cache = new Map<string, { t: number; v: AggregateResponse }>();
const TTL_MS = 20 * 1000;

/** Conservative EUR→USD used by the seed path; matches the API FX table. */
export const FX_EUR_USD = 1.08;

export function listingTotal(l: Listing): number {
  return (Number(l.price) || 0) + (Number(l.shipping) || 0);
}

export function listingHasShipping(l: Listing): boolean {
  return l.shipping != null && Number.isFinite(l.shipping);
}

/** Search-URL / unpriced shop rows are not Buy-It-Now listings. */
export function isShopListing(l: Listing): boolean {
  if (l.kind === "shop") return true;
  if (!l.url) return true;
  if ((Number(l.price) || 0) <= 0) return true;
  if (/ebay\.com\/sch\//i.test(l.url)) return true;
  if (/mercari\.com\/search/i.test(l.url)) return true;
  return false;
}

/**
 * Stable skip identity. TCGPlayer product pages share one URL across
 * holofoil / reverse / 1st edition, so URL-only keys wipe a whole product.
 * Prefer a real listing id when we have one; otherwise source + print +
 * condition + price + path.
 */
export function listingKey(l: Listing): string {
  if (l.listingId) return `${l.source}::id::${l.listingId}`;
  const path = (l.url || "").split("?")[0];
  const cond = (l.condition || "").toLowerCase().trim();
  const variant = (l.variant || "").toLowerCase().trim();
  const cents = Math.round((Number(l.price) || 0) * 100);
  return `${l.source}::${cond}::${variant}::${cents}::${path}`;
}

/** 0 = NM/LP/unknown print name, 1 = MP, 2 = HP, 3 = damaged. */
export function conditionTier(condition?: string | null): number {
  const s = (condition || "").toLowerCase();
  if (/damaged|\bdmg\b/.test(s)) return 3;
  if (/heavily\s*played|\bhp\b/.test(s)) return 2;
  if (/moderately\s*played|\bmp\b/.test(s)) return 1;
  return 0;
}

export function preferredPrintsFromCard(card: {
  name?: string;
  rarity?: string;
  set?: { name?: string };
  tcgplayer?: { prices?: Record<string, unknown> };
}): string[] {
  const keys = Object.keys(card.tcgplayer?.prices || {});
  const rarity = (card.rarity || "").toLowerCase();
  const blob = `${card.name || ""} ${card.set?.name || ""} ${rarity}`.toLowerCase();
  const out: string[] = [];
  const push = (k: string) => {
    const n = k.toLowerCase();
    if (n && !out.includes(n)) out.push(n);
  };
  if (/1st|first edition/.test(blob)) {
    keys.filter((k) => /1st|first/i.test(k)).forEach(push);
  }
  if (/shadowless/.test(blob)) {
    keys.filter((k) => /shadowless/i.test(k)).forEach(push);
  }
  if (/reverse/.test(rarity) || /reverse holo/.test(blob)) {
    keys.filter((k) => /reverse/i.test(k)).forEach(push);
  } else if (/holo/.test(rarity)) {
    keys.filter((k) => /holofoil/i.test(k) && !/reverse/i.test(k)).forEach(push);
  } else {
    keys.filter((k) => /^normal$/i.test(k)).forEach(push);
  }
  if (!out.length) keys.forEach(push);
  return out;
}

export function printMatchScore(l: Listing, preferPrints: string[] = []): number {
  if (!preferPrints.length) return 0;
  const blob = `${l.variant || ""} ${l.condition || ""} ${l.title || ""}`.toLowerCase();
  const hasPrintSignal = /holofoil|reverse|1st|first edition|unlimited|normal|shadowless/.test(blob);
  if (!hasPrintSignal) return 0; // unknown print (e.g. Cardmarket low) stays in landed-cost race
  return preferPrints.some((p) => blob.includes(p.toLowerCase())) ? 0 : 1;
}

export function compareListings(a: Listing, b: Listing, preferPrints: string[] = []): number {
  const print = printMatchScore(a, preferPrints) - printMatchScore(b, preferPrints);
  if (print) return print;
  const cond = conditionTier(a.condition) - conditionTier(b.condition);
  if (cond) return cond;
  return listingTotal(a) - listingTotal(b);
}

export function rankQueue(
  data: AggregateResponse | null,
  skipKeys: string[] = [],
  opts?: { preferPrints?: string[] },
): Listing[] {
  if (!data) return [];
  const skip = new Set(skipKeys);
  const preferPrints = opts?.preferPrints ?? [];
  const fromQueue = data.queue?.length
    ? data.queue
    : data.sources.flatMap((s) => s.listings);
  const seen = new Set<string>();
  const priced: Listing[] = [];
  const shops: Listing[] = [];
  for (const l of fromQueue) {
    const k = listingKey(l);
    if (!k || seen.has(k) || skip.has(k) || !l.url) continue;
    seen.add(k);
    if (isShopListing(l)) {
      shops.push(l);
      continue;
    }
    if (listingTotal(l) > 0) priced.push(l);
  }
  priced.sort((a, b) => compareListings(a, b, preferPrints));
  return priced;
}

export async function getCardPrices(
  query: string,
  opts?: { cheapOnly?: boolean; fresh?: boolean; cardId?: string },
): Promise<AggregateResponse> {
  const key = `${opts?.cheapOnly ? "c:" : "f:"}${opts?.cardId ?? ""}:${query.toLowerCase().trim()}`;
  if (!opts?.fresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  }

  const headers: Record<string, string> = {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // guests still get live listings
  }

  const qs = new URLSearchParams({ q: query });
  if (opts?.cardId) qs.set("id", opts.cardId);
  if (opts?.cheapOnly) qs.set("cheap", "1");
  if (opts?.fresh) qs.set("fresh", "1");
  const r = await fetch(`/api/public/card-prices?${qs}`, { headers, cache: opts?.fresh ? "no-store" : "default" });
  if (!r.ok) throw new Error(`card-prices ${r.status}`);
  const json = (await r.json()) as AggregateResponse;
  cache.set(key, { t: Date.now(), v: json });
  return json;
}

/** Lightweight: returns just the cheapest listing total (price + shipping) or null. */
export async function getCheapestPrice(query: string, cardId?: string): Promise<Listing | null> {
  try {
    const j = await getCardPrices(query, { cheapOnly: true, cardId });
    const queue = rankQueue(j);
    return queue[0] ?? j.cheapest;
  } catch {
    return null;
  }
}
