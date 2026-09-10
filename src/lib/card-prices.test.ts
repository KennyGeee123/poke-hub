import { describe, expect, test } from "bun:test";
import {
  listingKey,
  listingTotal,
  mergeLiveQueue,
  needsRefill,
  rankQueue,
  REFILL_AT,
  seedListingsFromCard,
  TICK_MS,
  type Listing,
} from "./card-prices";

function L(partial: Partial<Listing> & Pick<Listing, "source" | "price" | "url">): Listing {
  return {
    title: partial.title ?? partial.source,
    priceRaw: `$${partial.price}`,
    currency: "USD",
    image: null,
    kind: "listing",
    ...partial,
  };
}

describe("Quick Strike refill + ticker helpers", () => {
  test("TICK_MS is TimeFlow's 5s loop", () => {
    expect(TICK_MS).toBe(5000);
    expect(REFILL_AT).toBe(4);
  });

  test("needsRefill is true below 4 remaining rows", () => {
    const rows = [1, 2, 3].map((n) => L({ source: "TCGplayer", price: n, url: `https://x/${n}` }));
    expect(needsRefill(rows)).toBe(true);
    expect(needsRefill([...rows, L({ source: "Cardmarket", price: 4, url: "https://x/4" })])).toBe(false);
  });

  test("skip does not collapse the rest of the live queue", () => {
    const a = L({ source: "TCGplayer", price: 1, url: "https://tcgplayer.com/p/1", variant: "normal" });
    const b = L({ source: "TCGplayer", price: 2, url: "https://tcgplayer.com/p/1", variant: "holofoil" });
    const c = L({ source: "Cardmarket", price: 3, url: "https://cardmarket.com/p/1", variant: "low", currency: "EUR" });
    const skip = [listingKey(a)];
    const next = rankQueue(
      { query: "", cheapest: a, queue: [a, b, c], sources: [], generatedAt: "" },
      skip,
    );
    expect(next.map(listingKey)).toEqual([listingKey(b), listingKey(c)]);
  });

  test("mergeLiveQueue never reinserts skipped keys and re-ranks by landed cost", () => {
    const seed = L({ source: "TCGplayer", price: 9, url: "https://tcgplayer.com/p/1", variant: "normal", shipping: 0 });
    const liveCheap = L({ source: "Cardmarket", price: 2, shipping: 1, url: "https://cardmarket.com/p/1", variant: "low" });
    const liveSkip = L({ source: "TCGplayer", price: 1, url: "https://tcgplayer.com/p/2", variant: "holofoil" });
    const merged = mergeLiveQueue([seed], [liveSkip, liveCheap], [listingKey(liveSkip)]);
    expect(merged[0].source).toBe("Cardmarket");
    expect(listingTotal(merged[0])).toBe(3);
    expect(merged.some((l) => listingKey(l) === listingKey(liveSkip))).toBe(false);
  });

  test("seed emits Direct as its own row when it differs from low", () => {
    const rows = seedListingsFromCard({
      name: "Pikachu",
      set: { name: "Base" },
      images: { small: "https://img" },
      tcgplayer: {
        url: "https://tcgplayer.com/p/pika",
        prices: { normal: { low: 1.5, directLow: 2.25 } },
      },
    });
    const variants = rows.map((r) => r.variant).sort();
    expect(variants).toEqual(["normal", "normal-direct"]);
    expect(rows.every((r) => r.kind === "listing")).toBe(true);
  });

  test("seed does not duplicate Direct when it equals low", () => {
    const rows = seedListingsFromCard({
      name: "Pikachu",
      tcgplayer: {
        url: "https://tcgplayer.com/p/pika",
        prices: { normal: { low: 2, directLow: 2 } },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].variant).toBe("normal");
  });
});
