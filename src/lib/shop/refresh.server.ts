// Server-only: pulls prices from every reachable source and upserts shop tables.
import { createClient } from "@supabase/supabase-js";
import { fetchGradeQuotes, type SourceStatus } from "./grades.server";
import { variantId } from "./grades";
import {
  DEFAULT_MARKUP_RULES,
  normalizePricing,
  type PricingSettings,
  type MarkupRule,
  type SourceListing,
  cheapest,
  cheapestUnclaimed,
  cleanSetName,
  parseShopifySuggest,
  salePrice,
  sealedMatchKey,
  sealedType,
  titleMatches,
  toUsd,
} from "./core";

const TCGCSV = "https://tcgcsv.com/tcgplayer/3";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

/** Shopify card shops whose public search/suggest.json answered from a server (verified 2026-10-14). */
export const SHOPIFY_STORES = [
  { source: "hobbiesville", origin: "https://www.hobbiesville.com", currency: "USD" },
  { source: "totalcards", origin: "https://www.totalcards.net", currency: "USD" },
  { source: "401games", origin: "https://store.401games.ca", currency: "CAD" },
];
/** Retailers that block server fetches (bot walls / 403 / JS-only); skipped. */
export const BLOCKED_SOURCES = [
  "walmart (412)", "target (JS-only, redsky 435)", "bestbuy (timeout)", "amazon (captcha)",
  "pokemoncenter (bot wall)", "gamestop (403)", "trollandtoad (JS/401)", "coolstuffinc (empty)", "dacardworld (403)",
];

const TYPE_QUERY: Record<string, string> = {
  etb: "elite trainer box", pc_etb: "pokemon center elite trainer box", booster_box: "booster box",
  bundle: "booster bundle", tin: "tin", upc: "ultra premium collection",
};

async function getJson(url: string, init: RequestInit = {}, ms = 10000): Promise<unknown | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Group = { groupId: number; name: string; publishedOn: string };
type TProduct = { productId: number; name: string; imageUrl: string; url: string; extendedData: { name: string; value: string }[] };
type TPrice = { productId: number; lowPrice: number | null; marketPrice: number | null; subTypeName: string };

async function shopifySearch(q: string): Promise<SourceListing[]> {
  const out = await Promise.all(
    SHOPIFY_STORES.map(async (s) => {
      const j = await getJson(`${s.origin}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=10`);
      return j ? parseShopifySuggest(j, s.source, s.origin, s.currency) : [];
    }),
  );
  return out.flat();
}

let ebayToken: { v: string; exp: number } | null = null;
async function ebayBrowse(q: string): Promise<SourceListing[]> {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return [];
  if (!ebayToken || ebayToken.exp < Date.now()) {
    const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!j?.access_token) return [];
    ebayToken = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 900 };
  }
  const j = (await getJson(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&filter=buyingOptions:{FIXED_PRICE},conditions:{NEW}&sort=price&limit=20`,
    { headers: { Authorization: `Bearer ${ebayToken.v}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } },
  )) as { itemSummaries?: { title: string; price: { value: string; currency: string }; itemWebUrl: string }[] } | null;
  return (j?.itemSummaries ?? []).map((i) => ({
    source: "ebay", title: i.title, price: parseFloat(i.price.value), currency: i.price.currency, url: i.itemWebUrl, inStock: true,
  }));
}

