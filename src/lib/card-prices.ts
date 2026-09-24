// Client wrapper for /api/public/card-prices with Graded Slab & Condition Arbitrage
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
  isSlab?: boolean;
  gradeCompany?: string | null;
  gradeScore?: string | number | null;
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
export const TTL_MS = 20 * 1000;

/** Conservative EUR→USD used by the seed path; matches the API FX table. */
export const FX_EUR_USD = 1.08;

/** Fetch more live rows when the remaining loop drops below this. */
export const REFILL_AT = 4;

/** TimeFlow: re-rank landed cost on a 5s ticker; fetch only when stale or thin. */
export const TICK_MS = 5_000;

const SOLD_KEY = "pv.sold.registry.v1";
const inMemSoldSet = new Set<string>();

export function getSoldListingKeys(): Set<string> {
  const set = new Set<string>(inMemSoldSet);
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(SOLD_KEY);
      if (raw) {
        for (const k of JSON.parse(raw)) set.add(k);
      }
    } catch {
      // ignore
    }
  }
  return set;
}

export function markListingSold(key: string) {
  if (!key) return;
  inMemSoldSet.add(key);
  if (typeof localStorage !== "undefined") {
    try {
      const set = getSoldListingKeys();
      set.add(key);
      localStorage.setItem(SOLD_KEY, JSON.stringify(Array.from(set).slice(-500)));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pv-listing-sold", { detail: { key } }));
      }
    } catch {
      // ignore
    }
  }
}

export function isListingSold(key: string): boolean {
  return getSoldListingKeys().has(key);
}

export function listingTotal(l: Listing): number {
  return (Number(l.price) || 0) + (Number(l.shipping) || 0);
}

export function listingHasShipping(l: Listing): boolean {
  return l.shipping != null && Number.isFinite(l.shipping);
}

/** Detects if a listing represents a graded slab (PSA, BGS, CGC, SGC, AGS, GMA). */
export function isSlabListing(l: Listing): boolean {
  if (l.isSlab) return true;
  const text = `${l.title || ""} ${l.variant || ""} ${l.condition || ""}`.toLowerCase();
  return /\b(psa|bgs|cgc|sgc|beckett|graded|gem\s*mint\s*10|psa\s*10|psa\s*9|psa\s*8|bgs\s*9\.5|cgc\s*10)\b/i.test(
    text,
  );
}

