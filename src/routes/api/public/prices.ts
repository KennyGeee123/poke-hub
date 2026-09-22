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

async function quoteOne(id: string): Promise<{ market: number; source: string } | null> {
  try {
    const r = await fetch(`${UPSTREAM}/en/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const raw = await r.json();
    const market = marketFromTcgdex(raw);
    if (market > 0) return { market, source: "tcgdex" };
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
