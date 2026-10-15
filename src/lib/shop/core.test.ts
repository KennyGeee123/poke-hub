import { describe, expect, it } from "bun:test";
import { DEFAULT_MARKUP_RULES, cheapest, markupCents, parseShopifySuggest, roundUp99, salePrice, salePriceCents, sealedType, titleMatches, toCents } from "./core";

describe("shop core", () => {
  it("sliding-scale tiers at every boundary (exact cents)", () => {
    const cases: [number, number][] = [
      [0.01, 0.11],   // 50% = 0.005 → 0.01, tier floor $0.10
      [0.05, 0.15],   // 50% = 0.025 → 0.03, floor $0.10
      [0.2, 0.3],     // 50% = 0.10 (= floor)
      [0.5, 0.75],    // 50% = 0.25
      [0.99, 1.49],   // 50% = 0.495 → 0.50 half-up
      [1.0, 1.4],     // 40% tier, floor $0.25
      [4.99, 6.99],   // 40% = 1.996 → 2.00
      [5.0, 6.5],     // 30% tier
      [19.99, 25.99], // 30% = 5.997 → 6.00
      [20.0, 24.0],   // 20%
      [49.99, 59.99], // 20% = 9.998 → 10.00
      [50.0, 57.5],   // 15%
      [99.99, 114.99],// 15% = 14.9985 → 15.00
      [100.0, 110.0], // 10%
      [249.99, 274.99],
      [250.0, 270.0], // 8%
      [1000.0, 1080.0],
      [0.1 + 0.2, 0.45], // float noise 0.30000000000000004 → 30¢, 50% = 15¢
    ];
    for (const [src, sale] of cases) expect([src, salePrice(src)]).toEqual([src, sale]);
  });
  it("defaults have no flat dollar markups", () => {
    expect(DEFAULT_MARKUP_RULES.every((r) => r.flat_usd === 0)).toBe(true);
  });
  it("cents math has no float drift", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(salePriceCents(1999)).toBe(2599);
    expect(markupCents(3333)).toBe(667); // 20% of 33.33 = 6.666 → 6.67
    expect(markupCents(1)).toBe(10);     // tier floor 10¢
  });
  it("floors: per-tier, global, and .99 rounding", () => {
    expect(salePrice(0.2, DEFAULT_MARKUP_RULES, { min_profit_usd: 0.5, round_99: false })).toBe(0.7);
    expect(salePrice(2, [{ min_price: 0, max_price: null, flat_usd: 0, percent: 10, min_profit_usd: 1 }])).toBe(3);
    expect(salePrice(12, DEFAULT_MARKUP_RULES, { min_profit_usd: 0, round_99: true })).toBe(15.99); // 15.60 → 15.99
    expect(roundUp99(1799)).toBe(1799);
    expect(roundUp99(1800)).toBe(1899);
    expect(roundUp99(1720)).toBe(1799);
  });
  it("custom tiers with flat + decimal percent", () => {
    expect(salePrice(10, [{ min_price: 0, max_price: null, flat_usd: 2, percent: 12.5 }])).toBe(13.25);
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
