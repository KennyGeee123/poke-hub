// Server-only: grade-specific source prices. Never invents a price — returns only what a source actually reported.
import { GRADERS, MIN_SOLD_SAMPLES, median, parsePriceCharting, titleMatchesGrade, type Grader } from "./grades";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
export type GradeQuote = { grader: Grader; grade: string; price: number; source: "ebay_active" | "ebay_sold" | "pricecharting"; url: string | null; samples: number };
export type CardRef = { name: string; number: string | null; setName: string | null };

/** Grades we look up on eBay (one query per grader, then bucket by exact grade). */
export const EBAY_GRADES: Record<string, string[]> = { PSA: ["10", "9", "8"], BGS: ["10", "9.5", "9"], CGC: ["10", "9.5", "9"], SGC: ["10", "9"] };

function cardQuery(c: CardRef, grader: string): string {
  const base = c.name.replace(/\s*-\s*\d+\/\d+.*$/, "").replace(/\[.*?\]|\(.*?\)/g, " ").trim();
  return `pokemon ${base} ${c.number?.split("/")[0] ?? ""} ${grader}`.replace(/\s+/g, " ").trim();
}

export type SourceStatus = Record<string, "ok" | "no_data" | "blocked" | "no_key" | "error">;

/** eBay sold/completed via HTML (same approach as /api/public/ebay-sold). Often 403 from datacenter IPs. */
async function ebaySold(q: string): Promise<{ status: "ok" | "blocked" | "error"; items: { title: string; price: number; url: string }[] }> {
  try {
    const r = await fetch(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1&_ipg=120`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html" },
    });
    if (r.status === 403 || r.status === 429) return { status: "blocked", items: [] };
    if (!r.ok) return { status: "error", items: [] };
    const html = await r.text();
    const items: { title: string; price: number; url: string }[] = [];
    const re = /<li[^>]*class="[^"]*s-(?:item|card)[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && items.length < 120) {
      const b = m[1];
      const t = b.match(/s-(?:item|card)__title[^>]*>(?:<span[^>]*>)?([\s\S]*?)<\//)?.[1]?.replace(/<[^>]*>/g, "").trim();
      const p = b.match(/s-(?:item|card)__price[^>]*>[^\d]*([\d,]+\.\d{2})/)?.[1];
      const u = b.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"?]+)/)?.[1];
      if (t && p && !/shop on ebay/i.test(t) && !/ to /.test(p)) items.push({ title: t, price: parseFloat(p.replace(/,/g, "")), url: u ?? "" });
    }
    return { status: "ok", items };
  } catch {
    return { status: "error", items: [] };
  }
}

let ebayTok: { v: string; exp: number } | null = null;
async function ebayActive(q: string): Promise<{ status: "ok" | "no_key" | "error"; items: { title: string; price: number; url: string }[] }> {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return { status: "no_key", items: [] };
  try {
    if (!ebayTok || ebayTok.exp < Date.now()) {
      const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
      });
      const j = (await r.json()) as { access_token?: string; expires_in?: number };
      if (!j.access_token) return { status: "error", items: [] };
      ebayTok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 900 };
    }
    const r = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=100`, {
      headers: { Authorization: `Bearer ${ebayTok.v}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    });
    if (!r.ok) return { status: "error", items: [] };
    const j = (await r.json()) as { itemSummaries?: { title: string; price: { value: string; currency: string }; itemWebUrl: string }[] };
    return { status: "ok", items: (j.itemSummaries ?? []).filter((i) => i.price.currency === "USD").map((i) => ({ title: i.title, price: parseFloat(i.price.value), url: i.itemWebUrl })) };
  } catch {
    return { status: "error", items: [] };
  }
}

async function priceCharting(c: CardRef): Promise<{ status: "ok" | "no_key" | "no_data" | "error"; quotes: GradeQuote[] }> {
  const t = process.env.PRICECHARTING_TOKEN;
  if (!t) return { status: "no_key", quotes: [] };
  try {
    const q = `pokemon ${c.setName ?? ""} ${c.name.replace(/\s*-\s*\d+\/\d+.*$/, "")} ${c.number?.split("/")[0] ?? ""}`.replace(/\s+/g, " ").trim();
    const r = await fetch(`https://www.pricecharting.com/api/product?t=${encodeURIComponent(t)}&q=${encodeURIComponent(q)}`);
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!r.ok || !j || j.status === "error") return { status: r.ok ? "no_data" : "error", quotes: [] };
    const url = j.id ? `https://www.pricecharting.com/offer?product=${j.id}` : null;
    const quotes = parsePriceCharting(j).map((x) => ({ ...x, source: "pricecharting" as const, url, samples: 0 }));
    return { status: quotes.length ? "ok" : "no_data", quotes };
  } catch {
    return { status: "error", quotes: [] };
  }
}

/**
 * Collect grade quotes for one card. Preference per grade: eBay active (buyable, cheapest) → eBay sold median (≥3 sales) → PriceCharting.
 * Grades with no data are simply absent (caller may mark them "price on request").
 */
export async function fetchGradeQuotes(c: CardRef): Promise<{ quotes: GradeQuote[]; status: SourceStatus }> {
  const status: SourceStatus = {};
  const byKey = new Map<string, GradeQuote>();
  const put = (q: GradeQuote) => { const k = `${q.grader}|${q.grade}`; if (!byKey.has(k)) byKey.set(k, q); };

  for (const grader of GRADERS) {
    const q = cardQuery(c, grader);
    const [act, sold] = await Promise.all([ebayActive(q), ebaySold(q)]);
    status.ebay_active = status.ebay_active === "ok" ? "ok" : act.status === "ok" ? (act.items.length ? "ok" : "no_data") : act.status;
    status.ebay_sold = status.ebay_sold === "ok" ? "ok" : sold.status === "ok" ? (sold.items.length ? "ok" : "no_data") : sold.status;
    for (const grade of EBAY_GRADES[grader]) {
      const a = act.items.filter((i) => titleMatchesGrade(i.title, c.number, grader, grade)).sort((x, y) => x.price - y.price)[0];
      if (a) put({ grader, grade, price: a.price, source: "ebay_active", url: a.url, samples: 1 });
      const s = sold.items.filter((i) => titleMatchesGrade(i.title, c.number, grader, grade));
      const med = s.length >= MIN_SOLD_SAMPLES ? median(s.map((i) => i.price)) : null;
      if (med != null) put({ grader, grade, price: med, source: "ebay_sold", url: s[0].url || null, samples: s.length });
    }
  }
  const pc = await priceCharting(c);
  status.pricecharting = pc.status;
  for (const q of pc.quotes) put(q);
  return { quotes: [...byKey.values()], status };
}
