import { describe, expect, it } from "bun:test";
import {
  cardSearchScore,
  detectPrint,
  isGoldCard,
  parseSearchQuery,
  type SearchableCard,
} from "./card-search";

function card(partial: Partial<SearchableCard> & { rarity?: string }): SearchableCard {
  return { id: partial.id || "x-1", ...partial };
}

describe("gold search", () => {
  it("treats bare Gold as a gold-rarity query, not Golduck", () => {
    const p = parseSearchQuery("Gold");
    expect(p.print).toBe("gold");
    expect(p.name).toBe("");
    expect(detectPrint("gold star")).toBe("gold");
    expect(detectPrint("Gold Charizard")).toBe("gold");
    expect(parseSearchQuery("Gold Charizard").name).toBe("charizard");
  });

  it("does not treat Golduck / Goldeen as gold print", () => {
    expect(detectPrint("golduck")).toBe(null);
    expect(parseSearchQuery("Golduck").print).toBe(null);
    expect(parseSearchQuery("Golduck").name).toBe("golduck");
    expect(detectPrint("goldeen")).toBe(null);
  });

  it("matches hyper rare, secret rare, gold star; skips commons", () => {
    expect(isGoldCard(card({ rarity: "Hyper rare" }))).toBe(true);
    expect(isGoldCard(card({ rarity: "Mega Hyper Rare" }))).toBe(true);
    expect(isGoldCard(card({ rarity: "Secret Rare" }))).toBe(true);
    expect(isGoldCard(card({ rarity: "Rare Holo Star", name: "Umbreon ★" }))).toBe(true);
    expect(isGoldCard(card({ rarity: "Common", name: "Golduck" }))).toBe(false);
    expect(isGoldCard(card({ rarity: "Uncommon", name: "Goldeen" }))).toBe(false);
  });

  it("scores every gold card when the query is Gold", () => {
    const parsed = parseSearchQuery("Gold");
    expect(
      cardSearchScore(card({ rarity: "Hyper rare", names: { en: "Mew ex" } }), parsed, "en"),
    ).not.toBeNull();
    expect(
      cardSearchScore(card({ rarity: "Common", names: { en: "Golduck" } }), parsed, "en"),
    ).toBeNull();
  });
});
