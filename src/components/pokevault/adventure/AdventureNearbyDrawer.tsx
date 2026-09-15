import React from "react";
import {
  Compass,
  MapPin,
  Swords,
  X,
  Target,
  ArrowRight,
  Footprints,
  Sparkles,
} from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type DiscoveryPoint,
  type BattleArena,
  RADAR_DISCOVERY_RADIUS_METERS,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";

export function AdventureNearbyDrawer({
  adventureState,
  onClose,
  onSelectCreature,
  onSelectDiscoveryPoint,
  onSelectBattleArena,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onSelectCreature: (creature: WildCreature) => void;
  onSelectDiscoveryPoint: (point: DiscoveryPoint) => void;
  onSelectBattleArena: (arena: BattleArena) => void;
}) {
  return (
    <div className="absolute inset-x-3 sm:inset-x-auto sm:right-6 bottom-20 sm:w-96 max-h-[500px] z-50 rounded-3xl bg-neutral-950/95 backdrop-blur-md border border-neutral-800 shadow-2xl p-4 flex flex-col gap-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Nearby GO Radar (45m Radius)
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[400px]">
        {/* Wild Creatures Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400">
              Nearby Wildlife ({adventureState.wildCreatures.length})
            </span>
            <span className="text-[9px] text-cyan-400/80">
              Walk to rustling grass to reveal
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {adventureState.wildCreatures.map((c) => {
              const isDiscovered = c.isDiscovered || c.distanceMeters <= RADAR_DISCOVERY_RADIUS_METERS;
              const footprints =
                c.distanceMeters <= 75 ? "🐾" : c.distanceMeters <= 150 ? "🐾🐾" : "🐾🐾🐾";

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (isDiscovered) {
                      onSelectCreature(c);
                      onClose();
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition flex items-center gap-2.5 text-left relative overflow-hidden ${
                    isDiscovered
                      ? "bg-neutral-900/90 hover:bg-neutral-800 border-cyan-500/50 hover:border-cyan-400 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      : "bg-neutral-950/80 border-neutral-800/80 cursor-default opacity-85"
                  }`}
                >
                  {/* Silhouette vs Revealed Sprite */}
                  <div className="w-10 h-10 flex items-center justify-center relative shrink-0">
                    {isDiscovered ? (
                      <img
                        src={animatedSpriteUrl(c.species)}
                        alt={c.species}
                        className="w-10 h-10 object-contain animate-bounce"
                      />
                    ) : (
                      <div className="relative flex items-center justify-center">
                        <img
                          src={animatedSpriteUrl(c.species)}
                          alt="Unknown Pokémon"
                          className="w-9 h-9 object-contain filter brightness-0 contrast-200 opacity-60"
                        />
                        <span className="absolute text-[10px] font-bold text-amber-400/90">
                          ?
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col overflow-hidden min-w-0">
                    {isDiscovered ? (
                      <>
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{c.species}</span>
                          {c.isParkNest && <span className="text-emerald-400 text-[8px]">🌳</span>}
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold">CP {c.cp}</span>
                        <span className="text-[9px] text-emerald-400 font-bold">
                          ⚡ {c.distanceMeters}m · READY
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-neutral-400 truncate">
                          ??? Mystery
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                          <span>{footprints}</span>
                          <span>~{c.distanceMeters}m</span>
                        </div>
                        <span className="text-[8px] text-amber-400/80 mt-0.5">
                          Walk closer!
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Discovery Points Section */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-800/80">
          <span className="text-[10px] uppercase font-bold text-neutral-400">
            Discovery Landmarks (PokéStops)
          </span>
          <div className="flex flex-col gap-1.5">
            {adventureState.discoveryPoints.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectDiscoveryPoint(p);
                  onClose();
                }}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">{p.title}</div>
                    <div className="text-[10px] text-neutral-400">{p.distanceMeters}m away</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
              </button>
            ))}
          </div>
        </div>

        {/* Battle Arenas Section */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-800/80">
          <span className="text-[10px] uppercase font-bold text-neutral-400">
            Battle Arenas (Gym Towers)
          </span>
          <div className="flex flex-col gap-1.5">
            {adventureState.battleArenas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelectBattleArena(a);
                  onClose();
                }}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-rose-400" />
                  <div>
                    <div className="text-xs font-bold text-white">{a.name}</div>
                    <div className="text-[10px] text-neutral-400">
                      {a.distanceMeters}m · Leader: {a.championSpecies}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
