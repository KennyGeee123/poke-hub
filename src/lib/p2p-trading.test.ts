import { describe, expect, it } from "bun:test";
import { createTradeItem, evaluateTradeFairness, type TradeParty } from "./p2p-trading";
import type { TCGCard } from "./pokemon-api";

const mockCardA: TCGCard = {
  id: "base1-4",
  name: "Charizard",
  supertype: "Pokémon",
  number: "4",
  rarity: "Rare Holo",
  images: { small: "", large: "" },
  tcgplayer: {
    prices: {
      holofoil: { market: 300 },
    },
  },
};

const mockCardB: TCGCard = {
  id: "base1-2",
  name: "Blastoise",
  supertype: "Pokémon",
  number: "2",
  rarity: "Rare Holo",
  images: { small: "", large: "" },
  tcgplayer: {
    prices: {
      holofoil: { market: 100 },
    },
  },
};

describe("P2P Trading Engine & Valuation Fairness Index", () => {
  it("creates valid trade items with embedded RPG stats and market prices", () => {
    const item = createTradeItem(mockCardA, "psa10", "card");
    expect(item.grade).toBe("psa10");
    expect(item.stats.level).toBe(100);
    expect(item.stats.hasNaturalSlabBoost).toBe(true);
    expect(item.marketPrice).toBeGreaterThan(300);
  });

  it("computes trade delta and fairness index for unbalanced trades", () => {
    const partyA: TradeParty = {
      id: "party-a",
      name: "Trainer A",
      avatar: "",
      reputation: 99,
      completedTrades: 10,
      items: [createTradeItem(mockCardA, "raw_nm")],
      cashSweetener: 0,
      isReady: true,
    };

    const partyB: TradeParty = {
      id: "party-b",
      name: "Trainer B",
      avatar: "",
      reputation: 99,
      completedTrades: 10,
      items: [createTradeItem(mockCardB, "raw_nm")],
      cashSweetener: 0,
      isReady: true,
    };

    const evalResult = evaluateTradeFairness(partyA, partyB);
    expect(evalResult.senderTotal).toBeGreaterThan(evalResult.receiverTotal);
    expect(evalResult.delta).toBeLessThan(0);
    expect(evalResult.fairnessScore).toBeLessThan(50);
  });

  it("recognizes balanced trades with cash sweeteners", () => {
    const itemA = createTradeItem(mockCardA, "raw_nm"); // ~$300
    const itemB = createTradeItem(mockCardB, "raw_nm"); // ~$100

    const partyA: TradeParty = {
      id: "party-a",
      name: "Trainer A",
      avatar: "",
      reputation: 99,
      completedTrades: 10,
      items: [itemA],
      cashSweetener: 0,
      isReady: true,
    };

    const partyB: TradeParty = {
      id: "party-b",
      name: "Trainer B",
      avatar: "",
      reputation: 99,
      completedTrades: 10,
      items: [itemB],
      cashSweetener: itemA.marketPrice - itemB.marketPrice, // Add cash sweetener
      isReady: true,
    };

    const evalResult = evaluateTradeFairness(partyA, partyB);
    expect(evalResult.fairnessScore).toBe(100);
    expect(Math.abs(evalResult.delta)).toBe(0);
  });
});
