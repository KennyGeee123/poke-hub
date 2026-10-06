// Peer-to-Peer (P2P) Trading Engine for TCG Cards & Game Pokémon
import type { TCGCard } from "./pokemon-api";
import { type CardGrade, getEstimatedGradePrice } from "./card-grades";
import { getCardLevelAndStats, type PokemonStats } from "./card-stats";

export type TradeItemType = "card" | "game_pokemon";

export type TradeItem = {
  id: string;
  type: TradeItemType;
  card: TCGCard;
  grade: CardGrade;
  stats: PokemonStats;
  marketPrice: number;
  isFoil?: boolean;
  notes?: string;
};

export type TradeParty = {
  id: string;
  name: string;
  avatar: string;
  reputation: number; // e.g. 99.4%
  completedTrades: number;
  items: TradeItem[];
  cashSweetener: number; // USD added to balance trade
  isReady: boolean;
};

export type TradeStatus = "drafting" | "negotiating" | "transferring" | "completed" | "declined";

export type TradeOffer = {
  id: string;
  createdAt: string;
  sender: TradeParty;
  receiver: TradeParty;
  status: TradeStatus;
  fairnessScore: number; // 0 to 100
  valuationDelta: number; // Receiver value - Sender value
  suggestedSweetener: number;
};

/** Default partner-side offer when a mock trainer is selected in the P2P hub. */
export type TrainerDefaultOffer = {
  kind: "card" | "go";
  cardName: string;
  grade: CardGrade;
  cash: number;
  goName?: string;
  goShiny?: boolean;
  /** Partner card / GO artwork URL — must change when the trainer (offer) changes. */
  imageUrl: string;
  /** Fixed USD so each trainer's total differs even when the seed card price is shared. */
  marketPriceOverride: number;
};

export type MockTrainer = Omit<TradeParty, "items" | "cashSweetener" | "isReady"> & {
  defaultOffer: TrainerDefaultOffer;
};

export const MOCK_TRAINERS: MockTrainer[] = [
  {
    id: "trainer-red",
    name: "Red (Champion Navi)",
    // PokeAPI /sprites/trainers/*.png 404 — Showdown trainer sprites are reliable.
    avatar: "https://play.pokemonshowdown.com/sprites/trainers/red.png",
    reputation: 99.8,
    completedTrades: 342,
    defaultOffer: {
      kind: "card",
      cardName: "Charizard VMAX (Shiny Secret)",
      grade: "psa9",
      cash: 0,
      imageUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png",
      marketPriceOverride: 312.5,
    },
  },
  {
    id: "trainer-cynthia",
    name: "Cynthia (Sinnoh Master)",
    avatar: "https://play.pokemonshowdown.com/sprites/trainers/cynthia.png",
    reputation: 100.0,
    completedTrades: 512,
    defaultOffer: {
      kind: "card",
      cardName: "Giratina VSTAR (Gold Secret)",
      grade: "psa10",
      cash: 40,
      imageUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/487.png",
      marketPriceOverride: 485.0,
    },
  },
  {
    id: "trainer-blue",
    name: "Blue (Viridian Gym)",
    avatar: "https://play.pokemonshowdown.com/sprites/trainers/blue.png",
    reputation: 98.9,
    completedTrades: 218,
    defaultOffer: {
      kind: "card",
      cardName: "Blastoise ex (Obsidian Flames)",
      grade: "raw_nm",
      cash: 15,
      imageUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png",
      marketPriceOverride: 68.4,
    },
  },
  {
    id: "trainer-steven",
    name: "Steven Stone (Hoenn Vault)",
    avatar: "https://play.pokemonshowdown.com/sprites/trainers/steven.png",
    reputation: 99.9,
    completedTrades: 429,
    defaultOffer: {
      kind: "go",
      cardName: "Metagross",
      grade: "raw",
      cash: 0,
      goName: "Metagross",
      goShiny: true,
      imageUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/376.png",
      marketPriceOverride: 142.0,
    },
  },
];

export function getTrainerDefaultOffer(trainerId: string): TrainerDefaultOffer {
  const t = MOCK_TRAINERS.find((x) => x.id === trainerId);
  return t?.defaultOffer ?? MOCK_TRAINERS[0].defaultOffer;
}

/** Display helpers for trainer chips (full name + parenthetical subtitle). */
export function splitTrainerDisplayName(name: string): { primary: string; subtitle: string | null } {
  const m = name.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (m) return { primary: m[1].trim(), subtitle: m[2].trim() };
  return { primary: name, subtitle: null };
}

