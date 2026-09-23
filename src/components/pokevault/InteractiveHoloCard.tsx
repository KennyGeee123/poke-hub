import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Eye, RotateCw, Layers, ZoomIn, Sliders, ShieldCheck, X, Maximize2 } from "lucide-react";

export type HoloStyle = "prism_rainbow" | "cosmic_galaxy" | "reverse_holo" | "secret_gold";

export interface InteractiveHoloCardProps {
  frontImage: string;
  backImage?: string;
  name: string;
  setName?: string;
  rarity?: string;
  isHolo?: boolean;
  className?: string;
  style?: React.CSSProperties;
  allowFlip?: boolean;
  allowStyleChange?: boolean;
  showControls?: boolean;
  height?: number | string;
  width?: number | string;
  defaultStyle?: HoloStyle;
  onExpandModal?: () => void;
}

const DEFAULT_CARD_BACK = "https://images.pokemontcg.io/base1/back.png";

export function InteractiveHoloCard({
  frontImage,
  backImage = DEFAULT_CARD_BACK,
  name,
  setName,
  rarity,
  isHolo = true,
  className = "",
  style = {},
  allowFlip = true,
  allowStyleChange = true,
  showControls = true,
  height,
  width,
  defaultStyle = "prism_rainbow",
  onExpandModal,
}: InteractiveHoloCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [holoStyle, setHoloStyle] = useState<HoloStyle>(defaultStyle);
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoFloating, setIsAutoFloating] = useState(false); // lag: no rAF until first hover
  const [holoIntensity, setHoloIntensity] = useState(0.85);

  // 3D coordinates (-1 to 1)
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

  const cardRef = useRef<HTMLDivElement>(null);

  // Handle pointer/mouse move across card surface
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
    const normY = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));

    const glareX = Math.round((x / rect.width) * 100);
    const glareY = Math.round((y / rect.height) * 100);

    setCoords({ x: normX, y: normY });
    setGlarePos({ x: glareX, y: glareY });
    setIsHovered(true);
    setIsAutoFloating(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    // Smoothly settle back to level — do not restart idle rAF (Geek Squad lag)
    setCoords({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
    setIsAutoFloating(false);
  }, []);

  // Ambient gentle floating animation when idle
  useEffect(() => {
    if (!isAutoFloating || isHovered) return;

    let frame: number;
    let t = 0;
    const animate = () => {
      t += 0.035;
      const x = Math.sin(t * 0.7) * 0.3;
      const y = Math.cos(t * 0.9) * 0.22;
      setCoords({ x, y });
      setGlarePos({
        x: 50 + Math.sin(t * 0.7) * 22,
        y: 50 + Math.cos(t * 0.9) * 22,
      });
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isAutoFloating, isHovered]);

  // Derived 3D transform calculations
  const maxTiltDeg = 24;
  const rotateX = -coords.y * maxTiltDeg;
  const rotateY = coords.x * maxTiltDeg;
  const cardScale = isHovered ? 1.04 : 1.0;

  // Angle for linear rainbow sheen
  const sheenAngle = Math.round(Math.atan2(coords.y, coords.x) * (180 / Math.PI) + 180);

  // Dynamic Holo Overlays by style
  const renderHoloLayer = () => {
    if (!isHolo) return null;

    switch (holoStyle) {
      case "prism_rainbow":
        return (
          <>
            {/* Prismatic Rainbow Diagonal Sheen */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.55,
                backgroundImage: `linear-gradient(${sheenAngle}deg, 
                  rgba(255, 0, 128, 0) 0%, 
                  rgba(255, 0, 128, 0.4) 20%, 
                  rgba(255, 230, 0, 0.5) 35%, 
                  rgba(0, 255, 170, 0.55) 50%, 
                  rgba(0, 180, 255, 0.5) 65%, 
                  rgba(180, 0, 255, 0.4) 80%, 
                  rgba(255, 0, 128, 0) 100%)`,
                backgroundSize: "200% 200%",
                backgroundPosition: `${50 + coords.x * 30}% ${50 + coords.y * 30}%`,
                mixBlendMode: "color-dodge",
              }}
            />
            {/* Prismatic Cross Hatch Grid Shimmer */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.15) 40%, transparent 70%),
                  repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 2px, transparent 2px, transparent 6px)`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "cosmic_galaxy":
        return (
          <>
            {/* Vintage Cosmic Galaxy Swirl */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.6,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, 
                  rgba(255, 255, 255, 0.95) 0%, 
                  rgba(255, 100, 200, 0.65) 20%, 
                  rgba(100, 200, 255, 0.55) 45%, 
                  rgba(255, 220, 100, 0.45) 65%, 
                  transparent 85%)`,
                mixBlendMode: "color-dodge",
              }}
            />
            {/* Cosmic Star Dust Glitter Specks */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                backgroundImage: `radial-gradient(1.5px 1.5px at ${15 + coords.x * 10}% ${25 + coords.y * 10}%, #ffffff, rgba(0,0,0,0)),
                  radial-gradient(2px 2px at ${75 - coords.x * 10}% ${35 - coords.y * 10}%, #ffdd88, rgba(0,0,0,0)),
                  radial-gradient(2.5px 2.5px at ${45 + coords.x * 8}% ${65 + coords.y * 8}%, #88ffff, rgba(0,0,0,0)),
                  radial-gradient(1.5px 1.5px at ${85 - coords.x * 8}% ${80 - coords.y * 8}%, #ff88ff, rgba(0,0,0,0))`,
                backgroundSize: "80px 80px",
                mixBlendMode: "overlay",
              }}
            />
          </>
        );

      case "reverse_holo":
        return (
          <>
            {/* Vertical Foil Sheen */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity * 0.9 : holoIntensity * 0.45,
                background: `linear-gradient(90deg, 
                  transparent 0%, 
                  rgba(255, 255, 255, 0.25) ${Math.max(0, glarePos.x - 25)}%, 
                  rgba(255, 220, 150, 0.75) ${glarePos.x}%, 
                  rgba(180, 240, 255, 0.65) ${Math.min(100, glarePos.x + 15)}%, 
                  transparent 100%)`,
                mixBlendMode: "color-dodge",
              }}
            />
          </>
        );

      case "secret_gold":
        return (
          <>
            {/* Ultra Rare Gold & Prismatic Luster */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: isHovered ? holoIntensity : holoIntensity * 0.65,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, 
                  rgba(255, 235, 120, 0.95) 0%, 
                  rgba(255, 170, 0, 0.7) 30%, 
                  rgba(217, 70, 239, 0.5) 55%, 
                  transparent 80%)`,
                mixBlendMode: "color-dodge",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-45"
              style={{
                backgroundImage: `repeating-linear-gradient(120deg, rgba(255,215,0,0.4) 0px, rgba(255,215,0,0.4) 2px, transparent 2px, transparent 8px)`,
                mixBlendMode: "overlay",
              }}
            />
          </>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center gap-2.5 w-full ${className}`} style={style}>
      {/* 3D Perspective Card Stage */}
      <div
        className="relative select-none touch-none cursor-grab active:cursor-grabbing group w-full aspect-[2.5/3.5] max-w-[300px]"
        style={{
          perspective: "1200px",
          width: width,
          height: height,
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={() => setIsAutoFloating(false)}
      >
        {/* Tilting Card Wrapper */}
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
          {/* FRONT FACE */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-neutral-900 border-2 border-amber-400/40"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            {/* Card Graphic */}
            <img
              src={frontImage}
              alt={name}
              className="w-full h-full object-fill pointer-events-none"
              draggable={false}
            />

            {/* Holographic / Halo Foil Layers */}
            {renderHoloLayer()}

            {/* Specular Glare / Spotlight Reflection Tracking Cursor */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-150"
              style={{
                opacity: isHovered ? 0.78 : 0.25,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, 
                  rgba(255, 255, 255, 0.8) 0%, 
                  rgba(255, 255, 255, 0.22) 28%, 
                  rgba(255, 255, 255, 0) 65%)`,
                mixBlendMode: "screen",
              }}
            />

            {/* Slab Protective Chamfer Acrylic Border Reflection */}
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-white/20"
              style={{
                boxShadow: `inset ${coords.x * 6}px ${-coords.y * 6}px 12px rgba(255, 255, 255, 0.4),
                  inset ${-coords.x * 6}px ${coords.y * 6}px 12px rgba(0, 0, 0, 0.5)`,
              }}
            />

            {/* Floating Halo Badge */}
            {isHolo && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-amber-400/60 text-[9px] font-mono font-bold text-amber-300 flex items-center gap-1 shadow-lg pointer-events-none">
                <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-spin-slow" />
                <span>HOLO FOIL</span>
              </div>
            )}
          </div>

          {/* BACK FACE (CARD BACK) */}
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

            {/* Back face subtle gloss shine */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0.45,
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.6) 0%, transparent 60%)`,
                mixBlendMode: "screen",
              }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Toolbar & Controls */}
      {showControls && (
        <div className="w-full max-w-[300px] flex flex-col gap-2 p-2.5 rounded-2xl bg-neutral-950/90 backdrop-blur-md border border-neutral-800 text-xs font-mono shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold text-[10px] flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>3D HOLO TILT ACTIVE</span>
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

          {/* Holo Foil Style Selector */}
          {allowStyleChange && isHolo && (
            <div className="flex items-center gap-1 pt-1 border-t border-neutral-800/80">
              <span className="text-[9px] text-neutral-500 uppercase">Foil:</span>
              <div className="grid grid-cols-4 gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setHoloStyle("prism_rainbow")}
                  className={`px-1 py-0.5 rounded text-[9px] font-bold transition text-center truncate ${
                    holoStyle === "prism_rainbow"
                      ? "bg-gradient-to-r from-pink-500 to-cyan-500 text-white shadow"
                      : "bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                  title="Prism Rainbow Holo"
                >
                  Prism
                </button>
                <button
                  type="button"
                  onClick={() => setHoloStyle("cosmic_galaxy")}
                  className={`px-1 py-0.5 rounded text-[9px] font-bold transition text-center truncate ${
                    holoStyle === "cosmic_galaxy"
                      ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow"
                      : "bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                  title="Cosmic Galaxy Stars"
                >
                  Cosmic
                </button>
                <button
                  type="button"
                  onClick={() => setHoloStyle("reverse_holo")}
                  className={`px-1 py-0.5 rounded text-[9px] font-bold transition text-center truncate ${
                    holoStyle === "reverse_holo"
                      ? "bg-neutral-700 text-white shadow"
                      : "bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                  title="Reverse Holo Sheen"
                >
                  Reverse
                </button>
                <button
                  type="button"
                  onClick={() => setHoloStyle("secret_gold")}
                  className={`px-1 py-0.5 rounded text-[9px] font-bold transition text-center truncate ${
                    holoStyle === "secret_gold"
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-neutral-950 font-extrabold shadow"
                      : "bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                  title="Secret Rare Gold"
                >
                  Gold
                </button>
              </div>
            </div>
          )}

          {/* Interactive Hint */}
          <div className="text-[9px] text-neutral-500 text-center italic">
            Move mouse or drag finger to inspect rainbow holo glare & flare
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE FULLSCREEN 3D HOLO INSPECTOR MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function HoloInspectorModal({
  isOpen,
  onClose,
  frontImage,
  backImage,
  name,
  setName,
  rarity,
}: {
  isOpen: boolean;
  onClose: () => void;
  frontImage: string;
  backImage?: string;
  name: string;
  setName?: string;
  rarity?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-lg animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.3)] p-6 flex flex-col items-center gap-4 text-center">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex flex-col items-center">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
            ✨ QUANTUM 3D HOLOGRAPHIC INSPECTOR
          </span>
          <h3 className="text-xl font-extrabold text-white font-mono mt-1">{name}</h3>
          <p className="text-xs text-neutral-400">{setName || "Pokémon TCG"} · {rarity || "Holographic Rare"}</p>
        </div>

        {/* Interactive Holo Stage */}
        <div className="w-full flex justify-center py-2">
          <InteractiveHoloCard
            frontImage={frontImage}
            backImage={backImage}
            name={name}
            setName={setName}
            rarity={rarity}
            isHolo={true}
            allowFlip={true}
            allowStyleChange={true}
            showControls={true}
            width={280}
            height={390}
          />
        </div>

        {/* Close Action */}
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
