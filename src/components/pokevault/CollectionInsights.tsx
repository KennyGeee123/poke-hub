import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useServerFn } from "@tanstack/react-start";
import { analyzeCollection } from "@/lib/insights.functions";
import { useVault, formatPrice } from "@/lib/vault";
import { getMarketPrice } from "@/lib/pokemon-api";

export function CollectionInsightsCard() {
  const { vault, totalValue, totalCards } = useVault();
  const run = useServerFn(analyzeCollection);
  const [loading, setLoading] = useState(false);
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const entries = Object.values(vault);
  const empty = entries.length === 0;

  async function analyze() {
    setLoading(true);
    setErr(null);
    setMd(null);
    try {
      // Send top 80 by value to keep prompt compact
      const items = entries
        .map((e) => ({
          name: e.card.name,
          set: e.card.set.name,
          rarity: e.card.rarity,
          qty: e.qty,
          price: Math.round(getMarketPrice(e.card) * 100) / 100,
          types: e.card.types,
        }))
        .sort((a, b) => b.price * b.qty - a.price * a.qty)
        .slice(0, 80);
      const { markdown } = await run({
        data: { items, totalValue, totalCards },
      });
      setMd(markdown);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
        background:
          "linear-gradient(135deg, rgba(0,245,212,.08), rgba(255,0,110,.08))",
        border: "1px solid var(--brd)",
        boxShadow: "var(--glow-cyan)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue, Impact, sans-serif", letterSpacing: 2, fontSize: 22, color: "var(--neon-cyan)", textShadow: "var(--glow-cyan)" }}>
            ✦ AI COLLECTION INSIGHTS
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
            {empty ? "Add cards to unlock analysis." : `Analyzes top holdings · ${formatPrice(totalValue)} tracked`}
          </div>
        </div>
        <button
          className="pv-tool-btn primary"
          disabled={empty || loading}
          onClick={analyze}
          style={{ opacity: empty || loading ? 0.6 : 1 }}
        >
          {loading ? "Analyzing…" : md ? "↻ Re-analyze" : "✨ Analyze My Vault"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "rgba(255,0,110,.12)", border: "1px solid var(--neon-pink)", color: "#fff", fontSize: 13 }}>
          {err}
        </div>
      )}

      {md && (
        <div
          className="pv-insights-md"
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 10,
            background: "rgba(13,0,26,.55)",
            border: "1px solid var(--brd)",
            color: "var(--t1)",
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
