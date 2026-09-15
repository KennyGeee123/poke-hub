// Graded card valuation engine & slab multiplier calculations
import type { TCGCard } from "./pokemon-api";
import { getMarketPrice } from "./pokemon-api";

export type CardGrade =
  | "raw"
  | "psa10"
  | "psa9"
  | "psa8"
  | "psa7"
  | "bgs10_black"
  | "bgs95"
  | "cgc10_pristine"
  | "cgc95"
  | "cgc9"
  | "sgc10";

export type GradeMeta = {
  id: CardGrade;
  company: "RAW" | "PSA" | "BGS" | "CGC" | "SGC";
  gradeNum: number | null;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  baseMultiplier: number;
  isSlab: boolean;
};

export const GRADING_FEE_ESTIMATE = 19.99; // Standard PSA/CGC/BGS submission cost baseline

export const GRADE_DEFINITIONS: Record<CardGrade, GradeMeta> = {
  raw: {
    id: "raw",
    company: "RAW",
    gradeNum: null,
    label: "Raw / Ungraded (NM)",
    shortLabel: "RAW",
    description: "Ungraded card in Near Mint condition",
    badgeBg: "rgba(255,255,255,0.08)",
    badgeText: "var(--t1, #ffffff)",
    baseMultiplier: 1.0,
    isSlab: false,
  },
  psa10: {
    id: "psa10",
    company: "PSA",
    gradeNum: 10,
    label: "PSA 10 (Gem Mint)",
    shortLabel: "PSA 10",
    description: "Gem Mint 10 - Virtually flawless centering, corners, and surface",
    badgeBg: "rgba(239, 68, 68, 0.18)",
    badgeText: "#f87171",
    baseMultiplier: 3.8,
    isSlab: true,
  },
  psa9: {
    id: "psa9",
    company: "PSA",
    gradeNum: 9,
    label: "PSA 9 (Mint)",
    shortLabel: "PSA 9",
    description: "Mint 9 - Superb condition with minor imperfection",
    badgeBg: "rgba(239, 68, 68, 0.12)",
    badgeText: "#fca5a5",
    baseMultiplier: 1.45,
    isSlab: true,
  },
  psa8: {
    id: "psa8",
    company: "PSA",
    gradeNum: 8,
    label: "PSA 8 (NM-MT)",
    shortLabel: "PSA 8",
    description: "Near Mint-Mint 8 - High-end collectible grade",
    badgeBg: "rgba(239, 68, 68, 0.09)",
    badgeText: "#fecaca",
    baseMultiplier: 1.05,
    isSlab: true,
  },
  psa7: {
    id: "psa7",
    company: "PSA",
    gradeNum: 7,
    label: "PSA 7 (Near Mint)",
    shortLabel: "PSA 7",
    description: "Near Mint 7 - Slight surface wear or minor centering drift",
    badgeBg: "rgba(239, 68, 68, 0.06)",
    badgeText: "#e2e8f0",
    baseMultiplier: 0.85,
    isSlab: true,
  },
  bgs10_black: {
    id: "bgs10_black",
    company: "BGS",
    gradeNum: 10,
    label: "BGS 10 Black Label (Pristine)",
    shortLabel: "BGS 10 BL",
    description: "Perfect 10 on all four subgrades: Centering, Corners, Edges, Surface",
    badgeBg: "rgba(0, 0, 0, 0.6)",
    badgeText: "#fbbf24",
    baseMultiplier: 8.5,
    isSlab: true,
  },
  bgs95: {
    id: "bgs95",
    company: "BGS",
    gradeNum: 9.5,
    label: "BGS 9.5 (Gem Mint)",
    shortLabel: "BGS 9.5",
    description: "Beckett Gem Mint 9.5 - Premium quad-subgrade slab",
    badgeBg: "rgba(217, 119, 6, 0.18)",
    badgeText: "#fbbf24",
    baseMultiplier: 3.2,
    isSlab: true,
  },
  cgc10_pristine: {
    id: "cgc10_pristine",
    company: "CGC",
    gradeNum: 10,
    label: "CGC 10 (Pristine)",
    shortLabel: "CGC 10",
    description: "CGC Cards Pristine 10 - Flawless presentation slab",
    badgeBg: "rgba(37, 99, 235, 0.18)",
    badgeText: "#60a5fa",
    baseMultiplier: 3.6,
    isSlab: true,
  },
  cgc95: {
    id: "cgc95",
    company: "CGC",
    gradeNum: 9.5,
    label: "CGC 9.5 (Gem Mint)",
    shortLabel: "CGC 9.5",
    description: "CGC Cards Gem Mint 9.5",
    badgeBg: "rgba(37, 99, 235, 0.14)",
    badgeText: "#93c5fd",
    baseMultiplier: 2.1,
    isSlab: true,
  },
  cgc9: {
    id: "cgc9",
    company: "CGC",
    gradeNum: 9,
    label: "CGC 9 (Mint)",
    shortLabel: "CGC 9",
    description: "CGC Cards Mint 9",
    badgeBg: "rgba(37, 99, 235, 0.10)",
    badgeText: "#bfdbfe",
    baseMultiplier: 1.35,
    isSlab: true,
  },
  sgc10: {
    id: "sgc10",
    company: "SGC",
    gradeNum: 10,
    label: "SGC 10 (Gem Mint - Tuxedo)",
    shortLabel: "SGC 10",
    description: "SGC Gem 10 in signature black Tuxedo slab",
    badgeBg: "rgba(15, 23, 42, 0.8)",
    badgeText: "#38bdf8",
    baseMultiplier: 2.8,
    isSlab: true,
  },
};