/** Matches listing condition / slab against target filter. */
export function matchesConditionFilter(l: Listing, filter?: string | null): boolean {
  if (!filter || filter === "all" || filter === "any") return true;
  const slab = isSlabListing(l);
  const text = `${l.title || ""} ${l.variant || ""} ${l.condition || ""}`.toLowerCase();

  if (filter === "raw") return !slab;
  if (filter === "slab" || filter === "graded") return slab;
  if (filter === "psa10") return slab && /psa\s*10|gem\s*mint\s*10/i.test(text);
  if (filter === "psa9") return slab && /psa\s*9\b|mint\s*9/i.test(text);
  if (filter === "psa8") return slab && /psa\s*8\b|nm\s*mt\s*8/i.test(text);
  if (filter === "psa7") return slab && /psa\s*7\b|near\s*mint\s*7/i.test(text);
  if (filter === "bgs" || filter === "bgs95" || filter === "bgs10_black")
    return slab && /bgs|beckett/i.test(text);
  if (filter === "cgc" || filter === "cgc10_pristine" || filter === "cgc95" || filter === "cgc9")
    return slab && /cgc/i.test(text);
  if (filter === "sgc" || filter === "sgc10") return slab && /sgc/i.test(text);

  if (filter === "raw_mint")
    return (
      !slab && /mint|pack\s*fresh|gem\s*raw/i.test(text) && !/played|damaged|hp|mp|lp/i.test(text)
    );
  if (filter === "raw_nm" || filter === "nm")
    return (
      !slab &&
      /near\s*mint|\bnm\b|normal|holofoil|mint/i.test(text) &&
      !/played|damaged|hp|mp/i.test(text)
    );
  if (filter === "raw_lp" || filter === "lp")
    return !slab && /lightly\s*played|\blp\b|excellent/i.test(text);
  if (filter === "raw_mp" || filter === "mp")
    return !slab && /moderately\s*played|\bmp\b|fine|very\s*good/i.test(text);
  if (filter === "raw_hp" || filter === "hp")
    return !slab && /heavily\s*played|\bhp\b|good/i.test(text);
  if (filter === "raw_dmg" || filter === "dmg") return !slab && /damaged|\bdmg\b|poor/i.test(text);

  return true;
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
  const hasPrintSignal = /holofoil|reverse|1st|first edition|unlimited|normal|shadowless/.test(
    blob,
  );
  if (!hasPrintSignal) return 0;
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
  opts?: { preferPrints?: string[]; condition?: string | null },
): Listing[] {
  if (!data) return [];
  const skip = new Set([...skipKeys, ...Array.from(getSoldListingKeys())]);
  const preferPrints = opts?.preferPrints ?? [];
  const condition = opts?.condition ?? null;
  const fromQueue = data.queue?.length ? data.queue : data.sources.flatMap((s) => s.listings);
  const seen = new Set<string>();
  const priced: Listing[] = [];
  const shops: Listing[] = [];
  for (const l of fromQueue) {
    const k = listingKey(l);
    if (!k || seen.has(k) || skip.has(k) || !l.url) continue;
    if (!matchesConditionFilter(l, condition)) continue;
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

export function needsRefill(queue: Listing[]): boolean {
  return queue.length < REFILL_AT;
}

/** Merge live rows over seed, drop skip keys, re-rank. Never rebuild from seed alone. */
export function mergeLiveQueue(
  seed: Listing[],
  live: Listing[],
  skipKeys: string[] = [],
  preferPrints: string[] = [],
  condition?: string | null,
): Listing[] {
  const livePriced = live.filter((l) => listingTotal(l) > 0 && l.url);
  return rankQueue(
    { query: "", cheapest: null, queue: [...livePriced, ...seed], sources: [], generatedAt: "" },
    skipKeys,
    { preferPrints, condition },
  );
}

function prettyPrintName(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

type SeedCard = {
  name: string;
  number?: string;
  images?: { small?: string };
  set?: { name?: string };
  tcgplayer?: {
    url?: string;
    prices?: Record<string, { low?: number | null; directLow?: number | null }>;
  };
  cardmarket?: {
    url?: string;
    prices?: { lowPrice?: number | null; trendPrice?: number | null };
  };
};

function pushTcgRow(
  out: Listing[],
  card: SeedCard,
  variant: string,
  price: number,
  label: "low" | "direct",
) {
  const pretty = prettyPrintName(variant);
  const qStr = `${card.name} ${card.number ?? ""}`.trim();
  const url =
    card.tcgplayer?.url ||
    `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(qStr)}`;
  out.push({
    source: "TCGplayer",
    title: `${card.name} · ${pretty} ${label === "direct" ? "Direct" : "low"}`,
    price,
    priceRaw: `$${price.toFixed(2)}`,
    currency: "USD",
    url,
    image: card.images?.small ?? null,
    condition: pretty,
    variant: label === "direct" ? `${variant}-direct` : variant,
    kind: "listing",
    isSlab: false,
  });
}

/** Catalog seed: every TCG variant low, plus Direct when it is a different number. */
export function seedListingsFromCard(card: SeedCard): Listing[] {
  const out: Listing[] = [];
  const tp = card.tcgplayer;
  const qStr = `${card.name} ${card.number ?? ""}`.trim();

  if (tp?.prices) {
    for (const [name, p] of Object.entries(tp.prices)) {
      const low = typeof p?.low === "number" && p.low > 0 ? p.low : null;
      const direct = typeof p?.directLow === "number" && p.directLow > 0 ? p.directLow : null;
      if (low) pushTcgRow(out, card, name, low, "low");
      if (direct && (low == null || Math.round(direct * 100) !== Math.round(low * 100))) {
        pushTcgRow(out, card, name, direct, "direct");
      }
    }
  }
  const cm = card.cardmarket;
  const eur = cm?.prices?.lowPrice ?? cm?.prices?.trendPrice;
  if (typeof eur === "number" && eur > 0) {
    const usd = Math.round(eur * FX_EUR_USD * 100) / 100;
    const cmUrl =
      cm?.url ||
      `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`;
    out.push({
      source: "Cardmarket",
      title: `${card.name} · EU low`,
      price: usd,
      priceRaw: `€${eur.toFixed(2)}`,
      currency: "EUR",
      url: cmUrl,
      image: card.images?.small ?? null,
      variant: "low",
      kind: "listing",
      isSlab: false,
    });
  }

  if (out.length === 0) {
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
      `Pokemon ${qStr}`,
    )}&LH_BIN=1&_sop=15`;
    const tcgUrl =
      tp?.url || `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(qStr)}`;
    out.push({
      source: "eBay",
      title: `${card.name} · Live Market Search`,
      price: 0.99,
      priceRaw: "Live Bids / BIN",
      currency: "USD",
      url: ebayUrl,
      image: card.images?.small ?? null,
      variant: "raw",
      kind: "listing",
      isSlab: false,
    });
    out.push({
      source: "TCGplayer",
      title: `${card.name} · Live Marketplace`,
      price: 0.99,
      priceRaw: "Check Listings",
      currency: "USD",
      url: tcgUrl,
      image: card.images?.small ?? null,
      variant: "raw",
      kind: "listing",
      isSlab: false,
    });
  }

  return rankQueue(
    { query: "", cheapest: out[0] ?? null, queue: out, sources: [], generatedAt: "" },
    [],
    { preferPrints: preferredPrintsFromCard(card) },
  );
}

export async function getCardPrices(
  query: string,
  opts?: {
    cheapOnly?: boolean;
    fresh?: boolean;
    cardId?: string;
    skipKeys?: string[];
    condition?: string | null;
  },
): Promise<AggregateResponse> {
  const skip = (opts?.skipKeys ?? []).slice(0, 64);
  const cond = (opts?.condition || "").toLowerCase().trim();
  const key = `${opts?.cheapOnly ? "c:" : "f:"}${opts?.cardId ?? ""}:${query.toLowerCase().trim()}:${cond}:${skip.slice().sort().join("|")}`;
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
  if (cond) qs.set("condition", cond);
  for (const k of skip) qs.append("skip", k);
  const r = await fetch(`/api/public/card-prices?${qs}`, {
    headers,
    cache: opts?.fresh ? "no-store" : "default",
  });
  if (!r.ok) throw new Error(`card-prices ${r.status}`);
  const json = (await r.json()) as AggregateResponse;
  cache.set(key, { t: Date.now(), v: json });
  return json;
}

/** Lightweight: returns just the cheapest listing total (price + shipping) or null. */
export async function getCheapestPrice(
  query: string,
  cardId?: string,
  condition?: string,
): Promise<Listing | null> {
  try {
    const j = await getCardPrices(query, { cheapOnly: true, cardId, condition });
    const queue = rankQueue(j, [], { condition });
    return queue[0] ?? j.cheapest;
  } catch {
    return null;
  }
}
