import { describe, expect, it } from "bun:test";
import {
  fairTradeSwap,
  MOCK_TRAINERS,
  getTrainerDefaultOffer,
  splitTrainerDisplayName,
  evaluateTradeFairness,
  createTradeItem,
  type TradeParty,
} from "./p2p-trading";
import type { TCGCard } from "./pokemon-api";

describe("Fair Trade swap", () => {
  it("calls even values FAIR within $5 or 10%", () => {
    const v = fairTradeSwap(50, 52);
    expect(v.fair).toBe(true);
    expect(v.label).toBe("FAIR");
    expect(v.youAdd).toBe(0);
  });

  it("asks you to add cash when their card is higher", () => {
    const v = fairTradeSwap(20, 80);
    expect(v.fair).toBe(false);
    expect(v.label).toBe("YOU ADD");
    expect(v.youAdd).toBe(60);
  });

  it("asks them to add cash when your card is higher", () => {
    const v = fairTradeSwap(100, 40);
    expect(v.label).toBe("THEY ADD");
    expect(v.theyAdd).toBe(60);
  });

  it("counts cash already on the table toward fairness", () => {
    const v = fairTradeSwap(20, 80, 60, 0);
    expect(v.fair).toBe(true);
    expect(v.label).toBe("FAIR");
  });
});

describe("Mock trainers / default offers", () => {
  it("exposes 4 trainers with avatar + full display names", () => {
    expect(MOCK_TRAINERS).toHaveLength(4);
    for (const t of MOCK_TRAINERS) {
      expect(t.avatar.length).toBeGreaterThan(8);
      // Broken PokeAPI raw …/sprites/trainers/{n}.png paths 404 — use Showdown (or similar)
      expect(t.avatar).not.toMatch(/raw\.githubusercontent\.com\/PokeAPI\/sprites.*\/trainers\//);
      expect(t.avatar).toMatch(/^https?:\/\//);
      expect(t.name).toContain("(");
      const d = splitTrainerDisplayName(t.name);
      expect(d.primary.length).toBeGreaterThan(0);
      expect(d.subtitle).toBeTruthy();
    }
  });

  it("gives each trainer a distinct partner imageUrl (art changes on switch)", () => {
    const urls = MOCK_TRAINERS.map((t) => getTrainerDefaultOffer(t.id).imageUrl);
    expect(urls.every((u) => typeof u === "string" && u.length > 8)).toBe(true);
    expect(new Set(urls).size).toBe(4);
    expect(getTrainerDefaultOffer("trainer-steven").imageUrl).toContain("376");
    expect(getTrainerDefaultOffer("trainer-cynthia").imageUrl).toContain("487");
    expect(getTrainerDefaultOffer("trainer-blue").imageUrl).toContain("/9.png");
  });

  it("gives each trainer a distinct default partner offer total", () => {
    const totals = MOCK_TRAINERS.map((t) => {
      const o = getTrainerDefaultOffer(t.id);
      return Math.round((o.marketPriceOverride + o.cash) * 100) / 100;
    });
    expect(new Set(totals).size).toBe(4);
    // Sanity: known fixtures
    expect(getTrainerDefaultOffer("trainer-red").cardName).toContain("Charizard");
    expect(getTrainerDefaultOffer("trainer-cynthia").grade).toBe("psa10");
    expect(getTrainerDefaultOffer("trainer-blue").marketPriceOverride).toBeLessThan(
      getTrainerDefaultOffer("trainer-cynthia").marketPriceOverride,
    );
    expect(getTrainerDefaultOffer("trainer-steven").kind).toBe("go");
  });

  it("changes fairness when partner offer swaps between trainers", () => {
    const seed: TCGCard = {
      id: "seed-1",
      name: "Pikachu",
      number: "25",
      rarity: "Common",
      images: { small: "/x.png", large: "/x.png" },
      tcgplayer: { prices: { normal: { market: 40 } } },
    } as TCGCard;
    const senderItem = createTradeItem(seed, "raw_nm", "card");
    // Force a stable sender value for the assertion
    senderItem.marketPrice = 100;

    const sender: TradeParty = {
      id: "you",
      name: "You",
      avatar: "",
      reputation: 100,
      completedTrades: 1,
      items: [senderItem],
      cashSweetener: 0,
      isReady: true,
    };

    const scores: number[] = [];
    for (const t of MOCK_TRAINERS) {
      const o = getTrainerDefaultOffer(t.id);
      const partnerCard = { ...seed, id: `p-${t.id}`, name: o.cardName };
      const item = createTradeItem(partnerCard, o.grade, o.kind === "go" ? "game_pokemon" : "card");
      item.marketPrice = o.marketPriceOverride;
      const receiver: TradeParty = {
        id: t.id,
        name: t.name,
        avatar: t.avatar,
        reputation: t.reputation,
        completedTrades: t.completedTrades,
        items: [item],
        cashSweetener: o.cash,
        isReady: true,
      };
      scores.push(evaluateTradeFairness(sender, receiver).fairnessScore);
    }
    expect(new Set(scores).size).toBeGreaterThan(1);
  });
});
