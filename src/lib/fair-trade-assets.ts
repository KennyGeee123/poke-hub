// Unified Fair Trade assets: TCG cards (graded) and Pokémon GO creatures (name-keyed eBay values).
import type { TCGCard } from "./pokemon-api";
import {
  type CardGrade,
  getEstimatedGradePrice,
  getGradeMeta,
  GRADE_DEFINITIONS,
} from "./card-grades";
import {
  estimatePoGoValueByName,
  findSpecies,
  pogoSpriteUrl,
  type PoGoSpecies,
  valueFromEbayOrEstimate,
} from "./pogo-market";
import { fairTradeSwap, type FairTradeVerdict } from "./p2p-trading";

export type FairAssetKind = "card" | "go";

/** Mock slab / raw images under public/fair-trade/grades/ */
export const GRADE_MOCK_IMG: Partial<Record<CardGrade, string>> = {
  raw: "/fair-trade/grades/raw.svg",
  raw_nm: "/fair-trade/grades/raw.svg",
  raw_mint: "/fair-trade/grades/raw.svg",
  psa7: "/fair-trade/grades/psa7.svg",
  psa8: "/fair-trade/grades/psa8.svg",
  psa9: "/fair-trade/grades/psa9.svg",
  psa10: "/fair-trade/grades/psa10.svg",
  cgc10_pristine: "/fair-trade/grades/cgc10.svg",
  cgc95: "/fair-trade/grades/cgc95.svg",
  bgs10_black: "/fair-trade/grades/bgs10.svg",
  bgs95: "/fair-trade/grades/bgs95.svg",
};

export function gradeMockImg(grade: CardGrade): string {
  return GRADE_MOCK_IMG[grade] || GRADE_MOCK_IMG.raw || "/fair-trade/grades/raw.svg";
}

export type FairCardAsset = {
  kind: "card";
  id: string;
  card: TCGCard;
  grade: CardGrade;
  /** Graded market value (USD). */
  valueUsd: number;
  image: string;
  label: string;
  sublabel: string;
};

export type FairGoAsset = {
  kind: "go";
  id: string;
  species: PoGoSpecies;
  shiny: boolean;
  lucky: boolean;
  ivPct: number;
  cp: number;
  valueUsd: number;
  image: string;
  label: string;
  sublabel: string;
};

export type FairAsset = FairCardAsset | FairGoAsset;

export function cardAssetValue(card: TCGCard, grade: CardGrade): number {
  return getEstimatedGradePrice(card, grade);
}

export function makeCardAsset(card: TCGCard, grade: CardGrade = "raw_nm"): FairCardAsset {
  const meta = getGradeMeta(grade);
  const valueUsd = cardAssetValue(card, grade);
  const img =
    card.images?.large ||
    card.images?.small ||
    gradeMockImg(grade);
  return {
    kind: "card",
    id: `card:${card.id}:${grade}`,
    card,
    grade,
    valueUsd,
    image: img,
    label: card.name,
    sublabel: `${meta.shortLabel} · ${card.set?.name || ""}${card.number ? ` #${card.number}` : ""}`.trim(),
  };
}

export function goAssetValue(
  species: PoGoSpecies,
  opts?: { shiny?: boolean; lucky?: boolean; ivPct?: number },
): number {
  let v = estimatePoGoValueByName(species.name, species.rarity);
  if (opts?.shiny) v *= 1.55;
  if (opts?.lucky) v *= 1.12;
  const iv = opts?.ivPct ?? 90;
  if (iv >= 98) v *= 1.25;
  else if (iv >= 90) v *= 1.1;
  return Math.round(v * 100) / 100;
}

export function makeGoAsset(
  species: PoGoSpecies,
  opts?: { shiny?: boolean; lucky?: boolean; ivPct?: number; cp?: number },
): FairGoAsset {
  const shiny = !!opts?.shiny;
  const lucky = !!opts?.lucky;
  const ivPct = opts?.ivPct ?? 95;
  const cp = opts?.cp ?? 2500;
  const valueUsd = goAssetValue(species, { shiny, lucky, ivPct });
  const badges = [
    shiny ? "✨ Shiny" : null,
    lucky ? "🍀 Lucky" : null,
    `${ivPct}% IV`,
    `${cp} CP`,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "go",
    id: `go:${species.id}:${shiny ? "s" : "n"}:${lucky ? "l" : "n"}`,
    species,
    shiny,
    lucky,
    ivPct,
    cp,
    valueUsd,
    image: pogoSpriteUrl(species.id),
    label: species.name,
    sublabel: `GO · ${badges}`,
  };
}

export function assetValue(a: FairAsset | null | undefined): number {
  return a?.valueUsd || 0;
}

export function compareFairAssets(
  mine: FairAsset | null,
  theirs: FairAsset | null,
  cashMine = 0,
  cashTheirs = 0,
): FairTradeVerdict & { mode: "card-card" | "go-go" | "mixed" | "empty"; youWinLose: "FAIR" | "YOU WIN" | "YOU LOSE" | "NEED PRICES" } {
  const v = fairTradeSwap(assetValue(mine), assetValue(theirs), cashMine, cashTheirs);
  let mode: "card-card" | "go-go" | "mixed" | "empty" = "empty";
  if (mine && theirs) {
    if (mine.kind === "card" && theirs.kind === "card") mode = "card-card";
    else if (mine.kind === "go" && theirs.kind === "go") mode = "go-go";
    else mode = "mixed";
  }
  let youWinLose: "FAIR" | "YOU WIN" | "YOU LOSE" | "NEED PRICES" = "NEED PRICES";
  if (v.label === "FAIR") youWinLose = "FAIR";
  else if (v.label === "THEY ADD") youWinLose = "YOU WIN"; // they add cash → you come out ahead on assets
  else if (v.label === "YOU ADD") youWinLose = "YOU LOSE";
  else youWinLose = "NEED PRICES";
  return { ...v, mode, youWinLose };
}