export const ALL_GRADES: CardGrade[] = [
  "raw",
  "psa10",
  "psa9",
  "psa8",
  "psa7",
  "bgs10_black",
  "bgs95",
  "cgc10_pristine",
  "cgc95",
  "cgc9",
  "sgc10",
];

export function getGradeMeta(grade: CardGrade): GradeMeta {
  return GRADE_DEFINITIONS[grade] ?? GRADE_DEFINITIONS.raw;
}

export function getEraMultiplierAdjustment(card: { set?: { releaseDate?: string; name?: string }; rarity?: string }): number {
  const releaseYear = parseInt(card.set?.releaseDate?.slice(0, 4) || "2020", 10);
  const rarity = (card.rarity || "").toLowerCase();
  const setName = (card.set?.name || "").toLowerCase();

  let eraBonus = 1.0;
  if (releaseYear <= 2003) {
    eraBonus = 2.4;
  } else if (releaseYear <= 2007) {
    eraBonus = 2.0;
  } else if (releaseYear <= 2012) {
    eraBonus = 1.5;
  } else if (releaseYear <= 2018) {
    eraBonus = 1.2;
  } else {
    eraBonus = 1.0;
  }

  if (/secret|hyper|special\s*art|illustration|alt\s*art|gold\s*star|shining/i.test(rarity) || /shadowless|1st\s*edition/i.test(setName)) {
    eraBonus *= 1.35;
  } else if (/holo|ultra|vmax|vstar|ex|gx/i.test(rarity)) {
    eraBonus *= 1.15;
  }

  return eraBonus;
}

export type GradedValuation = {
  grade: CardGrade;
  meta: GradeMeta;
  rawPrice: number;
  estimatedGradedPrice: number;
  multiplier: number;
  gradingFee: number;
  estimatedProfit: number;
  estimatedRoiPct: number;
  isSlab: boolean;
};

export function calculateGradedValue(card: TCGCard, grade: CardGrade): GradedValuation {
  const rawPrice = getMarketPrice(card) || 1.0;
  const meta = getGradeMeta(grade);

  if (grade === "raw") {
    return {
      grade: "raw",
      meta,
      rawPrice,
      estimatedGradedPrice: rawPrice,
      multiplier: 1.0,
      gradingFee: 0,
      estimatedProfit: 0,
      estimatedRoiPct: 0,
      isSlab: false,
    };
  }

  const eraAdj = getEraMultiplierAdjustment(card);
  let effectiveMultiplier = meta.baseMultiplier;

  if (meta.gradeNum && meta.gradeNum >= 9.5) {
    effectiveMultiplier = 1.0 + (meta.baseMultiplier - 1.0) * eraAdj;
  } else if (meta.gradeNum === 9) {
    effectiveMultiplier = 1.0 + (meta.baseMultiplier - 1.0) * Math.min(1.4, eraAdj);
  } else if (meta.gradeNum && meta.gradeNum <= 8) {
    effectiveMultiplier = meta.baseMultiplier;
  }

  const estimatedGradedPrice = Math.max(
    rawPrice * effectiveMultiplier,
    rawPrice + (meta.isSlab ? 18.0 : 0)
  );

  const rounded = Math.round(estimatedGradedPrice * 100) / 100;
  const totalCostBasis = rawPrice + GRADING_FEE_ESTIMATE;
  const profit = rounded - totalCostBasis;
  const roi = totalCostBasis > 0 ? Math.round((profit / totalCostBasis) * 100) : 0;

  return {
    grade,
    meta,
    rawPrice,
    estimatedGradedPrice: rounded,
    multiplier: Math.round(effectiveMultiplier * 100) / 100,
    gradingFee: GRADING_FEE_ESTIMATE,
    estimatedProfit: Math.round(profit * 100) / 100,
    estimatedRoiPct: roi,
    isSlab: meta.isSlab,
  };
}

export function getSlabSearchUrls(card: TCGCard, grade: CardGrade) {
  const meta = getGradeMeta(grade);
  const baseQuery = `${card.name} ${card.set?.name || ""} ${card.number || ""}`.trim();
  const slabQuery = grade === "raw" ? `${baseQuery} raw` : `${baseQuery} ${meta.shortLabel}`;

  const enc = encodeURIComponent;
  return {
    ebayActive: `https://www.ebay.com/sch/i.html?_nkw=${enc(slabQuery + " pokemon")}&_sacat=183454&LH_BIN=1&_sop=15`,
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${enc(slabQuery + " pokemon")}&_sacat=183454&LH_Complete=1&LH_Sold=1&_sop=13`,
    priceCharting: `https://www.pricecharting.com/search-products?q=${enc(baseQuery)}&type=prices`,
  };
}
