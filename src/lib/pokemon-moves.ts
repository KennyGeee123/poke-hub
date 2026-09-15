// Comprehensive Move & Egg/Breedable Move Repertoire Engine for PokeVault
import type { TCGCard } from "./pokemon-api";

export type MoveCategory = "egg" | "level_up" | "tm" | "signature";

export type PokemonMove = {
  id: string;
  name: string;
  category: MoveCategory;
  categoryLabel: string;
  type: string; // Fire, Water, Electric, Grass, Dragon, Normal, etc.
  power: number;
  energyCost: string[];
  description: string;
  isBreedable: boolean;
};

// Repertoire of classic & competitive breedable egg moves, signature attacks, and TM moves
const UNIVERSAL_EGG_MOVES: PokemonMove[] = [
  { id: "egg-dd", name: "Dragon Dance", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Dragon", power: 0, energyCost: ["Colorless"], description: "Raises Attack & Speed by 1 stage through primal rhythm.", isBreedable: true },
  { id: "egg-outrage", name: "Outrage", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Dragon", power: 120, energyCost: ["Dragon", "Colorless"], description: "Rampages for 2-3 turns with overwhelming dragon fury.", isBreedable: true },
  { id: "egg-bd", name: "Belly Drum", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Normal", power: 0, energyCost: ["Colorless", "Colorless"], description: "Maximizes Attack stat instantly at the cost of 50% HP.", isBreedable: true },
  { id: "egg-ap", name: "Ancient Power", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Rock", power: 70, energyCost: ["Colorless", "Colorless"], description: "Attacks with prehistoric power. 10% chance to boost all stats.", isBreedable: true },
  { id: "egg-crunch", name: "Crunch", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Dark", power: 80, energyCost: ["Dark", "Colorless"], description: "Crushes the target with sharp fangs. May lower Special Defense.", isBreedable: true },
  { id: "egg-fb", name: "Flare Blitz", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Fire", power: 130, energyCost: ["Fire", "Fire", "Colorless"], description: "Cloaks the user in fierce flame and charges with immense recoil.", isBreedable: true },
  { id: "egg-aj", name: "Aqua Jet", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Water", power: 60, energyCost: ["Water"], description: "High-speed water strike that always strikes with priority +1.", isBreedable: true },
  { id: "egg-vt", name: "Volt Tackle", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Electric", power: 130, energyCost: ["Electric", "Electric", "Colorless"], description: "Electrified tackle of legendary voltage. Inflicts recoil.", isBreedable: true },
  { id: "egg-cc", name: "Close Combat", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Fighting", power: 120, energyCost: ["Fighting", "Colorless"], description: "Unleashes rapid flurry attacks, slightly lowering defenses.", isBreedable: true },
  { id: "egg-np", name: "Nasty Plot", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Dark", power: 0, energyCost: ["Dark"], description: "Concocts malicious schemes to sharply raise Special Attack.", isBreedable: true },
  { id: "egg-counter", name: "Counter", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Fighting", power: 100, energyCost: ["Fighting", "Colorless"], description: "Retaliates with double the damage taken from physical blows.", isBreedable: true },
  { id: "egg-es", name: "Extreme Speed", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Normal", power: 80, energyCost: ["Colorless", "Colorless"], description: "Blinding instantaneous tackle with priority +2.", isBreedable: true },
  { id: "egg-mc", name: "Metal Claw", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Metal", power: 70, energyCost: ["Metal"], description: "Rakes the foe with hard steel claws. May raise Attack.", isBreedable: true },
  { id: "egg-seed", name: "Leech Seed", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Grass", power: 40, energyCost: ["Grass"], description: "Plants draining seeds that steal HP each turn.", isBreedable: true },
  { id: "egg-baton", name: "Baton Pass", category: "egg", categoryLabel: "Egg / Breedable 🥚", type: "Normal", power: 0, energyCost: ["Colorless"], description: "Switches out while passing all stat boosts to the next Pokémon.", isBreedable: true },
];

const STANDARD_MOVES: PokemonMove[] = [
  { id: "std-ft", name: "Flamethrower", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Fire", power: 90, energyCost: ["Fire", "Colorless"], description: "Intense blast of fire. 10% burn chance.", isBreedable: false },
  { id: "std-fb", name: "Fire Blast", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Fire", power: 120, energyCost: ["Fire", "Fire", "Colorless"], description: "Incinerates with a star-shaped inferno.", isBreedable: false },
  { id: "std-hp", name: "Hydro Pump", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Water", power: 110, energyCost: ["Water", "Water", "Colorless"], description: "Blasts a colossal volume of pressurized water.", isBreedable: false },
  { id: "std-tb", name: "Thunderbolt", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Electric", power: 90, energyCost: ["Electric", "Colorless"], description: "Strong bolt of lightning. 10% paralysis chance.", isBreedable: false },
  { id: "std-sol", name: "Solar Beam", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Grass", power: 120, energyCost: ["Grass", "Grass", "Colorless"], description: "Gathers intense solar energy and discharges in 1 devastating blast.", isBreedable: false },
  { id: "std-eq", name: "Earthquake", category: "tm", categoryLabel: "Technical Machine 💿", type: "Fighting", power: 100, energyCost: ["Fighting", "Colorless"], description: "Shakes the tectonic plates, hitting all foes.", isBreedable: false },
  { id: "std-ib", name: "Ice Beam", category: "tm", categoryLabel: "Technical Machine 💿", type: "Water", power: 90, energyCost: ["Water", "Colorless"], description: "Freezing sub-zero beam. 10% freeze chance.", isBreedable: false },
  { id: "std-psy", name: "Psychic", category: "level_up", categoryLabel: "Level-Up ⚡", type: "Psychic", power: 90, energyCost: ["Psychic", "Colorless"], description: "Telekinetic blast that may lower target Special Defense.", isBreedable: false },
  { id: "std-sb", name: "Shadow Ball", category: "tm", categoryLabel: "Technical Machine 💿", type: "Psychic", power: 80, energyCost: ["Psychic", "Colorless"], description: "Hurls a shadowy blob that weakens special defense.", isBreedable: false },
  { id: "std-hb", name: "Hyper Beam", category: "tm", categoryLabel: "Technical Machine 💿", type: "Normal", power: 150, energyCost: ["Colorless", "Colorless", "Colorless", "Colorless"], description: "Extreme destructive laser beam. Highest raw kinetic damage.", isBreedable: false },
];

export function getFullMoveRepertoireForCard(card: TCGCard): PokemonMove[] {
  const customMoves: PokemonMove[] = [];

  // 1. Include card's printed native attacks as Signature moves
  if (card.attacks && card.attacks.length > 0) {
    card.attacks.forEach((atk, idx) => {
      const dmg = parseInt((atk.damage || "").replace(/[^0-9]/g, ""), 10) || 50;
      customMoves.push({
        id: `native-atk-${idx}`,
        name: atk.name,
        category: "signature",
        categoryLabel: "Card Signature 🏆",
        type: card.types?.[0] || "Colorless",
        power: dmg,
        energyCost: atk.cost || ["Colorless"],
        description: atk.text || "Official printed Pokémon TCG attack.",
        isBreedable: false,
      });
    });
  }

  // 2. Combine with all breedable egg moves and standard TM moves
  return [...customMoves, ...UNIVERSAL_EGG_MOVES, ...STANDARD_MOVES];
}

const CUSTOM_MOVESET_STORAGE_KEY = "pv_custom_movesets_v1";

const memCache = new Map<string, PokemonMove[]>();

export function getCustomMoveSet(cardId: string, card: TCGCard): PokemonMove[] {
  if (memCache.has(cardId)) {
    return memCache.get(cardId)!;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(`${CUSTOM_MOVESET_STORAGE_KEY}:${cardId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {}
  }
  
  const rep = getFullMoveRepertoireForCard(card);
  const defaults: PokemonMove[] = [];
  
  if (rep[0]) defaults.push(rep[0]);
  if (rep[1]) defaults.push(rep[1]);

  const eggMoves = rep.filter(m => m.isBreedable);
  if (defaults.length < 3 && eggMoves[0]) defaults.push(eggMoves[0]);
  if (defaults.length < 4 && eggMoves[1]) defaults.push(eggMoves[1]);

  while (defaults.length < 4) {
    const next = rep.find(m => !defaults.some(d => d.id === m.id));
    if (next) defaults.push(next);
    else break;
  }

  return defaults;
}

export function saveCustomMoveSet(cardId: string, moves: PokemonMove[]): void {
  memCache.set(cardId, moves.slice(0, 4));
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`${CUSTOM_MOVESET_STORAGE_KEY}:${cardId}`, JSON.stringify(moves.slice(0, 4)));
    } catch (err) {
      console.error("Failed to save custom moveset", err);
    }
  }
}
