import React, { useState, useEffect } from "react";
import { Sparkles, Zap, Target, Swords, X, CheckCircle, ExternalLink } from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type CaptureItemId,
  CAPTURE_ITEMS,
  attemptCapture,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";

export function AdventureEncounterModal({
  creature,
  adventureState,
  onClose,
  onStateUpdate,
  onSwitchToBattle,
  onOpenVault,
}: {
  creature: WildCreature;
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
  onSwitchToBattle: () => void;
  onOpenVault?: () => void;
}) {
  const [selectedBall, setSelectedBall] = useState<CaptureItemId>("poke_ball");
  const [selectedBerry, setSelectedBerry] = useState<CaptureItemId | undefined>(undefined);
  const [isThrowing, setIsThrowing] = useState(false);
  const [throwPhase, setThrowPhase] = useState<
    "aiming" | "flying" | "shaking" | "caught" | "escaped"
  >("aiming");
  const [captureReward, setCaptureReward] = useState<{
    xp: number;
    coins: number;
    candies: number;
    rareCandyChance: boolean;
  } | null>(null);

  const availableBalls = (
    ["poke_ball", "great_ball", "ultra_ball", "master_ball"] as CaptureItemId[]
  ).filter((b) => (adventureState.inventory.captureItems[b] || 0) > 0);

  const availableBerries = (
    ["razz_berry", "nanab_berry", "pinap_berry", "golden_razz"] as CaptureItemId[]
  ).filter((b) => (adventureState.inventory.captureItems[b] || 0) > 0);

  function handleThrow() {
    if (isThrowing || throwPhase !== "aiming") return;
    setIsThrowing(true);
    setThrowPhase("flying");

    setTimeout(() => {
      setThrowPhase("shaking");

      setTimeout(() => {
        const res = attemptCapture(
          adventureState,
          creature.id,
          selectedBall,
          selectedBerry,
          "great",
        );
        if (res.success && res.rewards) {
          setThrowPhase("caught");
          setCaptureReward(res.rewards);
          onStateUpdate(res.state);
        } else {
          setThrowPhase("escaped");
          onStateUpdate(res.state);
          setTimeout(() => setThrowPhase("aiming"), 1400);
        }
        setIsThrowing(false);
      }, 1600);
    }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-cyan-500/40 shadow-2xl p-5 sm:p-7 flex flex-col items-center gap-4 text-center overflow-hidden">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between border-b border-neutral-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
              WILD ENCOUNTER
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              CP {creature.cp} · Lv. {creature.level}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToBattle}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 transition"
              title="Fight in HD Turn-Based Battle"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>BATTLE</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wild Emergence Banner & Classic Battle Switcher */}
        <div className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-left">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base select-none">🌿</span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">
                Wild {creature.species} emerged!
              </span>
              <span className="text-[9px] text-neutral-400">
                Discovered in radar pulse (~{creature.distanceMeters}m)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToBattle}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:brightness-110 text-white font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-500/25"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>CLASSIC BATTLE</span>
          </button>
        </div>

        {/* 3D Creature Arena Stage */}
        <div className="relative w-full h-64 rounded-2xl bg-gradient-to-b from-cyan-950/30 via-neutral-900 to-neutral-950 border border-neutral-800/80 flex items-center justify-center overflow-hidden">
          {/* Floor Shadow Ring */}
          <div className="absolute bottom-6 w-44 h-12 rounded-full bg-cyan-500/15 filter blur-sm" />

          {/* Creature Image */}
          <img
            src={animatedSpriteUrl(creature.species)}
            alt={creature.species}
            className={`w-36 h-36 object-contain relative z-10 filter drop-shadow-[0_12px_18px_rgba(0,0,0,0.8)] transition-transform duration-300 ${
              throwPhase === "shaking"
                ? "scale-0 opacity-0"
                : throwPhase === "caught"
                  ? "scale-110"
                  : "animate-bounce"
            }`}
          />

          {/* Capture Ball Animation */}
          {throwPhase === "flying" && (
            <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-white shadow-lg animate-bounce z-20" />
          )}

          {throwPhase === "shaking" && (
            <div className="absolute bottom-8 w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-white shadow-xl animate-spin z-20" />
          )}

          {/* Pulsing Target Ring (Aiming) */}
          {throwPhase === "aiming" && (
            <div className="absolute w-32 h-32 rounded-full border-2 border-dashed border-emerald-400/60 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Creature Name & Details */}
        <div className="flex flex-col items-center">
          {creature.isParkNest && (
            <div className="mb-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 font-mono text-[11px] font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1.5 animate-pulse">
              <span>🌳</span>
              <span>DRESDEN PARK RARE NEST</span>
              <span className="text-amber-400">· +50% CANDY BONUS</span>
            </div>
          )}
          <h3 className="text-xl font-extrabold text-white font-mono tracking-wide">
            {creature.species}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs font-mono">
            {creature.types.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                {t}
              </span>
            ))}
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-400">{creature.relatedCardsCount} related TCG cards</span>
          </div>
        </div>

        {/* Post-Catch Celebration */}
        {throwPhase === "caught" && captureReward ? (
          <div className="w-full p-4 rounded-2xl bg-neutral-900 border border-emerald-500/40 flex flex-col gap-2 font-mono">
            <div className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>{creature.species} WAS CAUGHT!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-amber-400 font-bold">+{captureReward.coins}</span>
                <span className="block text-[10px] text-neutral-400">Coins</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-cyan-400 font-bold">+{captureReward.xp}</span>
                <span className="block text-[10px] text-neutral-400">XP</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-emerald-400 font-bold">+{captureReward.candies}</span>
                <span className="block text-[10px] text-neutral-400">Candies</span>
              </div>
            </div>
            {creature.isParkNest && (
              <span className="text-xs text-emerald-300 font-bold flex items-center justify-center gap-1">
                <span>🌳</span> Dresden Park Nest Bonus: +50% Extra Candies Awarded!
              </span>
            )}
            {captureReward.rareCandyChance && (
              <span className="text-xs text-amber-300 font-bold">
                ✨ Bonus: +1 Rare Candy Dropped!
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs"
            >
              CONTINUE
            </button>
          </div>
        ) : (
          /* BALL & BERRY SELECTION DOCK */
          <div className="w-full flex flex-col gap-3">
            {/* Balls Picker */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 font-bold">POKÉ BALLS</span>
              <div className="flex items-center gap-1.5">
                {availableBalls.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBall(b)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      selectedBall === b
                        ? "bg-cyan-500 text-neutral-950 border-cyan-400 shadow"
                        : "bg-neutral-900 border-neutral-800 text-neutral-300"
                    }`}
                  >
                    {CAPTURE_ITEMS[b].name} ({adventureState.inventory.captureItems[b] || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Berries Picker */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 font-bold">BERRIES</span>
              <div className="flex items-center gap-1.5">
                {availableBerries.map((berry) => (
                  <button
                    key={berry}
                    type="button"
                    onClick={() => setSelectedBerry(selectedBerry === berry ? undefined : berry)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                      selectedBerry === berry
                        ? "bg-amber-500 text-neutral-950 border-amber-400 shadow"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {CAPTURE_ITEMS[berry].name} ({adventureState.inventory.captureItems[berry] || 0}
                    )
                  </button>
                ))}
              </div>
            </div>

            {/* Throw Action */}
            <button
              type="button"
              disabled={isThrowing}
              onClick={handleThrow}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-neutral-950 font-mono font-bold text-xs tracking-wider shadow-xl shadow-cyan-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Target className="w-4 h-4" />
              <span>
                {isThrowing
                  ? "THROWING..."
                  : `THROW ${CAPTURE_ITEMS[selectedBall].name.toUpperCase()}`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
