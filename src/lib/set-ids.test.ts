import { describe, expect, it } from "bun:test";
import {
  expectedSetTotal,
  localCardNumber,
  mergeSetCardsByLocalId,
  setCardsLookComplete,
  setIdAliases,
} from "./set-ids";

describe("setIdAliases", () => {
  it("maps Ascended Heroes me2pt5 to TCGdex me02.5", () => {
    const aliases = setIdAliases("me2pt5");
    expect(aliases).toContain("me2pt5");
    expect(aliases).toContain("me02.5");
    expect(aliases[0]).toBe("me02.5");
  });

  it("maps me02.5 back to me2pt5", () => {
    const aliases = setIdAliases("me02.5");
    expect(aliases).toContain("me2pt5");
    expect(aliases).toContain("me02.5");
  });

  it("pads Mega Evolution / Phantasmal Flames / Perfect Order", () => {
    expect(setIdAliases("me1")).toContain("me01");
    expect(setIdAliases("me01")).toContain("me1");
    expect(setIdAliases("me2")).toContain("me02");
    expect(setIdAliases("me3")).toContain("me03");
  });

  it("maps Black Bolt / White Flare and Celebration", () => {
    expect(setIdAliases("zsv10pt5")).toContain("sv10.5b");
    expect(setIdAliases("sv10.5b")).toContain("zsv10pt5");
    expect(setIdAliases("wsv10pt5")).toContain("sv10.5w");
    expect(setIdAliases("me55")).toContain("30th");
    expect(setIdAliases("sv8")).toContain("sv08");
  });
});

describe("set card completeness", () => {
  it("treats 250 of 295 Ascended Heroes as incomplete", () => {
    expect(setCardsLookComplete(Array.from({ length: 250 }, (_, i) => ({ id: `x-${i}` })), 295)).toBe(false);
    expect(setCardsLookComplete(Array.from({ length: 295 }, (_, i) => ({ id: `x-${i}` })), 295)).toBe(true);
  });

  it("reads expected total from card.set.total", () => {
    const cards = [{ id: "me2pt5-1", set: { total: 295, printedTotal: 217 } }];
    expect(expectedSetTotal(cards)).toBe(295);
  });
});

describe("mergeSetCardsByLocalId", () => {
  it("collapses me02.5-001 and me2pt5-1", () => {
    const dx = [{ id: "me02.5-001", number: "001", name: "Oddish" }];
    const ptcg = [{ id: "me2pt5-1", number: "1", name: "Oddish", tcgplayer: { prices: { normal: { market: 0.03 } } } }];
    const merged = mergeSetCardsByLocalId(dx, ptcg);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("me02.5-001");
    expect(localCardNumber(ptcg[0])).toBe("1");
    expect(localCardNumber(dx[0])).toBe("1");
  });

  it("removes 151 Charizard doubles from TCGdex + pokemontcg ids", () => {
    const dx = [
      { id: "sv03.5-006", number: "006", name: "Charizard" },
      { id: "sv03.5-199", number: "199", name: "Charizard" },
    ];
    const ptcg = [
      { id: "sv3pt5-6", number: "6", name: "Charizard" },
      { id: "sv3pt5-199", number: "199", name: "Charizard" },
    ];
    const merged = mergeSetCardsByLocalId(dx, ptcg);
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.id).sort()).toEqual(["sv03.5-006", "sv03.5-199"]);
  });

  it("does not treat a short cache as complete when expected is unknown", () => {
    expect(setCardsLookComplete([{ id: "a-1" }], 0)).toBe(false);
  });
});
