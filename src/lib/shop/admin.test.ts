import { describe, expect, it } from "bun:test";
import { profit, profitPct, safeEqual, validatePricing, validateOrderPatch, validateProductPatch, validateRule } from "./admin";

describe("shop admin", () => {
  it("profit", () => {
    expect(profit(119.88, 111)).toBe(8.88);
    expect(profit(80, 70, 2)).toBe(20);
    expect(profit(null, 5)).toBeNull();
    expect(profit(0.3, 0.1)).toBe(0.2);
    expect(profitPct(24, 20)).toBe(20);
    expect(profitPct(25.99, 19.99)).toBe(30);
    expect(profitPct(10, 0)).toBeNull();
    expect(validatePricing({ min_profit_usd: 1 })).toBeNull();
    expect(validatePricing({ min_profit_usd: -1 })).not.toBeNull();
  });
  it("rules", () => {
    expect(validateRule({ min_price: 0, max_price: 20, flat_usd: 5, percent: 0 })).toBeNull();
    expect(validateRule({ min_price: 100, max_price: null, flat_usd: 0, percent: 8 })).toBeNull();
    expect(validateRule({ min_price: 20, max_price: 10, flat_usd: 5, percent: 0 })).not.toBeNull();
    expect(validateRule({ min_price: 0, max_price: null, flat_usd: 0, percent: 0 })).not.toBeNull();
    expect(validateRule({ min_price: 0, max_price: 1, flat_usd: 0, percent: 50, min_profit_usd: 0.1 })).toBeNull();
    expect(validateRule({ min_price: 0, max_price: 1, flat_usd: 0, percent: 50, min_profit_usd: -1 })).not.toBeNull();
    expect(validateRule({ min_price: 0, max_price: 1, flat_usd: 0, percent: 0, fixed_price_usd: 1 })).toBeNull();
    expect(validateRule({ min_price: 0, max_price: 1, flat_usd: 0, percent: 0, fixed_price_usd: 0.5 })).not.toBeNull();
  });
  it("patches", () => {
    expect(validateOrderPatch({ status: "shipped", tracking_number: "1Z" })).toBeNull();
    expect(validateOrderPatch({ status: "lost" })).not.toBeNull();
    expect(validateProductPatch({ sell_mode: "affiliate", affiliate_url: "https://x.com/a" })).toBeNull();
    expect(validateProductPatch({ affiliate_url: "javascript:alert(1)" })).not.toBeNull();
    expect(validateProductPatch({ price_override: -1 })).not.toBeNull();
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
});
