import React, { useState } from "react";
import { MapPin, Sparkles, RotateCw, X, CheckCircle } from "lucide-react";
import {
  type AdventureState,
  type DiscoveryPoint,
  spinDiscoveryPoint,
  EVOLUTION_STONES,
} from "@/lib/adventure-engine";

export function AdventureDiscoveryModal({
  point,
  adventureState,
  onClose,
  onStateUpdate,
}: {
  point: DiscoveryPoint;
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
}) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinLoot, setSpinLoot] = useState<{
    xp: number;
    coins: number;
    ballsAwarded: number;
    berriesAwarded: number;
    stoneAwarded?: string;
  } | null>(null);

  const now = Date.now();
  const elapsed = now - point.lastSpunTimestamp;
  const onCooldown = elapsed < point.cooldownMs;
  const cooldownSec = Math.ceil((point.cooldownMs - elapsed) / 1000);

  function handleSpin() {
    if (isSpinning || onCooldown) return;
    setIsSpinning(true);

    setTimeout(() => {
      const res = spinDiscoveryPoint(adventureState, point.id);
      if (res.success && res.loot) {
        setSpinLoot(res.loot);
        onStateUpdate(res.state);
      }
      setIsSpinning(false);
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-cyan-500/40 shadow-2xl p-6 flex flex-col items-center gap-4 text-center overflow-hidden">
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
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
            DISCOVERY POINT
          </span>
          <h3 className="text-lg font-bold text-white font-mono mt-1">{point.title}</h3>
          <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{point.subtitle}</p>
        </div>

        {/* 3D Photo Disc Circle */}
        <div className="relative w-48 h-48 rounded-full p-2 bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center justify-center">
          <div
            className={`w-full h-full rounded-full overflow-hidden border-4 border-neutral-950 transition-transform duration-1000 ${
              isSpinning ? "rotate-[720deg] scale-95" : "hover:rotate-6"
            }`}
          >
            <img src={point.photoUrl} alt={point.title} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Rewards / Status */}
        {spinLoot ? (
          <div className="w-full p-3.5 rounded-2xl bg-neutral-900 border border-cyan-500/40 flex flex-col gap-2 animate-bounce">
            <span className="text-xs font-mono font-bold text-cyan-300 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> DISCOVERY REWARDS!
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-amber-400 font-bold">+{spinLoot.coins}</span>
                <span className="block text-[10px] text-neutral-400">Coins</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-cyan-400 font-bold">+{spinLoot.xp}</span>
                <span className="block text-[10px] text-neutral-400">XP</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-rose-400 font-bold">+{spinLoot.ballsAwarded}</span>
                <span className="block text-[10px] text-neutral-400">Poké Balls</span>
              </div>
            </div>
            {spinLoot.stoneAwarded && (
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold">
                ✨ Bonus: {(EVOLUTION_STONES as Record<string, any>)[spinLoot.stoneAwarded]?.name}{" "}
                Dropped!
              </div>
            )}
          </div>
        ) : onCooldown ? (
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-purple-300 text-xs font-mono">
            Landmark is recharging. Ready in {cooldownSec}s.
          </div>
        ) : (
          <p className="text-xs text-neutral-400 font-mono">
            Spin the photo disc to collect Coins, XP, Poké Balls & Rare Items!
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={onCooldown || isSpinning}
          onClick={handleSpin}
          className={`w-full py-3 rounded-2xl font-mono font-bold text-xs tracking-wide shadow-lg transition flex items-center justify-center gap-2 ${
            onCooldown
              ? "bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-not-allowed"
              : "bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-cyan-500/30 cursor-pointer"
          }`}
        >
          <RotateCw className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
          <span>
            {isSpinning ? "SPINNING DISC..." : onCooldown ? "COOLDOWN ACTIVE" : "SPIN PHOTO DISC"}
          </span>
        </button>
      </div>
    </div>
  );
}
