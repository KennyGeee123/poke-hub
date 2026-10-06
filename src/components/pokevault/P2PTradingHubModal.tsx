import React, { useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { type CardGrade, ALL_GRADES, getGradeMeta } from "@/lib/card-grades";
import {
  MOCK_TRAINERS,
  createTradeItem,
  evaluateTradeFairness,
  saveTradeToLedger,
  type TradeItem,
  type TradeParty,
  type TradeOffer,
} from "@/lib/p2p-trading";
import { findSpecies, pogoSpriteUrl } from "@/lib/pogo-market";
import { goAssetValue, gradeMockImg } from "@/lib/fair-trade-assets";
import { P2PTradeBeamTransfer } from "./QuantumTransferAnimation";

export function P2PTradingHubModal({
  initialCard,
  initialGrade = "raw",
  onClose,
}: {
  initialCard: TCGCard;
  initialGrade?: CardGrade;
  onClose: () => void;
}) {
  const [selectedTrainer, setSelectedTrainer] = useState(MOCK_TRAINERS[0]);
  const [senderItem] = useState<TradeItem>(createTradeItem(initialCard, initialGrade, "card"));
  const [senderCash, setSenderCash] = useState<number>(0);

  // Partner's counter card (mocking an exciting comparable card trade)
  const [partnerCardName, setPartnerCardName] = useState<string>("Charizard VMAX (Shiny Secret)");
  const [partnerGrade, setPartnerGrade] = useState<CardGrade>("psa9");
  const [partnerCash, setPartnerCash] = useState<number>(0);
  const [partnerKind, setPartnerKind] = useState<"card" | "go">("card");
  const [partnerGoName, setPartnerGoName] = useState<string>("Mewtwo");
  const [partnerGoShiny, setPartnerGoShiny] = useState(true);

  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);

  // Synthesize partner item (TCG card or Pokémon GO creature)
  const goSpecies = findSpecies(partnerGoName)[0] || findSpecies("Mewtwo")[0];
  const partnerMockCard: TCGCard = {
    ...initialCard,
    id: partnerKind === "go" ? `go-mock-${goSpecies?.id || 150}` : "partner-mock-01",
    name: partnerKind === "go" ? (goSpecies?.name || partnerGoName) : partnerCardName,
    hp: partnerKind === "go" ? String(goSpecies?.id || 150) : "330",
    rarity: partnerKind === "go" ? "Pokémon GO" : "Secret Rare",
    images: {
      small:
        partnerKind === "go" && goSpecies
          ? pogoSpriteUrl(goSpecies.id)
          : initialCard.images?.small || gradeMockImg(partnerGrade),
      large:
        partnerKind === "go" && goSpecies
          ? pogoSpriteUrl(goSpecies.id)
          : initialCard.images?.large || gradeMockImg(partnerGrade),
    },
  };
  const receiverItem = createTradeItem(
    partnerMockCard,
    partnerKind === "go" ? "raw" : partnerGrade,
    partnerKind === "go" ? "game_pokemon" : "card",
  );
  if (partnerKind === "go" && goSpecies) {
    // Override market with name-keyed GO / eBay value (shiny bonus).
    receiverItem.marketPrice = goAssetValue(goSpecies, {
      shiny: partnerGoShiny,
      lucky: false,
      ivPct: 98,
    });
    receiverItem.grade = "raw";
  }

  const senderParty: TradeParty = {
    id: "user-party",
    name: "You (Vault Master)",
    avatar: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/101.png",
    reputation: 100.0,
    completedTrades: 84,
    items: [senderItem],
    cashSweetener: senderCash,
    isReady: true,
  };

  const receiverParty: TradeParty = {
    ...selectedTrainer,
    items: [receiverItem],
    cashSweetener: partnerCash,
    isReady: true,
  };

  const evaluation = evaluateTradeFairness(senderParty, receiverParty);

  function handleExecuteTransfer() {
    setIsTransferring(true);
  }

  function handleTransferFinished() {
    setIsTransferring(false);
    setTradeSuccess(true);

    const completedTrade: TradeOffer = {
      id: `trade-${Date.now()}`,
      createdAt: new Date().toISOString(),
      sender: senderParty,
      receiver: receiverParty,
      status: "completed",
      fairnessScore: evaluation.fairnessScore,
      valuationDelta: evaluation.delta,
      suggestedSweetener: 0,
    };
    saveTradeToLedger(completedTrade);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Visual P2P Quantum Beam Animation */}
      <P2PTradeBeamTransfer
        isActive={isTransferring}
        onComplete={handleTransferFinished}
        senderCardName={`${senderItem.card.name} (${senderItem.grade.toUpperCase()})`}
        receiverCardName={`${receiverItem.card.name} (${receiverItem.grade.toUpperCase()})`}
      />

      <div className="relative w-full max-w-4xl rounded-2xl bg-neutral-900 border border-neutral-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Peer-to-Peer (P2P) Pokémon Trading Hub
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ATOMIC ZERO-COLLISION
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                Card ↔ card, GO ↔ GO, or mixed — grade ladders + name-keyed GO/eBay values
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {tradeSuccess ? (
            <div className="p-8 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-3xl">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-white">Quantum P2P Trade Completed!</h3>
              <p className="text-sm text-neutral-300 max-w-md font-mono">
                Ownership of{" "}
                <b>
                  {receiverItem.card.name} (Lv. {receiverItem.stats.level})
                </b>{" "}
                has been verified and deposited into your active vault ledger.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono transition"
              >
                Return to Vault
              </button>
            </div>
          ) : (
            <>
              {/* Partner Select Bar */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-neutral-400">Select Peer Partner:</span>
                  <div className="flex gap-2">
                    {MOCK_TRAINERS.map((trainer) => (
                      <button
                        key={trainer.id}
                        type="button"
                        onClick={() => setSelectedTrainer(trainer)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          selectedTrainer.id === trainer.id
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                        }`}
                      >
                        {trainer.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs font-mono text-neutral-400">
                  Reputation:{" "}
                  <span className="text-emerald-400 font-bold">{selectedTrainer.reputation}%</span>{" "}
                  ({selectedTrainer.completedTrades} trades)
                </div>
              </div>

              {/* Side-by-Side Trade Pods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Your Offer Pod */}
                <div className="p-5 rounded-2xl bg-neutral-950/80 border border-cyan-500/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <span className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                      🔵 YOUR OFFER (POD 1)
                    </span>
                    <span className="text-xs font-bold text-white font-mono">
                      ${(senderItem.marketPrice + senderCash).toFixed(2)} Total
                    </span>
                  </div>

                  {/* Card Details & Stats */}
                  <div className="flex gap-4 items-center">
                    <img
                      src={senderItem.card.images.small}
                      alt={senderItem.card.name}
                      className="w-20 h-28 object-contain rounded-lg border border-neutral-700 bg-black shadow"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-white text-base">{senderItem.card.name}</div>
                      <div className="text-xs text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            background: getGradeMeta(senderItem.grade).badgeBg,
                            color: getGradeMeta(senderItem.grade).badgeText,
                          }}
                        >
                          {getGradeMeta(senderItem.grade).shortLabel}
                        </span>
                        <span>#{senderItem.card.number}</span>
                      </div>

                      {/* Level & Boost Badges */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white font-mono">
                          Lv. {senderItem.stats.level}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                          +{senderItem.stats.totalBoostPercent}% STATS
                        </span>
                      </div>
                      <div className="text-sm font-bold text-cyan-300 font-mono mt-2">
                        Market Worth: ${senderItem.marketPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Cash Sweetener Input */}
                  <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400">Cash Sweetener ($ USD):</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={senderCash}
                      onChange={(e) => setSenderCash(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-right text-white font-mono"
                    />
                  </div>
                </div>

                {/* 2. Partner's Offer Pod */}
                <div className="p-5 rounded-2xl bg-neutral-950/80 border border-purple-500/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <span className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">
                      🟣 PARTNER'S OFFER (POD 2)
                    </span>
                    <span className="text-xs font-bold text-white font-mono">
                      ${(receiverItem.marketPrice + partnerCash).toFixed(2)} Total
                    </span>
                  </div>

                  {/* Partner Card Select / Customize */}
                  <div className="flex gap-4 items-center">
                    <img
                      src={receiverItem.card.images.small}
                      alt={receiverItem.card.name}
                      className="w-20 h-28 object-contain rounded-lg border border-neutral-700 bg-black shadow"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={partnerCardName}
                        onChange={(e) => setPartnerCardName(e.target.value)}
                        className="font-bold text-white text-sm bg-neutral-900 px-2 py-1 rounded border border-neutral-700 w-full mb-1"
                      />

                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setPartnerKind("card")}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              partnerKind === "card"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "bg-neutral-900 text-neutral-500"
                            }`}
                          >
                            TCG Card
                          </button>
                          <button
                            type="button"
                            onClick={() => setPartnerKind("go")}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              partnerKind === "go"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-neutral-900 text-neutral-500"
                            }`}
                          >
                            Pokémon GO
                          </button>
                        </div>
                        {partnerKind === "card" ? (
                          <select
                            value={partnerGrade}
                            onChange={(e) => setPartnerGrade(e.target.value as CardGrade)}
                            className="text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300"
                          >
                            {ALL_GRADES.map((g) => (
                              <option key={g} value={g}>
                                {getGradeMeta(g).shortLabel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={partnerGoName}
                              onChange={(e) => setPartnerGoName(e.target.value)}
                              className="text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300 w-28"
                              placeholder="Species"
                            />
                            <label className="text-[10px] text-neutral-400 flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={partnerGoShiny}
                                onChange={(e) => setPartnerGoShiny(e.target.checked)}
                              />
                              Shiny
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Level & Boost Badges */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white font-mono">
                          Lv. {receiverItem.stats.level}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                          +{receiverItem.stats.totalBoostPercent}% STATS
                        </span>
                      </div>
                      <div className="text-sm font-bold text-purple-300 font-mono mt-2">
                        Market Worth: ${receiverItem.marketPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Partner Cash Sweetener */}
                  <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400">Partner Cash Added ($):</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={partnerCash}
                      onChange={(e) => setPartnerCash(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-right text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Trade Fairness & Balance Evaluation Bar */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Trade Valuation Equilibrium:</span>
                  <span className="font-bold text-emerald-400">
                    Fairness Score: {evaluation.fairnessScore} / 100
                  </span>
                </div>

                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      evaluation.fairnessScore > 85 ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${evaluation.fairnessScore}%` }}
                  />
                </div>

                <div className="text-[11px] text-neutral-300 flex items-center justify-between pt-1 gap-2">
                  <span>{evaluation.suggestion}</span>
                  <span
                    className={`font-bold ${
                      Math.abs(evaluation.delta) < 5
                        ? "text-emerald-400"
                        : evaluation.delta > 0
                          ? "text-cyan-300"
                          : "text-amber-300"
                    }`}
                  >
                    {Math.abs(evaluation.delta) < 5
                      ? "FAIR"
                      : evaluation.delta > 0
                        ? "YOU WIN"
                        : "YOU LOSE"}{" "}
                    · {evaluation.delta >= 0 ? "+" : ""}${evaluation.delta.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!tradeSuccess && (
          <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">
              ⚡ Atomic Collision-Free Quantum Protocol Active
            </span>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold font-mono text-xs shadow-lg transition"
              >
                🚀 Execute Quantum P2P Trade
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