/** Offline demo fixtures with baked TCGPlayer prices so guest/offline still works. */
function mockTcg(
  id: string,
  name: string,
  setName: string,
  number: string,
  market: number,
  image: string,
): TCGCard {
  return {
    id,
    name,
    number,
    rarity: "Rare Holo",
    set: { id: id.split("-")[0], name: setName, releaseDate: "1999/01/09" },
    images: { small: image, large: image },
    tcgplayer: { prices: { holofoil: { market, mid: market, low: market * 0.85, high: market * 1.2 } } },
  } as TCGCard;
}

const DEMO_CHAR = mockTcg(
  "demo-base1-4",
  "Charizard",
  "Base Set",
  "4",
  350,
  "https://images.pokemontcg.io/base1/4_hires.png",
);
const DEMO_PIKA = mockTcg(
  "demo-base1-58",
  "Pikachu",
  "Base Set",
  "58",
  12,
  "https://images.pokemontcg.io/base1/58_hires.png",
);
const DEMO_BLAST = mockTcg(
  "demo-base1-2",
  "Blastoise",
  "Base Set",
  "2",
  180,
  "https://images.pokemontcg.io/base1/2_hires.png",
);

function sp(name: string): PoGoSpecies {
  return findSpecies(name)[0] || { id: 25, name, types: ["Electric"], rarity: "shiny_popular" };
}

export type FairDemoId =
  | "fair-card"
  | "you-win-card"
  | "you-lose-card"
  | "fair-go"
  | "you-win-go"
  | "you-lose-go"
  | "fair-mixed"
  | "you-win-mixed"
  | "you-lose-mixed";

export type FairDemo = {
  id: FairDemoId;
  title: string;
  blurb: string;
  mine: FairAsset;
  theirs: FairAsset;
};

export function fairTradeDemos(): FairDemo[] {
  const mew = sp("Mewtwo");
  const ray = sp("Rayquaza");
  const pika = sp("Pikachu");
  const eevee = sp("Eevee");
  const arceus = sp("Arceus");

  return [
    {
      id: "fair-card",
      title: "FAIR · Card ↔ Card",
      blurb: "PSA 7 Charizard ≈ PSA 9 Blastoise (graded values)",
      mine: makeCardAsset(DEMO_CHAR, "psa7"),
      theirs: makeCardAsset(DEMO_BLAST, "psa9"),
    },
    {
      id: "you-win-card",
      title: "YOU WIN · Card ↔ Card",
      blurb: "Your PSA 10 Charizard vs their raw Pikachu — they add cash",
      mine: makeCardAsset(DEMO_CHAR, "psa10"),
      theirs: makeCardAsset(DEMO_PIKA, "raw_nm"),
    },
    {
      id: "you-lose-card",
      title: "YOU LOSE · Card ↔ Card",
      blurb: "Your raw Pikachu vs their PSA 10 Charizard — you add cash",
      mine: makeCardAsset(DEMO_PIKA, "raw_nm"),
      theirs: makeCardAsset(DEMO_CHAR, "psa10"),
    },
    {
      id: "fair-go",
      title: "FAIR · GO ↔ GO",
      blurb: "Shiny Gyarados ≈ lucky Dragonite by name-keyed GO value",
      mine: makeGoAsset(sp("Gyarados"), { shiny: true, ivPct: 96, cp: 3200 }),
      theirs: makeGoAsset(sp("Dragonite"), { lucky: true, ivPct: 98, cp: 3500 }),
    },
    {
      id: "you-win-go",
      title: "YOU WIN · GO ↔ GO",
      blurb: "Your shiny Mewtwo vs their Eevee — they add",
      mine: makeGoAsset(mew, { shiny: true, ivPct: 100, cp: 4000 }),
      theirs: makeGoAsset(eevee, { shiny: false, ivPct: 80, cp: 900 }),
    },
    {
      id: "you-lose-go",
      title: "YOU LOSE · GO ↔ GO",
      blurb: "Your Pikachu vs their Arceus — you add",
      mine: makeGoAsset(pika, { shiny: false, ivPct: 85, cp: 1100 }),
      theirs: makeGoAsset(arceus, { shiny: true, ivPct: 100, cp: 4200 }),
    },
    {
      id: "fair-mixed",
      title: "FAIR · Card ↔ GO",
      blurb: "PSA 8 Blastoise ≈ shiny Rayquaza (cross-market)",
      mine: makeCardAsset(DEMO_BLAST, "psa8"),
      theirs: makeGoAsset(ray, { shiny: true, ivPct: 98, cp: 3800 }),
    },
    {
      id: "you-win-mixed",
      title: "YOU WIN · Card ↔ GO",
      blurb: "Your PSA 10 Charizard vs their GO Pikachu",
      mine: makeCardAsset(DEMO_CHAR, "psa10"),
      theirs: makeGoAsset(pika, { shiny: true, ivPct: 90, cp: 1500 }),
    },
    {
      id: "you-lose-mixed",
      title: "YOU LOSE · Card ↔ GO",
      blurb: "Your raw Pikachu card vs their shiny Mewtwo GO",
      mine: makeCardAsset(DEMO_PIKA, "raw"),
      theirs: makeGoAsset(mew, { shiny: true, ivPct: 100, cp: 4100 }),
    },
  ];
}

export { getGradeMeta, GRADE_DEFINITIONS, valueFromEbayOrEstimate };
