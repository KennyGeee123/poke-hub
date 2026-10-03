import { describe, expect, it } from "bun:test";
import { getMarketPrice, type TCGCard } from "./pokemon-api";

const card = (extra: Partial<TCGCard>): TCGCard => ({
  id: "sv3pt5-1",
  name: "Bulbasaur",
  set: { id: "sv3pt5", name: "151" },
  images: { small: "", large: "" },
  ...extra,
});

describe("getMarketPrice", () => {
  it("prices a common at its normal print, not the reverse holo", () => {
    const c = card({
      tcgplayer: { prices: { reverseHolofoil: { market: 0.36 }, normal: { market: 0.26 } } },
    });
    expect(getMarketPrice(c)).toBe(0.26);
  });

  it("prefers unlimited over 1st Edition for the everyday copy", () => {
    const c = card({
      tcgplayer: {
        prices: { "1stEditionHolofoil": { market: 900 }, unlimitedHolofoil: { market: 345 } },
      },
    });
    expect(getMarketPrice(c)).toBe(345);
  });

  it("uses TCGPlayer market before the Cardmarket (EUR) average", () => {
    const c = card({
      tcgplayer: { prices: { holofoil: { market: 1022.31 } } },
      cardmarket: { prices: { avg7: 8.5 } } as TCGCard["cardmarket"],
    });
    expect(getMarketPrice(c)).toBe(1022.31);
  });

  it("falls back to Cardmarket only when TCGPlayer has nothing", () => {
    const c = card({ cardmarket: { prices: { avg7: 10 } } as TCGCard["cardmarket"] });
    expect(getMarketPrice(c)).toBe(10.8);
  });
});
