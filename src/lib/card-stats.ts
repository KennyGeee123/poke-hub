// RPG Battle Level & Stat Boost Engine for PokeVault TCG & In-Game Pokémon
import type { TCGCard } from "./pokemon-api";
import { type CardGrade, GRADE_DEFINITIONS } from "./card-grades";

export type PokemonStats = {
  level: number;
  baseHp: number;
  boostedHp: number;
  baseAtk: number;
  boostedAtk: number;
  baseDef: number;
  boostedDef: number;
  baseSpd: number;
  boostedSpd: number;
  critRate: number; // percentage e.g. 15%
  boostedCritRate: number;
  totalCombatPower: number;
  conditionBoostPercent: number; // up to 50%
  hasNaturalSlabBoost: boolean; // +20% natural slab synergy
  slabBoostPercent: number;
  totalBoostPercent: number; // combined boost
  tierBadge: string;
  tierColor: string;
  auraEffect:
    | "none"
    | "green_sparkle"
    | "blue_radiance"
    | "purple_quantum"
    | "golden_legendary"
    | "cosmic_black";
};

export function getCardLevelAndStats(card: TCGCard, grade: CardGrade = "raw"): PokemonStats {
  const meta = GRADE_DEFINITIONS[grade] || GRADE_DEFINITIONS.raw;

  // 1. Calculate Base HP & Primary Attack Power from card data
  const rawHp = parseInt(card.hp || "70", 10);
  const baseHp = isNaN(rawHp) || rawHp <= 0 ? 70 : rawHp;

  let maxAttackDmg = 40;
  if (card.attacks && card.attacks.length > 0) {
    for (const atk of card.attacks) {
      const dmgNum = parseInt((atk.damage || "").replace(/[^0-9]/g, ""), 10);
      if (!isNaN(dmgNum) && dmgNum > maxAttackDmg) {
        maxAttackDmg = dmgNum;
      }
    }
  }
  const baseAtk = maxAttackDmg;
  const baseDef = Math.round(baseHp * 0.75);
  const baseSpd = Math.round(50 + ((card.retreatCost?.length ?? 1) <= 1 ? 40 : 15));
  const baseCrit = 10; // 10% baseline

  // 2. Condition-to-Level & Stat Boost Curves (Capped at Level 50 / 50% max)
  // Rule: Standard 10 -> Level 40 (+40%). Pristine 10 -> Level 50 (+50%).
  let level = 25;
  let conditionBoost = 0.25;

  switch (grade) {
    case "raw_dmg":
      level = 5;
      conditionBoost = 0.0; // 0%
      break;
    case "raw_hp":
      level = 10;
      conditionBoost = 0.1; // +10%
      break;
    case "raw_mp":
      level = 15;
      conditionBoost = 0.15; // +15%
      break;
    case "raw_lp":
      level = 20;
      conditionBoost = 0.2; // +20%
      break;
    case "raw":
    case "raw_nm":
      level = 25;
      conditionBoost = 0.25; // +25%
      break;
    case "raw_mint":
      level = 30;
      conditionBoost = 0.3; // +30%
      break;

    // Graded Slabs
    case "psa7":
      level = 28;
      conditionBoost = 0.08; // 8% + 20% slab = 28%
      break;
    case "psa8":
      level = 32;
      conditionBoost = 0.12; // 12% + 20% slab = 32%
      break;
    case "psa9":
    case "cgc9":
    case "cgc95":
    case "bgs95":
      level = 35;
      conditionBoost = 0.15; // 15% + 20% slab = 35%
      break;
    case "sgc10":
    case "psa10":
      // Standard 10: Level 40 (+40% stat boost)
      level = 40;
      conditionBoost = 0.2; // 20% grade + 20% slab = 40%
      break;
    case "cgc10_pristine":
    case "bgs10_black":
      // Pristine / Black Label 10: Level 50 (+50% stat boost)
      level = 50;
      conditionBoost = 0.3; // 30% grade + 20% slab = 50%
      break;
    default:
      level = 25;
      conditionBoost = 0.25;
      break;
  }

  const isSlab = meta.isSlab;
  const slabBoost = isSlab ? 0.2 : 0.0; // Natural +20% Graded Slab Synergy
  const totalBoost = Math.min(0.5, conditionBoost + slabBoost); // Max cap 50%

  // 3. Compute boosted battle attributes
  const boostedHp = Math.round(baseHp * (1 + totalBoost));
  const boostedAtk = Math.round(baseAtk * (1 + totalBoost));
  const boostedDef = Math.round(baseDef * (1 + totalBoost));
  const boostedSpd = Math.round(baseSpd * (1 + totalBoost * 0.8));
  const boostedCritRate = Math.min(50, Math.round(baseCrit + totalBoost * 40));

  const totalCombatPower = Math.round(
    boostedHp * 1.5 + boostedAtk * 2.2 + boostedDef * 1.2 + boostedSpd * 1.0 + boostedCritRate * 5,
  );

  // 4. Aura & Tier Badges
  let tierBadge = "STANDARD";
  let tierColor = "#94a3b8";
  let auraEffect: PokemonStats["auraEffect"] = "none";

  if (level === 50 && (grade === "bgs10_black" || grade === "cgc10_pristine")) {
    tierBadge = "PRISTINE GOD TIER";
    tierColor = "#f59e0b";
    auraEffect = "cosmic_black";
  } else if (level === 40) {
    tierBadge = "GEM MINT 10 CHAMPION";
    tierColor = "#38bdf8";
    auraEffect = "golden_legendary";
  } else if (level >= 35) {
    tierBadge = "MINT 9 VANGUARD";
    tierColor = "#c084fc";
    auraEffect = "purple_quantum";
  } else if (level >= 25) {
    tierBadge = "NEAR MINT FIGHTER";
    tierColor = "#60a5fa";
    auraEffect = "blue_radiance";
  } else {
    tierBadge = "BATTLE READY";
    tierColor = "#4ade80";
    auraEffect = "green_sparkle";
  }

  return {
    level,
    baseHp,
    boostedHp,
    baseAtk,
    boostedAtk,
    baseDef,
    boostedDef,
    baseSpd,
    boostedSpd,
    critRate: baseCrit,
    boostedCritRate,
    totalCombatPower,
    conditionBoostPercent: Math.round(conditionBoost * 100),
    hasNaturalSlabBoost: isSlab,
    slabBoostPercent: Math.round(slabBoost * 100),
    totalBoostPercent: Math.round(totalBoost * 100),
    tierBadge,
    tierColor,
    auraEffect,
  };
}
