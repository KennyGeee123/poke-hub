import { describe, expect, it } from "bun:test";
import { profit, profitPct } from "./admin";
import { DEFAULT_MARKUP_RULES, DEFAULT_PRICING, cheapest, normalizePricing, roundUpWhole, markupCents, parseShopifySuggest, roundUp99, salePrice, salePriceCents, sealedType, titleMatches, toCents } from "./core";

describe("shop core", () => {
  const NONE = { min_profit_usd: 0, rounding: "none" as const };
  it("default: whole-dollar ceiling — Kenneth's example table", () => {
    // [source, sale, profit $, profit % of source]
    const table: [number, number, number, number][] = [
      [0.05, 1, 0.95, 1900],
      [0.2, 1, 0.8, 400],
      [0.8, 1, 0.2, 25],
      [0.99, 1, 0.01, 1],
      [1, 2, 1, 100],
      [2.5, 4, 1.5, 60],
      [4.99, 7, 2.01, 40.3],
      [7, 10, 3, 42.9],
      [19.99, 26, 6.01, 30.1],
      [45, 54, 9, 20],
      [111, 123, 12, 10.8],
      [300, 324, 24, 8],
    ];
    for (const [src, sale, p, pct] of table) {
      const sp = salePrice(src);
      expect([src, sp]).toEqual([src, sale]);
      expect(profit(sp, src)).toBe(p);
      expect(profitPct(sp, src)).toBe(pct);
    }
  });
  it("whole-dollar keeps exact dollars, ceils everything else", () => {
    expect(roundUpWhole(1800)).toBe(1800);
    expect(roundUpWhole(1801)).toBe(1900);
    expect(roundUpWhole(1)).toBe(100);
    expect(salePrice(45)).toBe(54);     // 45 + 9.00 = 54.00 exactly → stays 54
    expect(salePrice(300)).toBe(324);   // 300 + 24.00 → 324
  });
  it("under-$1 tier: fixed $1 sale price regardless of rounding/floors", () => {
    for (const src of [0.01, 0.05, 0.2, 0.8, 0.99]) {
      expect(salePrice(src)).toBe(1);
      expect(salePrice(src, DEFAULT_MARKUP_RULES, { min_profit_usd: 5, rounding: "none" })).toBe(1);
    }
    expect(salePrice(1)).toBe(2); // $1.00 is the next tier (30%, min $0.50, ceil)
    const custom = DEFAULT_MARKUP_RULES.map((r) => (r.max_price === 1 ? { ...r, fixed_price_usd: 1.5 } : r));
    expect(salePrice(0.5, custom)).toBe(1.5);
    const noFixed = DEFAULT_MARKUP_RULES.map((r) => ({ ...r, fixed_price_usd: null }));
    expect(salePrice(0.8, noFixed)).toBe(2); // percent path when fixed price cleared
  });
  it("tier boundaries before rounding (exact cents)", () => {
    const cases: [number, number][] = [
      [0.01, 0.26],   // 25% = 0.0025 → 0, floor $0.25
      [0.99, 1.24],   // 25% = 0.2475 → 0.25
      [1.0, 1.5],     // 30% = 0.30 → floor $0.50
      [1.67, 2.17],   // 30% = 0.501 → 0.50
      [4.99, 6.49],   // 30% = 1.497 → 1.50
      [5.0, 6.5],     // 30% tier ($5–20)
      [19.99, 25.99],
      [20.0, 24.0],   // 20%
      [49.99, 59.99],
      [50.0, 57.5],   // 15%
      [99.99, 114.99],
      [100.0, 110.0], // 10%
      [249.99, 274.99],
      [250.0, 270.0], // 8%
      [0.1 + 0.2, 0.55], // float noise → 30¢ + floor 25¢
    ];
    const pct = DEFAULT_MARKUP_RULES.map((r) => ({ ...r, fixed_price_usd: null }));
    for (const [src, sale] of cases) expect([src, salePrice(src, pct, NONE)]).toEqual([src, sale]);
  });
  it("defaults have no flat dollar markups", () => {
    expect(DEFAULT_MARKUP_RULES.every((r) => r.flat_usd === 0)).toBe(true);
    expect(DEFAULT_PRICING.rounding).toBe("whole");
  });
  it("cents math has no float drift", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(salePriceCents(1999, DEFAULT_MARKUP_RULES, NONE)).toBe(2599);
    expect(markupCents(3333)).toBe(667); // 20% of 33.33 = 6.666 → 6.67
    expect(markupCents(1)).toBe(25);     // tier floor 25¢
  });
  it("rounding modes + floors", () => {
    expect(salePrice(12, DEFAULT_MARKUP_RULES, { min_profit_usd: 0, rounding: "99" })).toBe(15.99); // 15.60 → 15.99
    expect(salePrice(12, DEFAULT_MARKUP_RULES, { min_profit_usd: 0, rounding: "none" })).toBe(15.6);
    expect(salePrice(12, DEFAULT_MARKUP_RULES, { min_profit_usd: 0, rounding: "whole" })).toBe(16);
    expect(salePrice(0.2, DEFAULT_MARKUP_RULES.map((r) => ({ ...r, fixed_price_usd: null })), { min_profit_usd: 0.5, rounding: "none" })).toBe(0.7);
    expect(salePrice(2, [{ min_price: 0, max_price: null, flat_usd: 0, percent: 10, min_profit_usd: 1 }], NONE)).toBe(3);
    expect(roundUp99(1799)).toBe(1799);
    expect(roundUp99(1800)).toBe(1899);
  });
  it("normalizePricing accepts legacy round_99", () => {
    expect(normalizePricing({ min_profit_usd: 0, round_99: true }).rounding).toBe("99");
    expect(normalizePricing({}).rounding).toBe("whole");
    expect(normalizePricing({ rounding: "none" }).rounding).toBe("none");
    expect(normalizePricing({ rounding: "bogus" }).rounding).toBe("whole");
  });
  it("custom tiers with flat + decimal percent", () => {
    expect(salePrice(10, [{ min_price: 0, max_price: null, flat_usd: 2, percent: 12.5 }], NONE)).toBe(13.25);
  });
  it("keeps cases separate", () => expect(sealedType("30th Celebration Booster Bundle Case")).toBe("case"));
  it("classifies sealed", () => {
    expect(sealedType("30th Celebration Elite Trainer Box")).toBe("etb");
    expect(sealedType("30th Celebration Pokemon Center Elite Trainer Box")).toBe("pc_etb");
    expect(sealedType("Surging Sparks Booster Box")).toBe("booster_box");
    expect(sealedType("Code Card")).toBeNull();
  });
  it("matches retailer titles", () => {
    expect(titleMatches("Pokemon - 30th Celebration - Elite Trainer Box", "30th Celebration", "etb")).toBe(true);
    expect(titleMatches("Pokemon - 30th Celebration - Booster Bundle", "30th Celebration", "etb")).toBe(false);
    expect(titleMatches("Pokemon - Surging Sparks ETB", "SV08: Surging Sparks", "etb")).toBe(true);
  });
  it("parses shopify + picks cheapest", () => {
    const ls = parseShopifySuggest(
      { resources: { results: { products: [
        { title: "A", price: "99.95", url: "/products/a?x=1", available: true },
        { title: "B", price: "59.00", url: "/products/b", available: false },
        { title: "C", price: "79.00", url: "/products/c", available: true },
      ] } } },
      "s", "https://x.com", "USD",
    );
    expect(ls[0].url).toBe("https://x.com/products/a");
    expect(cheapest(ls)?.title).toBe("C");
  });
});
