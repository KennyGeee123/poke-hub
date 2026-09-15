import { useEffect, useState } from "react";
import { getCardPrices, type AggregateResponse, type Listing } from "@/lib/card-prices";

const SOURCE_COLORS: Record<string, string> = {
  eBay: "#0064d2",
  TCGplayer: "#ee7700",
  Cardmarket: "#2563eb",
  TrollAndToad: "#16a34a",
  CardKingdom: "#dc2626",
  Mercari: "#ef4444",
  PriceCharting: "#a855f7",
  "123Pokemon": "#f59e0b",
  "Pokemon Center": "#ef4444",
  CoolStuffInc: "#10b981",
  Amazon: "#f59e0b",
  Whatnot: "#ec4899",
  "Dave & Adam's": "#3b82f6",
  "Steel City": "#6366f1",
  "Miniature Market": "#8b5cf6",
  ChannelFireball: "#f97316",
  Walmart: "#0284c7",
};

function Price({ l }: { l: Listing }) {
  const total = l.price + (l.shipping ?? 0);
  return (
    <span>
      <strong style={{ color: "var(--neon-yellow, #fbbf24)" }}>${total.toFixed(2)}</strong>
      {l.shipping != null && l.shipping > 0 && (
        <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 4 }}>
          (incl ${l.shipping.toFixed(2)} ship)
        </span>
      )}
      {l.currency !== "USD" && (
        <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 4 }}>
          · {l.priceRaw}
        </span>
      )}
    </span>
  );
}

export function PriceComparePanel({ query, cardId, initialCondition = "all" }: { query: string; cardId?: string; initialCondition?: string }) {
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [condition, setCondition] = useState<string>(initialCondition);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCondition(initialCondition);
  }, [initialCondition]);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const r = await getCardPrices(query, { cardId, condition });
      setData(r);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setData(null);
    setErr(null);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cardId, condition]);

  const sortedSources = data?.sources
    ?.slice()
    .sort((a, b) => {
      const ap = a.lowest ? a.lowest.price + (a.lowest.shipping ?? 0) : Infinity;
      const bp = b.lowest ? b.lowest.price + (b.lowest.shipping ?? 0) : Infinity;
      return ap - bp;
    });

  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">💸 BUY IT CHEAPEST · ALL MARKETPLACES</div>
        <div className="pv-panel-tag">
          {data
            ? `${data.sources.filter((s) => s.lowest).length} priced · ${data.sources.filter((s) => s.kind === "shop").length} live search shops`
            : loading ? "Scanning 15+ marketplaces…" : "—"}
        </div>
      </div>

      {/* Condition & Slab filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 12px" }}>
        {[
          { id: "all", label: "⚡ All Lows" },
          { id: "raw_nm", label: "📋 Raw NM" },
          { id: "raw_mint", label: "📋 Raw Mint" },
          { id: "raw_lp", label: "📋 Raw LP" },
          { id: "raw_mp", label: "📋 Raw MP" },
          { id: "slab", label: "🏆 All Slabs" },
          { id: "psa10", label: "🏆 PSA 10 Slabs" },
          { id: "psa9", label: "🏆 PSA 9 Slabs" },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setCondition(c.id)}
            style={{
              fontSize: 10,
              padding: "4px 8px",
              borderRadius: 6,
              border: condition === c.id ? "1px solid var(--gold, #fbbf24)" : "1px solid var(--brd)",
              background: condition === c.id ? "rgba(251, 191, 36, 0.15)" : "rgba(255,255,255,0.04)",
              color: condition === c.id ? "var(--gold, #fbbf24)" : "var(--t2)",
              cursor: "pointer",
              fontFamily: "var(--mono, monospace)",
              fontWeight: condition === c.id ? 700 : 500,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Pulling real-time listings across TCGPlayer, Cardmarket, eBay BINs, Target, and 15+ specialized collectible stores…
        </div>
      )}

      {err && (
        <div style={{ fontSize: 11, color: "#f87171" }}>
          {err}{" "}
          <button onClick={run} style={{ color: "var(--neon-cyan, #38bdf8)", textDecoration: "underline", marginLeft: 6 }}>
            Retry
          </button>
        </div>
      )}

      {data?.cheapest && (
        <a
          href={data.cheapest.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: 12,
            margin: "10px 0 14px",
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(254,228,64,.18), rgba(0,245,212,.12))",
            border: "1px solid var(--neon-yellow, #fbbf24)",
            boxShadow: "0 0 16px rgba(251, 191, 36, 0.25)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {data.cheapest.image && (
            <img
              src={data.cheapest.image}
              alt=""
              style={{ width: 56, height: 56, borderRadius: 8, objectFit: "contain", background: "#0d001a" }}
              loading="lazy"
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--gold, #fbbf24)", fontWeight: 800 }}>
              🏆 CHEAPEST ON THE NET · {data.cheapest.source.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data.cheapest.title}
            </div>
            <div style={{ marginTop: 4, fontSize: 18, fontFamily: "Bebas Neue, Impact, sans-serif", letterSpacing: 1 }}>
              <Price l={data.cheapest} />
              <span style={{ marginLeft: 8, color: "var(--neon-cyan, #38bdf8)", fontSize: 12 }}>BUY DIRECT ↗</span>
            </div>
          </div>
        </a>
      )}

      {sortedSources?.map((s) => {
        const color = SOURCE_COLORS[s.source] ?? "#888";
        const isOpen = !!expanded[s.source];
        return (
          <div
            key={s.source}
            style={{
              padding: "10px 12px",
              marginBottom: 6,
              borderRadius: 10,
              background: "rgba(13,0,26,.45)",
              border: `1px solid ${s.ok ? "var(--brd)" : "rgba(255,0,110,.25)"}`,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: s.lowest ? "pointer" : "default" }}
              onClick={() => s.lowest && setExpanded((p) => ({ ...p, [s.source]: !isOpen }))}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t1)", minWidth: 110 }}>{s.source}</div>
              {s.lowest ? (
                <>
                  <div style={{ fontSize: 13, color: "var(--t2)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.lowest.title}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    <Price l={s.lowest} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--neon-cyan, #38bdf8)" }}>{isOpen ? "▾" : "▸"}</span>
                </>
              ) : s.kind === "shop" && s.shopUrl ? (
                <a
                  href={s.shopUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 12, color: "var(--neon-cyan, #38bdf8)", marginLeft: "auto", textDecoration: "none" }}
                >
                  Search live ↗
                </a>
              ) : (
                <div style={{ fontSize: 11, color: "var(--t3)", flex: 1 }}>
                  {s.error ? `listed feed busy (${s.error.slice(0, 24)})` : "no listed low"}
                </div>
              )}
            </div>

            {isOpen && s.listings.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {s.listings.slice(0, 6).map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,.03)",
                      textDecoration: "none",
                      color: "inherit",
                      fontSize: 12,
                    }}
                  >
                    {l.image ? (
                      <img src={l.image} alt="" loading="lazy" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "contain", background: "#0d001a" }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,.05)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--t2)" }}>
                      {l.title}
                    </div>
                    <Price l={l} />
                    <span style={{ color: "var(--neon-cyan, #38bdf8)", fontSize: 10 }}>↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {data && (
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--t3)", textAlign: "right" }}>
          Updated {new Date(data.generatedAt).toLocaleTimeString()} ·{" "}
          <button onClick={run} style={{ color: "var(--neon-cyan, #38bdf8)", textDecoration: "underline" }}>
            refresh
          </button>
        </div>
      )}
    </div>
  );
}
