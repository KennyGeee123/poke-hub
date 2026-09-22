import { PristineMoveCustomizer } from "./PristineMoveCustomizer";
import { P2PTradingHubModal } from "./P2PTradingHubModal";
import { getCardLevelAndStats } from "@/lib/card-stats";
import { VisualGradeScannerModal } from "./VisualGradeScannerModal";
import { InteractiveHoloCard, HoloInspectorModal } from "./InteractiveHoloCard";
import { useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getCard, getMarketPrice, getRarityColor, stubCardFromId } from "@/lib/pokemon-api";
import { applyLiveQuote, useLivePrice } from "@/lib/live-prices";
import { getPrintLang, printLangMeta } from "@/lib/print-lang";
import { formatPrice } from "@/lib/vault";
import { CardActions } from "./CardTile";
import { getPokedex, type Pokedex } from "@/lib/pokeapi";
import { getAltArtworks, type AltArt } from "@/lib/tcgdex";
import { getEbaySold, type EbayResponse } from "@/lib/ebay";
import { fetchBulbapedia, type BulbaInfo } from "@/lib/bulbapedia";
import { PriceComparePanel } from "./PriceCompare";
import { QuickStrike } from "./QuickStrike";
import { fallbackCardImages, resolveHDImage } from "@/lib/card-images";
import {
  calculateGradedValue,
  type CardGrade,
  type RawQuality,
  UNGRADED_QUALITIES,
  GRADED_SLABS,
  getGradeMeta,
  getSlabSearchUrls,
  predetermineCardGrade,
  printVariantPriceRows,
  rawConditionLadder,
  gradedSlabLadder,
} from "@/lib/card-grades";

