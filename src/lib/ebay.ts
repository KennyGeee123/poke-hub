export type EbayListing = {
  title: string;
  price: string;
  priceValue: number | null;
  currency: string;
  soldDate: string | null;
  url: string;
  image: string | null;
};

export type EbayResponse = {
  query: string;
  summary: { count: number; min: number; max: number; avg: number; median: number } | null;
  listings: EbayListing[];
  error?: string;
};

import { supabase } from "@/integrations/supabase/client";

export async function getEbaySold(query: string): Promise<EbayResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in required to look up eBay sold prices");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  let r: Response;
  try {
    r = await fetch(`/api/public/ebay-sold?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctl.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error("eBay sold listings timed out — please try again.");
    }
    throw new Error(`Could not reach eBay sold listings: ${(e as Error)?.message ?? "network error"}`);
  } finally {
    clearTimeout(timer);
  }
  const json = (await r.json().catch(() => null)) as EbayResponse | null;
  if (!r.ok) {
    throw new Error(json?.error || `eBay sold listings failed (${r.status})`);
  }
  if (!json) throw new Error("eBay sold listings returned an unreadable response");
  return json;
}
