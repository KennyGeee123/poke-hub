import { describe, it, expect } from "bun:test";
import {
  calculateGradedValue,
  getGradeMeta,
  ALL_GRADES,
  getEraMultiplierAdjustment,
  getSlabSearchUrls,
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

const mockModernCard: TCGCard = {
  id: "sv3-1",
  name: "Oddish",
  rarity: "Common",
  set: {
    id: "sv3",
    name: "Obsidian Flames",
    releaseDate: "2023/08/11",
  },
  images: { small: "https://example.com/small.png", large: "https://example.com/large.png" },
  tcgplayer: {
    prices: {
      normal: { market: 0.25, low: 0.10, high: 0.50 },
    },
  },
};

describe("Card Grades Engine & Valuation", () => {
  it("defines all major grading tiers", () => {
    expect(ALL_GRADES).toContain("raw");
    expect(ALL_GRADES).toContain("psa10");
    expect(ALL_GRADES).toContain("psa9");
    expect(ALL_GRADES).toContain("psa8");
    expect(ALL_GRADES).toContain("bgs10_black");
    expect(ALL_GRADES).toContain("bgs95");
    expect(ALL_GRADES).toContain("cgc10_pristine");
    expect(ALL_GRADES).toContain("sgc10");
  });

  it("calculates raw ungraded value identically to market price", () => {
    const rawVal = calculateGradedValue(mockCharizard, "raw");
    expect(rawVal.estimatedGradedPrice).toBe(350.0);
    expect(rawVal.multiplier).toBe(1.0);
    expect(rawVal.isSlab).toBe(false);
  });

  it("applies vintage era multiplier bonus for vintage holos in PSA 10", () => {
    const vintageBonus = getEraMultiplierAdjustment(mockCharizard);
    expect(vintageBonus).toBeGreaterThan(2.0);

    const modernBonus = getEraMultiplierAdjustment(mockModernCard);
    expect(modernBonus).toBe(1.0);

    const psa10Val = calculateGradedValue(mockCharizard, "psa10");
    expect(psa10Val.estimatedGradedPrice).toBeGreaterThan(1000.0);
    expect(psa10Val.isSlab).toBe(true);
  });

  it("calculates grading profit and ROI %", () => {
    const psa10Val = calculateGradedValue(mockCharizard, "psa10");
    expect(psa10Val.gradingFee).toBe(19.99);
    expect(psa10Val.estimatedProfit).toBeGreaterThan(0);
    expect(psa10Val.estimatedRoiPct).toBeGreaterThan(0);
  });

  it("generates correct slab search URLs for eBay and PriceCharting", () => {
    const urls = getSlabSearchUrls(mockCharizard, "psa10");
    expect(urls.ebayActive).toContain("Charizard");
    expect(urls.ebayActive).toContain("PSA%2010");
    expect(urls.priceCharting).toContain("Charizard");
  });
});
