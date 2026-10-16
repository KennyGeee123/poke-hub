import { describe, expect, it } from "bun:test";
import { CLASSIC_NOT_GOLD_FRAMED, isClassicCollectionCard, isGoldBorderCard } from "./gold-border";

describe("gold border", () => {
  it("gilds every Classic Collection print, which TCGdex gives no rarity", () => {
    const c = { id: "30th-c-002", name: "Charizard", rarity: null, set: { id: "30th-c" } };
    expect(isClassicCollectionCard(c)).toBe(true);
    expect(isGoldBorderCard(c)).toBe(true);
    // Id alone is enough when the set object is missing.
    expect(isGoldBorderCard({ id: "me55c-203", name: "Magikarp" })).toBe(true);
    expect(
      isGoldBorderCard({
        id: "x-1",
        name: "Eevee",
        set: { id: "x", name: "30th Classic Collection" },
      }),
    ).toBe(true);
  });

  it("gilds gold-tier rarities, including Special Illustration Rare", () => {
    for (const rarity of [
      "Special illustration rare",
      "Hyper rare",
      "Secret Rare",
      "Rare Secret",
      "Gold Star",
    ]) {
      expect(
        isGoldBorderCard({ id: "30th-010", name: "Pikachu", rarity, set: { id: "30th" } }),
      ).toBe(true);
    }
  });

  it("leaves ordinary Celebration prints plain", () => {
    for (const rarity of ["Common", "Rare", "Double rare", "Illustration rare", "Pikachu Rare"]) {
      expect(
        isGoldBorderCard({ id: "30th-001", name: "Exeggcute", rarity, set: { id: "30th" } }),
      ).toBe(false);
    }
    // "30th-001" must not be mistaken for the Classic set by its prefix.
    expect(isClassicCollectionCard({ id: "30th-001" })).toBe(false);
  });
});

describe("Classic Collection: only prints with a real gold frame are framed", () => {
  it("skips the three full-bleed EX/VMAX prints but still gilds the rest", () => {
    for (const id of CLASSIC_NOT_GOLD_FRAMED) {
      expect(isClassicCollectionCard({ id })).toBe(true);
      expect(isGoldBorderCard({ id, name: "x", set: { id: "30th-c" } })).toBe(false);
    }
    expect(CLASSIC_NOT_GOLD_FRAMED.size).toBe(3);
    expect(isGoldBorderCard({ id: "30th-c-001", name: "Charizard", set: { id: "30th-c" } })).toBe(
      true,
    );
    // me55c-4 is Charizard 4/102. The printed gold edge is on that scan.
    expect(isGoldBorderCard({ id: "me55c-4", name: "Charizard", set: { id: "me55c" } })).toBe(
      true,
    );
    expect(isGoldBorderCard({ id: "me55c-11g", name: "Genesect EX" })).toBe(false);
    expect(isGoldBorderCard({ id: "me55c-106m", name: "M Gardevoir EX" })).toBe(false);
    expect(isGoldBorderCard({ id: "me55c-114", name: "Mew VMAX" })).toBe(false);
    expect(isGoldBorderCard({ id: "30th-c-030", name: "Magikarp", set: { id: "30th-c" } })).toBe(
      true,
    );
  });
});
