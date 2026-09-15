import React, { useState } from "react";
import {
  ShoppingBag,
  Sparkles,
  Coins,
  Check,
  X,
  Zap,
  Package,
} from "lucide-react";
import {
  type AdventureState,
  EVOLUTION_STONES,
  CAPTURE_ITEMS,
  BOOST_ITEMS,
  buyShopItem,
} from "@/lib/adventure-engine";

export function AdventureShopModal({
  adventureState,
  onClose,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
}) {
  const [activeTab, setActiveTab] = useState<"featured" | "stones" | "capture" | "boosts">("featured");
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);

  function handleBuy(
    type: "stone" | "capture" | "boost" | "rare_candy",
    id: string,
    name: string,
    price: number
  ) {
    const res = buyShopItem(adventureState, type, id, 1);
    if (res.success) {
      onStateUpdate(res.state);
      setPurchaseToast(`Purchased 1x ${name} for ${price} Coins!`);
      setTimeout(() => setPurchaseToast(null), 2500);
    } else if (res.error) {
      alert(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl p-5 sm:p-7 flex flex-col gap-4 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white font-mono">TRAINER SUPPLY OUTPOST</h3>
              <p className="text-xs text-neutral-400">Gear up with Evolution Stones, Rare Candy & Boosts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-xs font-bold text-amber-300">
              <span>🪙</span>
              <span>{adventureState.inventory.coins} Coins</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast */}
        {purchaseToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{purchaseToast}</span>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-1 border-b border-neutral-800 pb-2 text-xs font-mono">
          {[
            { id: "featured", label: "Featured & Candy" },
            { id: "stones", label: "Evolution Stones" },
            { id: "capture", label: "Capture Items" },
            { id: "boosts", label: "Adventure Boosts" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === t.id
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Catalog Content Grid */}
        <div className="overflow-y-auto pr-1 flex flex-col gap-3 max-h-[55vh]">
          {activeTab === "featured" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Rare Candy Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-neutral-900 to-neutral-950 border border-amber-500/40 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-3xl">🍬</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    MOST POPULAR
                  </span>
                </div>
                <div className="mt-2">
                  <h4 className="font-bold text-white font-mono text-sm">Universal Rare Candy</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Converts into species-specific candy or fuels stone evolution milestones.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/80">
                  <span className="text-xs font-mono font-bold text-amber-400">100 Coins</span>
                  <button
                    type="button"
                    onClick={() => handleBuy("rare_candy", "rare_candy", "Rare Candy", 100)}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold font-mono text-xs shadow"
                  >
                    Buy 1x
                  </button>
                </div>
              </div>

              {/* Master Ball */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/15 via-neutral-900 to-neutral-950 border border-purple-500/40 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-3xl">🔮</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold">
                    LEGENDARY TIER
                  </span>
                </div>
                <div className="mt-2">
                  <h4 className="font-bold text-white font-mono text-sm">Master Ball</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    100% Guaranteed capture on any creature, even Mythics and Legendary Raid Bosses.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/80">
                  <span className="text-xs font-mono font-bold text-purple-400">1,000 Coins</span>
                  <button
                    type="button"
                    onClick={() => handleBuy("capture", "master_ball", "Master Ball", 1000)}
                    className="px-4 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold font-mono text-xs shadow"
                  >
                    Buy 1x
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "stones" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(EVOLUTION_STONES).map((st) => (
                <div
                  key={st.id}
                  className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{st.emoji}</span>
                    <div>
                      <h5 className="text-xs font-bold text-white font-mono">{st.name}</h5>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {st.element} Element · Evolve eligible species
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 font-mono">{st.priceCoins} 🪙</span>
                    <button
                      type="button"
                      onClick={() => handleBuy("stone", st.id, st.name, st.priceCoins)}
                      className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 font-bold font-mono text-xs text-neutral-200 transition"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "capture" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(CAPTURE_ITEMS).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-white font-mono">{item.name}</h5>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {item.category === "ball" ? `Catch Rate x${item.multiplier}` : item.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 font-mono">{item.priceCoins} 🪙</span>
                    <button
                      type="button"
                      onClick={() => handleBuy("capture", item.id, item.name, item.priceCoins)}
                      className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 font-bold font-mono text-xs text-neutral-200 transition"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "boosts" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(BOOST_ITEMS).map((boost) => (
                <div
                  key={boost.id}
                  className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-white font-mono">{boost.name}</h5>
                    <span className="text-[10px] text-neutral-400 font-mono line-clamp-1">
                      {boost.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 font-mono">{boost.priceCoins} 🪙</span>
                    <button
                      type="button"
                      onClick={() => handleBuy("boost", boost.id, boost.name, boost.priceCoins)}
                      className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 font-bold font-mono text-xs text-neutral-200 transition"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
