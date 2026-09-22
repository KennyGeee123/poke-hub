// Graded & Ungraded Condition Valuation Engine & AI Grade Pre-Determination Analyzer
import type { TCGCard } from "./pokemon-api";
import { getMarketPrice } from "./pokemon-api";

export type QualityCategory = "ungraded" | "graded";

export type RawQuality =
  | "raw_mint"
  | "raw_nm"
  | "raw_lp"
  | "raw_mp"
  | "raw_hp"
  | "raw_dmg";

export type SlabGrade =
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

export type CardGrade = "raw" | RawQuality | SlabGrade;

export type GradeMeta = {
  id: CardGrade;
  category: QualityCategory;
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

export const GRADING_FEE_ESTIMATE = 19.99; // Standard PSA/CGC submission cost

export const GRADE_DEFINITIONS: Record<CardGrade, GradeMeta> = {
  raw: {
    id: "raw",
    category: "ungraded",
    company: "RAW",
    gradeNum: null,
    label: "Raw / Near Mint (Standard Baseline)",
    shortLabel: "RAW NM",
    description: "Ungraded card in Near Mint baseline condition",
    badgeBg: "rgba(255,255,255,0.08)",
    badgeText: "var(--t1, #ffffff)",
    baseMultiplier: 1.0,
    isSlab: false,
  },
  raw_mint: {
    id: "raw_mint",
    category: "ungraded",
    company: "RAW",
    gradeNum: 9.5,
    label: "Raw Mint (Pack Fresh / Flawless)",
    shortLabel: "MINT (RAW)",
    description: "Pack-fresh ungraded card with crisp corners and pristine surface",
    badgeBg: "rgba(34, 197, 94, 0.16)",
    badgeText: "#4ade80",
    baseMultiplier: 1.15,
    isSlab: false,
  },
  raw_nm: {
    id: "raw_nm",
    category: "ungraded",
    company: "RAW",
    gradeNum: 8.5,
    label: "Raw Near Mint (NM)",
    shortLabel: "NM (RAW)",
    description: "Near Mint with minimal surface or edge wear",
    badgeBg: "rgba(59, 130, 246, 0.14)",
    badgeText: "#60a5fa",
    baseMultiplier: 1.0,
    isSlab: false,
  },
  raw_lp: {
    id: "raw_lp",
    category: "ungraded",
    company: "RAW",
    gradeNum: 7.0,
    label: "Raw Lightly Played (LP / EX)",
    shortLabel: "LP (RAW)",
    description: "Light edge whitening or minor surface scratches",
    badgeBg: "rgba(234, 179, 8, 0.14)",
    badgeText: "#facc15",
    baseMultiplier: 0.82,
    isSlab: false,
  },
  raw_mp: {
    id: "raw_mp",
    category: "ungraded",
    company: "RAW",
    gradeNum: 5.5,
    label: "Raw Moderately Played (MP / Fine / VG)",
    shortLabel: "MP (RAW)",
    description: "Moderate edge wear, minor creasing, or binder rub",
    badgeBg: "rgba(249, 115, 22, 0.14)",
    badgeText: "#fb923c",
    baseMultiplier: 0.62,
    isSlab: false,
  },
  raw_hp: {
    id: "raw_hp",
    category: "ungraded",
    company: "RAW",
    gradeNum: 4.0,
    label: "Raw Heavily Played (HP / Good)",
    shortLabel: "HP (RAW)",
    description: "Heavy whitening, small creases, or extensive surface wear",
    badgeBg: "rgba(239, 68, 68, 0.14)",
    badgeText: "#f87171",
    baseMultiplier: 0.42,
    isSlab: false,
  },
  raw_dmg: {
    id: "raw_dmg",
    category: "ungraded",
    company: "RAW",
    gradeNum: 2.0,
    label: "Raw Damaged (DMG / Poor)",
    shortLabel: "DMG (RAW)",
    description: "Bends, structural creases, water damage, or tears",
    badgeBg: "rgba(185, 28, 28, 0.18)",
    badgeText: "#ef4444",
    baseMultiplier: 0.22,
    isSlab: false,
  },
  psa10: {
    id: "psa10",
    category: "graded",
    company: "PSA",
    gradeNum: 10,
    label: "PSA 10 (Gem Mint)",
    shortLabel: "PSA 10",
    description: "Gem Mint 10 - Virtually flawless centering, corners, edges, surface",
    badgeBg: "rgba(239, 68, 68, 0.18)",
    badgeText: "#f87171",
    baseMultiplier: 3.8,
    isSlab: true,
  },
  psa9: {
    id: "psa9",
    category: "graded",
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
    category: "graded",
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
    category: "graded",
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
    category: "graded",
    company: "BGS",
    gradeNum: 10,
    label: "BGS 10 Black Label (Pristine)",
    shortLabel: "BGS 10 BL",
    description: "Perfect 10 on Centering, Corners, Edges, and Surface",
    badgeBg: "rgba(0, 0, 0, 0.7)",
    badgeText: "#fbbf24",
    baseMultiplier: 8.5,
    isSlab: true,
  },
  bgs95: {
    id: "bgs95",
    category: "graded",
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
    category: "graded",
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
    category: "graded",
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
    category: "graded",
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
    category: "graded",
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

export const UNGRADED_QUALITIES: RawQuality[] = [
  "raw_mint",
  "raw_nm",
  "raw_lp",
  "raw_mp",
  "raw_hp",
  "raw_dmg",
];

export const GRADED_SLABS: SlabGrade[] = [
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

export const ALL_GRADES: CardGrade[] = [
  "raw",
  ...UNGRADED_QUALITIES,
  ...GRADED_SLABS,
];

export function getGradeMeta(grade: CardGrade): GradeMeta {
  return GRADE_DEFINITIONS[grade] ?? GRADE_DEFINITIONS.raw;
}

export type PrintVariantRow = {
  key: string;
  label: string;
  low?: number;
  mid?: number;
  market?: number;
  high?: number;
};

const PRINT_VARIANT_LABELS: Record<string, string> = {
  normal: "Normal / Unlimited (RAW)",
  holofoil: "Holofoil (RAW)",
  reverseHolofoil: "Reverse Holofoil (RAW)",
  reverseholofoil: "Reverse Holofoil (RAW)",
  "1stEdition": "1st Edition (RAW)",
  "1stEditionHolofoil": "1st Edition Holofoil (RAW)",
  "1stEditionNormal": "1st Edition Normal (RAW)",
  unlimited: "Unlimited (RAW)",
  unlimitedHolofoil: "Unlimited Holofoil (RAW)",
  shadowless: "Shadowless (RAW)",
};

function prettyPrintKey(key: string): string {
  return PRINT_VARIANT_LABELS[key] || `${key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()} (RAW)`;
}

/** TCGPlayer print variants (holo / reverse / 1st / unlimited / shadowless), with a RAW NM fallback. */
export function printVariantPriceRows(card: TCGCard): PrintVariantRow[] {
  const tp = card.tcgplayer?.prices || {};
  const rows: PrintVariantRow[] = [];
  for (const [key, p] of Object.entries(tp)) {
    if (!p || typeof p !== "object") continue;
    const market = Number(p.market) || 0;
    const low = Number(p.low) || 0;
    const mid = Number(p.mid) || 0;
    const high = Number(p.high) || 0;
    if (market <= 0 && low <= 0 && mid <= 0) continue;
    rows.push({
      key,
      label: prettyPrintKey(key),
      low: low > 0 ? low : undefined,
      mid: mid > 0 ? mid : undefined,
      market: market > 0 ? market : undefined,
      high: high > 0 ? high : undefined,
    });
  }
  if (!rows.length) {
    const market = getMarketPrice(card);
    if (market > 0) {
      const blob = `${card.set?.name || ""} ${card.rarity || ""} ${card.name || ""}`.toLowerCase();
      const label = /shadowless/.test(blob)
        ? "Shadowless (RAW NM)"
        : /\b1st|first edition/.test(blob)
          ? "1st Edition (RAW NM)"
          : /reverse/.test(blob)
            ? "Reverse Holofoil (RAW NM)"
            : /holo/.test(blob)
              ? "Holofoil (RAW NM)"
              : "NM (RAW)";
      rows.push({ key: "market", label, market });
    }
  }
  return rows;
}

export function rawConditionLadder(card: TCGCard): GradedValuation[] {
  return UNGRADED_QUALITIES.map((g) => calculateGradedValue(card, g));
}

export function gradedSlabLadder(card: TCGCard): GradedValuation[] {
  return GRADED_SLABS.map((g) => calculateGradedValue(card, g));
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
  const rawPrice = getMarketPrice(card);
  const meta = getGradeMeta(grade);

  if (!(rawPrice > 0)) {
    return {
      grade,
      meta,
      rawPrice: 0,
      estimatedGradedPrice: 0,
      multiplier: meta.baseMultiplier,
      gradingFee: 0,
      estimatedProfit: 0,
      estimatedRoiPct: 0,
      isSlab: meta.isSlab,
    };
  }

  if (!meta.isSlab) {
    // Ungraded condition calculation
    const condPrice = Math.round(rawPrice * meta.baseMultiplier * 100) / 100;
    return {
      grade,
      meta,
      rawPrice,
      estimatedGradedPrice: condPrice,
      multiplier: meta.baseMultiplier,
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

/**
 * AI Pre-Grade Inspector & Grade Probability Engine.
 * Analyzes an ungraded card and predicts the probability distribution of PSA 10, PSA 9, PSA 8,
 * along with expected financial upside (Expected Value - EV).
 */
export type PreGradeAnalysis = {
  quality: RawQuality;
  centeringScore: number; // 0-100
  cornersScore: number;   // 0-100
  edgesScore: number;     // 0-100
  surfaceScore: number;   // 0-100
  compositeScore: number; // 0-100
  predictedGrade: "PSA 10" | "PSA 9" | "PSA 8" | "PSA 7" | "Sub-7";
  probabilities: {
    psa10: number; // 0-100%
    psa9: number;  // 0-100%
    psa8: number;  // 0-100%
    sub8: number;  // 0-100%
  };
  rawPurchasePrice: number;
  gradingFee: number;
  expectedGrossValue: number;
  expectedNetGain: number;
  recommendedAction: "SUBMIT FOR GRADING" | "KEEP RAW / BINDER" | "SELL AS RAW SINGLE";
};

export function predetermineCardGrade(
  card: TCGCard,
  quality: RawQuality = "raw_mint",
  customOverrides?: { centering?: number; corners?: number; edges?: number; surface?: number }
): PreGradeAnalysis {
  const rawPrice = getMarketPrice(card);
  const psa10Value = calculateGradedValue(card, "psa10").estimatedGradedPrice;
  const psa9Value = calculateGradedValue(card, "psa9").estimatedGradedPrice;
  const psa8Value = calculateGradedValue(card, "psa8").estimatedGradedPrice;
  const sub8Value = rawPrice * 0.7;

  let baseCentering = 95;
  let baseCorners = 95;
  let baseEdges = 95;
  let baseSurface = 95;

  switch (quality) {
    case "raw_mint":
      baseCentering = 96; baseCorners = 98; baseEdges = 97; baseSurface = 98;
      break;
    case "raw_nm":
      baseCentering = 90; baseCorners = 92; baseEdges = 91; baseSurface = 92;
      break;
    case "raw_lp":
      baseCentering = 82; baseCorners = 80; baseEdges = 78; baseSurface = 84;
      break;
    case "raw_mp":
      baseCentering = 70; baseCorners = 65; baseEdges = 60; baseSurface = 68;
      break;
    case "raw_hp":
      baseCentering = 55; baseCorners = 45; baseEdges = 40; baseSurface = 50;
      break;
    case "raw_dmg":
      baseCentering = 35; baseCorners = 25; baseEdges = 20; baseSurface = 25;
      break;
  }

  const centering = customOverrides?.centering ?? baseCentering;
  const corners = customOverrides?.corners ?? baseCorners;
  const edges = customOverrides?.edges ?? baseEdges;
  const surface = customOverrides?.surface ?? baseSurface;

  const composite = Math.round((centering * 0.25) + (corners * 0.25) + (edges * 0.25) + (surface * 0.25));

  let prob10 = 0;
  let prob9 = 0;
  let prob8 = 0;
  let probSub8 = 0;

  if (composite >= 96) {
    prob10 = 78;
    prob9 = 19;
    prob8 = 3;
    probSub8 = 0;
  } else if (composite >= 91) {
    prob10 = 42;
    prob9 = 48;
    prob8 = 8;
    probSub8 = 2;
  } else if (composite >= 80) {
    prob10 = 8;
    prob9 = 38;
    prob8 = 46;
    probSub8 = 8;
  } else if (composite >= 65) {
    prob10 = 0;
    prob9 = 8;
    prob8 = 32;
    probSub8 = 60;
  } else {
    prob10 = 0;
    prob9 = 0;
    prob8 = 5;
    probSub8 = 95;
  }

  let predictedGrade: "PSA 10" | "PSA 9" | "PSA 8" | "PSA 7" | "Sub-7" = "Sub-7";
  if (prob10 >= 50) predictedGrade = "PSA 10";
  else if (prob9 >= 40) predictedGrade = "PSA 9";
  else if (prob8 >= 40) predictedGrade = "PSA 8";
  else if (composite >= 70) predictedGrade = "PSA 7";

  const expectedGross = (
    (prob10 / 100) * psa10Value +
    (prob9 / 100) * psa9Value +
    (prob8 / 100) * psa8Value +
    (probSub8 / 100) * sub8Value
  );

  const rawCostBasis = rawPrice + GRADING_FEE_ESTIMATE;
  const expectedNet = Math.round((expectedGross - rawCostBasis) * 100) / 100;

  let recommendedAction: "SUBMIT FOR GRADING" | "KEEP RAW / BINDER" | "SELL AS RAW SINGLE" = "KEEP RAW / BINDER";
  if (expectedNet >= 25.0 && (prob10 + prob9) >= 65) {
    recommendedAction = "SUBMIT FOR GRADING";
  } else if (expectedNet < 0) {
    recommendedAction = "SELL AS RAW SINGLE";
  }

  return {
    quality,
    centeringScore: centering,
    cornersScore: corners,
    edgesScore: edges,
    surfaceScore: surface,
    compositeScore: composite,
    predictedGrade,
    probabilities: {
      psa10: prob10,
      psa9: prob9,
      psa8: prob8,
      sub8: probSub8,
    },
    rawPurchasePrice: rawPrice,
    gradingFee: GRADING_FEE_ESTIMATE,
    expectedGrossValue: Math.round(expectedGross * 100) / 100,
    expectedNetGain: expectedNet,
    recommendedAction,
  };
}

export function getSlabSearchUrls(card: TCGCard, grade: CardGrade) {
  const meta = getGradeMeta(grade);
  const baseQuery = `${card.name} ${card.set?.name || ""} ${card.number || ""}`.trim();
  const slabQuery = !meta.isSlab ? `${baseQuery} ${meta.shortLabel}` : `${baseQuery} ${meta.shortLabel}`;

  const enc = encodeURIComponent;
  return {
    ebayActive: `https://www.ebay.com/sch/i.html?_nkw=${enc(slabQuery + " pokemon")}&_sacat=183454&LH_BIN=1&_sop=15`,
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${enc(slabQuery + " pokemon")}&_sacat=183454&LH_Complete=1&LH_Sold=1&_sop=13`,
    priceCharting: `https://www.pricecharting.com/search-products?q=${enc(baseQuery)}&type=prices`,
  };
}

export function getEstimatedGradePrice(card: TCGCard, grade: CardGrade = "raw"): number {
  return calculateGradedValue(card, grade).estimatedGradedPrice;
}
