import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Sparkles,
  Layers,
  ChevronRight,
  Shield,
  Zap,
  ExternalLink,
  Flame,
  Droplets,
  BookOpen,
  Filter,
} from "lucide-react";
import {
  ALL_POKEMON,
  GENERATION_METADATA,
  type NationalDexPokemon,
} from "@/lib/all-pokemon-data";
import { animatedSpriteUrl } from "@/lib/sprites";

const ALL_TYPES = [
  "All Types",
  "Normal",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Steel",
  "Dark",
  "Fairy",
];

const TYPE_COLORS: Record<string, string> = {
  Fire: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  Water: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Grass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Electric: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Psychic: "bg-pink-500/20 text-pink-400 border-pink-500/40",
  Ice: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  Dragon: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
  Dark: "bg-neutral-800 text-neutral-300 border-neutral-700",
  Fairy: "bg-rose-400/20 text-rose-300 border-rose-400/40",
  Fighting: "bg-red-600/20 text-red-400 border-red-600/40",
  Flying: "bg-sky-500/20 text-sky-400 border-sky-500/40",
  Poison: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  Ground: "bg-amber-700/20 text-amber-500 border-amber-700/40",
  Rock: "bg-stone-500/20 text-stone-300 border-stone-500/40",
  Bug: "bg-lime-500/20 text-lime-400 border-lime-500/40",
  Ghost: "bg-violet-600/20 text-violet-400 border-violet-600/40",
  Steel: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  Normal: "bg-neutral-600/20 text-neutral-400 border-neutral-600/40",
};