export function createTradeItem(
  card: TCGCard,
  grade: CardGrade = "raw",
  type: TradeItemType = "card",
): TradeItem {
  const stats = getCardLevelAndStats(card, grade);
  const marketPrice = getEstimatedGradePrice(card, grade);
  return {
    id: `item-${card.id}-${grade}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type,
    card,
    grade,
    stats,
    marketPrice,
    isFoil:
      card.rarity?.toLowerCase().includes("holo") || card.rarity?.toLowerCase().includes("secret"),
  };
}

export function evaluateTradeFairness(
  sender: TradeParty,
  receiver: TradeParty,
): {
  senderTotal: number;
  receiverTotal: number;
  delta: number;
  fairnessScore: number;
  suggestion: string;
} {
  const senderItemsVal = sender.items.reduce((sum, item) => sum + item.marketPrice, 0);
  const senderTotal = Math.round((senderItemsVal + (sender.cashSweetener || 0)) * 100) / 100;

  const receiverItemsVal = receiver.items.reduce((sum, item) => sum + item.marketPrice, 0);
  const receiverTotal = Math.round((receiverItemsVal + (receiver.cashSweetener || 0)) * 100) / 100;

  const delta = Math.round((receiverTotal - senderTotal) * 100) / 100; // Positive = sender is getting more value

  if (senderTotal === 0 && receiverTotal === 0) {
    return {
      senderTotal: 0,
      receiverTotal: 0,
      delta: 0,
      fairnessScore: 100,
      suggestion: "Add items to both sides to initiate valuation.",
    };
  }

  const maxVal = Math.max(senderTotal, receiverTotal, 1);
  const ratio = Math.min(senderTotal, receiverTotal) / maxVal;
  const fairnessScore = Math.round(ratio * 100);

  let suggestion = "Balanced Trade Offer";
  if (Math.abs(delta) < 5) {
    suggestion = "💎 Perfectly Balanced Peer Trade! High probability of instant acceptance.";
  } else if (delta > 0) {
    suggestion = `⚖️ You are receiving +$${delta.toFixed(2)} more value. Consider adding a small cash sweetener.`;
  } else {
    suggestion = `⚠️ You are offering +$${Math.abs(delta).toFixed(2)} more value than partner's offer.`;
  }

  return {
    senderTotal,
    receiverTotal,
    delta,
    fairnessScore,
    suggestion,
  };
}

export type FairTradeVerdict = {
  mine: number;
  theirs: number;
  delta: number;
  threshold: number;
  fair: boolean;
  youAdd: number;
  theyAdd: number;
  label: "FAIR" | "YOU ADD" | "THEY ADD" | "NEED PRICES";
  line: string;
};

/** Cash to put on the swap so both sides match live market. */
export function fairTradeSwap(
  mine: number,
  theirs: number,
  cashMine = 0,
  cashTheirs = 0,
): FairTradeVerdict {
  const a = Math.max(0, Number(mine) || 0) + Math.max(0, Number(cashMine) || 0);
  const b = Math.max(0, Number(theirs) || 0) + Math.max(0, Number(cashTheirs) || 0);
  if (!(a > 0) || !(b > 0)) {
    return {
      mine: a,
      theirs: b,
      delta: 0,
      threshold: 0,
      fair: false,
      youAdd: 0,
      theyAdd: 0,
      label: "NEED PRICES",
      line: "Scan both cards and wait for live quotes.",
    };
  }
  const delta = Math.round((a - b) * 100) / 100;
  const threshold = Math.round(Math.max(5, 0.1 * Math.max(a, b)) * 100) / 100;
  if (Math.abs(delta) <= threshold) {
    return {
      mine: a,
      theirs: b,
      delta,
      threshold,
      fair: true,
      youAdd: 0,
      theyAdd: 0,
      label: "FAIR",
      line: `Fair trade. Gap $${Math.abs(delta).toFixed(2)} is within $${threshold.toFixed(2)}.`,
    };
  }
  if (delta > 0) {
    return {
      mine: a,
      theirs: b,
      delta,
      threshold,
      fair: false,
      youAdd: 0,
      theyAdd: Math.abs(delta),
      label: "THEY ADD",
      line: `They add $${Math.abs(delta).toFixed(2)} on the swap (your card is higher).`,
    };
  }
  return {
    mine: a,
    theirs: b,
    delta,
    threshold,
    fair: false,
    youAdd: Math.abs(delta),
    theyAdd: 0,
    label: "YOU ADD",
    line: `You add $${Math.abs(delta).toFixed(2)} on the swap (their card is higher).`,
  };
}

const TRADE_HISTORY_KEY = "pokevault_p2p_trade_ledger_v1";

export function loadTradeLedger(): TradeOffer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRADE_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTradeToLedger(trade: TradeOffer): void {
  if (typeof window === "undefined") return;
  try {
    const history = loadTradeLedger();
    const updated = [trade, ...history.filter((t) => t.id !== trade.id)].slice(0, 30);
    localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save trade to ledger", err);
  }
}
