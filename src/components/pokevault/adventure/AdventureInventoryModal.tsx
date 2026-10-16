import React, { useState } from "react";
import { Package, Sparkles, X, Zap, Target, ArrowRight } from "lucide-react";
import {
  type AdventureState,
  EVOLUTION_STONES,
  CAPTURE_ITEMS,
  BOOST_ITEMS,
  REPEL_ITEMS,
  teachBagTm,
  useRepel,
  type RepelItemId,
} from "@/lib/adventure-engine";
import { syncPartyToScannedCards } from "@/lib/adventure-party";
import { TM_DISCS } from "@/lib/tm-catalog";
import { BallMark } from "./BallMark";

export function AdventureInventoryModal({
  adventureState,
  onClose,
  onOpenEvolution,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onOpenEvolution: () => void;
  onStateUpdate?: (updated: AdventureState) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "evolution" | "capture" | "repels" | "tms" | "boosts" | "candies"
  >("evolution");
  const [note, setNote] = useState<string | null>(null);
  const [tmQuery, setTmQuery] = useState("");
  const [teachFor, setTeachFor] = useState<string | null>(null);
  const inv = adventureState.inventory;
  const scanned = Object.values(adventureState.world.scannedFighters || {}).filter(
    (fighter) => fighter.cardIds?.length,
  );
  const tmRows = TM_DISCS.filter((disc) => {
    const q = tmQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      disc.label.toLowerCase().includes(q) ||
      disc.move.toLowerCase().includes(q) ||
      disc.type.toLowerCase().includes(q)
    );
  });
  const learnersFor = (move: string) =>
    scanned.filter((fighter) =>
      (fighter.machines || []).some((name) => name.toLowerCase() === move.toLowerCase()),
    );
  const teach = (species: string, tmId: string) => {
    const result = teachBagTm(species, tmId);
    setNote(result.message);
    setTeachFor(null);
    if (!result.success) return;
    onStateUpdate?.(result.state);
    void syncPartyToScannedCards(species);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl p-5 sm:p-7 flex flex-col gap-4 overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 font-mono">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white uppercase">Trainer Item Bag</h3>
              <p className="text-xs text-neutral-400">
                All collected Evolution items, capture supplies & boosts
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

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 pb-2 text-xs font-mono">
          {[
            { id: "evolution", label: "Stones & Candy" },
            { id: "capture", label: "Balls & Berries" },
            { id: "repels", label: "Repels" },
            { id: "tms", label: "TMs" },
            { id: "boosts", label: "Boosts" },
            { id: "candies", label: "Species Candies" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === t.id
                  ? "bg-blue-600 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto pr-1 flex flex-col gap-3 max-h-[50vh] font-mono">
          {activeTab === "evolution" && (
            <div className="flex flex-col gap-3">
              {/* Rare Candy Feature Row */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🍬</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">Rare Candy</h4>
                    <p className="text-[11px] text-neutral-400">Universal evolution catalyst</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white font-mono">{inv.rareCandy}x</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEvolution();
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-neutral-950 font-bold text-xs"
                  >
                    Use
                  </button>
                </div>
              </div>

              {/* 10 Evolution Stones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(EVOLUTION_STONES).map((st) => {
                  const count = inv.stones[st.id] || 0;
                  return (
                    <div
                      key={st.id}
                      className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{st.emoji}</span>
                        <div>
                          <div className="text-xs font-bold text-white">{st.name}</div>
                          <div className="text-[10px] text-neutral-400">{st.element} Element</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-400">{count}x</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "capture" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(CAPTURE_ITEMS).map((item) => {
                const count = inv.captureItems[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {item.colors ? <BallMark colors={item.colors} size={28} /> : null}
                      <div>
                      <div className="text-xs font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-neutral-400">{item.description}</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-cyan-400">{count}x</span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "repels" && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-neutral-400">
                {inv.repelSteps > 0
                  ? `${inv.repelSteps} steps left. Using another Repel replaces this.`
                  : "No Repel is active."}
              </p>
              {note && <p className="text-[11px] text-emerald-300">{note}</p>}
              {Object.values(REPEL_ITEMS).map((item) => {
                const count = inv.repels?.[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    data-repel={item.id}
                    className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-neutral-400">{item.steps} steps</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-400">{count}x</span>
                      <button
                        type="button"
                        disabled={count <= 0}
                        onClick={() => {
                          const res = useRepel(adventureState, item.id as RepelItemId);
                          setNote(res.message);
                          if (res.success) onStateUpdate?.(res.state);
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-neutral-950 font-bold text-xs disabled:opacity-40"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "tms" && (
            <div className="flex flex-col gap-2" data-tm-bag={TM_DISCS.length}>
              <p className="text-[11px] text-neutral-400">
                {TM_DISCS.length} TMs. Teach one to a scanned card. The disc stays in the bag.
                {scanned.length
                  ? ` Scanned: ${scanned.map((fighter) => fighter.species).join(", ")}.`
                  : " Scan a Pokémon card to choose who learns it."}
              </p>
              {note && <p className="text-[11px] text-emerald-300">{note}</p>}
              <input
                value={tmQuery}
                onChange={(event) => setTmQuery(event.target.value)}
                placeholder="Search TMs, like Earthquake"
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white"
              />
              {tmRows.map((disc) => {
                const learners = learnersFor(disc.move);
                const open = teachFor === disc.id;
                return (
                  <div
                    key={disc.id}
                    data-tm={disc.id}
                    className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">
                          {disc.label} {disc.move}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {disc.type} · Power {disc.power} · x{inv.tms?.[disc.id] ?? 0}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (learners.length === 1) teach(learners[0].species, disc.id);
                          else setTeachFor(open ? null : disc.id);
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-400 text-neutral-950 font-bold text-xs"
                      >
                        Teach
                      </button>
                    </div>
                    {open && learners.length === 0 && (
                      <p className="text-[10px] text-neutral-400">
                        None of your scanned cards can learn {disc.move}.
                      </p>
                    )}
                    {open &&
                      learners.map((fighter) => (
                        <button
                          key={fighter.species}
                          type="button"
                          onClick={() => teach(fighter.species, disc.id)}
                          className="text-left text-[11px] text-amber-200"
                        >
                          Teach to {fighter.species}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "boosts" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(BOOST_ITEMS).map((b) => {
                const count = inv.boosts[b.id] || 0;
                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{b.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        {b.durationMinutes}m active duration
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">{count}x</span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "candies" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(inv.speciesCandies).map(([sp, count]) => (
                <div
                  key={sp}
                  className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-white truncate">{sp}</span>
                  <span className="text-xs font-bold text-amber-300">{count} 🍬</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
