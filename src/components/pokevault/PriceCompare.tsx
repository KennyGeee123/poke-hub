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
};

function Price({ l }: { l: Listing }) {
  const total = l.price + (l.shipping ?? 0);
  return (
    <span>
      <strong style={{ color: "var(--neon-yellow)" }}>${total.toFixed(2)}</strong>
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

export function PriceComparePanel({ query, cardId }: { query: string; cardId?: string }) {
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const r = await getCardPrices(query, { cardId });
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
  }, [query, cardId]);

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
        <div className="pv-panel-title">💸 BUY IT CHEAPEST</div>
        <div className="pv-panel-tag">
          {data
            ? `${data.sources.filter((s) => s.lowest).length} priced · ${data.sources.filter((s) => s.kind === "shop").length} shop links`
            : loading ? "Looking up listed lows…" : "—"}
        </div>
      </div>

      {loading && !data && (
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Pulling TCGPlayer and Cardmarket listed lows. Other stores are live search links (cloud scrapes are blocked).
        </div>
      )}

      {err && (
        <div style={{ fontSize: 11, color: "#f87171" }}>
          {err}{" "}
          <button onClick={run} style={{ color: "var(--neon-cyan)", textDecoration: "underline", marginLeft: 6 }}>
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
              "linear-gradient(135deg, rgba(254,228,64,.15), rgba(0,245,212,.10))",
            border: "1px solid var(--neon-yellow)",
            boxShadow: "var(--glow-yellow)",
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
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--t3)", fontWeight: 700 }}>
              🏆 CHEAPEST ON THE NET · {data.cheapest.source.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data.cheapest.title}
            </div>
            <div style={{ marginTop: 4, fontSize: 18, fontFamily: "Bebas Neue, Impact, sans-serif", letterSpacing: 1 }}>
              <Price l={data.cheapest} />
              <span style={{ marginLeft: 8, color: "var(--neon-cyan)", fontSize: 12 }}>BUY ↗</span>
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
                  <span style={{ fontSize: 11, color: "var(--neon-cyan)" }}>{isOpen ? "▾" : "▸"}</span>
                </>
              ) : s.kind === "shop" && s.shopUrl ? (
                <a
                  href={s.shopUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 12, color: "var(--neon-cyan)", marginLeft: "auto", textDecoration: "none" }}
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
                    <span style={{ color: "var(--neon-cyan)", fontSize: 10 }}>↗</span>
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
          <button onClick={run} style={{ color: "var(--neon-cyan)", textDecoration: "underline" }}>
            refresh
          </button>
        </div>
      )}
    </div>
  );
}
