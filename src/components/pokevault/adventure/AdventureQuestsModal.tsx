import React from "react";
import {
  Sparkles,
  CheckCircle2,
  Trophy,
  X,
  Coins,
  ArrowRight,
} from "lucide-react";
import {
  type AdventureState,
  claimQuest,
} from "@/lib/adventure-engine";

export function AdventureQuestsModal({
  adventureState,
  onClose,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
}) {
  function handleClaim(questId: string) {
    const res = claimQuest(adventureState, questId);
    if (res.success) {
      onStateUpdate(res.state);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white font-mono">ADVENTURE RESEARCH TASKS</h3>
              <p className="text-xs text-neutral-400">Complete objectives to earn Coins, XP & Rare Candies</p>
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

        {/* Quests List */}
        <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {adventureState.quests.map((q) => {
            const pct = Math.min(100, Math.round((q.currentProgress / q.targetProgress) * 100));
            return (
              <div
                key={q.id}
                className={`p-3.5 rounded-2xl border transition flex flex-col gap-2 ${
                  q.claimed
                    ? "bg-neutral-900/40 border-neutral-800/50 opacity-60"
                    : q.completed
                    ? "bg-emerald-950/30 border-emerald-500/50"
                    : "bg-neutral-900 border-neutral-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-neutral-800 text-neutral-300">
                      {q.category}
                    </span>
                    <h4 className="text-xs font-bold text-white font-mono mt-1">{q.title}</h4>
                    <p className="text-[11px] text-neutral-400">{q.description}</p>
                  </div>
                  <div className="flex flex-col items-end text-xs font-mono">
                    <span className="text-amber-400 font-bold">+{q.rewardCoins} 🪙</span>
                    <span className="text-cyan-400">+{q.rewardXp} XP</span>
                    {q.rewardRareCandy > 0 && (
                      <span className="text-amber-300 font-bold">+{q.rewardRareCandy} 🍬</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Claim Button */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                      <span>Progress</span>
                      <span>
                        {q.currentProgress} / {q.targetProgress} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                      <div
                        className={`h-full transition-all ${
                          q.completed ? "bg-emerald-500" : "bg-cyan-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {q.claimed ? (
                    <span className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-500 font-mono text-[10px] font-bold">
                      CLAIMED
                    </span>
                  ) : q.completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(q.id)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold font-mono text-xs shadow-md shadow-emerald-500/20 animate-pulse"
                    >
                      CLAIM
                    </button>
                  ) : (
                    <span className="text-[10px] text-neutral-500 font-mono">IN PROGRESS</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
