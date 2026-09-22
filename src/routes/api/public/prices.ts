import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.tcgdex.net/v2";
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, JPY: 0.0064, CAD: 0.73, AUD: 0.66 };

export type PriceQuote = {
  market: number;
  source: string;
  soldAvg?: number;
  listingMarket?: number;
};

function usd(n: number, unit?: string): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * (FX[(unit || "USD").toUpperCase()] ?? 1) * 100) / 100;
}

const TP_PRINTS = ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "unlimitedHolofoil", "normal", "unlimited"];

function pickTpField(tp: any, field: "marketPrice" | "midPrice" | "lowPrice"): number {
  if (!tp || typeof tp !== "object") return 0;
  const unit = tp.unit || "USD";
  for (const k of TP_PRINTS) {
    const n = usd(Number(tp[k]?.[field]), unit);
    if (n > 0) return n;
  }
  for (const [k, v] of Object.entries(tp)) {
    if (!v || typeof v !== "object" || k === "updated" || k === "unit" || k === "url") continue;
    const n = usd(Number((v as any)[field]), unit);
    if (n > 0) return n;
  }
  return 0;
}

/** Prefer Cardmarket sold averages, then TCGPlayer market/mid/low. */
function marketFromTcgdex(raw: any): PriceQuote | null {
  const cm = raw?.pricing?.cardmarket;
  let soldAvg = 0;
  let cmLow = 0;
  if (cm && typeof cm === "object") {
    const unit = cm.unit || "EUR";
    for (const key of ["avg7", "avg30", "avg", "trend"] as const) {
      const n = usd(Number(cm[key]), unit);
      if (n > 0) {
        soldAvg = n;
        break;
      }
    }
    cmLow = usd(Number(cm.low), unit);
  }

  const tpMarket = pickTpField(raw?.pricing?.tcgplayer, "marketPrice");
  const tpMid = pickTpField(raw?.pricing?.tcgplayer, "midPrice");
  const tpLow = pickTpField(raw?.pricing?.tcgplayer, "lowPrice");
  const listingMarket = tpMarket || tpMid || tpLow || cmLow || undefined;

  if (soldAvg > 0) {
    return {
      market: soldAvg,
      source: "sold-avg",
      soldAvg,
      listingMarket: listingMarket && listingMarket !== soldAvg ? listingMarket : undefined,
    };
  }
  if (cmLow > 0) {
    return {
      market: cmLow,
      source: "cardmarket-low",
      listingMarket: listingMarket !== cmLow ? listingMarket : undefined,
    };
  }
  if (tpMarket > 0) {
    return {
      market: tpMarket,
      source: "tcgplayer-market",
      listingMarket: tpMid || tpLow || undefined,
    };
  }
  if (tpMid > 0) {
    return { market: tpMid, source: "tcgplayer-mid", listingMarket: tpLow || undefined };
  }
  if (tpLow > 0) {
    return { market: tpLow, source: "tcgplayer-low" };
  }
  return null;
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

async function quoteOne(id: string): Promise<PriceQuote | null> {
  try {
    const r = await fetch(`${UPSTREAM}/en/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (r.ok) {
      const raw = await r.json();
      const q = marketFromTcgdex(raw);
      if (q && q.market > 0) return q;
      const pid = Number(raw?.pricing?.tcgplayer?.holofoil?.productId || raw?.pricing?.tcgplayer?.normal?.productId);
      if (pid > 0) {
        const tp = await quoteTcgplayerProduct(pid);
        if (tp && tp > 0) return { market: tp, source: "tcgplayer-market" };
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
        for (const field of ["market", "mid", "low"] as const) {
          for (const k of ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "normal", "unlimited"]) {
            const n = Number(prices[k]?.[field]);
            if (Number.isFinite(n) && n > 0) {
              const source =
                field === "market" ? "pokemontcg-market" : field === "mid" ? "pokemontcg-mid" : "pokemontcg-low";
              return { market: n, source };
            }
          }
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
        const prices: Record<string, PriceQuote> = {};
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
