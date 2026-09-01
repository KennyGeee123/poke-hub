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
};

export type AggregateResponse = {
  query: string;
  cheapest: Listing | null;
  sources: SourceResult[];
  generatedAt: string;
};

const cache = new Map<string, { t: number; v: AggregateResponse }>();
const TTL_MS = 10 * 60 * 1000;

export async function getCardPrices(query: string, opts?: { cheapOnly?: boolean }): Promise<AggregateResponse> {
  const key = `${opts?.cheapOnly ? "c:" : "f:"}${query.toLowerCase().trim()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to compare prices across marketplaces");

  const qs = new URLSearchParams({ q: query });
  if (opts?.cheapOnly) qs.set("cheap", "1");
  const r = await fetch(`/api/public/card-prices?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`card-prices ${r.status}`);
  const json = (await r.json()) as AggregateResponse;
  cache.set(key, { t: Date.now(), v: json });
  return json;
}

/** Lightweight: returns just the cheapest listing total (price + shipping) or null. */
export async function getCheapestPrice(query: string): Promise<Listing | null> {
  try {
    const j = await getCardPrices(query, { cheapOnly: true });
    return j.cheapest;
  } catch {
    return null;
  }
}
