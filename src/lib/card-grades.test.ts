import { describe, it, expect } from "bun:test";
import {
  calculateGradedValue,
  getGradeMeta,
  ALL_GRADES,
  UNGRADED_QUALITIES,
  GRADED_SLABS,
  getEraMultiplierAdjustment,
  getSlabSearchUrls,
  predetermineCardGrade,
} from "./card-grades";
import type { TCGCard } from "./pokemon-api";

const mockCharizard: TCGCard = {
  id: "base1-4",
  name: "Charizard",
  rarity: "Rare Holo",
  set: {
    id: "base1",
    name: "Base Set",
    releaseDate: "1999/01/09",
  },
  images: { small: "https://example.com/small.png", large: "https://example.com/large.png" },
  tcgplayer: {
    prices: {
      holofoil: { market: 350.0, low: 300.0, high: 450.0 },
    },
  },
};

describe("Ungraded & Graded Condition Engine", () => {
  it("defines full spectrum of raw qualities and slabs", () => {
    expect(UNGRADED_QUALITIES).toContain("raw_mint");
    expect(UNGRADED_QUALITIES).toContain("raw_nm");
    expect(UNGRADED_QUALITIES).toContain("raw_lp");
    expect(UNGRADED_QUALITIES).toContain("raw_mp");
    expect(UNGRADED_QUALITIES).toContain("raw_hp");
    expect(UNGRADED_QUALITIES).toContain("raw_dmg");

    expect(GRADED_SLABS).toContain("psa10");
    expect(GRADED_SLABS).toContain("psa9");
    expect(GRADED_SLABS).toContain("bgs10_black");
  });

  it("calculates raw condition tier pricing appropriately", () => {
    const rawMint = calculateGradedValue(mockCharizard, "raw_mint");
    const rawLP = calculateGradedValue(mockCharizard, "raw_lp");
    const rawDMG = calculateGradedValue(mockCharizard, "raw_dmg");

    expect(rawMint.estimatedGradedPrice).toBeGreaterThan(rawLP.estimatedGradedPrice);
    expect(rawLP.estimatedGradedPrice).toBeGreaterThan(rawDMG.estimatedGradedPrice);
    expect(rawMint.isSlab).toBe(false);
  });

  it("applies vintage era multiplier bonus for vintage holos in PSA 10", () => {
    const vintageBonus = getEraMultiplierAdjustment(mockCharizard);
    expect(vintageBonus).toBeGreaterThan(2.0);

    const psa10Val = calculateGradedValue(mockCharizard, "psa10");
    expect(psa10Val.estimatedGradedPrice).toBeGreaterThan(1000.0);
    expect(psa10Val.isSlab).toBe(true);
  });
});

describe("AI Pre-Grade Inspector & Predetermination Engine", () => {
  it("computes high PSA 10 probability for pack-fresh raw mint cards", () => {
    const analysis = predetermineCardGrade(mockCharizard, "raw_mint", {
      centering: 98,
      corners: 98,
      edges: 96,
      surface: 97,
    });

    expect(analysis.predictedGrade).toBe("PSA 10");
    expect(analysis.probabilities.psa10).toBeGreaterThanOrEqual(75);
    expect(analysis.expectedNetGain).toBeGreaterThan(0);
    expect(analysis.recommendedAction).toBe("SUBMIT FOR GRADING");
  });

  it("predicts lower grade probabilities for heavily played cards", () => {
    const analysis = predetermineCardGrade(mockCharizard, "raw_hp", {
      centering: 60,
      corners: 40,
      edges: 40,
      surface: 45,
    });

    expect(analysis.probabilities.psa10).toBe(0);
    expect(analysis.probabilities.sub8).toBeGreaterThanOrEqual(60);
  });
});
