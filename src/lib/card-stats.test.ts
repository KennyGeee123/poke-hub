import { describe, expect, it } from "bun:test";
import { getCardLevelAndStats } from "./card-stats";
import type { TCGCard } from "./pokemon-api";

const mockCharizard: TCGCard = {
  id: "base1-4",
  name: "Charizard",
  supertype: "Pokémon",
  subtypes: ["Stage 2"],
  level: "76",
  hp: "120",
  types: ["Fire"],
  attacks: [
    {
      name: "Fire Spin",
      cost: ["Fire", "Fire", "Fire", "Fire"],
      convertedEnergyCost: 4,
      damage: "100",
      text: "Discard 2 Energy cards attached to Charizard in order to use this attack.",
    },
  ],
  set: {
    id: "base1",
    name: "Base Set",
    series: "Base",
    printedTotal: 102,
    total: 102,
    legalities: { unlimited: "Legal" },
    ptcgoCode: "BS",
    releaseDate: "1999/01/09",
    updatedAt: "2020/08/14 09:35:00",
    images: { symbol: "", logo: "" },
  },
  number: "4",
  artist: "Mitsuhiro Arita",
  rarity: "Rare Holo",
  images: { small: "", large: "" },
};

describe("RPG Battle Level & Condition Stat Boost Engine", () => {
  it("calculates baseline Level 10 and 0% boost for Damaged cards", () => {
    const stats = getCardLevelAndStats(mockCharizard, "raw_dmg");
    expect(stats.level).toBe(10);
    expect(stats.totalBoostPercent).toBe(0);
    expect(stats.boostedHp).toBe(120);
    expect(stats.boostedAtk).toBe(100);
    expect(stats.hasNaturalSlabBoost).toBe(false);
  });

  it("calculates Level 85 and +50% max raw boost for Raw Gem-Mint", () => {
    const stats = getCardLevelAndStats(mockCharizard, "raw_mint");
    expect(stats.level).toBe(85);
    expect(stats.conditionBoostPercent).toBe(50);
    expect(stats.totalBoostPercent).toBe(50);
    expect(stats.boostedHp).toBe(180); // 120 * 1.50
    expect(stats.boostedAtk).toBe(150); // 100 * 1.50
  });

  it("applies +20% Natural Graded Slab Synergy Boost to PSA 10 to reach Level 100 and +50% capped stats", () => {
    const stats = getCardLevelAndStats(mockCharizard, "psa10");
    expect(stats.level).toBe(100);
    expect(stats.hasNaturalSlabBoost).toBe(true);
    expect(stats.slabBoostPercent).toBe(20);
    expect(stats.totalBoostPercent).toBe(50); // 30% grade + 20% slab = 50% max capped
    expect(stats.boostedHp).toBe(180);
    expect(stats.boostedAtk).toBe(150);
    expect(stats.tierBadge).toBe("GEM MINT CHAMPION");
  });

  it("applies Natural Slab Boost to PSA 8 to reach Level 80 with +40% combined boost", () => {
    const stats = getCardLevelAndStats(mockCharizard, "psa8");
    expect(stats.level).toBe(80);
    expect(stats.hasNaturalSlabBoost).toBe(true);
    expect(stats.slabBoostPercent).toBe(20);
    expect(stats.conditionBoostPercent).toBe(20);
    expect(stats.totalBoostPercent).toBe(40); // 20% + 20% = 40%
    expect(stats.boostedHp).toBe(168); // 120 * 1.40
  });
});
