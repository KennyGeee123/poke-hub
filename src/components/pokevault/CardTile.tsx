import { useEffect, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getMarketPrice, rememberCard } from "@/lib/pokemon-api";
import { printLangMeta } from "@/lib/print-lang";
import { formatPrice, useVault } from "@/lib/vault";
import { fallbackSpriteUrls, spriteSlug } from "@/lib/sprites";
import { fallbackCardImages, hdImg } from "@/lib/card-images";

type Props = {
  card: TCGCard;
  onClick: (card: TCGCard) => void;
  qty?: number;
  onRemove?: () => void;
  eager?: boolean;
};

export function CardSpriteOverlay({ card, size = 140, show = true }: { card: TCGCard; size?: number; show?: boolean }) {
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
        top: 10,
        left: "50%",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(-50%) scale(${show ? 1 : 0.7})`,
        opacity: show ? 1 : 0,
        visibility: show ? "visible" : "hidden",
        transition: "opacity .22s ease, transform .22s ease, visibility .22s ease",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <img
        src={urls[idx]}
        alt=""
        aria-hidden
        loading="eager"
        decoding="async"
        onError={() => {
          if (idx + 1 < urls.length) setIdx(idx + 1);
          else setHide(true);
        }}
        className="pv-card-sprite"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function CardTile({ card, onClick, qty, onRemove, eager }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const price = getMarketPrice(card);
  const fallbacks = fallbackCardImages(card);
  const hd = hdImg(card, { tile: true });
  const src = fallbacks[srcIdx] || hd.src;

  useEffect(() => {
    setSrcIdx(0);
    setLoaded(false);
  }, [card.id]);

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
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (srcIdx + 1 < fallbacks.length) setSrcIdx(srcIdx + 1);
            setLoaded(true);
          }}
        />
        <CardSpriteOverlay card={card} size={112} show={hovered} />
        {card.lang && card.lang !== "en" && (
          <div className="pv-lang-b" title={printLangMeta(card.lang).name}>{printLangMeta(card.lang).label}</div>
        )}
        {/shadowless/i.test(`${card.set?.name || ""} ${card.rarity || ""}`) && (
          <div className="pv-var-b" title="Base Set Shadowless" style={card.lang && card.lang !== "en" ? { left: 44 } : undefined}>SL</div>
        )}
        {/\b(error|misprint)/i.test(`${card.set?.name || ""} ${card.rarity || ""} ${card.name || ""}`) && (
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
        <div className="pv-card-ovl">
          <div className="pv-c-name">{card.name}</div>
          <div className="flex justify-between items-center mt-1">
            <div className="pv-c-set">{card.set.name}</div>
            <div className="pv-c-price">{price ? formatPrice(price) : "—"}</div>
          </div>
        </div>
      </div>
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
