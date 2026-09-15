import React, { useState } from "react";
import {
  Sparkles,
  Package,
  CheckCircle2,
  TrendingUp,
  X,
  ExternalLink,
} from "lucide-react";
import {
  type AdventureState,
  type CardCacheDrop,
  claimCardCache,
} from "@/lib/adventure-engine";

export function AdventureCardCacheModal({
  cache,
  adventureState,
  onClose,
  onStateUpdate,
  onOpenVault,
}: {
  cache: CardCacheDrop;
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
  onOpenVault?: () => void;
}) {
  const [isRipping, setIsRipping] = useState(false);
  const [isRevealed, setIsRevealed] = useState(cache.claimed);

  function handleRipPack() {
    if (isRipping || isRevealed) return;
    setIsRipping(true);

    setTimeout(() => {
      const res = claimCardCache(adventureState, cache.id);
      if (res.success) {
        onStateUpdate(res.state);
        setIsRevealed(true);
      }
      setIsRipping(false);
    }, 1500);
  }

  const p = cache.cardPayload;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-fuchsia-500/40 shadow-2xl p-6 flex flex-col items-center gap-4 text-center overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center">
          <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 font-mono text-[10px] font-bold">
            TCG CARD CACHE
          </span>
          <h3 className="text-lg font-bold text-white font-mono mt-1">{cache.title}</h3>
          <p className="text-xs text-neutral-400">Digital collectible cache found during exploration</p>
        </div>

        {/* Holographic Reveal Stage */}
        <div className="relative w-56 h-72 rounded-2xl p-1 bg-gradient-to-tr from-fuchsia-500 via-amber-400 to-cyan-400 shadow-[0_0_35px_rgba(217,70,239,0.5)] flex items-center justify-center">
          {isRevealed ? (
            <div className="w-full h-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 flex flex-col items-center p-2 relative">
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-44 object-contain rounded-lg filter drop-shadow-md"
              />
              <div className="mt-2 text-left w-full flex flex-col">
                <div className="text-xs font-bold text-white font-mono">{p.name}</div>
                <div className="text-[10px] text-neutral-400">{p.setName} · {p.number}</div>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-neutral-800 text-[11px] font-mono">
                  <span className="text-emerald-400 font-bold">${p.marketPrice.toFixed(2)}</span>
                  <span className="text-amber-400 font-bold">{p.projectedGrade}</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={handleRipPack}
              className={`w-full h-full rounded-xl bg-neutral-950 flex flex-col items-center justify-center gap-3 cursor-pointer transition-transform ${
                isRipping ? "scale-95 animate-pulse" : "hover:scale-102"
              }`}
            >
              <Package className="w-16 h-16 text-fuchsia-400 animate-bounce" />
              <div className="font-mono text-xs font-bold text-fuchsia-300">
                {isRipping ? "RIPPING PACK..." : "TAP TO OPEN PACK"}
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">Contains 1 Guaranteed Rare Card</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isRevealed ? (
          <div className="w-full flex flex-col gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-left flex items-center justify-between">
              <span>Card Added to PokéVault!</span>
              <span className="font-bold">+300 XP</span>
            </div>
            {onOpenVault && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVault();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold hover:brightness-110 shadow flex items-center justify-center gap-2"
              >
                <span>VIEW IN VAULT</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={isRipping}
            onClick={handleRipPack}
            className="w-full py-3 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 text-neutral-950 font-mono font-bold text-xs shadow-lg shadow-fuchsia-500/30 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>OPEN HOLOGRAPHIC CACHE</span>
          </button>
        )}
      </div>
    </div>
  );
}
