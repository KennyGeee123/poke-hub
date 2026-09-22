import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.tcgdex.net/v2";
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, JPY: 0.0064, CAD: 0.73, AUD: 0.66 };

function usd(n: number, unit?: string): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * (FX[(unit || "USD").toUpperCase()] ?? 1) * 100) / 100;
}

function marketFromTcgdex(raw: any): number {
  const unit = String(raw?.pricing?.tcgplayer?.unit || raw?.pricing?.cardmarket?.unit || "USD");
  const tp = raw?.pricing?.tcgplayer;
  if (tp && typeof tp === "object") {
    const order = ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "unlimitedHolofoil", "normal", "unlimited"];
    for (const k of order) {
      const n = usd(Number(tp[k]?.marketPrice ?? tp[k]?.midPrice ?? tp[k]?.lowPrice), tp.unit || unit);
      if (n > 0) return n;
    }
    for (const [k, v] of Object.entries(tp)) {
      if (!v || typeof v !== "object" || k === "updated" || k === "unit" || k === "url") continue;
      const n = usd(Number((v as any).marketPrice ?? (v as any).midPrice ?? (v as any).lowPrice), tp.unit || unit);
      if (n > 0) return n;
    }
  }
  const cm = raw?.pricing?.cardmarket;
  if (cm && typeof cm === "object") {
    const n = usd(Number(cm.trend ?? cm.avg ?? cm.low ?? 0), cm.unit || "EUR");
    if (n > 0) return n;
  }
  return 0;
}

async function quoteTcgplayerProduct(productId: number): Promise<number | null> {
  try {
    const r = await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}?range=quarter`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const variants = j?.result?.[0]?.variants;
    if (!Array.isArray(variants)) return null;
    let best = Infinity;
    for (const v of variants) {
      const n = Number(v.marketPrice);
      if (Number.isFinite(n) && n > 0 && n < best) best = n;
    }
    return Number.isFinite(best) && best < Infinity ? best : null;
  } catch {
    return null;
  }
}

async function quoteOne(id: string): Promise<{ market: number; source: string } | null> {
  try {
    const r = await fetch(`${UPSTREAM}/en/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (r.ok) {
      const raw = await r.json();
      const market = marketFromTcgdex(raw);
      if (market > 0) return { market, source: "tcgdex" };
      const pid = Number(raw?.pricing?.tcgplayer?.holofoil?.productId || raw?.pricing?.tcgplayer?.normal?.productId);
      if (pid > 0) {
        const tp = await quoteTcgplayerProduct(pid);
        if (tp && tp > 0) return { market: tp, source: "tcgplayer" };
      }
    }
  } catch {
    /* next */
  }
  try {
    const r = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j: any = await r.json();
      const prices = j?.data?.tcgplayer?.prices;
      if (prices && typeof prices === "object") {
        for (const k of ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "normal", "unlimited"]) {
          const n = Number(prices[k]?.market ?? prices[k]?.mid ?? prices[k]?.low);
          if (Number.isFinite(n) && n > 0) return { market: n, source: "pokemontcg" };
        }
      }
    }
  } catch {
    /* next */
  }
  return null;
}

export const Route = createFileRoute("/api/public/prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ids = (url.searchParams.get("ids") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 24);
        const prices: Record<string, { market: number; source: string }> = {};
        const chunk = 6;
        for (let i = 0; i < ids.length; i += chunk) {
          const part = ids.slice(i, i + chunk);
          const got = await Promise.all(part.map((id) => quoteOne(id)));
          part.forEach((id, idx) => {
            const q = got[idx];
            if (q) prices[id] = q;
          });
        }
        return Response.json(
          { prices, generatedAt: new Date().toISOString() },
          { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
        );
      },
    },
  },
});