/** Fallback: scrape eBay active Buy-It-Now results (same approach as /api/public/ebay-sold). Often 403s from datacenter IPs. */
async function ebayScrape(q: string): Promise<SourceListing[]> {
  try {
    const r = await fetch(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_BIN=1&LH_ItemCondition=1000&_sop=15&_ipg=60`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html" },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: SourceListing[] = [];
    const re = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 30) {
      const b = m[1];
      const t = b.match(/s-item__title[^>]*>(?:<span[^>]*>)?([\s\S]*?)<\//)?.[1]?.replace(/<[^>]*>/g, "").trim();
      const p = b.match(/s-item__price[^>]*>[^\d]*([\d,]+\.\d{2})/)?.[1];
      const u = b.match(/s-item__link[^"]*"[^>]+href="(https:[^"]+)"/)?.[1];
      if (t && p && u && !/shop on ebay/i.test(t)) out.push({ source: "ebay", title: t, price: parseFloat(p.replace(/,/g, "")), currency: "USD", url: u.split("?")[0], inStock: true });
    }
    return out;
  } catch {
    return [];
  }
}

export type RefreshResult = { groups: string[]; products: number; listings: number; sources: Record<string, number>; nextOffset: number; done: boolean };

/**
 * Refresh one batch of TCGplayer groups (newest first).
 * kinds: which product kinds to write. Sealed items also fan out to Shopify stores + eBay.
 */
export async function refreshBatch(opts: { offset: number; limit: number; kinds: ("sealed" | "single")[]; external: boolean }): Promise<RefreshResult> {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: ruleRows } = await sb.from("shop_markup_rules").select("min_price,max_price,flat_usd,percent,min_profit_usd,fixed_price_usd").eq("active", true);
  const rules: MarkupRule[] = ruleRows?.length ? (ruleRows as MarkupRule[]) : DEFAULT_MARKUP_RULES;
  const { data: ps } = await sb.from("shop_state").select("value").eq("key", "pricing").maybeSingle();
  const pricing: PricingSettings = normalizePricing(ps?.value);
  const gj = (await getJson(`${TCGCSV}/groups`)) as { results: Group[] } | null;
  const groups = (gj?.results ?? []).sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
  const batch = groups.slice(opts.offset, opts.offset + opts.limit);
  const sources: Record<string, number> = {};
  let nProducts = 0, nListings = 0;

  for (const g of batch) {
    const [pj, prj] = await Promise.all([getJson(`${TCGCSV}/${g.groupId}/products`), getJson(`${TCGCSV}/${g.groupId}/prices`)]);
    const products = ((pj as { results?: TProduct[] })?.results ?? []);
    const prices = new Map<number, TPrice>();
    const allPrices = new Map<number, TPrice[]>();
    for (const p of ((prj as { results?: TPrice[] })?.results ?? [])) {
      allPrices.set(p.productId, [...(allPrices.get(p.productId) ?? []), p]);
      const cur = prices.get(p.productId);
      const v = p.lowPrice ?? p.marketPrice;
      if (v != null && (!cur || v < (cur.lowPrice ?? cur.marketPrice ?? Infinity))) prices.set(p.productId, p);
    }
    const setName = cleanSetName(g.name);
    // Sellers claimed by a recent sale stay skipped until the hold ends (see shop_rotate_after_sale).
    const claims = new Map<string, Map<string, string | null>>();
    const ids = products.map((p) => `tcgp:${p.productId}`);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: cl } = await sb.from("shop_listings").select("product_id,source,claimed_at").in("product_id", ids.slice(i, i + 200)).not("claimed_at", "is", null);
      for (const c of cl ?? []) claims.set(c.product_id, (claims.get(c.product_id) ?? new Map()).set(c.source, c.claimed_at));
    }
    const productRows: Record<string, unknown>[] = [];
    const listingRows: Record<string, unknown>[] = [];
    const variantRows: Record<string, unknown>[] = [];

    for (const p of products) {
      const number = p.extendedData.find((e) => e.name === "Number")?.value;
      const kind = number ? "single" : sealedType(p.name) ? "sealed" : null;
      if (!kind || !opts.kinds.includes(kind)) continue;
      const pr = prices.get(p.productId);
      const tcgPrice = pr?.lowPrice ?? pr?.marketPrice ?? null;
      const type = kind === "single" ? "card" : sealedType(p.name)!;
      const listings: SourceListing[] = [];
      if (tcgPrice) listings.push({ source: "tcgplayer", title: p.name, price: tcgPrice, currency: "USD", url: p.url, inStock: true });

      if (kind === "sealed" && opts.external && TYPE_QUERY[type] && !/\[|display|case/i.test(p.name)) {
        const q = `${setName} ${TYPE_QUERY[type]}`;
        const ext = [...(await shopifySearch(q)), ...(await ebayBrowse(`pokemon ${q} sealed`))];
        if (!ext.some((l) => l.source === "ebay")) ext.push(...(await ebayScrape(`pokemon ${q} sealed`)));
        const bySource = new Map<string, SourceListing[]>();
        for (const l of ext) if (titleMatches(l.title, setName, type) && !/empty|opened|no packs|case of/i.test(l.title)) bySource.set(l.source, [...(bySource.get(l.source) ?? []), l]);
        for (const ls of bySource.values()) { const c = cheapest(ls) ?? [...ls].sort((a, b) => a.price - b.price)[0]; if (c) listings.push(c); }
      }

      const id = `tcgp:${p.productId}`;
      const best = cheapestUnclaimed(listings, claims.get(id));
      const bestUsd = best ? toUsd(best.price, best.currency) : null;
      productRows.push({
        id, kind, product_type: type, name: p.name, set_name: setName, card_number: number ?? null, image_url: p.imageUrl,
        match_key: kind === "sealed" ? sealedMatchKey(setName, type) : null,
        cheapest_source_price: bestUsd, cheapest_source: best?.source ?? null, cheapest_source_url: best?.url ?? null,
        sale_price: bestUsd != null ? salePrice(bestUsd, rules, pricing) : null, in_stock: !!best, updated_at: new Date().toISOString(),
      });
      if (kind === "single") {
        // Raw Near Mint per printing finish. TCGplayer Market Price is based on Near Mint sales; other
        // conditions have no source in tcgcsv, so they are not created (never invented).
        for (const v of allPrices.get(p.productId) ?? []) {
          const src = v.marketPrice ?? v.lowPrice;
          if (!src || src <= 0) continue;
          variantRows.push({
            id: variantId(id, v.subTypeName || "Normal", "RAW", "NM"), product_id: id, finish: v.subTypeName || "Normal", grader: "RAW", grade: "NM",
            source: "tcgplayer", source_price: src, source_url: p.url, sample_size: null, sale_price: salePrice(src, rules, pricing),
            price_status: "priced", updated_at: new Date().toISOString(),
          });
        }
      }
      for (const l of listings) {
        sources[l.source] = (sources[l.source] ?? 0) + 1;
        listingRows.push({ product_id: id, source: l.source, source_title: l.title.slice(0, 300), source_price: l.price, currency: l.currency, source_url: l.url, in_stock: l.inStock, updated_at: new Date().toISOString() });
      }
    }
    for (let i = 0; i < productRows.length; i += 500) {
      const { error } = await sb.from("shop_products").upsert(productRows.slice(i, i + 500));
      if (error) throw new Error(`shop_products upsert: ${error.message}`);
    }
    for (let i = 0; i < listingRows.length; i += 500) {
      const { error } = await sb.from("shop_listings").upsert(listingRows.slice(i, i + 500));
      if (error) throw new Error(`shop_listings upsert: ${error.message}`);
    }
    for (let i = 0; i < variantRows.length; i += 500) {
      const { error } = await sb.from("shop_variants").upsert(variantRows.slice(i, i + 500));
      if (error) throw new Error(`shop_variants upsert: ${error.message}`);
    }
    nProducts += productRows.length; nListings += listingRows.length;
  }
  const nextOffset = opts.offset + batch.length;
  return { groups: batch.map((g) => g.name), products: nProducts, listings: nListings, sources, nextOffset, done: nextOffset >= groups.length };
}

export type GradeRefreshResult = { products: { id: string; name: string; priced: string[]; onRequest: string[] }[]; status: SourceStatus };

/** Fetch graded prices for the given single-card products. Grades without data become "price on request" (PSA 10/9 only). */
export async function refreshGrades(productIds: string[]): Promise<GradeRefreshResult> {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: ruleRows } = await sb.from("shop_markup_rules").select("min_price,max_price,flat_usd,percent,min_profit_usd,fixed_price_usd").eq("active", true);
  const rules: MarkupRule[] = ruleRows?.length ? (ruleRows as MarkupRule[]) : DEFAULT_MARKUP_RULES;
  const { data: ps } = await sb.from("shop_state").select("value").eq("key", "pricing").maybeSingle();
  const pricing = normalizePricing(ps?.value);
  const { data: prods } = await sb.from("shop_products").select("id,name,card_number,set_name,kind").in("id", productIds.slice(0, 25));
  const out: GradeRefreshResult = { products: [], status: {} };
  for (const p of prods ?? []) {
    if (p.kind !== "single") continue;
    const { quotes, status } = await fetchGradeQuotes({ name: p.name, number: p.card_number, setName: p.set_name });
    for (const [k, v] of Object.entries(status)) if (out.status[k] !== "ok") out.status[k] = v;
    const now = new Date().toISOString();
    const rows = quotes.map((q) => ({
      id: variantId(p.id, "Normal", q.grader, q.grade), product_id: p.id, finish: "Normal", grader: q.grader, grade: q.grade,
      source: q.source, source_price: q.price, source_url: q.url, sample_size: q.samples || null,
      sale_price: salePrice(q.price, rules, pricing), price_status: "priced", updated_at: now,
    }));
    const have = new Set(rows.map((r) => `${r.grader}|${r.grade}`));
    const { data: existing } = await sb.from("shop_variants").select("grader,grade,price_status").eq("product_id", p.id);
    const pricedBefore = new Set((existing ?? []).filter((e) => e.price_status === "priced").map((e) => `${e.grader}|${e.grade}`));
    const onRequest = (["10", "9"] as const).filter((g) => !have.has(`PSA|${g}`) && !pricedBefore.has(`PSA|${g}`));
    for (const g of onRequest) rows.push({ id: variantId(p.id, "Normal", "PSA", g), product_id: p.id, finish: "Normal", grader: "PSA", grade: g, source: null as never, source_price: null as never, source_url: null, sample_size: null, sale_price: null as never, price_status: "on_request", updated_at: now });
    if (rows.length) {
      const { error } = await sb.from("shop_variants").upsert(rows);
      if (error) throw new Error(`shop_variants upsert: ${error.message}`);
    }
    out.products.push({ id: p.id, name: p.name, priced: quotes.map((q) => `${q.grader} ${q.grade} $${q.price} (${q.source}${q.samples > 1 ? `, n=${q.samples}` : ""})`), onRequest: onRequest.map((g) => `PSA ${g}`) });
  }
  return out;
}
