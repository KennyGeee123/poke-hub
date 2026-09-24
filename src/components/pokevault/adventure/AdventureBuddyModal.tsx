import React, { useState } from "react";
import { Heart, Sparkles, Footprints, Gift, X, Smile, Zap } from "lucide-react";
import { type AdventureState, feedBuddy } from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";

export function AdventureBuddyModal({
  adventureState,
  onClose,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
}) {
  const [feedMessage, setFeedMessage] = useState<string | null>(null);
  const buddy = adventureState.buddy;

  function handleFeed() {
    const res = feedBuddy(adventureState, "razz_berry");
    if (res.success) {
      onStateUpdate(res.state);
      setFeedMessage(res.message);
      setTimeout(() => setFeedMessage(null), 3000);
    } else {
      setFeedMessage(res.message);
      setTimeout(() => setFeedMessage(null), 3000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-fuchsia-500/40 shadow-2xl p-6 flex flex-col items-center gap-4 text-center overflow-hidden font-mono">
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
          <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-[10px] font-bold">
            ADVENTURE BUDDY
          </span>
          <h3 className="text-xl font-extrabold text-white mt-1">{buddy.nickname}</h3>
          <span className="text-xs text-neutral-400">Species: {buddy.species}</span>
        </div>

        {/* 3D Buddy Animation Stage */}
        <div className="relative w-44 h-44 rounded-full bg-gradient-to-tr from-fuchsia-950/40 via-neutral-900 to-neutral-950 border border-fuchsia-500/30 flex items-center justify-center">
          <div className="absolute bottom-4 w-28 h-8 rounded-full bg-fuchsia-500/20 filter blur-sm animate-pulse" />
          <img
            src={animatedSpriteUrl(buddy.species)}
            alt={buddy.species}
            className="w-28 h-28 object-contain relative z-10 animate-bounce"
          />
        </div>

        {/* Status Indicators */}
        <div className="w-full grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center gap-0.5">
            <Smile className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-neutral-400">Mood</span>
            <span className="font-bold text-white uppercase">{buddy.mood}</span>
          </div>

          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center gap-0.5">
            <Footprints className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] text-neutral-400">Walked</span>
            <span className="font-bold text-white">{buddy.totalKmWalked} km</span>
          </div>

          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center gap-0.5">
            <Gift className="w-4 h-4 text-fuchsia-400" />
            <span className="text-[10px] text-neutral-400">Candies</span>
            <span className="font-bold text-white">{buddy.candiesFound}</span>
          </div>
        </div>

        {/* Daily Hearts */}
        <div className="w-full p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span className="font-bold text-neutral-200">Daily Hearts</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: buddy.maxHeartsToday }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < buddy.heartsToday
                    ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                    : "bg-neutral-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Feedback Message */}
        {feedMessage && (
          <div className="w-full p-2.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-bold animate-bounce">
            {feedMessage}
          </div>
        )}

        {/* Actions */}
        <button
          type="button"
          onClick={handleFeed}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs tracking-wider shadow-lg shadow-fuchsia-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Heart className="w-4 h-4" />
          <span>TREAT WITH RAZZ BERRY</span>
        </button>
      </div>
    </div>
  );
}
