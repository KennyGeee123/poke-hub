import { VisualGradeScannerModal } from "./VisualGradeScannerModal";
import { P2PTradingHubModal } from "./P2PTradingHubModal";
import { useEffect, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getMarketPrice, rememberCard } from "@/lib/pokemon-api";
import { printLangMeta } from "@/lib/print-lang";
import { formatPrice, useVault } from "@/lib/vault";
import { fallbackSpriteUrls, spriteSlug } from "@/lib/sprites";
import { fallbackCardImages, hdImg } from "@/lib/card-images";
import {
  calculateGradedValue,
  type CardGrade,
  UNGRADED_QUALITIES,
  GRADED_SLABS,
  getGradeMeta,
} from "@/lib/card-grades";
import { getCardLevelAndStats } from "@/lib/card-stats";
import { applyLiveQuote, useLivePrice, usePricePending } from "@/lib/live-prices";

type Props = {
  card: TCGCard;
  onClick: (card: TCGCard) => void;
  qty?: number;
  onRemove?: () => void;
  eager?: boolean;
  defaultGrade?: CardGrade;
};

export function CardSpriteOverlay({ card, size = 140, show = true, eager = false }: { card: TCGCard; size?: number; show?: boolean; eager?: boolean }) {
  const slug = spriteSlug(card.name);
  const urls = slug ? fallbackSpriteUrls(card.name) : [];
  const [idx, setIdx] = useState(0);
  const [hide, setHide] = useState(!slug);
  useEffect(() => { setIdx(0); setHide(!slug); }, [card.name, slug]);
  if (hide || !urls[idx]) return null;
  return (
    <div
      className="pv-card-sprite-pop"
      style={{
        position: "absolute",
        top: 6,
        left: "50%",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(-50%) scale(${show ? 1.05 : 0.7}) translateY(${show ? "-4px" : "0px"})`,
        opacity: show ? 1 : 0,
        visibility: show ? "visible" : "hidden",
        transition: "all .24s cubic-bezier(0.34, 1.56, 0.64, 1)",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {/* Energetic Halo Glow */}
      <div
        style={{
          position: "absolute",
          width: "90%",
          height: "90%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, rgba(192, 132, 252, 0.2) 50%, transparent 75%)",
          filter: "blur(6px)",
        }}
      />
      <img
        src={urls[idx]}
        alt=""
        aria-hidden
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => {
          if (idx + 1 < urls.length) setIdx(idx + 1);
          else setHide(true);
        }}
        className="pv-card-sprite"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.85)) drop-shadow(0 0 10px rgba(56,189,248,0.6))",
        }}
      />
    </div>
  );
}

export function CardTile({ card, onClick, qty, onRemove, eager, defaultGrade = "raw_nm" }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const [grade, setGrade] = useState<CardGrade>(defaultGrade);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);

  const live = useLivePrice(card);
  const pricePending = usePricePending(card);
  const priced = live > 0 ? applyLiveQuote(card, live) : card;
  const gradedVal = calculateGradedValue(priced, grade);
  // Prefer live market for RAW tiles so Discover never sticks on "—" while grades load.
  const displayPrice =
    grade === "raw" || !grade
      ? (live > 0 ? live : gradedVal.estimatedGradedPrice)
      : gradedVal.estimatedGradedPrice;
  const gradeMeta = getGradeMeta(grade);
  const stats = getCardLevelAndStats(card, grade);

  const fallbacks = fallbackCardImages(card, { tile: true });
  const hd = hdImg(card, { tile: true });
  const src = fallbacks[srcIdx] || hd.src;

  useEffect(() => {
    setSrcIdx(0);
    setLoaded(false);
  }, [card.id]);

  const isGold = /\b(hyper\s*rare|mega\s*hyper|rare\s*holo\s*star|gold\s*star|secret\s*rare|rare\s*secret)\b/i.test(
    `${card.rarity || ""} ${card.name || ""}`
  );
  const isShadowless = /shadowless/i.test(`${card.set?.name || ""} ${card.rarity || ""}`);
  const isError = /\b(error|misprint)/i.test(`${card.set?.name || ""} ${card.rarity || ""} ${card.name || ""}`);
  const setLine = [card.set?.name, card.number ? `#${card.number}` : null].filter(Boolean).join(" · ");
  const priceLabel = pricePending ? null : live > 0 ? "sold avg" : displayPrice ? "market" : null;

  return (
    <div
      className="pv-card-wrap pv-card-press"
      onClick={() => { rememberCard(card); onClick(card); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{ position: "relative" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rememberCard(card);
          onClick(card);
        }
      }}
    >
      <div className="pv-card-img-wrap" style={{ position: "relative" }}>
        {!loaded && <div className="pv-card-skel" />}
        <img
          className={`pv-card-img ${loaded ? "loaded" : ""}`}
          src={src}
          srcSet={srcIdx === 0 ? hd.srcSet : undefined}
          sizes={hd.sizes}
          alt={card.name}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (srcIdx + 1 < fallbacks.length) setSrcIdx(srcIdx + 1);
            setLoaded(true);
          }}
        />
        {hovered ? <CardSpriteOverlay card={card} size={112} show eager={false} /> : null}
        {card.lang && card.lang !== "en" && (
          <div className="pv-lang-b" title={printLangMeta(card.lang).name}>{printLangMeta(card.lang).label}</div>
        )}
        {isShadowless && (
          <div className="pv-var-b" title="Base Set Shadowless" style={card.lang && card.lang !== "en" ? { left: 44 } : undefined}>SL</div>
        )}
        {isError && (
          <div className="pv-err-b" title="Error / misprint">ERR</div>
        )}
        {qty && qty > 1 ? <div className="pv-qty-b">×{qty}</div> : null}
        {onRemove && (
          <button
            className="pv-rm-b"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </div>

      <div className="pv-card-caption">
        <div className="pv-c-name" title={card.name}>{card.name}</div>
        <div className="pv-c-set" title={setLine}>{setLine}</div>
        <div className="pv-c-price-row">
          <div className="pv-c-price">
            {displayPrice
              ? formatPrice(displayPrice)
              : pricePending
                ? <span className="pv-price-pending" title="Prices pending — new set">Pending</span>
                : "—"}
          </div>
          {priceLabel ? <span className="pv-c-price-lbl">{priceLabel}</span> : null}
          {isGold ? <span className="pv-gold-chip" title="Gold / Hyper / Secret Rare">GOLD</span> : null}
        </div>

        <div className="pv-card-meta-badges">
          <span
            className="pv-grade-chip"
            style={{
              background: gradeMeta.badgeBg,
              color: gradeMeta.badgeText,
              borderColor: `${gradeMeta.badgeText}66`,
            }}
          >
            {gradeMeta.shortLabel}
          </span>
          <span className="pv-lvl-chip">Lv.{stats.level} · +{stats.totalBoostPercent}%</span>
        </div>

        <div className="pv-card-tools">
          <button
            type="button"
            className="pv-tile-tool pv-tile-tool-scan"
            onClick={(e) => {
              e.stopPropagation();
              setShowScanModal(true);
            }}
            title="Launch Dual-Sided Quantum AI Pre-Grade Scanner"
          >
            🔬 Scan
          </button>
          <button
            type="button"
            className="pv-tile-tool pv-tile-tool-trade"
            onClick={(e) => {
              e.stopPropagation();
              setShowTradeModal(true);
            }}
            title="Propose P2P Card / Game Pokémon Trade"
          >
            🔄 Trade
          </button>
        </div>

        <div
          className="pv-card-grade"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value={grade}
            onChange={(e) => {
              e.stopPropagation();
              setGrade(e.target.value as CardGrade);
            }}
            style={{
              width: "100%",
              background: "rgba(10, 15, 29, 0.95)",
              color: gradeMeta.isSlab ? "#fbbf24" : "var(--t1)",
              border: gradeMeta.isSlab ? "1px solid rgba(251, 191, 36, 0.5)" : "1px solid var(--brd)",
              borderRadius: 5,
              fontSize: 10,
              fontFamily: "var(--mono, monospace)",
              padding: "3px 4px",
              cursor: "pointer",
              outline: "none",
            }}
            title="Select Graded Slab or Ungraded Condition"
          >
            <optgroup label="📋 UNGRADED CONDITIONS">
              {UNGRADED_QUALITIES.map((g) => {
                const gm = getGradeMeta(g);
                const gVal = calculateGradedValue(card, g);
                return (
                  <option key={g} value={g}>
                    {gm.shortLabel} · {formatPrice(gVal.estimatedGradedPrice)}
                  </option>
                );
              })}
            </optgroup>
            <optgroup label="🏆 GRADED SLABS">
              {GRADED_SLABS.map((g) => {
                const gm = getGradeMeta(g);
                const gVal = calculateGradedValue(card, g);
                return (
                  <option key={g} value={g}>
                    {gm.shortLabel} · {formatPrice(gVal.estimatedGradedPrice)}
                  </option>
                );
              })}
            </optgroup>
          </select>
        </div>
      </div>
      {showScanModal && (
        <VisualGradeScannerModal
          card={card}
          initialImageUrl={src}
          onClose={() => setShowScanModal(false)}
        />
      )}
      {showTradeModal && (
        <P2PTradingHubModal
          initialCard={card}
          initialGrade={grade}
          onClose={() => setShowTradeModal(false)}
        />
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="pv-card-wrap">
      <div className="pv-card-img-wrap">
        <div className="pv-card-skel" />
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  };
  const node = msg ? (
    <div className="pv-toast" role="status">{msg}</div>
  ) : null;
  return { show, node };
}

export function CardActions({ card, onAfterAction }: { card: TCGCard; onAfterAction?: (m: string) => void }) {
  const { inVault, inWish, addToVault, toggleWish } = useVault();
  const v = inVault(card.id), w = inWish(card.id);
  return (
    <div className="flex gap-2 mt-3">
      <button
        className={`pv-btn pv-btn-fill ${v ? "yes" : ""} flex-1`}
        onClick={(e) => { e.stopPropagation(); addToVault(card); onAfterAction?.(v ? "Added another" : "Added to vault"); }}
      >
        {v ? "✓ IN VAULT" : "+ ADD TO VAULT"}
      </button>
      <button
        className="pv-btn pv-btn-out"
        style={w ? { background: "#7c3aed", borderColor: "#7c3aed" } : undefined}
        onClick={(e) => { e.stopPropagation(); toggleWish(card); onAfterAction?.(w ? "Removed wish" : "Wishlisted"); }}
        aria-label="Wishlist"
      >
        {w ? "★" : "☆"}
      </button>
    </div>
  );
}
