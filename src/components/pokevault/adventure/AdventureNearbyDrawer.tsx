import React from "react";
import {
  Compass,
  MapPin,
  Swords,
  X,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type DiscoveryPoint,
  type BattleArena,
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
          <Compass className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-white uppercase">Nearby Radar</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[400px]">
        {/* Wild Creatures Section */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400">
            Wild Creatures ({adventureState.wildCreatures.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {adventureState.wildCreatures.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelectCreature(c);
                  onClose();
                }}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 transition flex items-center gap-2 text-left"
              >
                <img
                  src={animatedSpriteUrl(c.species)}
                  alt={c.species}
                  className="w-9 h-9 object-contain"
                />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-white truncate">{c.species}</span>
                  <span className="text-[10px] text-amber-400">CP {c.cp}</span>
                  <span className="text-[9px] text-neutral-400">{c.distanceMeters}m away</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Discovery Points Section */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-800/80">
          <span className="text-[10px] uppercase font-bold text-neutral-400">
            Discovery Landmarks
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
            Battle Arenas (Gyms)
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
                    <div className="text-[10px] text-neutral-400">{a.distanceMeters}m · Champ: {a.championSpecies}</div>
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
