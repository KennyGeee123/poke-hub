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

export function listingTotal(l: Listing): number {
  return l.price + (l.shipping ?? 0);
}

export function listingKey(l: Listing): string {
  const path = (l.url || "").split("?")[0];
  const cond = (l.condition || "").toLowerCase();
  return `${l.source}::${cond}::${path}`;
}

export function rankQueue(data: AggregateResponse | null, skipKeys: string[] = []): Listing[] {
  if (!data) return [];
  const skip = new Set(skipKeys);
  const fromQueue = data.queue?.length
    ? data.queue
    : data.sources.flatMap((s) => s.listings);
  const seen = new Set<string>();
  const priced: Listing[] = [];
  const unpriced: Listing[] = [];
  for (const l of fromQueue) {
    const k = listingKey(l);
    if (!k || seen.has(k) || skip.has(k) || !l.url) continue;
    seen.add(k);
    if (listingTotal(l) > 0) priced.push(l);
    else unpriced.push(l);
  }
  priced.sort((a, b) => listingTotal(a) - listingTotal(b));
  return [...priced, ...unpriced];
}

export async function getCardPrices(
  query: string,
  opts?: { cheapOnly?: boolean; fresh?: boolean; cardId?: string }
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
    return j.cheapest;
  } catch {
    return null;
  }
}
