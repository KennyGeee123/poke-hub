// Multi-source Pokémon card price aggregator.
// GET /api/public/card-prices?q=<card name set number>
// Fans out to many marketplaces in parallel, returns lowest-price listings
// from each source plus a global "cheapest right now" pick.
import { createFileRoute } from "@tanstack/react-router";

export type Listing = {
  source: string;
  title: string;
  price: number;       // USD (best effort conversion)
  priceRaw: string;    // Original price text
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
  queue: Listing[];
  sources: SourceResult[];
  generatedAt: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36";

function tcgIoHeaders(): Record<string, string> {
  const key = process.env.POKEMONTCG_API_KEY || process.env.VITE_POKEMONTCG_API_KEY;
  return key ? { "X-Api-Key": key } : {};
}

const enc = encodeURIComponent;

// Conservative FX so EUR/GBP listings can still be compared. Updated infrequently.
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, JPY: 0.0064 };

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function detectCurrency(text: string): string {
  if (/€|EUR/i.test(text)) return "EUR";
  if (/£|GBP/i.test(text)) return "GBP";
  if (/CA\$|C\$/i.test(text)) return "CAD";
  if (/A\$/i.test(text)) return "AUD";
  if (/¥|JPY/i.test(text)) return "JPY";
  return "USD";
}

function parsePriceUSD(text: string): { value: number | null; currency: string } {
  const currency = detectCurrency(text);
  const m = text.replace(/,/g, "").match(/[\d]+\.?\d*/);
  if (!m) return { value: null, currency };
  const raw = parseFloat(m[0]);
  if (!isFinite(raw) || raw <= 0) return { value: null, currency };
  const rate = FX[currency] ?? 1;
  return { value: Math.round(raw * rate * 100) / 100, currency };
}

