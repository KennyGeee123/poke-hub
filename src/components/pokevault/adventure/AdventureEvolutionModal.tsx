import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  Flame,
  Droplets,
  Moon,
  Sun,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  type AdventureState,
  type EvolutionStoneId,
  EVOLUTION_STONES,
  canEvolveCreature,
  executeEvolution,
  convertRareCandyToSpecies,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";

export function AdventureEvolutionModal({
  adventureState,
  onClose,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
}) {
  const [selectedSpecies, setSelectedSpecies] = useState<string>("Eevee");
  const [selectedStone, setSelectedStone] = useState<EvolutionStoneId>("fire_stone");
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolvedResult, setEvolvedResult] = useState<string | null>(null);
  const [rareCandyConvertCount, setRareCandyConvertCount] = useState(1);

  const availableSpecies = [
    {
      name: "Eevee",
      icon: "Eevee",
      stones: ["fire_stone", "water_stone", "thunder_stone", "ice_stone"],
    },
    { name: "Pikachu", icon: "Pikachu", stones: ["thunder_stone"] },
    { name: "Vulpix", icon: "Vulpix", stones: ["fire_stone"] },
    { name: "Gloom", icon: "Gloom", stones: ["leaf_stone", "sun_stone"] },
    { name: "Poliwhirl", icon: "Poliwhirl", stones: ["water_stone"] },
    { name: "Clefairy", icon: "Clefairy", stones: ["moon_stone"] },
    { name: "Togetic", icon: "Togetic", stones: ["shiny_stone"] },
    { name: "Murkrow", icon: "Murkrow", stones: ["dusk_stone"] },
  ];

  const stoneDef = EVOLUTION_STONES[selectedStone];
  const stoneCount = adventureState.inventory.stones[selectedStone] || 0;
  const speciesCandies = adventureState.inventory.speciesCandies[selectedSpecies] || 0;
  const rareCandies = adventureState.inventory.rareCandy;

  const evolutionCheck = canEvolveCreature(adventureState, selectedSpecies, selectedStone);

  function handleEvolve() {
    if (!evolutionCheck.eligible || isEvolving) return;
    setIsEvolving(true);

    setTimeout(() => {
      const res = executeEvolution(adventureState, selectedSpecies, selectedStone);
      if (res.success && res.evolvedTo) {
        setEvolvedResult(res.evolvedTo);
        onStateUpdate(res.state);
      }
      setIsEvolving(false);
    }, 2400);
  }

  function handleRareCandyConvert() {
    const res = convertRareCandyToSpecies(adventureState, selectedSpecies, rareCandyConvertCount);
    if (res.success) {
      onStateUpdate(res.state);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl bg-neutral-950 border border-amber-500/40 shadow-2xl p-5 sm:p-7 flex flex-col gap-5 overflow-hidden">
        {/* Glow Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                QUANTUM EVOLUTION CHAMBER
              </h3>
              <p className="text-xs text-neutral-400">
                Harness Elemental Evolution Stones & Rare Candy to evolve your squad
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {evolvedResult ? (
          /* CINEMATIC EVOLUTION SUCCESS SCREEN */
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 bg-amber-500/30 rounded-full animate-ping" />
              <img
                src={animatedSpriteUrl(evolvedResult)}
                alt={evolvedResult}
                className="w-32 h-32 object-contain relative z-10 filter drop-shadow-[0_0_25px_rgba(251,191,36,0.8)]"
              />
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-amber-400 font-mono tracking-wider">
                CONGRATULATIONS!
              </h4>
              <p className="text-sm text-neutral-200 mt-1">
                Your <span className="text-white font-bold">{selectedSpecies}</span> evolved into{" "}
                <span className="text-amber-300 font-bold">{evolvedResult}</span>!
              </p>
              <p className="text-xs text-emerald-400 font-mono mt-1">+500 Adventure XP Awarded!</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEvolvedResult(null);
                setSelectedSpecies(evolvedResult);
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-mono font-bold text-xs shadow-lg"
            >
              CONTINUE EXPLORING
            </button>
          </div>
        ) : (
          /* STANDARD EVOLUTION DASHBOARD */
          <div className="flex flex-col gap-4">
            {/* 1. Species Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase">
                1. Select Candidate Pokémon
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {availableSpecies.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      setSelectedSpecies(s.name);
                      setSelectedStone(s.stones[0] as EvolutionStoneId);
                    }}
                    className={`px-3 py-2 rounded-xl border flex items-center gap-2 whitespace-nowrap transition ${
                      selectedSpecies === s.name
                        ? "bg-amber-500/20 border-amber-500/80 text-white shadow-lg"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    <img
                      src={animatedSpriteUrl(s.name)}
                      alt={s.name}
                      className="w-6 h-6 object-contain"
                    />
                    <span className="text-xs font-mono font-bold">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Interactive Evolution Preview Card */}
            <div className="relative p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
              {/* Base Form */}
              <div className="flex flex-col items-center gap-1 w-28">
                <img
                  src={animatedSpriteUrl(selectedSpecies)}
                  alt={selectedSpecies}
                  className="w-16 h-16 object-contain"
                />
                <span className="text-xs font-bold text-white font-mono">{selectedSpecies}</span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {speciesCandies} Candies
                </span>
              </div>

              {/* Arrow with Requirements */}
              <div className="flex flex-col items-center gap-1 text-center px-2">
                <span className="text-lg">{stoneDef.emoji}</span>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400">
                  <span>{stoneDef.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Need: 1 Stone + {evolutionCheck.cost.candiesRequired} Candies
                </span>
              </div>

              {/* Target Evolved Form */}
              <div className="flex flex-col items-center gap-1 w-28">
                {evolutionCheck.targetSpecies ? (
                  <>
                    <img
                      src={animatedSpriteUrl(evolutionCheck.targetSpecies)}
                      alt={evolutionCheck.targetSpecies}
                      className="w-16 h-16 object-contain"
                    />
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {evolutionCheck.targetSpecies}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">+50% Stat Boost</span>
                  </>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-neutral-950 border border-dashed border-neutral-700 flex items-center justify-center text-xs text-neutral-500">
                    ?
                  </div>
                )}
              </div>
            </div>

            {/* 3. 10 Evolution Stones Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-neutral-400 uppercase">2. Select Evolution Stone</span>
                <span className="text-amber-400 font-normal">
                  In Bag: {stoneCount}x {stoneDef.name}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.values(EVOLUTION_STONES).map((st) => {
                  const count = adventureState.inventory.stones[st.id] || 0;
                  const selected = selectedStone === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStone(st.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                        selected
                          ? "bg-amber-500/20 border-amber-500 text-white shadow-md shadow-amber-500/20"
                          : count > 0
                            ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                            : "bg-neutral-900/50 border-neutral-800/60 text-neutral-600 opacity-60"
                      }`}
                    >
                      <span className="text-lg">{st.emoji}</span>
                      <span className="text-[11px] font-bold font-mono text-center truncate w-full">
                        {st.name}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-400">x{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Rare Candy Converter Utility */}
            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-base">🍬</span>
                <div>
                  <div className="font-bold text-white">Rare Candy Reserve: {rareCandies}x</div>
                  <div className="text-[10px] text-neutral-400">
                    Convert universal Rare Candy into {selectedSpecies} Candies
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={rareCandies <= 0}
                  onClick={handleRareCandyConvert}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] disabled:opacity-40"
                >
                  Convert +1
                </button>
              </div>
            </div>

            {/* 5. EVOLVE Execution Button */}
            <button
              type="button"
              disabled={!evolutionCheck.eligible || isEvolving}
              onClick={handleEvolve}
              className={`w-full py-3.5 rounded-2xl font-mono font-bold text-sm tracking-wide shadow-xl transition flex items-center justify-center gap-2 ${
                evolutionCheck.eligible
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-neutral-950 hover:brightness-110 shadow-amber-500/30 cursor-pointer"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-not-allowed"
              }`}
            >
              {isEvolving ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>EVOLUTION IN PROGRESS...</span>
                </>
              ) : evolutionCheck.eligible ? (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>EVOLVE INTO {evolutionCheck.targetSpecies?.toUpperCase()}!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>{evolutionCheck.missingReason || "INELIGIBLE"}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
