import { describe, expect, it } from "bun:test";
import { cheapest, parseShopifySuggest, salePrice, sealedType, titleMatches } from "./core";

describe("shop core", () => {
  it("applies tiered markup", () => {
    expect(salePrice(12)).toBe(17);
    expect(salePrice(49.99)).toBe(59.99);
    expect(salePrice(200)).toBe(216);
    expect(salePrice(10, [{ min_price: 0, max_price: null, flat_usd: 2, percent: 10 }])).toBe(13);
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