export function AdventurePokedexModal({
  onClose,
  onOpenVaultWithQuery,
}: {
  onClose: () => void;
  onOpenVaultWithQuery?: (species: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGen, setSelectedGen] = useState<number | 0>(0); // 0 = all
  const [selectedType, setSelectedType] = useState<string>("All Types");
  const [selectedRarity, setSelectedRarity] = useState<string>("all");
  const [selectedPokemon, setSelectedPokemon] = useState<NationalDexPokemon | null>(null);

  // Filtered Pokémon list
  const filtered = useMemo(() => {
    return ALL_POKEMON.filter((mon) => {
      // Gen filter
      if (selectedGen !== 0 && mon.gen !== selectedGen) return false;

      // Type filter
      if (selectedType !== "All Types" && !mon.types.includes(selectedType)) return false;

      // Rarity filter
      if (selectedRarity !== "all" && mon.rarity !== selectedRarity) return false;

      // Text query (Name or ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = mon.name.toLowerCase().includes(q);
        const matchesId = mon.id.toString() === q.replace(/^#/, "");
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [searchQuery, selectedGen, selectedType, selectedRarity]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/80 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Top Gradient Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  NATIONAL POKÉDEX
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-bold text-red-400">
                  ALL 1,025 SPECIES
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Complete franchise registry from #0001 Bulbasaur to #1025 Pecharunt
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/30 flex flex-col gap-3">
          {/* Search bar + Type select */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Pokémon name or #Number (e.g. Rayquaza, #1025, Pecharunt)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/60 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Type Selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 focus:outline-none focus:border-cyan-500/60"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Rarity Selector */}
            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 focus:outline-none focus:border-amber-500/60"
            >
              <option value="all">All Rarities</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          {/* Generation Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedGen(0)}
              className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition ${
                selectedGen === 0
                  ? "bg-red-500 text-neutral-950 shadow"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              ALL (1,025)
            </button>
            {GENERATION_METADATA.map((g) => (
              <button
                key={g.gen}
                type="button"
                onClick={() => setSelectedGen(g.gen)}
                className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition ${
                  selectedGen === g.gen
                    ? "bg-cyan-500 text-neutral-950 shadow"
                    : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                }`}
              >
                {g.badge} ({g.count})
              </button>
            ))}
          </div>
        </div>

        {/* Results Count Bar */}
        <div className="px-4 py-1.5 bg-neutral-950 border-b border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Showing {filtered.length} of 1,025 Pokémon</span>
          {filtered.length === 0 && <span className="text-amber-400">No matches found</span>}
        </div>

        {/* Main Grid & Detail Split View */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4 max-h-[60vh]">
          {/* Pokémon Grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 overflow-y-auto pr-1">
            {filtered.map((mon) => {
              const isSelected = selectedPokemon?.id === mon.id;
              const isLegendary = mon.rarity === "legendary";
              const isEpic = mon.rarity === "epic";

              return (
                <button
                  key={mon.id}
                  type="button"
                  onClick={() => setSelectedPokemon(mon)}
                  className={`group relative p-3 rounded-2xl border transition flex flex-col items-center text-center cursor-pointer ${
                    isSelected
                      ? "bg-neutral-800 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                      : "bg-neutral-900/60 hover:bg-neutral-800/60 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {/* Dex Number Badge */}
                  <span className="self-start text-[10px] font-bold text-neutral-400">
                    #{String(mon.id).padStart(4, "0")}
                  </span>

                  {/* 3D Animated Sprite */}
                  <div className="w-16 h-16 my-1 flex items-center justify-center relative">
                    {isLegendary && (
                      <div className="absolute inset-0 bg-amber-400/20 rounded-full filter blur-md animate-pulse" />
                    )}
                    {isEpic && (
                      <div className="absolute inset-0 bg-purple-500/20 rounded-full filter blur-md" />
                    )}
                    <img
                      src={animatedSpriteUrl(mon.name)}
                      alt={mon.name}
                      loading="lazy"
                      className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-200 relative z-10 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = "0.6";
                      }}
                    />
                  </div>

                  {/* Species Name */}
                  <span className="text-xs font-bold text-white truncate max-w-full">
                    {mon.name}
                  </span>

                  {/* Types */}
                  <div className="flex items-center gap-1 mt-1">
                    {mon.types.map((t) => (
                      <span
                        key={t}
                        className={`px-1.5 py-0.2 text-[8px] font-bold rounded-md border ${
                          TYPE_COLORS[t] || "bg-neutral-800 text-neutral-300 border-neutral-700"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Base CP Pill */}
                  <span className="mt-1 text-[10px] text-amber-400 font-bold">
                    CP {mon.baseCp}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Pokémon Inspector Panel */}
          {selectedPokemon ? (
            <div className="w-full md:w-80 rounded-2xl bg-neutral-900/90 border border-neutral-800 p-4 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-neutral-400">
                  #{String(selectedPokemon.id).padStart(4, "0")} · Gen {selectedPokemon.gen}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    selectedPokemon.rarity === "legendary"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                      : selectedPokemon.rarity === "epic"
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                      : "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
                  }`}
                >
                  {selectedPokemon.rarity}
                </span>
              </div>

              {/* 3D Animated Hero Sprite */}
              <div className="w-full h-36 rounded-xl bg-gradient-to-b from-neutral-800/40 to-neutral-950 flex items-center justify-center relative overflow-hidden border border-neutral-800/60">
                <div className="w-24 h-24 rounded-full bg-red-500/10 filter blur-xl absolute" />
                <img
                  src={animatedSpriteUrl(selectedPokemon.name)}
                  alt={selectedPokemon.name}
                  className="w-28 h-28 object-contain relative z-10 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] animate-bounce"
                />
              </div>

              <div className="text-center">
                <h4 className="text-lg font-bold text-white">{selectedPokemon.name}</h4>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  {selectedPokemon.types.map((t) => (
                    <span
                      key={t}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                        TYPE_COLORS[t] || "bg-neutral-800 text-neutral-300 border-neutral-700"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Base Stats Breakdown */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-neutral-400">
                  Combat Base Stats (BST {selectedPokemon.bst})
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-neutral-950/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400">MAX CP</span>
                    <div className="text-sm font-bold text-amber-400">{selectedPokemon.baseCp}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-neutral-950/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400">CATCH RATE</span>
                    <div className="text-sm font-bold text-emerald-400">
                      {Math.round(selectedPokemon.baseCatchRate * 100)}%
                    </div>
                  </div>
                </div>

                {/* HP / ATK / DEF / SPD Bars */}
                <div className="flex flex-col gap-1 mt-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">HP</span>
                    <span className="text-white font-bold">{selectedPokemon.baseStats.hp}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${Math.min(100, (selectedPokemon.baseStats.hp / 250) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-neutral-400">Attack</span>
                    <span className="text-white font-bold">{selectedPokemon.baseStats.atk}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.min(100, (selectedPokemon.baseStats.atk / 190) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-neutral-400">Defense</span>
                    <span className="text-white font-bold">{selectedPokemon.baseStats.def}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (selectedPokemon.baseStats.def / 230) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-neutral-400">Speed</span>
                    <span className="text-white font-bold">{selectedPokemon.baseStats.spe}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.min(100, (selectedPokemon.baseStats.spe / 180) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Button: View TCG Cards in Vault */}
              {onOpenVaultWithQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenVaultWithQuery(selectedPokemon.name);
                    onClose();
                  }}
                  className="mt-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white font-bold text-xs hover:brightness-110 transition flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>VIEW TCG CARDS IN VAULT</span>
                </button>
              )}
            </div>
          ) : (
            <div className="hidden md:flex w-80 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-6 flex-col items-center justify-center text-center text-neutral-500 shrink-0">
              <BookOpen className="w-10 h-10 mb-2 opacity-40 text-neutral-400" />
              <p className="text-xs">Select any Pokémon to inspect its 3D model, combat stats, and TCG cards.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
