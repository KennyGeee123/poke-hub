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
  auraEffect: "none" | "green_sparkle" | "blue_radiance" | "purple_quantum" | "golden_legendary" | "cosmic_black";
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

  // 2. Condition-to-Level & Stat Boost Curves (Capped at 50% max)
  let level = 70;
  let conditionBoost = 0.25; // 25% baseline for standard NM

  switch (grade) {
    case "raw_dmg":
      level = 10;
      conditionBoost = 0.00; // 0%
      break;
    case "raw_hp":
      level = 25;
      conditionBoost = 0.05; // +5%
      break;
    case "raw_mp":
      level = 40;
      conditionBoost = 0.12; // +12%
      break;
    case "raw_lp":
      level = 55;
      conditionBoost = 0.22; // +22%
      break;
    case "raw":
    case "raw_nm":
      level = 70;
      conditionBoost = 0.35; // +35%
      break;
    case "raw_mint":
      level = 85;
      conditionBoost = 0.50; // +50% max raw boost
      break;
    
    // Graded Slabs: receive Natural +20% Slab Synergy Boost
    case "psa7":
      level = 75;
      conditionBoost = 0.15; // 15% grade + 20% slab = 35%
      break;
    case "psa8":
      level = 80;
      conditionBoost = 0.20; // 20% grade + 20% slab = 40%
      break;
    case "psa9":
    case "cgc9":
    case "cgc95":
    case "bgs95":
      level = 90;
      conditionBoost = 0.25; // 25% grade + 20% slab = 45%
      break;
    case "sgc10":
    case "cgc10_pristine":
    case "psa10":
      level = 100;
      conditionBoost = 0.30; // 30% grade + 20% slab = 50% (capped)
      break;
    case "bgs10_black":
      level = 100;
      conditionBoost = 0.30; // +50% max capped boost
      break;
    default:
      level = 70;
      conditionBoost = 0.30;
      break;
  }

  const isSlab = meta.isSlab;
  const slabBoost = isSlab ? 0.20 : 0.00; // Natural +20% Graded Slab Synergy
  const totalBoost = Math.min(0.50, conditionBoost + slabBoost); // Max cap 50%

  // 3. Compute boosted battle attributes
  const boostedHp = Math.round(baseHp * (1 + totalBoost));
  const boostedAtk = Math.round(baseAtk * (1 + totalBoost));
  const boostedDef = Math.round(baseDef * (1 + totalBoost));
  const boostedSpd = Math.round(baseSpd * (1 + totalBoost * 0.8));
  const boostedCritRate = Math.min(50, Math.round(baseCrit + totalBoost * 40));

  const totalCombatPower = Math.round(
    boostedHp * 1.5 + boostedAtk * 2.2 + boostedDef * 1.2 + boostedSpd * 1.0 + boostedCritRate * 5
  );

  // 4. Aura & Tier Badges
  let tierBadge = "STANDARD";
  let tierColor = "#94a3b8";
  let auraEffect: PokemonStats["auraEffect"] = "none";

  if (level === 100 && grade === "bgs10_black") {
    tierBadge = "BLACK LABEL GOD TIER";
    tierColor = "#f59e0b";
    auraEffect = "cosmic_black";
  } else if (level === 100) {
    tierBadge = "GEM MINT CHAMPION";
    tierColor = "#38bdf8";
    auraEffect = "golden_legendary";
  } else if (level >= 90) {
    tierBadge = "QUANTUM MINT ELITE";
    tierColor = "#c084fc";
    auraEffect = "purple_quantum";
  } else if (level >= 80) {
    tierBadge = "NEAR MINT VANGUARD";
    tierColor = "#60a5fa";
    auraEffect = "blue_radiance";
  } else if (level >= 50) {
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
