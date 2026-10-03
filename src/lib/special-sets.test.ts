import { describe, expect, it } from "bun:test";
import type { TCGSet } from "@/lib/pokemon-api";
import { isBoxSet, isTcgPocketSet, mergeSetLists } from "./special-sets";
import { canonicalSetId, setIdAliases } from "./set-ids";

const set = (id: string, name: string, total: number, series = ""): TCGSet => ({
  id,
  name,
  series,
  total,
  printedTotal: total,
  releaseDate: "",
  images: { logo: "", symbol: "" },
});

describe("set ids stay real", () => {
  it("keeps the API id instead of a synthetic pad", () => {
    expect(canonicalSetId("swsh1")).toBe("swsh1");
    expect(canonicalSetId("base1")).toBe("base1");
    expect(canonicalSetId("sv3pt5")).toBe("sv03.5");
  });

  it("maps pokemontcg White Flare rsv10pt5 to TCGdex sv10.5w", () => {
    expect(setIdAliases("rsv10pt5")).toContain("sv10.5w");
    expect(setIdAliases("sv10.5w")).toContain("rsv10pt5");
    expect(canonicalSetId("rsv10pt5")).toBe("sv10.5w");
  });
});

describe("mergeSetLists", () => {
  it("counts 30th Celebration + Classic once each (no double Classic)", () => {
    const ptcg = [
      set("me55c", "30th Celebration: Classic Collection", 30),
      set("me55", "30th Celebration", 161),
    ];
    const dx = [set("30th", "30th Celebration", 158), set("30th-c", "30th Classic Collection", 30)];
    const out = mergeSetLists(ptcg, dx);
    const box = out.filter((s) => s.id === "30th");
    expect(box.length).toBe(1);
    expect(box[0].total).toBe(191);
  });

  it("collapses White Flare from both sources into one sv10.5w box", () => {
    const out = mergeSetLists(
      [set("rsv10pt5", "White Flare", 173)],
      [set("sv10.5w", "White Flare", 173)],
    );
    expect(out.map((s) => s.id)).toEqual(["sv10.5w"]);
  });
});

describe("Box sets chip", () => {
  it("includes Celebrations and small special expansions", () => {
    expect(isBoxSet(set("cel25", "Celebrations", 25))).toBe(true);
    expect(isBoxSet(set("det1", "Detective Pikachu", 18))).toBe(true);
    expect(isBoxSet(set("sv1", "Scarlet & Violet", 258))).toBe(true);
  });

  it("excludes TCG Pocket, promos and McDonald's", () => {
    expect(isTcgPocketSet(set("A1", "Genetic Apex", 286))).toBe(true);
    expect(isBoxSet(set("A1", "Genetic Apex", 286))).toBe(false);
    expect(isBoxSet(set("B2a", "Paldean Wonders", 131))).toBe(false);
    expect(isBoxSet(set("svp", "Scarlet & Violet Black Star Promos", 196))).toBe(false);
    expect(isBoxSet(set("mcd24", "McDonald's Collection 2024", 15))).toBe(false);
  });
});

describe("pokemontcg ↔ TCGdex box ids", () => {
  it("reaches the TCGdex box for sets with odd pokemontcg ids", () => {
    const pairs: [string, string][] = [
      ["swsh45", "swsh4.5"],
      ["swsh35", "swsh3.5"],
      ["sm75", "sm7.5"],
      ["sm35", "sm3.5"],
      ["swsh45sv", "swsh4.5sv"],
      ["swsh12pt5gg", "swsh12.5gg"],
      ["cel25c", "cel25cc"],
      ["pgo", "swsh10.5"],
      ["base6", "lc"],
    ];
    for (const [ptcg, dx] of pairs) {
      expect(setIdAliases(ptcg).slice(0, 6)).toContain(dx);
    }
  });
});
