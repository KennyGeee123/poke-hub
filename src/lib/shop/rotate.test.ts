import { describe, expect, it } from "bun:test";
import { CLAIM_HOLD_HOURS, cheapestUnclaimed, isClaimed } from "./core";

const now = Date.parse("2026-10-16T15:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const L = (source: string, price: number, currency = "USD") => ({
  source,
  title: "x",
  price,
  currency,
  url: "u",
  inStock: true,
});

describe("shop rotation after a sale", () => {
  it("a claimed seller is skipped during the hold, then comes back", () => {
    expect(isClaimed(hoursAgo(1), now)).toBe(true);
    expect(isClaimed(hoursAgo(CLAIM_HOLD_HOURS + 0.1), now)).toBe(false);
    expect(isClaimed(null, now)).toBe(false);
    expect(isClaimed("not a date", now)).toBe(false);
  });

  it("rotates to the next-cheapest seller once the cheapest is bought", () => {
    const ls = [L("ebay", 40), L("tcgplayer", 45), L("401games", 70, "CAD")];
    expect(cheapestUnclaimed(ls, new Map(), now)?.source).toBe("ebay");
    expect(cheapestUnclaimed(ls, new Map([["ebay", hoursAgo(2)]]), now)?.source).toBe("tcgplayer");
    // 70 CAD = 51.10 USD, so it is next after both USD sellers are claimed
    expect(
      cheapestUnclaimed(
        ls,
        new Map([
          ["ebay", hoursAgo(2)],
          ["tcgplayer", hoursAgo(1)],
        ]),
        now,
      )?.source,
    ).toBe("401games");
  });

  it("returns null when every seller is claimed (product drops out of stock)", () => {
    expect(cheapestUnclaimed([L("ebay", 40)], new Map([["ebay", hoursAgo(0.5)]]), now)).toBeNull();
  });

  it("expired claims count as available again", () => {
    expect(
      cheapestUnclaimed([L("ebay", 40), L("tcgplayer", 45)], new Map([["ebay", hoursAgo(30)]]), now)
        ?.source,
    ).toBe("ebay");
  });
});
