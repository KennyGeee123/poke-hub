// Public route: GET /api/public/ebay-sold?q=<query>
// Scrapes eBay's sold/completed listings (no API key required).
import { createFileRoute } from "@tanstack/react-router";

export type SoldListing = {
  title: string;
  price: string;
  priceValue: number | null;
  currency: string;
  soldDate: string | null;
  url: string;
  image: string | null;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function parseListings(html: string): SoldListing[] {
  const items: SoldListing[] = [];
  // Each result item is wrapped in <li class="s-item ..."> ... </li>
  const itemRegex = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(html)) && items.length < 20) {
    const block = m[1];
    if (!/s-item__title/.test(block)) continue;

    const titleMatch = block.match(/<div[^>]*class="[^"]*s-item__title[^"]*"[^>]*>(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?<\/div>/);
    const priceMatch = block.match(/<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const urlMatch = block.match(/<a[^>]+class="[^"]*s-item__link[^"]*"[^>]+href="([^"]+)"/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const soldMatch = block.match(/Sold\s+([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/);

    if (!titleMatch || !priceMatch) continue;
    const title = stripTags(titleMatch[1]);
    if (!title || /shop on ebay/i.test(title)) continue;
    const priceText = stripTags(priceMatch[1]);
    const numMatch = priceText.match(/[\d,]+\.?\d*/);
    const currMatch = priceText.match(/[A-Z]{1,3}|\$|£|€/);

    items.push({
      title,
      price: priceText,
      priceValue: numMatch ? parseFloat(numMatch[0].replace(/,/g, "")) : null,
      currency: currMatch ? currMatch[0] : "$",
      soldDate: soldMatch ? soldMatch[1] : null,
      url: urlMatch ? urlMatch[1] : "",
      image: imgMatch ? imgMatch[1] : null,
    });
  }
  return items;
}

async function requireAuth(request: Request): Promise<Response | null> {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = auth.slice(7).trim();
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return null;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const Route = createFileRoute("/api/public/ebay-sold")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = await requireAuth(request);
        if (unauthorized) return unauthorized;
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").slice(0, 200);
        if (!q.trim()) {
          return Response.json({ error: "Missing q parameter" }, { status: 400 });
        }
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1&_ipg=60`;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 12000);
        try {
          const upstream = await fetch(ebayUrl, {
            signal: ctl.signal,
            headers: {
              // Mimic a real browser; eBay returns lite HTML otherwise
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
              "Accept": "text/html,application/xhtml+xml",
            },
          });
          if (!upstream.ok) {
            return Response.json(
              { query: q, summary: null, listings: [], error: `eBay responded ${upstream.status}`, errorKind: "upstream" },
              { status: 502 },
            );
          }
          const html = await upstream.text();
          const listings = parseListings(html);
          const prices = listings.map(l => l.priceValue).filter((n): n is number => typeof n === "number" && n > 0);
          const summary = prices.length ? {
            count: prices.length,
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: prices.reduce((a, b) => a + b, 0) / prices.length,
            median: prices.slice().sort((a, b) => a - b)[Math.floor(prices.length / 2)],
          } : null;
          return Response.json({ query: q, summary, listings }, {
            headers: { "Cache-Control": "public, max-age=600" },
          });
        } catch (err) {
          const aborted = (err as Error)?.name === "AbortError";
          return Response.json(
            {
              query: q,
              summary: null,
              listings: [],
              errorKind: aborted ? "timeout" : "network",
              error: aborted
                ? "eBay sold listings timed out after 12s — try again in a moment."
                : `Could not reach eBay: ${String((err as Error)?.message || err).slice(0, 200)}`,
            },
            { status: aborted ? 504 : 502 },
          );
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
