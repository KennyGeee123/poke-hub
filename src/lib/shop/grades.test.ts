import { describe, expect, it } from "bun:test";
import { median, parseGrade, parsePriceCharting, sortVariants, titleMatchesGrade, variantId, variantLabel } from "./grades";

describe("grades", () => {
  it("parses grader + grade from titles", () => {
    expect(parseGrade("2026 Pokemon 30th Celebration Sylveon ex 071/128 PSA 10 GEM MINT")).toEqual({ grader: "PSA", grade: "10" });
    expect(parseGrade("Charizard BGS 9.5 Gem Mint")).toEqual({ grader: "BGS", grade: "9.5" });
    expect(parseGrade("Beckett 9 Pikachu")).toEqual({ grader: "BGS", grade: "9" });
    expect(parseGrade("CGC Pristine 10 Umbreon")).toEqual({ grader: "CGC", grade: "10" });
    expect(parseGrade("Pikachu NM raw card")).toBeNull();
  });
  it("matches the exact card + grade only", () => {
    const t = "Pokemon Sylveon ex 071/128 30th Celebration PSA 10";
    expect(titleMatchesGrade(t, "071/128", "PSA", "10")).toBe(true);
    expect(titleMatchesGrade(t, "071/128", "PSA", "9")).toBe(false);
    expect(titleMatchesGrade(t, "072/128", "PSA", "10")).toBe(false);
    expect(titleMatchesGrade("Sylveon ex 71/128 PSA 10", "071/128", "PSA", "10")).toBe(true);
    expect(titleMatchesGrade("LOT of 5 Sylveon ex 071/128 PSA 10", "071/128", "PSA", "10")).toBe(false);
    expect(titleMatchesGrade("Sylveon ex 071/128 CGC 10", "071/128", "PSA", "10")).toBe(false);
  });
  it("median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("PriceCharting mapping uses only present prices (never invents)", () => {
    expect(parsePriceCharting({ "loose-price": 120, "manual-only-price": 15000, "graded-price": 4599, "bgs-10-price": 0 })).toEqual([
      { grader: "PSA", grade: "10", price: 150 },
      { grader: "ANY", grade: "9", price: 45.99 },
    ]);
    expect(parsePriceCharting({})).toEqual([]);
  });
  it("labels, ids, sort", () => {
    expect(variantLabel({ finish: "Holofoil", grader: "RAW", grade: "NM" })).toBe("Raw · Near Mint · Holofoil");
    expect(variantLabel({ finish: "Normal", grader: "PSA", grade: "10" })).toBe("PSA 10");
    expect(variantId("tcgp:1", "Reverse Holofoil", "RAW", "NM")).toBe("tcgp:1|reverse-holofoil|RAW|NM");
    const s = sortVariants([
      { finish: "Normal", grader: "PSA", grade: "9" }, { finish: "Normal", grader: "RAW", grade: "LP" },
      { finish: "Normal", grader: "PSA", grade: "10" }, { finish: "Normal", grader: "RAW", grade: "NM" },
      { finish: "Normal", grader: "ANY", grade: "9" }, { finish: "Normal", grader: "BGS", grade: "9.5" },
    ] as never[]);
    expect(s.map((v: { grader: string; grade: string }) => `${v.grader}${v.grade}`)).toEqual(["RAWNM", "RAWLP", "PSA10", "PSA9", "BGS9.5", "ANY9"]);
  });
});
