import { describe, expect, it } from "bun:test";
import {
  compareFairAssets,
  fairTradeDemos,
  gradeMockImg,
  makeCardAsset,
  makeGoAsset,
} from "./fair-trade-assets";
import { findSpecies } from "./pogo-market";
import type { TCGCard } from "./pokemon-api";

const card = (name: string, market: number): TCGCard =>
  ({
    id: `t-${name}`,
    name,
    set: { id: "base1", name: "Base Set", releaseDate: "1999/01/09" },
    images: { small: "/x.png", large: "/x.png" },
    tcgplayer: { prices: { holofoil: { market } } },
  }) as TCGCard;

describe("Fair Trade dual-mode assets", () => {
  it("exposes mock grade images for raw + PSA 7–10 + CGC/BGS", () => {
    for (const g of ["raw", "psa7", "psa8", "psa9", "psa10", "cgc10_pristine", "bgs10_black"] as const) {
      expect(gradeMockImg(g)).toContain("/fair-trade/grades/");
    }
  });

  it("card↔card: PSA 10 beats raw → YOU WIN / THEY ADD", () => {
    const mine = makeCardAsset(card("Charizard", 350), "psa10");
    const theirs = makeCardAsset(card("Pikachu", 12), "raw_nm");
    const v = compareFairAssets(mine, theirs);
    expect(v.mode).toBe("card-card");
    expect(v.youWinLose).toBe("YOU WIN");
    expect(v.label).toBe("THEY ADD");
    expect(mine.valueUsd).toBeGreaterThan(theirs.valueUsd);
  });

  it("GO↔GO: legendary shiny beats common → YOU WIN", () => {
    const mew = findSpecies("Mewtwo")[0]!;
    const eevee = findSpecies("Eevee")[0]!;
    const mine = makeGoAsset(mew, { shiny: true, ivPct: 100 });
    const theirs = makeGoAsset(eevee, { shiny: false, ivPct: 70 });
    const v = compareFairAssets(mine, theirs);
    expect(v.mode).toBe("go-go");
    expect(v.youWinLose).toBe("YOU WIN");
  });

  it("mixed card↔GO compares graded card vs name-keyed GO value", () => {
    const mine = makeCardAsset(card("Charizard", 350), "psa10");
    const pika = findSpecies("Pikachu")[0]!;
    const theirs = makeGoAsset(pika, { shiny: true });
    const v = compareFairAssets(mine, theirs);
    expect(v.mode).toBe("mixed");
    expect(v.youWinLose).not.toBe("NEED PRICES");
  });

  it("ships demos covering fair / win / lose across card, go, mixed", () => {
    const demos = fairTradeDemos();
    expect(demos.length).toBeGreaterThanOrEqual(9);
    const labels = new Set(
      demos.map((d) => compareFairAssets(d.mine, d.theirs).youWinLose),
    );
    expect(labels.has("FAIR") || labels.has("YOU WIN") || labels.has("YOU LOSE")).toBe(true);
    expect(demos.some((d) => d.mine.kind === "card" && d.theirs.kind === "go")).toBe(true);
    expect(demos.some((d) => d.mine.kind === "go" && d.theirs.kind === "go")).toBe(true);
  });
});
