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
  it("calculates baseline Level 5 and 0% boost for Damaged cards", () => {
    const stats = getCardLevelAndStats(mockCharizard, "raw_dmg");
    expect(stats.level).toBe(5);
    expect(stats.totalBoostPercent).toBe(0);
    expect(stats.boostedHp).toBe(120);
    expect(stats.boostedAtk).toBe(100);
    expect(stats.hasNaturalSlabBoost).toBe(false);
  });

  it("calculates Level 40 and +40% boost for Standard PSA 10 scans", () => {
    const stats = getCardLevelAndStats(mockCharizard, "psa10");
    expect(stats.level).toBe(40);
    expect(stats.totalBoostPercent).toBe(40);
    expect(stats.hasNaturalSlabBoost).toBe(true);
    expect(stats.slabBoostPercent).toBe(20);
    expect(stats.boostedHp).toBe(168); // 120 * 1.40
    expect(stats.boostedAtk).toBe(140); // 100 * 1.40
    expect(stats.tierBadge).toBe("GEM MINT 10 CHAMPION");
  });

  it("calculates Level 50 with max +50% stat boost for Pristine / BGS Black Label 10 scans", () => {
    const stats = getCardLevelAndStats(mockCharizard, "bgs10_black");
    expect(stats.level).toBe(50);
    expect(stats.totalBoostPercent).toBe(50);
    expect(stats.hasNaturalSlabBoost).toBe(true);
    expect(stats.slabBoostPercent).toBe(20);
    expect(stats.conditionBoostPercent).toBe(30);
    expect(stats.boostedHp).toBe(180); // 120 * 1.50
    expect(stats.boostedAtk).toBe(150); // 100 * 1.50
    expect(stats.tierBadge).toBe("PRISTINE GOD TIER");
  });

  it("calculates Level 50 with max +50% stat boost for CGC 10 Pristine", () => {
    const stats = getCardLevelAndStats(mockCharizard, "cgc10_pristine");
    expect(stats.level).toBe(50);
    expect(stats.totalBoostPercent).toBe(50);
    expect(stats.boostedHp).toBe(180);
    expect(stats.tierBadge).toBe("PRISTINE GOD TIER");
  });
});