async function withTimeout<T>(p: Promise<T>, ms = 7000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

// ─── eBay active (Buy It Now, ascending price) ────────────────────────────
async function ebayActive(q: string): Promise<Listing[]> {
  const isSealed = /booster\s*box|booster\s*display|elite\s*trainer|booster\s*bundle/i.test(q);
  // Sealed: drop the "pokemon card" suffix (singles bias) and use Sealed Booster Boxes cat 183455.
  const nkw = isSealed ? q : `${q} pokemon card`;
  const cat = isSealed ? "183455" : "183454";
  const url = `https://www.ebay.com/sch/i.html?_nkw=${enc(nkw)}&_sacat=${cat}&LH_BIN=1&_sop=15&_ipg=60`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 20) {
    const block = m[1];
    const title = block.match(/s-item__title[^>]*>(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?<\/div>/);
    const priceM = block.match(/s-item__price[^>]*>([\s\S]*?)<\/span>/);
    const urlM = block.match(/s-item__link[^"]*"[^>]+href="([^"]+)"/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    const shipM = block.match(/s-item__shipping[^>]*>([\s\S]*?)<\/span>/);
    if (!title || !priceM || !urlM) continue;
    const t = stripTags(title[1]);
    if (!t || /shop on ebay/i.test(t)) continue;
    const priceText = stripTags(priceM[1]).split(/to|–|-/i)[0].trim();
    const { value, currency } = parsePriceUSD(priceText);
    if (value === null) continue;
    const shipText = shipM ? stripTags(shipM[1]) : "";
    const shipping = /free/i.test(shipText) ? 0 : parsePriceUSD(shipText).value;
    out.push({
      source: "eBay",
      title: t,
      price: value,
      priceRaw: priceText,
      currency,
      url: urlM[1],
      image: imgM?.[1] ?? null,
      shipping,
    });
  }
  return out;
}

// ─── TCGplayer (via pokemontcg.io card data) ─────────────────────────────

function parseCardQuery(q: string): { firstToken: string; number: string | null; setTokens: string[]; lucene: string } {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  const firstToken = (tokens[0] || "").replace(/[*"\\]/g, "");
  let number: string | null = null;
  let rest = tokens.slice(1);
  if (rest.length) {
    const last = rest[rest.length - 1];
    const m = last.match(/^#?(\d{1,4}[a-zA-Z]?)(?:\/\d{1,4})?$/);
    if (m) {
      number = m[1];
      rest = rest.slice(0, -1);
    }
  }
  const setTokens = rest.map((tok) => tok.replace(/[*"\\]/g, "")).filter(Boolean);
  let lucene = firstToken ? `name:"${firstToken}"` : "";
  if (number) lucene = `${lucene} number:${number}`.trim();
  return { firstToken, number, setTokens, lucene };
}

function sameCardNumber(a: unknown, b: string | null): boolean {
  if (!b) return true;
  const n = String(a ?? "").replace(/^0+/, "") || "0";
  const m = b.replace(/^0+/, "") || "0";
  return n.toLowerCase() === m.toLowerCase();
}

function filterExactPrintings(cards: any[], q: string): any[] {
  const { firstToken, number, setTokens } = parseCardQuery(q);
  const first = firstToken.toLowerCase();
  return cards.filter((c) => {
    const name = String(c?.name || "").toLowerCase();
    if (first && !name.startsWith(first)) return false;
    if (!sameCardNumber(c?.number, number)) return false;
    if (setTokens.length) {
      const setName = String(c?.set?.name || "").toLowerCase();
      if (!setTokens.every((tok) => setName.includes(tok.toLowerCase()))) return false;
    }
    return true;
  });
}

async function tcgplayer(q: string): Promise<Listing[]> {
  const parsed = parseCardQuery(q);
  const lucene = parsed.lucene || `name:"${(q.split(/\s+/)[0] || q).replace(/[*"\\]/g, "")}"`;
  const params = new URLSearchParams({ q: lucene, pageSize: "20" });
  const r = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    headers: tcgIoHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const j: any = await r.json();
  const out: Listing[] = [];
  for (const c of filterExactPrintings((j?.data ?? []) as any[], q)) {
    const tp = c.tcgplayer;
    if (!tp?.url || !tp?.prices) continue;
    const variants = Object.entries(tp.prices) as [string, any][];
    let bestPrice = Infinity;
    let variantName = "";
    for (const [name, p] of variants) {
      const val = p?.low ?? p?.directLow;
      if (typeof val === "number" && val > 0 && val < bestPrice) {
        bestPrice = val;
        variantName = name;
      }
    }
    if (!isFinite(bestPrice)) continue;
    out.push({
      source: "TCGplayer",
      title: `${c.name} — ${c.set?.name ?? ""} #${c.number ?? ""} (${variantName})`.trim(),
      price: Math.round(bestPrice * 100) / 100,
      priceRaw: `$${bestPrice.toFixed(2)}`,
      currency: "USD",
      url: tp.url,
      image: c.images?.small ?? null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 10);
}

// ─── Cardmarket (EU) via card index ───────────────────────────────────────
async function cardmarket(q: string): Promise<Listing[]> {
  const parsed = parseCardQuery(q);
  const lucene = parsed.lucene || `name:"${(q.split(/\s+/)[0] || q).replace(/[*"\\]/g, "")}"`;
  const params = new URLSearchParams({ q: lucene, pageSize: "20" });
  const r = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    headers: tcgIoHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const j: any = await r.json();
  const out: Listing[] = [];
  for (const c of filterExactPrintings((j?.data ?? []) as any[], q)) {
    const cm = c.cardmarket;
    if (!cm?.url || !cm?.prices) continue;
    const eur = cm.prices.lowPrice ?? cm.prices.trendPrice ?? cm.prices.averageSellPrice;
    if (typeof eur !== "number" || eur <= 0) continue;
    out.push({
      source: "Cardmarket",
      title: `${c.name} — ${c.set?.name ?? ""} #${c.number ?? ""}`,
      price: Math.round(eur * (FX.EUR ?? 1) * 100) / 100,
      priceRaw: `€${eur.toFixed(2)}`,
      currency: "EUR",
      url: cm.url,
      image: c.images?.small ?? null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 10);
}

// ─── TrollAndToad ─────────────────────────────────────────────────────────
async function trollAndToad(q: string): Promise<Listing[]> {
  const url = `https://www.trollandtoad.com/category.php?selected-cat=0&search-words=${enc(q)}`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<div[^>]*class="[^"]*product-col[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 15) {
    const block = m[1];
    const titleM = block.match(/class="card-text[^"]*"[^>]*>([\s\S]*?)<\/a>/) ||
                   block.match(/<a[^>]+href="([^"]+product-detail[^"]+)"[^>]*>([^<]+)<\/a>/);
    const priceM = block.match(/\$([\d.]+)/);
    const urlM = block.match(/href="(\/[^"]*product-detail[^"]*)"/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleM || !priceM || !urlM) continue;
    const title = stripTags(titleM[titleM.length - 1] ?? titleM[1]);
    const price = parseFloat(priceM[1]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "TrollAndToad",
      title,
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.trollandtoad.com${urlM[1]}`,
      image: imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https://www.trollandtoad.com${imgM[1]}`) : null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 8);
}

// ─── CardKingdom ──────────────────────────────────────────────────────────
async function cardKingdom(q: string): Promise<Listing[]> {
  const url = `https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${enc(q)}&filter%5Bcategory%5D=pokemon`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<div[^>]*class="[^"]*productItemWrapper[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 15) {
    const block = m[1];
    const titleM = block.match(/class="productDetailTitle[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const priceM = block.match(/class="stylePrice"[^>]*>\$([\d.]+)/) ||
                   block.match(/\$([\d.]+)/);
    const urlM = block.match(/<a[^>]+href="(\/[^"]+)"/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleM || !priceM || !urlM) continue;
    const title = stripTags(titleM[1]);
    const price = parseFloat(priceM[1]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "CardKingdom",
      title,
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.cardkingdom.com${urlM[1]}`,
      image: imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https://www.cardkingdom.com${imgM[1]}`) : null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 8);
}

// ─── Mercari ──────────────────────────────────────────────────────────────
async function mercari(q: string): Promise<Listing[]> {
  const url = `https://www.mercari.com/search/?keyword=${enc(q + " pokemon card")}&sortBy=2&itemStatuses=1`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  // Mercari embeds JSON. Try to extract item objects.
  const re = /"name":"([^"]{8,160})"[^}]*?"price":(\d+)[^}]*?"id":"([a-z0-9]+)"[^}]*?"photos?":\[?{?"url":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 12) {
    const title = m[1].replace(/\\u0026/g, "&");
    if (!/pok[eé]?mon|pokémon|tcg/i.test(title)) continue;
    const price = parseInt(m[2], 10);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Mercari",
      title,
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.mercari.com/us/item/${m[3]}/`,
      image: m[4],
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 8);
}

// ─── PriceCharting ────────────────────────────────────────────────────────
async function priceCharting(q: string): Promise<Listing[]> {
  const url = `https://www.pricecharting.com/search-products?q=${enc(q)}&type=prices`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<tr[^>]*class="[^"]*offer[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const block = m[1];
    const titleM = block.match(/<a[^>]+href="(\/game\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const priceM = block.match(/\$([\d.]+)/);
    if (!titleM || !priceM) continue;
    const price = parseFloat(priceM[1]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "PriceCharting",
      title: stripTags(titleM[2]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.pricecharting.com${titleM[1]}`,
      image: null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── 123Pokemon (Sweden, ships worldwide) ────────────────────────────────
async function pokemon123(q: string): Promise<Listing[]> {
  const url = `https://www.123pokemon.com/?s=${enc(q)}&post_type=product`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const block = m[1];
    const titleM = block.match(/woocommerce-loop-product__title[^>]*>([^<]+)</);
    const urlM = block.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*woocommerce-LoopProduct-link/);
    const priceText = block.match(/<span class="woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleM || !priceText || !urlM) continue;
    const { value, currency } = parsePriceUSD(stripTags(priceText[1]));
    if (value === null) continue;
    out.push({
      source: "123Pokemon",
      title: stripTags(titleM[1]),
      price: value,
      priceRaw: stripTags(priceText[1]),
      currency,
      url: urlM[1],
      image: imgM?.[1] ?? null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Pokemon Center (official) ────────────────────────────────────────────
async function pokemonCenter(q: string): Promise<Listing[]> {
  const url = `https://www.pokemoncenter.com/search?q=${enc(q)}`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<a[^>]+href="(\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    const block = m[2];
    const titleM = block.match(/>([^<]{6,160})</);
    const priceM = block.match(/\$([\d.]+)/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleM || !priceM) continue;
    const price = parseFloat(priceM[1]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Pokemon Center",
      title: stripTags(titleM[1]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.pokemoncenter.com${m[1]}`,
      image: imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https:${imgM[1]}`) : null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── CoolStuffInc ─────────────────────────────────────────────────────────
async function coolStuffInc(q: string): Promise<Listing[]> {
  const url = `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&page=1&resultsPerPage=24&q=${enc(q)}&gamename=Pokemon`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<div[^>]*class="[^"]*main_results[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const block = m[1];
    const titleM = block.match(/<a[^>]+href="(\/p\/[^"]+)"[^>]*>([^<]+)<\/a>/);
    const priceM = block.match(/\$([\d.]+)/);
    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleM || !priceM) continue;
    const price = parseFloat(priceM[1]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "CoolStuffInc",
      title: stripTags(titleM[2]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.coolstuffinc.com${titleM[1]}`,
      image: imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https://www.coolstuffinc.com${imgM[1]}`) : null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Amazon (search results page) ─────────────────────────────────────────
async function amazon(q: string): Promise<Listing[]> {
  const url = `https://www.amazon.com/s?k=${enc(q + " pokemon card")}&i=toys-and-games&s=price-asc-rank`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /data-asin="([A-Z0-9]{10})"[\s\S]*?<span class="a-offscreen">\$([\d.]+)<\/span>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span[^>]+class="[^"]*a-text-normal[^"]*"[^>]*>([^<]{6,200})</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    const price = parseFloat(m[2]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Amazon",
      title: stripTags(m[4]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.amazon.com/dp/${m[1]}`,
      image: m[3],
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Whatnot (live auctions) ─────────────────────────────────────────────
async function whatnot(q: string): Promise<Listing[]> {
  const url = `https://www.whatnot.com/search/${enc(q)}?category=trading-card-games`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /"title":"([^"]{6,160})"[\s\S]{0,400}?"price":\{[^}]*?"amount":(\d+)[^}]*?"currency":"([A-Z]{3})"[\s\S]{0,400}?"slug":"([a-z0-9-]+)"[\s\S]{0,400}?"url":"([^"]+\.(?:jpg|png|webp)[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    const title = m[1].replace(/\\u0026/g, "&");
    const raw = parseInt(m[2], 10) / 100;
    if (!isFinite(raw) || raw <= 0) continue;
    const rate = FX[m[3]] ?? 1;
    out.push({
      source: "Whatnot",
      title,
      price: Math.round(raw * rate * 100) / 100,
      priceRaw: `${m[3] === "USD" ? "$" : m[3] + " "}${raw.toFixed(2)}`,
      currency: m[3],
      url: `https://www.whatnot.com/listing/${m[4]}`,
      image: m[5],
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Generic Shopify product scraper (used by sealed-product shops) ───────
async function shopScrape(name: string, base: string, path: string): Promise<Listing[]> {
  const html = await fetchHtml(base + path);
  const out: Listing[] = [];
  const re = /<a[^>]+href="(\/products\/[^"#?]+)[^"]*"[^>]*>[\s\S]{0,1400}?<img[^>]+src="([^"]+)"[\s\S]{0,1400}?<\/a>[\s\S]{0,800}?([A-Za-z][^<>{}]{6,160})[\s\S]{0,800}?\$([\d,]+\.?\d*)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) && out.length < 8) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const price = parseFloat(m[4].replace(/,/g, ""));
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: name,
      title: stripTags(m[3]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: m[1].startsWith("http") ? m[1] : base + m[1],
      image: m[2].startsWith("http") ? m[2] : m[2].startsWith("//") ? "https:" + m[2] : base + m[2],
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Dave & Adam's ────────────────────────────────────────────────────────
async function daveAndAdams(q: string): Promise<Listing[]> {
  const url = `https://www.dacardworld.com/gaming/search?keywords=${enc(q)}`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<a[^>]+href="(\/gaming\/[^"]+)"[^>]*>([^<]{6,200})<\/a>[\s\S]{0,600}?\$([\d,]+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const price = parseFloat(m[3].replace(/,/g, ""));
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Dave & Adam's",
      title: stripTags(m[2]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: `https://www.dacardworld.com${m[1]}`,
      image: null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

async function steelCity(q: string): Promise<Listing[]> {
  return shopScrape("Steel City", "https://www.steelcitycollectibles.com", `/search?q=${enc(q)}`);
}

async function channelFireball(q: string): Promise<Listing[]> {
  return shopScrape("ChannelFireball", "https://store.channelfireball.com", `/search?q=${enc(q + " pokemon")}`);
}

// ─── Miniature Market ─────────────────────────────────────────────────────
async function miniatureMarket(q: string): Promise<Listing[]> {
  const url = `https://www.miniaturemarket.com/catalogsearch/result/?q=${enc(q)}`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /<a[^>]+class="product-item-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1500}?data-price-amount="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    const price = parseFloat(m[3]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Miniature Market",
      title: stripTags(m[2]),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: m[1],
      image: null,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Target (Redsky search API) ───────────────────────────────────────────
async function target(q: string): Promise<Listing[]> {
  const url = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&keyword=${enc(q + " pokemon")}&page=%2Fs%2F${enc(q)}&count=24`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status}`);
  const j: any = await r.json();
  const items = j?.data?.search?.products ?? [];
  const out: Listing[] = [];
  for (const p of items) {
    const price = p?.price?.current_retail ?? p?.price?.reg_retail;
    const title = p?.item?.product_description?.title;
    const tcin = p?.tcin;
    if (!price || !title || !tcin) continue;
    out.push({
      source: "Target",
      title: stripTags(title),
      price: Number(price),
      priceRaw: `$${Number(price).toFixed(2)}`,
      currency: "USD",
      url: `https://www.target.com/p/-/A-${tcin}`,
      image: p?.item?.enrichment?.images?.primary_image_url ?? null,
    });
    if (out.length >= 8) break;
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Walmart ──────────────────────────────────────────────────────────────
async function walmart(q: string): Promise<Listing[]> {
  const url = `https://www.walmart.com/search?q=${enc(q + " pokemon")}&sort=price_low`;
  const html = await fetchHtml(url);
  const out: Listing[] = [];
  const re = /"name":"([^"]{6,180})"[\s\S]{0,400}?"price":(\d+\.?\d*)[\s\S]{0,400}?"canonicalUrl":"([^"]+)"[\s\S]{0,400}?"thumbnailUrl":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const price = parseFloat(m[2]);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      source: "Walmart",
      title: m[1].replace(/\\u0026/g, "&"),
      price,
      priceRaw: `$${price.toFixed(2)}`,
      currency: "USD",
      url: m[3].startsWith("http") ? m[3] : `https://www.walmart.com${m[3]}`,
      image: m[4].replace(/\\u002F/g, "/"),
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 6);
}

// ─── Source registry ──────────────────────────────────────────────────────
// Priced sources use public APIs that work from Vercel. Storefront HTML
// scrapes (eBay 403, etc.) are shop-links only — cloud IPs are blocked.
const PRICED: { name: string; fn: (q: string) => Promise<Listing[]>; sealed?: boolean }[] = [
  { name: "TCGplayer", fn: tcgplayer },
  { name: "Cardmarket", fn: cardmarket },
  { name: "Target", fn: target, sealed: true },
];

function shopUrl(name: string, q: string): string {
  const nkw = enc(q);
  switch (name) {
    case "eBay":
      return `https://www.ebay.com/sch/i.html?_nkw=${enc(q + " pokemon card")}&_sacat=183454&LH_BIN=1&_sop=15`;
    case "TrollAndToad":
      return `https://www.trollandtoad.com/category.php?selected-cat=0&search-words=${nkw}`;
    case "CardKingdom":
      return `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${nkw}`;
    case "Mercari":
      return `https://www.mercari.com/search/?keyword=${nkw}`;
    case "PriceCharting":
      return `https://www.pricecharting.com/search-products?q=${nkw}&type=prices`;
    case "123Pokemon":
      return `https://123pokemon.com/search?q=${nkw}`;
    case "Pokemon Center":
      return `https://www.pokemoncenter.com/search/${nkw}`;
    case "CoolStuffInc":
      return `https://www.coolstuffinc.com/main_search.php?pa=searchOnLoad&page=1&resultsPerPage=25&q=${nkw}`;
    case "Amazon":
      return `https://www.amazon.com/s?k=${nkw}`;
    case "Whatnot":
      return `https://www.whatnot.com/search?q=${nkw}`;
    case "Dave & Adam's":
      return `https://www.dacardworld.com/search?q=${nkw}`;
    case "Steel City":
      return `https://www.steelcitycollectibles.com/search?q=${nkw}`;
    case "Miniature Market":
      return `https://www.miniaturemarket.com/catalogsearch/result/?q=${nkw}`;
    case "ChannelFireball":
      return `https://store.channelfireball.com/search?q=${nkw}`;
    case "Walmart":
      return `https://www.walmart.com/search?q=${enc(q + " pokemon")}`;
    default:
      return `https://www.google.com/search?q=${enc(q + " " + name)}`;
  }
}

const SHOP_NAMES = [
  "eBay", "TrollAndToad", "CardKingdom", "Mercari", "PriceCharting",
  "123Pokemon", "Pokemon Center", "CoolStuffInc", "Amazon", "Whatnot",
  "Dave & Adam's", "Steel City", "Miniature Market", "ChannelFireball", "Walmart",
];

async function tcgIoById(id: string): Promise<Listing[]> {
  let last = "error";
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards/${enc(id)}`, {
        headers: tcgIoHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 429 || r.status >= 500) {
        last = String(r.status);
        await new Promise((res) => setTimeout(res, 400 * (i + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`${r.status}`);
      const j: any = await r.json();
      const c = j?.data;
      if (!c) return [];
      const q = `${c.name} ${c.set?.name ?? ""} ${c.number ?? ""}`.trim();
      const [tp, cm] = await Promise.all([
        (async () => {
          const fakeQ = q;
          // Reuse parsers by synthesizing from this card only
          const listings: Listing[] = [];
          const tcg = c.tcgplayer;
          if (tcg?.url && tcg?.prices) {
            for (const [name, p] of Object.entries(tcg.prices) as [string, any][]) {
              const val = p?.low ?? p?.directLow; // listed buy-now, never 24h market avg
              if (typeof val !== "number" || val <= 0) continue;
              listings.push({
                source: "TCGplayer",
                title: `${c.name} — ${c.set?.name ?? ""} #${c.number ?? ""} (${name})`.trim(),
                price: Math.round(val * 100) / 100,
                priceRaw: `$${val.toFixed(2)}`,
                currency: "USD",
                url: tcg.url,
                image: c.images?.small ?? null,
                condition: name,
              });
            }
          }
          const cmkt = c.cardmarket;
          if (cmkt?.url && cmkt?.prices) {
            const eur = cmkt.prices.lowPrice ?? cmkt.prices.trendPrice ?? cmkt.prices.averageSellPrice;
            if (typeof eur === "number" && eur > 0) {
              listings.push({
                source: "Cardmarket",
                title: `${c.name} — ${c.set?.name ?? ""} #${c.number ?? ""}`,
                price: Math.round(eur * (FX.EUR ?? 1) * 100) / 100,
                priceRaw: `€${eur.toFixed(2)}`,
                currency: "EUR",
                url: cmkt.url,
                image: c.images?.small ?? null,
              });
            }
          }
          return listings;
        })(),
        Promise.resolve([] as Listing[]),
      ]);
      return tp;
    } catch (e) {
      last = String((e as Error).message || e);
    }
  }
  throw new Error(last);
}

export const Route = createFileRoute("/api/public/card-prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").slice(0, 200).trim();
        const cardId = (url.searchParams.get("id") ?? "").trim();
        if (!q && !cardId) return Response.json({ error: "Missing q parameter" }, { status: 400 });
        const cheapOnly = url.searchParams.get("cheap") === "1";
        const fresh = url.searchParams.get("fresh") === "1";
        const sealed = url.searchParams.get("sealed") === "1" || /booster\s*box|elite\s*trainer|booster\s*bundle|booster\s*display/i.test(q);

        const sources: SourceResult[] = [];

        if (cardId && !sealed) {
          try {
            const listings = await withTimeout(tcgIoById(cardId), 10000);
            const bySrc = new Map<string, Listing[]>();
            for (const l of listings) {
              const arr = bySrc.get(l.source) ?? [];
              arr.push(l);
              bySrc.set(l.source, arr);
            }
            for (const [name, ls] of bySrc) {
              const ranked = ls.slice().sort((a, b) => (a.price + (a.shipping ?? 0)) - (b.price + (b.shipping ?? 0)));
              sources.push({
                source: name,
                ok: ranked.length > 0,
                count: ranked.length,
                lowest: ranked[0] ?? null,
                listings: ranked,
              });
            }
          } catch (e) {
            sources.push({
              source: "TCGplayer",
              ok: false,
              count: 0,
              lowest: null,
              listings: [],
              error: String((e as Error).message || e),
            });
          }
        } else {
          let priced = sealed ? PRICED.filter((s) => s.sealed) : PRICED;
          if (cheapOnly) priced = PRICED.filter((s) => s.name === "TCGplayer" || s.name === "Cardmarket");
          const settled = await Promise.allSettled(
            priced.map(async (src) => {
              try {
                const listings = await withTimeout(src.fn(q || cardId), cheapOnly ? 5000 : 8000);
                return { src, listings };
              } catch (e) {
                return { src, listings: [] as Listing[], error: String((e as Error).message || e) };
              }
            }),
          );
          for (const s of settled) {
            if (s.status === "rejected") {
              sources.push({ source: "?", ok: false, count: 0, lowest: null, listings: [], error: String(s.reason) });
              continue;
            }
            const { src, listings, error } = s.value as any;
            const ranked = listings.slice().sort(
              (a: Listing, b: Listing) => (a.price + (a.shipping ?? 0)) - (b.price + (b.shipping ?? 0)),
            );
            sources.push({
              source: src.name,
              ok: ranked.length > 0,
              count: ranked.length,
              lowest: ranked[0] ?? null,
              listings: ranked,
              error,
            });
          }
        }

        if (!cheapOnly) {
          for (const name of SHOP_NAMES) {
            if (sealed && name === "PriceCharting") continue;
            sources.push({
              source: name,
              ok: true,
              count: 0,
              lowest: null,
              listings: [],
              shopUrl: shopUrl(name, q || cardId),
              kind: "shop",
            } as SourceResult);
          }
        }

        const all = sources.flatMap((s) => s.listings).filter((l) => l.price > 0);
        const considered = sealed ? all.filter((l) => (l.price + (l.shipping ?? 0)) >= 40) : all;
        const ranked = considered.slice().sort(
          (a, b) => (a.price + (a.shipping ?? 0)) - (b.price + (b.shipping ?? 0)),
        );
        const seen = new Set<string>();
        const queue: Listing[] = [];
        for (const l of ranked) {
          const id = `${l.source}::${(l.url || "").split("?")[0]}::${l.condition || ""}`;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          queue.push(l);
          if (queue.length >= 8) break;
        }
        const cheapest = queue[0] ?? null;

        const body: AggregateResponse = {
          query: q || cardId,
          cheapest,
          queue,
          sources,
          generatedAt: new Date().toISOString(),
        };
        return Response.json(body, {
          headers: {
            "Cache-Control": fresh ? "no-store" : "private, max-age=20",
          },
        });
      },
    },
  },
});
