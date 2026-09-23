import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Eye, RotateCw, X, Maximize2 } from "lucide-react";
import {
  type FoilStyle,
  type FoilCardInput,
  type HoloStyle,
  resolveFoilStyle,
  cardHasFoilFinish,
  foilStyleLabel,
  normalizeHoloStyle,
} from "@/lib/foil-style";

export type { HoloStyle, FoilStyle };

export interface InteractiveHoloCardProps {
  frontImage: string;
  backImage?: string;
  name: string;
  setName?: string;
  setId?: string;
  rarity?: string;
  subtypes?: string[];
  card?: FoilCardInput;
  isHolo?: boolean;
  className?: string;
  style?: React.CSSProperties;
  allowFlip?: boolean;
  /** When false (default for card-driven tilt), foil follows resolved finish — no Cosmic override. */
  allowStyleChange?: boolean;
  showControls?: boolean;
  height?: number | string;
  width?: number | string;
  defaultStyle?: HoloStyle | FoilStyle;
  onExpandModal?: () => void;
}

const DEFAULT_CARD_BACK = "https://images.pokemontcg.io/base1/back.png";

export function InteractiveHoloCard({
  frontImage,
  backImage = DEFAULT_CARD_BACK,
  name,
  setName,
  setId,
  rarity,
  subtypes,
  card,
  isHolo,
  className = "",
  style = {},
  allowFlip = true,
  allowStyleChange = false,
  showControls = true,
  height,
  width,
  defaultStyle,
  onExpandModal,
}: InteractiveHoloCardProps) {
  const foilCard: FoilCardInput = useMemo(
    () =>
      card || {
        name,
        rarity,
        subtypes,
        set: { id: setId, name: setName },
      },
    [card, name, rarity, subtypes, setId, setName],
  );

  const resolved = useMemo(() => resolveFoilStyle(foilCard), [foilCard]);
  const hasFoil = isHolo ?? cardHasFoilFinish(foilCard);
  const initialStyle = normalizeHoloStyle(defaultStyle ?? resolved);

  const [isFlipped, setIsFlipped] = useState(false);
  const [holoStyle, setHoloStyle] = useState<FoilStyle>(initialStyle);
  const [isHovered, setIsHovered] = useState(false);
  // Geek Squad: never start idle rAF — only pointer-driven tilt
  const [isAutoFloating] = useState(false);
  const [holoIntensity] = useState(0.85);

  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Keep overlay in sync when navigating between cards
  useEffect(() => {
    if (!allowStyleChange) {
      setHoloStyle(resolved);
    }
  }, [resolved, allowStyleChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
    const normY = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));

    setCoords({ x: normX, y: normY });
    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
    });
    setIsHovered(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  }, []);

  // Ambient rAF only while explicitly enabled (kept off — Geek Squad)
  useEffect(() => {
    if (!isAutoFloating || isHovered) return;
    let frame = 0;
    let t = 0;
    const animate = () => {
      t += 0.035;
      setCoords({ x: Math.sin(t * 0.7) * 0.3, y: Math.cos(t * 0.9) * 0.22 });
      setGlarePos({
        x: 50 + Math.sin(t * 0.7) * 22,
        y: 50 + Math.cos(t * 0.9) * 22,
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isAutoFloating, isHovered]);

  const maxTiltDeg = 24;
  const rotateX = -coords.y * maxTiltDeg;
  const rotateY = coords.x * maxTiltDeg;
  const cardScale = isHovered ? 1.04 : 1.0;
  const sheenAngle = Math.round(Math.atan2(coords.y, coords.x) * (180 / Math.PI) + 180);
  const activeStyle: FoilStyle = hasFoil || holoStyle === "specular" ? holoStyle : "specular";

  const renderHoloLayer = () => {
    switch (activeStyle) {
      case "prism_rainbow":
        return (
          <>
            {/* Classic linear / rainbow stripe — Base Set style */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.45,
                backgroundImage: `linear-gradient(${sheenAngle}deg,
                  rgba(255, 0, 128, 0) 0%,
                  rgba(255, 0, 128, 0.35) 22%,
                  rgba(255, 230, 0, 0.45) 36%,
                  rgba(0, 255, 170, 0.5) 50%,
                  rgba(0, 180, 255, 0.45) 64%,
                  rgba(180, 0, 255, 0.35) 78%,
                  rgba(255, 0, 128, 0) 100%)`,
                backgroundSize: "220% 220%",
                backgroundPosition: `${50 + coords.x * 28}% ${50 + coords.y * 28}%`,
                mixBlendMode: "color-dodge",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: `repeating-linear-gradient(${sheenAngle + 90}deg,
                  rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px,
                  transparent 1px, transparent 7px)`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "cosmos_holo":
        // Star/circle field — ONLY when resolveFoilStyle says cosmos era
        return (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.55,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%,
                  rgba(255, 255, 255, 0.9) 0%,
                  rgba(255, 100, 200, 0.55) 22%,
                  rgba(100, 200, 255, 0.45) 48%,
                  rgba(255, 220, 100, 0.35) 68%,
                  transparent 88%)`,
                mixBlendMode: "color-dodge",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-55"
              style={{
                backgroundImage: `radial-gradient(1.5px 1.5px at ${15 + coords.x * 10}% ${25 + coords.y * 10}%, #ffffff, rgba(0,0,0,0)),
                  radial-gradient(2px 2px at ${75 - coords.x * 10}% ${35 - coords.y * 10}%, #ffdd88, rgba(0,0,0,0)),
                  radial-gradient(2.5px 2.5px at ${45 + coords.x * 8}% ${65 + coords.y * 8}%, #88ffff, rgba(0,0,0,0)),
                  radial-gradient(1.5px 1.5px at ${85 - coords.x * 8}% ${80 - coords.y * 8}%, #ff88ff, rgba(0,0,0,0)),
                  radial-gradient(1px 1px at 30% 70%, #ffffff, rgba(0,0,0,0)),
                  radial-gradient(1px 1px at 60% 15%, #ffeebb, rgba(0,0,0,0))`,
                backgroundSize: "72px 72px",
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "reverse_holo":
        return (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: isHovered ? holoIntensity * 0.85 : holoIntensity * 0.4,
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.2) ${Math.max(0, glarePos.x - 28)}%,
                rgba(255, 220, 150, 0.65) ${glarePos.x}%,
                rgba(180, 240, 255, 0.55) ${Math.min(100, glarePos.x + 14)}%,
                transparent 100%)`,
              mixBlendMode: "color-dodge",
            }}
          />
        );

      case "secret_gold":
        return (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.6,
                background: `radial-gradient(ellipse at ${glarePos.x}% ${glarePos.y}%,
                  rgba(255, 235, 120, 0.9) 0%,
                  rgba(255, 170, 0, 0.65) 32%,
                  rgba(217, 70, 239, 0.4) 58%,
                  transparent 82%)`,
                mixBlendMode: "color-dodge",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `repeating-linear-gradient(120deg, rgba(255,215,0,0.35) 0px, rgba(255,215,0,0.35) 2px, transparent 2px, transparent 8px)`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "shattered":
        return (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity * 0.9 : holoIntensity * 0.5,
                backgroundImage: `linear-gradient(${sheenAngle}deg,
                  rgba(255,255,255,0) 0%,
                  rgba(255,80,180,0.4) 25%,
                  rgba(80,220,255,0.45) 50%,
                  rgba(255,220,80,0.4) 75%,
                  rgba(255,255,255,0) 100%)`,
                backgroundSize: "200% 200%",
                backgroundPosition: `${50 + coords.x * 25}% ${50 + coords.y * 25}%`,
                mixBlendMode: "color-dodge",
              }}
            />
            {/* Cracked-ice shards — angular, not stars/circles */}
            <div
              className="absolute inset-0 pointer-events-none opacity-45"
              style={{
                backgroundImage: `
                  linear-gradient(125deg, transparent 40%, rgba(255,255,255,0.35) 41%, transparent 42%),
                  linear-gradient(55deg, transparent 55%, rgba(180,240,255,0.3) 56%, transparent 58%),
                  linear-gradient(200deg, transparent 30%, rgba(255,180,255,0.25) 32%, transparent 34%),
                  linear-gradient(10deg, transparent 65%, rgba(255,255,200,0.28) 66%, transparent 68%)`,
                backgroundPosition: `${coords.x * 12}px ${coords.y * 12}px`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "texture_sheen":
        // 30th / illustration: soft rainbow + fine grain — NO starfield, NO circle-dot sheet
        return (
          <>
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
              style={{
                opacity: isHovered ? Math.min(0.75, holoIntensity * 0.85) : holoIntensity * 0.35,
                backgroundImage: `linear-gradient(${sheenAngle}deg,
                  rgba(255, 120, 180, 0) 0%,
                  rgba(255, 120, 180, 0.22) 28%,
                  rgba(120, 220, 255, 0.28) 50%,
                  rgba(255, 220, 120, 0.22) 72%,
                  rgba(255, 120, 180, 0) 100%)`,
                backgroundSize: "180% 180%",
                backgroundPosition: `${50 + coords.x * 22}% ${50 + coords.y * 22}%`,
                mixBlendMode: "soft-light",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                // Fine diagonal texture — not dots/stars
                backgroundImage: `repeating-linear-gradient(
                  ${35 + coords.x * 8}deg,
                  rgba(255,255,255,0.08) 0px,
                  rgba(255,255,255,0.08) 1px,
                  transparent 1px,
                  transparent 5px
                )`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "specular":
      default:
        // Non-holo / clean: no foil sheet — specular handled below
        return null;
    }
  };

  const showFoilBadge = hasFoil && activeStyle !== "specular";

  return (
    <div className={`flex flex-col items-center gap-2.5 w-full ${className}`} style={style}>
      <div
        className="relative select-none touch-none cursor-grab active:cursor-grabbing group w-full aspect-[2.5/3.5] max-w-[300px]"
        style={{
          perspective: "1200px",
          width,
          height,
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div
          ref={cardRef}
          className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-transform ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY + (isFlipped ? 180 : 0)}deg) scale3d(${cardScale}, ${cardScale}, ${cardScale})`,
            transitionDuration: isHovered ? "75ms" : "450ms",
            boxShadow: isHovered
              ? `${-coords.x * 24}px ${coords.y * 24 + 16}px 32px rgba(0,0,0,0.65), 0 0 30px rgba(56, 189, 248, 0.35)`
              : "0 12px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-neutral-900 border-2 border-amber-400/40"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <img
              src={frontImage}
              alt={name}
              className="w-full h-full object-fill pointer-events-none"
              draggable={false}
            />

            {renderHoloLayer()}

            {/* Specular glare — always; this is light reflection, not a fake holo sheet */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-150"
              style={{
                opacity: isHovered ? (activeStyle === "specular" ? 0.55 : 0.7) : 0.18,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%,
                  rgba(255, 255, 255, 0.75) 0%,
                  rgba(255, 255, 255, 0.18) 28%,
                  rgba(255, 255, 255, 0) 62%)`,
                mixBlendMode: "screen",
              }}
            />

            <div
              className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-white/20"
              style={{
                boxShadow: `inset ${coords.x * 6}px ${-coords.y * 6}px 12px rgba(255, 255, 255, 0.4),
                  inset ${-coords.x * 6}px ${coords.y * 6}px 12px rgba(0, 0, 0, 0.5)`,
              }}
            />

            {showFoilBadge && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-amber-400/60 text-[9px] font-mono font-bold text-amber-300 flex items-center gap-1 shadow-lg pointer-events-none">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                <span>{foilStyleLabel(activeStyle).toUpperCase()}</span>
              </div>
            )}
          </div>

          <div
            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-neutral-950 border-2 border-blue-500/40"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <img
              src={backImage}
              alt="Card Back"
              className="w-full h-full object-fill pointer-events-none"
              draggable={false}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0.4,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.55) 0%, transparent 60%)`,
                mixBlendMode: "screen",
              }}
            />
          </div>
        </div>
      </div>

      {showControls && (
        <div className="w-full max-w-[300px] flex flex-col gap-2 p-2.5 rounded-2xl bg-neutral-950/90 backdrop-blur-md border border-neutral-800 text-xs font-mono shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold text-[10px] flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>3D TILT · {foilStyleLabel(activeStyle).toUpperCase()}</span>
            </span>

            <div className="flex items-center gap-1">
              {allowFlip && (
                <button
                  type="button"
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center gap-1 transition"
                  title="Flip Card to Back"
                >
                  <RotateCw className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isFlipped ? "FRONT" : "FLIP"}</span>
                </button>
              )}

              {onExpandModal && (
                <button
                  type="button"
                  onClick={onExpandModal}
                  className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                  title="Expand Fullscreen 3D Holo Inspector"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {allowStyleChange && (
            <div className="flex items-center gap-1 pt-1 border-t border-neutral-800/80">
              <span className="text-[9px] text-neutral-500 uppercase">Foil:</span>
              <div className="grid grid-cols-4 gap-1 flex-1">
                {(
                  [
                    ["prism_rainbow", "Prism"],
                    ["cosmos_holo", "Cosmos"],
                    ["texture_sheen", "Texture"],
                    ["reverse_holo", "Reverse"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHoloStyle(id)}
                    className={`px-1 py-0.5 rounded text-[9px] font-bold transition text-center truncate ${
                      holoStyle === id
                        ? "bg-gradient-to-r from-pink-500 to-cyan-500 text-white shadow"
                        : "bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[9px] text-neutral-500 text-center italic">
            Foil matched to card finish · tilt to inspect glare
          </div>
        </div>
      )}
    </div>
  );
}

export function HoloInspectorModal({
  isOpen,
  onClose,
  frontImage,
  backImage,
  name,
  setName,
  setId,
  rarity,
  subtypes,
  card,
}: {
  isOpen: boolean;
  onClose: () => void;
  frontImage: string;
  backImage?: string;
  name: string;
  setName?: string;
  setId?: string;
  rarity?: string;
  subtypes?: string[];
  card?: FoilCardInput;
}) {
  if (!isOpen) return null;

  const foilCard = card || { name, rarity, subtypes, set: { id: setId, name: setName } };
  const style = resolveFoilStyle(foilCard);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-lg animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.3)] p-6 flex flex-col items-center gap-4 text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
            3D FOIL INSPECTOR · {foilStyleLabel(style).toUpperCase()}
          </span>
          <h3 className="text-xl font-extrabold text-white font-mono mt-1">{name}</h3>
          <p className="text-xs text-neutral-400">
            {setName || "Pokémon TCG"} · {rarity || "—"}
          </p>
        </div>

        <div className="w-full flex justify-center py-2">
          <InteractiveHoloCard
            frontImage={frontImage}
            backImage={backImage}
            name={name}
            setName={setName}
            setId={setId}
            rarity={rarity}
            subtypes={subtypes}
            card={foilCard}
            allowFlip={true}
            allowStyleChange={false}
            showControls={true}
            width={280}
            height={390}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full max-w-[280px] py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-neutral-950 font-mono font-bold text-xs hover:brightness-110 shadow-lg transition"
        >
          DONE INSPECTING
        </button>
      </div>
    </div>
  );
}
