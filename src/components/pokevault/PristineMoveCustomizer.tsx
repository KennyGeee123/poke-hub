import React, { useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import {
  type PokemonMove,
  getFullMoveRepertoireForCard,
  getCustomMoveSet,
  saveCustomMoveSet,
} from "@/lib/pokemon-moves";

export function PristineMoveCustomizer({
  card,
  onMovesChanged,
}: {
  card: TCGCard;
  onMovesChanged?: (moves: PokemonMove[]) => void;
}) {
  const repertoire = getFullMoveRepertoireForCard(card);
  const [activeMoves, setActiveMoves] = useState<PokemonMove[]>(() =>
    getCustomMoveSet(card.id, card)
  );

  function handleSwapSlot(slotIdx: number, moveId: string) {
    const selected = repertoire.find((m) => m.id === moveId);
    if (!selected) return;

    const updated = [...activeMoves];
    updated[slotIdx] = selected;
    setActiveMoves(updated);
    saveCustomMoveSet(card.id, updated);
    onMovesChanged?.(updated);
  }

  const eggMoves = repertoire.filter((m) => m.category === "egg");
  const levelUpMoves = repertoire.filter((m) => m.category === "level_up");
  const tmMoves = repertoire.filter((m) => m.category === "tm");
  const sigMoves = repertoire.filter((m) => m.category === "signature");

  return (
    <div className="p-4 rounded-xl bg-neutral-950 border border-amber-500/40 shadow-xl flex flex-col gap-3">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-amber-500/20 text-amber-400 text-xs font-mono">
            🧬 EGG MOVES UNLOCKED
          </span>
          <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
            Pristine 10 Move Set Customizer (4 Slots)
          </span>
        </div>
        <span className="text-[10px] text-amber-300/80 font-mono">
          Swap moves any time via dropdown
        </span>
      </div>

      {/* 4 Interactive Move Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {activeMoves.map((move, slotIdx) => (
          <div
            key={`slot-${slotIdx}`}
            className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-neutral-400 font-bold">MOVE SLOT #{slotIdx + 1}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  move.isBreedable
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : move.category === "signature"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                }`}
              >
                {move.categoryLabel}
              </span>
            </div>

            {/* Clickable Move Dropdown Selector */}
            <select
              value={move.id}
              onChange={(e) => handleSwapSlot(slotIdx, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-950 border border-neutral-700 text-white rounded px-2 py-1.5 cursor-pointer outline-none focus:border-amber-400 transition"
              title="Click to swap this move with any Breedable Egg Move, Level-Up or TM Move"
            >
              {sigMoves.length > 0 && (
                <optgroup label="🏆 CARD SIGNATURE ATTACKS">
                  {sigMoves.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.power > 0 ? `${m.power} DMG` : "Status"})
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="🥚 BREEDABLE EGG MOVES">
                {eggMoves.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.power > 0 ? `${m.power} DMG` : "Status"} · {m.type})
                  </option>
                ))}
              </optgroup>

              <optgroup label="⚡ LEVEL-UP MOVES">
                {levelUpMoves.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.power > 0 ? `${m.power} DMG` : "Status"} · {m.type})
                  </option>
                ))}
              </optgroup>

              <optgroup label="💿 TECHNICAL MACHINE (TM) MOVES">
                {tmMoves.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.power > 0 ? `${m.power} DMG` : "Status"} · {m.type})
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Move Detail Snippet */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono pt-1">
              <span>Type: <b className="text-neutral-200">{move.type}</b></span>
              <span>Power: <b className="text-amber-400">{move.power > 0 ? move.power : "—"}</b></span>
            </div>
            <p className="text-[9px] text-neutral-400 italic line-clamp-1">{move.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