export function CardDetail({ cardId, onBack, onToast }: { cardId: string; onBack: () => void; onToast: (m: string) => void }) {
  const [card, setCard] = useState<TCGCard | null>(() => stubCardFromId(cardId));
  const [loaded, setLoaded] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<CardGrade>("raw_nm");
  const [activeTab, setActiveTab] = useState<"pricing" | "ai_inspector">("pricing");
  const [showVisualModal, setShowVisualModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showHoloModal, setShowHoloModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<"holo" | "classic">("holo");
  const failedImgs = useRef<Set<string>>(new Set());

  // AI Pre-Grade Scanner state
  const [inspectQuality, setInspectQuality] = useState<RawQuality>("raw_mint");
  const [centeringScore, setCenteringScore] = useState(96);
  const [cornersScore, setCornersScore] = useState(98);
  const [edgesScore, setEdgesScore] = useState(96);
  const [surfaceScore, setSurfaceScore] = useState(97);
  const [ebaySold, setEbaySold] = useState<EbayResponse | null>(null);

  useEffect(() => {
    const stub = stubCardFromId(cardId);
    setCard(stub);
    setLoaded(false);
    setDegraded(false);
    setImgSrc(stub.images?.large || stub.images?.small || "");
    setSelectedGrade("raw_nm");
    failedImgs.current = new Set();
    let live = true;
    getCard(cardId, getPrintLang())
      .then((c) => {
        if (!live || !c) return;
        setCard(c);
        setDegraded(c.name === stub.name && c.name === cardId.replace(/-/g, " "));
      })
      .catch(() => {
        if (live) setDegraded(true);
      });
    return () => {
      live = false;
    };
  }, [cardId]);

  useEffect(() => {
    if (!card) return;
    failedImgs.current = new Set();
    setLoaded(false);
    const list = fallbackCardImages(card);
    setImgSrc(list[0] || card.images?.large || card.images?.small || "");
    resolveHDImage(card).then((url) => {
      if (url && url !== (card.images?.large || "") && !failedImgs.current.has(url)) {
        setImgSrc(url);
      }
    }).catch(() => {});
  }, [card]);

  const live = useLivePrice(card);
  const ebayQuery = card ? `${card.name} ${card.set.name} ${card.number ?? ""}`.trim() : "";

  useEffect(() => {
    if (!ebayQuery) {
      setEbaySold(null);
      return;
    }
    let alive = true;
    setEbaySold(null);
    getEbaySold(ebayQuery)
      .then((d) => {
        if (alive) setEbaySold(d);
      })
      .catch(() => {
        if (alive) setEbaySold(null);
      });
    return () => {
      alive = false;
    };
  }, [ebayQuery]);

  const ebayAvg = ebaySold?.summary?.avg && ebaySold.summary.avg > 0 ? ebaySold.summary.avg : 0;
  // Prefer real eBay sold average (signed-in) → live sold-avg API → catalog quote.
  const displayMarket = ebayAvg || live;
  const priced = card && displayMarket > 0 ? applyLiveQuote(card, displayMarket) : card;

  if (!priced) return <div className="pv-empty">Loading…</div>;

  const market = displayMarket || getMarketPrice(priced);
  const cmPrices = priced.cardmarket?.prices;
  const gradedVal = calculateGradedValue(priced, selectedGrade);
  const gradeMeta = getGradeMeta(selectedGrade);
  const slabUrls = getSlabSearchUrls(card, selectedGrade);

  // Run AI Pre-Grade Predetermination Analysis
  const preGradeAnalysis = predetermineCardGrade(card, inspectQuality, {
    centering: centeringScore,
    corners: cornersScore,
    edges: edgesScore,
    surface: surfaceScore,
  });

  return (
    <div className="pad">
      <button className="pv-back" onClick={onBack}>← Back</button>
      {degraded && (
        <div style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 10px", padding: "8px 10px", background: "rgba(255,215,0,.08)", border: "1px solid var(--gold-brd)", borderRadius: 8 }}>
          Showing scan from image CDN while the catalog API recovers. Prices may be delayed.
        </div>
      )}
      <div className="pv-detail-layout">
        <div className="pv-detail-left">
          {/* 3D Holo / Classic View Switcher Bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => setDisplayMode("holo")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background: displayMode === "holo" ? "linear-gradient(135deg, #ec4899, #8b5cf6)" : "var(--s2)",
                color: "#ffffff",
                border: displayMode === "holo" ? "1px solid #ec4899" : "1px solid var(--brd)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                boxShadow: displayMode === "holo" ? "0 0 12px rgba(236,72,153,0.4)" : "none",
              }}
            >
              <span>✨</span> 3D Holo Tilt
            </button>
            <button
              onClick={() => setDisplayMode("classic")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background: displayMode === "classic" ? "linear-gradient(135deg, #0ea5e9, #3b82f6)" : "var(--s2)",
                color: displayMode === "classic" ? "#ffffff" : "var(--t2)",
                border: displayMode === "classic" ? "1px solid #0ea5e9" : "1px solid var(--brd)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <span>🖼️</span> Static View
            </button>
          </div>

          {displayMode === "holo" ? (
            <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <InteractiveHoloCard
                frontImage={imgSrc || card.images.large}
                name={card.name}
                setName={card.set?.name}
                rarity={card.rarity}
                isHolo={true}
                allowFlip={true}
                allowStyleChange={true}
                showControls={true}
                onExpandModal={() => setShowHoloModal(true)}
              />
            </div>
          ) : (
            <div
              className="pv-detail-img-wrap"
              style={{ position: "relative", cursor: "pointer" }}
              onClick={() => setShowVisualModal(true)}
              title="Click to launch AI Visual Pre-Grade Defect Scanner"
            >
              <div className="pv-card-skel" style={{ opacity: loaded ? 0 : 1 }} />
              <img
                className={`pv-detail-img ${loaded ? "loaded" : ""}`}
                src={imgSrc || card.images.large}
                alt={card.name}
                onLoad={() => setLoaded(true)}
                onError={() => {
                  failedImgs.current.add(imgSrc);
                  setLoaded(true);
                  const next = fallbackCardImages(card).find((u) => u && !failedImgs.current.has(u));
                  if (next) setImgSrc(next);
                }}
              />
              {/* Visual Scanner Prompt Badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  right: 8,
                  padding: "6px 10px",
                  background: "linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(99, 102, 241, 0.92))",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#ffffff",
                  textAlign: "center",
                  letterSpacing: 0.8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span>🔬</span> TAP CARD TO SCAN PIXELS & DEFECTS
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: "var(--mono, monospace)",
                  background: gradeMeta.badgeBg,
                  color: gradeMeta.badgeText,
                  border: `1px solid ${gradeMeta.badgeText}88`,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
                }}
              >
                {gradeMeta.shortLabel}
              </div>
            </div>
          )}

          <CardActions card={card} onAfterAction={onToast} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={() => setShowHoloModal(true)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(236, 72, 153, 0.15)",
                border: "1px solid rgba(236, 72, 153, 0.4)",
                color: "#f472b6",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              ✨ 3D Holo Flare
            </button>
            <button
              onClick={() => setShowVisualModal(true)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(14, 165, 233, 0.15)",
                border: "1px solid rgba(14, 165, 233, 0.4)",
                color: "#38bdf8",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              🔬 Dual-Sided Scan
            </button>
            <button
              onClick={() => setShowTradeModal(true)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#4ade80",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              🔄 Propose P2P Trade
            </button>
          </div>
          
          {/* Quick Strike Cheap Card Loop */}
          <QuickStrike card={card} selectedGrade={selectedGrade} />

          {/* Graded & Ungraded Condition Valuation HUD */}
          <div
            style={{
              marginTop: 12,
              padding: 14,
              background: "linear-gradient(180deg, rgba(239, 68, 68, 0.08), rgba(15, 23, 42, 0.6))",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#f87171", fontWeight: 800 }}>
                {gradeMeta.isSlab ? "🏆 GRADED SLAB VALUATION" : "📋 UNGRADED RATING & VALUE"}
              </div>
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: gradeMeta.badgeBg,
                  color: gradeMeta.badgeText,
                  fontWeight: 700,
                }}
              >
                {gradeMeta.category.toUpperCase()}
              </span>
            </div>

            {/* Dropdown Selector on Card Detail */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as CardGrade)}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "rgba(10, 15, 29, 0.95)",
                color: gradeMeta.isSlab ? "#fbbf24" : "var(--t1)",
                border: "1px solid var(--brd)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--mono, monospace)",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              <optgroup label="📋 UNGRADED CONDITIONS (RAW)">
                {UNGRADED_QUALITIES.map((g) => {
                  const gm = getGradeMeta(g);
                  const gv = calculateGradedValue(priced, g);
                  return (
                    <option key={g} value={g}>
                      {gm.label} · {formatPrice(gv.estimatedGradedPrice)}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="🏆 GRADED SLABS">
                {GRADED_SLABS.map((g) => {
                  const gm = getGradeMeta(g);
                  const gv = calculateGradedValue(priced, g);
                  return (
                    <option key={g} value={g}>
                      {gm.label} · {formatPrice(gv.estimatedGradedPrice)}
                    </option>
                  );
                })}
              </optgroup>
            </select>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: 1, textTransform: "uppercase" }}>
                  {gradeMeta.label}
                </div>
                <div
                  className={gradeMeta.isSlab ? undefined : "pv-c-price"}
                  style={
                    gradeMeta.isSlab
                      ? { fontFamily: "Bebas Neue", fontSize: 26, color: "#fbbf24", letterSpacing: 1 }
                      : market > 0
                        ? { fontFamily: "Bebas Neue", fontSize: 28, color: "var(--gold)", letterSpacing: 1 }
                        : { fontSize: 14, letterSpacing: 0.02 }
                  }
                >
                  {formatPrice(gradeMeta.isSlab ? gradedVal.estimatedGradedPrice : (market || gradedVal.estimatedGradedPrice))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "var(--t3)" }}>Rating Multiplier</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: gradeMeta.isSlab ? "#4ade80" : "var(--t2)" }}>
                  {gradedVal.multiplier.toFixed(2)}×
                </div>
              </div>
            </div>

            {gradeMeta.isSlab ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 8,
                  fontSize: 11,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--t2)" }}>
                  <span>Raw Card Cost:</span>
                  <span>{formatPrice(gradedVal.rawPrice)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--t2)" }}>
                  <span>Grading Fee (est):</span>
                  <span>+{formatPrice(gradedVal.gradingFee)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--brd)", paddingTop: 4, color: gradedVal.estimatedProfit >= 0 ? "#4ade80" : "#f87171" }}>
                  <span>Grading Profit / ROI:</span>
                  <span>
                    {gradedVal.estimatedProfit >= 0 ? "+" : ""}{formatPrice(gradedVal.estimatedProfit)} ({gradedVal.estimatedRoiPct}%)
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "var(--t2)",
                }}
              >
                {gradeMeta.description}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <a
                href={slabUrls.ebayActive}
                target="_blank"
                rel="noreferrer"
                className="pv-btn pv-btn-out"
                style={{ flex: 1, textAlign: "center", fontSize: 10, padding: "6px 4px", textDecoration: "none" }}
              >
                eBay {gradeMeta.shortLabel} ↗
              </a>
              <a
                href={slabUrls.ebaySold}
                target="_blank"
                rel="noreferrer"
                className="pv-btn pv-btn-out"
                style={{ flex: 1, textAlign: "center", fontSize: 10, padding: "6px 4px", textDecoration: "none" }}
              >
                Sold Comps ↗
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-3">
            {card.tcgplayer?.url && (
              <a href={card.tcgplayer.url} target="_blank" rel="noreferrer" className="text-center text-xs" style={{ color: "#60a5fa", padding: 6 }}>
                View on TCGPlayer ↗
              </a>
            )}
            {card.cardmarket?.url && (
              <a href={card.cardmarket.url} target="_blank" rel="noreferrer" className="text-center text-xs" style={{ color: "#60a5fa", padding: 6 }}>
                View on Cardmarket ↗
              </a>
            )}
          </div>
        </div>

        <div className="pv-detail-right">
          <div className="pv-detail-name">{card.name.toUpperCase()}</div>
          <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 10 }}>
            {card.lang && card.lang !== "en" ? `${printLangMeta(card.lang).name} print • ` : ""}
            {card.set.name} • #{card.number}/{card.set.printedTotal} {card.artist && `• Illus. ${card.artist}`}
          </div>

          {/* AI Pre-Grade vs Market Tab Header */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "1px solid var(--brd)", paddingBottom: 8 }}>
            <button
              onClick={() => setActiveTab("pricing")}
              style={{
                background: "transparent",
                border: "none",
                color: activeTab === "pricing" ? "var(--neon-yellow, #fbbf24)" : "var(--t3)",
                fontWeight: activeTab === "pricing" ? 800 : 500,
                borderBottom: activeTab === "pricing" ? "2px solid var(--neon-yellow, #fbbf24)" : "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              📈 Market Prices & Stats
            </button>
            <button
              onClick={() => setActiveTab("ai_inspector")}
              style={{
                background: "transparent",
                border: "none",
                color: activeTab === "ai_inspector" ? "var(--neon-cyan, #38bdf8)" : "var(--t3)",
                fontWeight: activeTab === "ai_inspector" ? 800 : 500,
                borderBottom: activeTab === "ai_inspector" ? "2px solid var(--neon-cyan, #38bdf8)" : "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              🔬 AI Pre-Grade Predetermination Analyzer
            </button>
          </div>

          <CardVariantPriceMatrix
            card={priced}
            selectedGrade={selectedGrade}
            onPickGrade={setSelectedGrade}
          />

          {activeTab === "ai_inspector" ? (
            /* AI Pre-Grade Inspector HUD */
            <div
              style={{
                padding: 16,
                background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(15, 23, 42, 0.8))",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", letterSpacing: 1 }}>
                    🔬 AI PRE-GRADE PREDETERMINATION ENGINE
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>
                    Analyze raw ungraded card online to predict PSA 10 / 9 probability & expected ROI
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 800,
                    background: preGradeAnalysis.expectedNetGain >= 20 ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.2)",
                    color: preGradeAnalysis.expectedNetGain >= 20 ? "#4ade80" : "#facc15",
                    border: `1px solid ${preGradeAnalysis.expectedNetGain >= 20 ? "#4ade80" : "#facc15"}`,
                  }}
                >
                  {preGradeAnalysis.recommendedAction}
                </span>
              </div>

              {/* Raw Condition Preset Selector */}
              <div style={{ margin: "12px 0" }}>
                <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4, fontWeight: 700 }}>
                  RAW LISTING QUALITY PRESET:
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {UNGRADED_QUALITIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInspectQuality(q);
                        if (q === "raw_mint") { setCenteringScore(96); setCornersScore(98); setEdgesScore(96); setSurfaceScore(97); }
                        else if (q === "raw_nm") { setCenteringScore(90); setCornersScore(92); setEdgesScore(91); setSurfaceScore(92); }
                        else if (q === "raw_lp") { setCenteringScore(82); setCornersScore(80); setEdgesScore(78); setSurfaceScore(84); }
                        else if (q === "raw_mp") { setCenteringScore(70); setCornersScore(65); setEdgesScore(60); setSurfaceScore(68); }
                        else { setCenteringScore(50); setCornersScore(45); setEdgesScore(40); setSurfaceScore(45); }
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: "var(--mono, monospace)",
                        border: inspectQuality === q ? "1px solid #38bdf8" : "1px solid var(--brd)",
                        background: inspectQuality === q ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.04)",
                        color: inspectQuality === q ? "#38bdf8" : "var(--t2)",
                        cursor: "pointer",
                      }}
                    >
                      {getGradeMeta(q).shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Four Sub-grade Parameter Sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "14px 0" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span>Centering (50/50 - 60/40)</span>
                    <strong style={{ color: "#38bdf8" }}>{centeringScore}%</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={centeringScore}
                    onChange={(e) => setCenteringScore(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span>Corners (Sharpness)</span>
                    <strong style={{ color: "#38bdf8" }}>{cornersScore}%</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={cornersScore}
                    onChange={(e) => setCornersScore(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span>Edges (Silvering / Whitening)</span>
                    <strong style={{ color: "#38bdf8" }}>{edgesScore}%</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={edgesScore}
                    onChange={(e) => setEdgesScore(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span>Surface (Scratches / Print Lines)</span>
                    <strong style={{ color: "#38bdf8" }}>{surfaceScore}%</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={surfaceScore}
                    onChange={(e) => setSurfaceScore(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>
              </div>

              {/* Predetermined Probabilities Card */}
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: 12,
                  borderRadius: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  textAlign: "center",
                  margin: "12px 0",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>PSA 10 GEM</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: preGradeAnalysis.probabilities.psa10 >= 50 ? "#4ade80" : "var(--t1)" }}>
                    {preGradeAnalysis.probabilities.psa10}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>PSA 9 MINT</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa" }}>
                    {preGradeAnalysis.probabilities.psa9}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>PSA 8 NM-MT</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#facc15" }}>
                    {preGradeAnalysis.probabilities.psa8}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>SUB-8 / RAW</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171" }}>
                    {preGradeAnalysis.probabilities.sub8}%
                  </div>
                </div>
              </div>

              {/* Expected ROI Summary */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>ESTIMATED GROSS VALUE AFTER GRADING</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24" }}>
                    {formatPrice(preGradeAnalysis.expectedGrossValue)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>PROJECTED NET PROFIT (AFTER RAW + $19.99 FEE)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: preGradeAnalysis.expectedNetGain >= 0 ? "#4ade80" : "#f87171" }}>
                    {preGradeAnalysis.expectedNetGain >= 0 ? "+" : ""}{formatPrice(preGradeAnalysis.expectedNetGain)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {card.rarity && (
            <span className="pv-rar-badge" style={{ color: getRarityColor(card.rarity), borderColor: getRarityColor(card.rarity) + "55", background: getRarityColor(card.rarity) + "18" }}>
              {card.rarity}
            </span>
          )}
          {card.types && (
            <div className="flex gap-1 mb-3 flex-wrap">
              {card.types.map(t => (
                <span key={t} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.06)" }}>{t}</span>
              ))}
            </div>
          )}
          {card.hp && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--t2)" }}>
              HP <span style={{ color: "#ff6b6b", fontWeight: 900, fontSize: 18, marginLeft: 4 }}>{card.hp}</span>
            </div>
          )}
          {card.evolvesFrom && (
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>Evolves from {card.evolvesFrom}</div>
          )}

          {card.abilities?.map((a, i) => (
            <div key={i} style={{ background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)", borderRadius: 8, padding: "9px 11px", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(139,92,246,.25)", color: "#c4b5fd", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{a.type}</span>
                <span style={{ fontWeight: 700, color: "#c4b5fd", fontSize: 12 }}>{a.name}</span>
              </div>
              <div style={{ color: "var(--t2)", fontSize: 11, lineHeight: 1.5 }}>{a.text}</div>
            </div>
          ))}

          {/* Pristine 10 Move Set & Egg / Breedable Moves Customizer */}
          <div style={{ margin: "14px 0" }}>
            <PristineMoveCustomizer card={card} />
          </div>

          {card.attacks?.map((atk, i) => (
            <div key={i} className="pv-atk">
              <div className="flex justify-between items-center">
                <div>
                  <div className="pv-atk-name">{atk.name}</div>
                  <div className="pv-atk-cost">Cost: {atk.cost?.join(" • ") || "—"}</div>
                </div>
                {atk.damage && <div className="pv-atk-dmg">{atk.damage}</div>}
              </div>
              {atk.text && <div className="pv-atk-text">{atk.text}</div>}
            </div>
          ))}

          {(card.weaknesses || card.resistances) && (
            <div className="flex gap-3 mt-3 mb-3 flex-wrap">
              {card.weaknesses?.map((w, i) => (
                <div key={i} style={{ fontSize: 11 }}>Weak: <strong style={{ color: "#f87171" }}>{w.type} {w.value}</strong></div>
              ))}
              {card.resistances?.map((r, i) => (
                <div key={i} style={{ fontSize: 11 }}>Resist: <strong style={{ color: "#4ade80" }}>{r.type} {r.value}</strong></div>
              ))}
            </div>
          )}



          {cmPrices && (
            <>
              <div className="pv-section-title">CARDMARKET (EUR)</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  ["Trend", cmPrices.trendPrice],
                  ["Avg", cmPrices.averageSellPrice],
                  ["Low", cmPrices.lowPrice],
                  ["1d", cmPrices.avg1], ["7d", cmPrices.avg7], ["30d", cmPrices.avg30],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} style={{ background: "rgba(255,255,255,.05)", padding: "8px 12px", borderRadius: 8, textAlign: "center", minWidth: 70 }}>
                    <div style={{ color: "var(--t3)", fontSize: 9 }}>{k}</div>
                    <div style={{ color: "#60a5fa", fontWeight: 700, fontFamily: "monospace" }}>€{(v as number).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {card.flavorText && (
            <div style={{ marginTop: 14, padding: "10px 13px", background: "rgba(255,255,255,.04)", borderRadius: 8, color: "var(--t2)", fontSize: 12, fontStyle: "italic", lineHeight: 1.6 }}>
              "{card.flavorText}"
            </div>
          )}

          <PokedexPanel cardName={card.name} />
          <BulbapediaPanel cardName={card.name} />
          <AltArtworksPanel card={card} />
          <PriceComparePanel
            query={`${card.name} ${card.set.name} ${card.number ?? ""}`.trim()}
            cardId={card.id}
            initialCondition={selectedGrade}
          />
          <EbaySoldPanel query={ebayQuery} data={ebaySold} />
        </div>
      </div>
      {showVisualModal && (
        <VisualGradeScannerModal
          card={card}
          initialImageUrl={imgSrc || card.images.large}
          onClose={() => setShowVisualModal(false)}
        />
      )}
      {showTradeModal && (
        <P2PTradingHubModal
          initialCard={card}
          initialGrade={selectedGrade}
          onClose={() => setShowTradeModal(false)}
        />
      )}
      {showHoloModal && (
        <HoloInspectorModal
          isOpen={showHoloModal}
          onClose={() => setShowHoloModal(false)}
          frontImage={imgSrc || card.images.large}
          name={card.name}
          setName={card.set?.name}
          rarity={card.rarity}
        />
      )}
    </div>
  );
}

function CardVariantPriceMatrix({
  card,
  selectedGrade,
  onPickGrade,
}: {
  card: TCGCard;
  selectedGrade: CardGrade;
  onPickGrade: (g: CardGrade) => void;
}) {
  const prints = printVariantPriceRows(card);
  const raw = rawConditionLadder(card);
  const slabs = gradedSlabLadder(card);
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="pv-section-title">PRINT VARIANTS (RAW)</div>
      <table className="pv-price-tbl">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Low</th>
            <th>Mid</th>
            <th>Market</th>
            <th>High</th>
          </tr>
        </thead>
        <tbody>
          {prints.length ? prints.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{r.low ? formatPrice(r.low) : "—"}</td>
              <td>{r.mid ? formatPrice(r.mid) : "—"}</td>
              <td style={{ color: "var(--gold)", fontWeight: 700 }}>{r.market ? formatPrice(r.market) : "—"}</td>
              <td>{r.high ? formatPrice(r.high) : "—"}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} style={{ color: "var(--t3)" }}>No print-variant quotes yet — RAW / slab ladders still apply.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pv-section-title" style={{ marginTop: 12 }}>RAW CONDITIONS</div>
      <table className="pv-price-tbl">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Est. value</th>
            <th>×</th>
          </tr>
        </thead>
        <tbody>
          {raw.map((row) => (
            <tr
              key={row.grade}
              onClick={() => onPickGrade(row.grade)}
              style={{
                cursor: "pointer",
                background: selectedGrade === row.grade ? "rgba(251,191,36,0.12)" : undefined,
              }}
            >
              <td>{row.meta.shortLabel}</td>
              <td style={{ color: "var(--gold)", fontWeight: 700 }}>{formatPrice(row.estimatedGradedPrice)}</td>
              <td>{row.multiplier.toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pv-section-title" style={{ marginTop: 12 }}>GRADED SLABS</div>
      <table className="pv-price-tbl">
        <thead>
          <tr>
            <th>Slab</th>
            <th>Est. value</th>
            <th>×</th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((row) => (
            <tr
              key={row.grade}
              onClick={() => onPickGrade(row.grade)}
              style={{
                cursor: "pointer",
                background: selectedGrade === row.grade ? "rgba(251,191,36,0.12)" : undefined,
              }}
            >
              <td>{row.meta.shortLabel}</td>
              <td style={{ color: "#fbbf24", fontWeight: 700 }}>{formatPrice(row.estimatedGradedPrice)}</td>
              <td>{row.multiplier.toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PokedexPanel({ cardName }: { cardName: string }) {
  const [data, setData] = useState<Pokedex | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); getPokedex(cardName).then(d => { setData(d); setLoading(false); }); }, [cardName]);
  if (loading) return <div className="pv-panel"><div className="pv-panel-title">POKÉDEX</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Loading PokeAPI…</div></div>;
  if (!data) return null;
  const maxStat = Math.max(...data.stats.map(s => s.base), 100);
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">POKÉDEX #{String(data.id).padStart(3, "0")}</div>
        <div className="pv-panel-tag">PokeAPI</div>
      </div>
      <div className="pv-pokedex-grid">
        {data.artwork && <img src={data.artwork} alt={data.name} />}
        <div>
          {data.genus && <div style={{ fontSize: 11, color: "var(--gold)", letterSpacing: 1, marginBottom: 4 }}>{data.genus.toUpperCase()}</div>}
          {data.flavorText && <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>"{data.flavorText}"</div>}
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>
            <div><span style={{ color: "var(--t3)" }}>HT</span> {(data.height / 10).toFixed(1)} m</div>
            <div><span style={{ color: "var(--t3)" }}>WT</span> {(data.weight / 10).toFixed(1)} kg</div>
          </div>
          {data.stats.map(s => (
            <div className="pv-stat-bar" key={s.name}>
              <div className="pv-stat-bar-lbl">{s.name.replace("special-", "sp.")}</div>
              <div className="pv-stat-bar-bar"><div className="pv-stat-bar-fill" style={{ width: `${Math.min(100, (s.base / maxStat) * 100)}%` }} /></div>
              <div className="pv-stat-bar-val">{s.base}</div>
            </div>
          ))}
          {data.evolutionChain.length > 1 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--t3)" }}>
              Evolution: <span style={{ color: "var(--t1)", textTransform: "capitalize" }}>{data.evolutionChain.join(" → ")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AltArtworksPanel({ card }: { card: TCGCard }) {
  const [arts, setArts] = useState<AltArt[] | null>(null);
  useEffect(() => { setArts(null); getAltArtworks(card).then(setArts).catch(() => setArts([])); }, [card.id]);
  if (!arts) return <div className="pv-panel"><div className="pv-panel-title">INTERNATIONAL ARTWORKS</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Searching TCGdex…</div></div>;
  if (arts.length === 0) return null;
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">INTERNATIONAL PRINTINGS</div>
        <div className="pv-panel-tag">TCGdex • {arts.length}</div>
      </div>
      <div className="pv-alt-strip hide-scroll">
        {arts.map(a => (
          <a key={a.lang} className="pv-alt" href={a.url} target="_blank" rel="noreferrer">
            <img src={a.url} alt={a.lang} loading="lazy" />
            <div className="pv-alt-lbl">{a.lang}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function EbaySoldPanel({ query, data: preloaded }: { query: string; data?: EbayResponse | null }) {
  const [data, setData] = useState<EbayResponse | null>(preloaded ?? null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (preloaded !== undefined) {
      setData(preloaded);
      setErr(null);
      return;
    }
    setData(null);
    setErr(null);
    getEbaySold(query).then(setData).catch((e) => setErr(String(e)));
  }, [query, preloaded]);
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">EBAY SOLD COMPS</div>
        <div className="pv-panel-tag">Last completed listings</div>
      </div>
      {!data && !err && <div style={{ fontSize: 11, color: "var(--t3)" }}>Scanning eBay…</div>}
      {err && <div style={{ fontSize: 11, color: "#f87171" }}>Failed to load eBay data.</div>}
      {data?.summary && (
        <div className="pv-ebay-summary">
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">SOLD</div><div className="pv-ebay-stat-val" style={{ color: "var(--t1)" }}>{data.summary.count}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">MEDIAN</div><div className="pv-ebay-stat-val">${data.summary.median.toFixed(0)}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">AVG</div><div className="pv-ebay-stat-val">${data.summary.avg.toFixed(0)}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">RANGE</div><div className="pv-ebay-stat-val" style={{ fontSize: 11 }}>${data.summary.min.toFixed(0)}-${data.summary.max.toFixed(0)}</div></div>
        </div>
      )}
      {data?.listings.slice(0, 6).map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="pv-ebay-row" style={{ textDecoration: "none", color: "inherit" }}>
          {l.image ? <img src={l.image} alt="" loading="lazy" /> : <div style={{ width: 40, height: 40, background: "var(--s2)", borderRadius: 4 }} />}
          <div>
            <div className="pv-ebay-title">{l.title}</div>
            {l.soldDate && <div style={{ fontSize: 9, color: "var(--t3)" }}>Sold {l.soldDate}</div>}
          </div>
          <div className="pv-ebay-price">{l.price}</div>
        </a>
      ))}
      {data && data.listings.length === 0 && !err && (
        <div style={{ fontSize: 11, color: "var(--t3)" }}>No recent sold listings found.</div>
      )}
    </div>
  );
}

function BulbapediaPanel({ cardName }: { cardName: string }) {
  const [info, setInfo] = useState<BulbaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchBulbapedia(cardName).then(setInfo).finally(() => setLoading(false));
  }, [cardName]);
  if (loading) return (
    <div className="pv-bulba-panel">
      <div className="pv-bulba-head"><span>📖</span>BULBAPEDIA</div>
      <div style={{ fontSize: 11, color: "var(--t3)" }}>Looking up…</div>
    </div>
  );
  if (!info) return null;
  return (
    <div className="pv-bulba-panel">
      <div className="pv-bulba-head"><span>📖</span>BULBAPEDIA · {info.title}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {info.image && (
          <img src={info.image} alt={info.title} style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,.04)", padding: 6, flexShrink: 0 }} loading="lazy" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 8 }}>{info.extract || "No summary available."}</p>
          <a href={info.url} target="_blank" rel="noreferrer" style={{ color: "var(--gold)", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            READ FULL ENTRY →
          </a>
        </div>
      </div>
    </div>
  );
}
