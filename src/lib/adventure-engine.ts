import {
  ALL_POKEMON,
  getPokemonByGen,
  getPokemonByName,
  getRandomPokemon,
  type NationalDexPokemon,
} from "./all-pokemon-data";
/**
 * PokéVault Pro — Adventure Living World Engine
 * 
 * Manages the full location-based exploration ecosystem:
 * - 3-Tier Economy: Coins 🪙, Energy ⚡, and XP / Levels 📈
 * - 10 Canonical Evolution Stones + Universal Rare Candy System
 * - Buddy Companion System (Mood, Friendship Tiers, Walking Candies)
 * - Dynamic World Spawns (Wild Creatures, Discovery Points, Card Caches, Battle Arenas)
 * - Quests, Daily Adventure Chest & 7-Day Streaks
 * - Full cross-runtime persistence (localStorage + memory cache)
 */

export type TimeOfDay = "day" | "sunset" | "night";
export type WeatherType = "clear" | "rain" | "snow" | "wind" | "storm" | "cloudy";
export type CreatureRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type BuddyFriendshipTier = "new" | "friendly" | "companion" | "adventurer" | "best_buddy";
export type BuddyMood = "excited" | "happy" | "content" | "tired";

export type EvolutionStoneId =
  | "fire_stone"
  | "water_stone"
  | "thunder_stone"
  | "leaf_stone"
  | "moon_stone"
  | "sun_stone"
  | "shiny_stone"
  | "dusk_stone"
  | "dawn_stone"
  | "ice_stone";

export interface EvolutionStoneDef {
  id: EvolutionStoneId;
  name: string;
  emoji: string;
  element: string;
  description: string;
  priceCoins: number;
  sellCoins: number;
  eligibleSpecies: {
    from: string;
    to: string;
    candiesRequired: number;
    specialCondition?: string;
  }[];
}

export const EVOLUTION_STONES: Record<EvolutionStoneId, EvolutionStoneDef> = {
  fire_stone: {
    id: "fire_stone",
    name: "Fire Stone",
    emoji: "🔥",
    element: "Fire",
    description: "A peculiar stone that radiates intense volcanic heat. Induces evolution in specific species.",
    priceCoins: 150,
    sellCoins: 50,
    eligibleSpecies: [
      { from: "Eevee", to: "Flareon", candiesRequired: 25 },
      { from: "Vulpix", to: "Ninetales", candiesRequired: 50 },
      { from: "Growlithe", to: "Arcanine", candiesRequired: 50 },
      { from: "Pansear", to: "Simisear", candiesRequired: 50 },
    ],
  },
  water_stone: {
    id: "water_stone",
    name: "Water Stone",
    emoji: "💧",
    element: "Water",
    description: "A crystal-clear sapphire blue stone that triggers evolution in water-attuned creatures.",
    priceCoins: 150,
    sellCoins: 50,
    eligibleSpecies: [
      { from: "Eevee", to: "Vaporeon", candiesRequired: 25 },
      { from: "Poliwhirl", to: "Poliwrath", candiesRequired: 100 },
      { from: "Shellder", to: "Cloyster", candiesRequired: 50 },
      { from: "Staryu", to: "Starmie", candiesRequired: 50 },
      { from: "Lombre", to: "Ludicolo", candiesRequired: 100 },
      { from: "Panpour", to: "Simipour", candiesRequired: 50 },
    ],
  },
  thunder_stone: {
    id: "thunder_stone",
    name: "Thunder Stone",
    emoji: "⚡",
    element: "Electric",
    description: "Crackles with ambient static electricity. Ignites high-voltage evolutions.",
    priceCoins: 150,
    sellCoins: 50,
    eligibleSpecies: [
      { from: "Pikachu", to: "Raichu", candiesRequired: 50 },
      { from: "Eevee", to: "Jolteon", candiesRequired: 25 },
      { from: "Magneton", to: "Magnezone", candiesRequired: 100 },
      { from: "Eelektrik", to: "Eelektross", candiesRequired: 100 },
    ],
  },
  leaf_stone: {
    id: "leaf_stone",
    name: "Leaf Stone",
    emoji: "🌿",
    element: "Grass",
    description: "Embedded with an ancient fossilized leaf. Resonates deeply with botanical species.",
    priceCoins: 150,
    sellCoins: 50,
    eligibleSpecies: [
      { from: "Gloom", to: "Vileplume", candiesRequired: 100 },
      { from: "Weepinbell", to: "Victreebel", candiesRequired: 100 },
      { from: "Exeggcute", to: "Exeggutor", candiesRequired: 50 },
      { from: "Nuzleaf", to: "Shiftry", candiesRequired: 100 },
      { from: "Pansage", to: "Simisage", candiesRequired: 50 },
    ],
  },
  moon_stone: {
    id: "moon_stone",
    name: "Moon Stone",
    emoji: "🌙",
    element: "Cosmic",
    description: "A dark gray meteorite shard that glimmers with the luminescence of the night sky.",
    priceCoins: 200,
    sellCoins: 75,
    eligibleSpecies: [
      { from: "Nidorina", to: "Nidoqueen", candiesRequired: 100 },
      { from: "Nidorino", to: "Nidoking", candiesRequired: 100 },
      { from: "Clefairy", to: "Clefable", candiesRequired: 50 },
      { from: "Jigglypuff", to: "Wigglytuff", candiesRequired: 50 },
      { from: "Skitty", to: "Delcatty", candiesRequired: 50 },
      { from: "Munna", to: "Musharna", candiesRequired: 50 },
    ],
  },
  sun_stone: {
    id: "sun_stone",
    name: "Sun Stone",
    emoji: "☀️",
    element: "Solar",
    description: "Burns as red as an evening sunset. Powers solar photosynthetic transformations.",
    priceCoins: 200,
    sellCoins: 75,
    eligibleSpecies: [
      { from: "Gloom", to: "Bellossom", candiesRequired: 100 },
      { from: "Sunkern", to: "Sunflora", candiesRequired: 50 },
      { from: "Cottonee", to: "Whimsicott", candiesRequired: 50 },
      { from: "Petilil", to: "Lilligant", candiesRequired: 50 },
      { from: "Helioptile", to: "Heliolisk", candiesRequired: 50 },
    ],
  },
  shiny_stone: {
    id: "shiny_stone",
    name: "Shiny Stone",
    emoji: "✨",
    element: "Light",
    description: "Dazzles with pure, unfiltered light. Awakes radiant and airborne evolutions.",
    priceCoins: 250,
    sellCoins: 85,
    eligibleSpecies: [
      { from: "Togetic", to: "Togekiss", candiesRequired: 100 },
      { from: "Roselia", to: "Roserade", candiesRequired: 100 },
      { from: "Minccino", to: "Cinccino", candiesRequired: 50 },
      { from: "Floette", to: "Florges", candiesRequired: 100 },
    ],
  },
  dusk_stone: {
    id: "dusk_stone",
    name: "Dusk Stone",
    emoji: "🌑",
    element: "Shadow",
    description: "Absorbs all incoming light like midnight. Unleashes potent ghost and dark evolutions.",
    priceCoins: 250,
    sellCoins: 85,
    eligibleSpecies: [
      { from: "Murkrow", to: "Honchkrow", candiesRequired: 100 },
      { from: "Misdreavus", to: "Mismagius", candiesRequired: 100 },
      { from: "Lampent", to: "Chandelure", candiesRequired: 100 },
      { from: "Doublade", to: "Aegislash", candiesRequired: 100 },
    ],
  },
  dawn_stone: {
    id: "dawn_stone",
    name: "Dawn Stone",
    emoji: "🌅",
    element: "Aura",
    description: "Sparkles like iridescent morning dew. Awakens latent spiritual power in specific lines.",
    priceCoins: 250,
    sellCoins: 85,
    eligibleSpecies: [
      { from: "Kirlia", to: "Gallade", candiesRequired: 100, specialCondition: "Male" },
      { from: "Snorunt", to: "Froslass", candiesRequired: 100, specialCondition: "Female" },
    ],
  },
  ice_stone: {
    id: "ice_stone",
    name: "Ice Stone",
    emoji: "❄️",
    element: "Ice",
    description: "Permanently frosted crystal that never melts. Triggers sub-zero glacial evolutions.",
    priceCoins: 200,
    sellCoins: 75,
    eligibleSpecies: [
      { from: "Eevee", to: "Glaceon", candiesRequired: 25 },
      { from: "Alolan Vulpix", to: "Alolan Ninetales", candiesRequired: 50 },
      { from: "Alolan Sandshrew", to: "Alolan Sandslash", candiesRequired: 50 },
      { from: "Galarian Darumaka", to: "Galarian Darmanitan", candiesRequired: 50 },
    ],
  },
};

export type CaptureItemId =
  | "poke_ball"
  | "great_ball"
  | "ultra_ball"
  | "master_ball"
  | "razz_berry"
  | "nanab_berry"
  | "pinap_berry"
  | "golden_razz";

export interface CaptureItemDef {
  id: CaptureItemId;
  name: string;
  category: "ball" | "berry";
  multiplier: number;
  description: string;
  priceCoins: number;
}

export const CAPTURE_ITEMS: Record<CaptureItemId, CaptureItemDef> = {
  poke_ball: {
    id: "poke_ball",
    name: "Poké Ball",
    category: "ball",
    multiplier: 1.0,
    description: "Standard capsule for wild creature capture.",
    priceCoins: 10,
  },
  great_ball: {
    id: "great_ball",
    name: "Great Ball",
    category: "ball",
    multiplier: 1.5,
    description: "High-performance ball with a 50% higher capture rate.",
    priceCoins: 30,
  },
  ultra_ball: {
    id: "ultra_ball",
    name: "Ultra Ball",
    category: "ball",
    multiplier: 2.0,
    description: "Ultra-grade capsule with double standard capture power.",
    priceCoins: 80,
  },
  master_ball: {
    id: "master_ball",
    name: "Master Ball",
    category: "ball",
    multiplier: 100.0,
    description: "The pinnacle of capture tech. Never fails to catch any target.",
    priceCoins: 1000,
  },
  razz_berry: {
    id: "razz_berry",
    name: "Razz Berry",
    category: "berry",
    multiplier: 1.5,
    description: "Feed to a wild creature to make it 50% easier to catch.",
    priceCoins: 25,
  },
  nanab_berry: {
    id: "nanab_berry",
    name: "Nanab Berry",
    category: "berry",
    multiplier: 1.2,
    description: "Calms creatures and reduces movement.",
    priceCoins: 20,
  },
  pinap_berry: {
    id: "pinap_berry",
    name: "Pinap Berry",
    category: "berry",
    multiplier: 1.0,
    description: "Doubles the amount of candy rewarded upon successful catch.",
    priceCoins: 40,
  },
  golden_razz: {
    id: "golden_razz",
    name: "Golden Razz Berry",
    category: "berry",
    multiplier: 2.5,
    description: "Legendary treat that drastically increases catch rate.",
    priceCoins: 150,
  },
};

export type BoostItemId = "incense" | "lucky_egg" | "coin_booster" | "encounter_radar";

export interface BoostItemDef {
  id: BoostItemId;
  name: string;
  durationMinutes: number;
  description: string;
  priceCoins: number;
}

export const BOOST_ITEMS: Record<BoostItemId, BoostItemDef> = {
  incense: {
    id: "incense",
    name: "Adventure Incense",
    durationMinutes: 15,
    description: "A mysterious aromatic fragrance that summons 5 rare wild creatures near you.",
    priceCoins: 80,
  },
  lucky_egg: {
    id: "lucky_egg",
    name: "Lucky Egg",
    durationMinutes: 30,
    description: "Doubles all XP earned from catches, discoveries, evolutions, and quests.",
    priceCoins: 120,
  },
  coin_booster: {
    id: "coin_booster",
    name: "Golden Dowsing Rod",
    durationMinutes: 30,
    description: "Doubles Coins collected from Discovery Points and walking milestones.",
    priceCoins: 100,
  },
  encounter_radar: {
    id: "encounter_radar",
    name: "Quantum Scanner Radar",
    durationMinutes: 60,
    description: "Expands discovery scan radius and pinpoints Mythic/Card Cache spawns.",
    priceCoins: 150,
  },
};

export interface AdventureInventory {
  coins: number;
  energy: number;
  maxEnergy: number;
  rareCandy: number;
  speciesCandies: Record<string, number>;
  stones: Record<EvolutionStoneId, number>;
  captureItems: Record<CaptureItemId, number>;
  boosts: Record<BoostItemId, number>;
  cardCachesDiscovered: number;
}

export interface BuddyCompanion {
  species: string;
  nickname: string;
  friendshipTier: BuddyFriendshipTier;
  mood: BuddyMood;
  totalKmWalked: number;
  candiesFound: number;
  giftsDelivered: number;
  heartsToday: number;
  maxHeartsToday: number;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatarSeed: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalDistanceKm: number;
  creaturesDiscovered: number;
  creaturesCaught: number;
  evolutionsCompleted: number;
  questsCompleted: number;
  discoveryPointsSpun: number;
  streakDays: number;
  lastDailyClaimTimestamp: number;
}


export type PokemonEraId =
  | "vintage_kanto"
  | "neo_johto"
  | "advanced_hoenn"
  | "diamond_sinnoh"
  | "black_unova"
  | "mega_kalos"
  | "sun_alola"
  | "sword_galar"
  | "modern_paldea";

export interface PokemonEraSpecies {
  species: string;
  types: string[];
  rarity: CreatureRarity;
  baseCatchRate: number;
  baseCp: number;
}

export interface PokemonEra {
  id: PokemonEraId;
  name: string;
  shortName: string;
  gen: number;
  years: string;
  badge: string;
  themeColor: string;
  bgGradient: string;
  description: string;
  speciesPool: PokemonEraSpecies[];
  legendaries: string[];
}

export const ERA_CYCLE_DURATION_MS = 30 * 60 * 1000; // 30-Minute Rotation Loop

export const ERA_ROTATION_ORDER: PokemonEraId[] = [
  "vintage_kanto",
  "neo_johto",
  "advanced_hoenn",
  "diamond_sinnoh",
  "modern_paldea",
];

export const POKEMON_ERAS: Record<PokemonEraId, PokemonEra> = {
  vintage_kanto: {
    id: "vintage_kanto",
    name: "Vintage Kanto (Gen 1)",
    shortName: "Kanto",
    gen: 1,
    years: "1996 - 1999",
    badge: "🔴 BASE SET",
    themeColor: "#ef4444",
    bgGradient: "from-red-600 to-amber-600",
    description: "The classic origin era. Wizards of the Coast Base Set, Jungle & Fossil holos.",
    legendaries: ["Mewtwo", "Dragonite", "Moltres", "Zapdos", "Articuno"],
    speciesPool: [
      { species: "Pikachu", types: ["Electric"], rarity: "uncommon", baseCatchRate: 0.6, baseCp: 450 },
      { species: "Charizard", types: ["Fire", "Flying"], rarity: "epic", baseCatchRate: 0.25, baseCp: 1850 },
      { species: "Blastoise", types: ["Water"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1780 },
      { species: "Venusaur", types: ["Grass", "Poison"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1750 },
      { species: "Gengar", types: ["Ghost", "Poison"], rarity: "epic", baseCatchRate: 0.32, baseCp: 1650 },
      { species: "Dragonite", types: ["Dragon", "Flying"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2450 },
      { species: "Mewtwo", types: ["Psychic"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2890 },
      { species: "Eevee", types: ["Normal"], rarity: "uncommon", baseCatchRate: 0.65, baseCp: 420 },
      { species: "Snorlax", types: ["Normal"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1550 },
      { species: "Gyarados", types: ["Water", "Flying"], rarity: "rare", baseCatchRate: 0.35, baseCp: 1620 },
      { species: "Lapras", types: ["Water", "Ice"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1480 },
      { species: "Alakazam", types: ["Psychic"], rarity: "rare", baseCatchRate: 0.35, baseCp: 1590 },
    ],
  },
  neo_johto: {
    id: "neo_johto",
    name: "Neo Johto (Gen 2)",
    shortName: "Johto",
    gen: 2,
    years: "1999 - 2002",
    badge: "🟡 NEO GENESIS",
    themeColor: "#f59e0b",
    bgGradient: "from-amber-500 to-yellow-600",
    description: "The Gold & Silver golden age. Neo Revelation shining Pokémon and legendary dogs.",
    legendaries: ["Lugia", "Ho-Oh", "Tyranitar", "Suicune", "Entei", "Raikou"],
    speciesPool: [
      { species: "Tyranitar", types: ["Rock", "Dark"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2520 },
      { species: "Lugia", types: ["Psychic", "Flying"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2850 },
      { species: "Ho-Oh", types: ["Fire", "Flying"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2850 },
      { species: "Umbreon", types: ["Dark"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1280 },
      { species: "Espeon", types: ["Psychic"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1320 },
      { species: "Scizor", types: ["Bug", "Steel"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Feraligatr", types: ["Water"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1680 },
      { species: "Typhlosion", types: ["Fire"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1700 },
      { species: "Ampharos", types: ["Electric"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1420 },
      { species: "Houndoom", types: ["Dark", "Fire"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1390 },
      { species: "Heracross", types: ["Bug", "Fighting"], rarity: "uncommon", baseCatchRate: 0.5, baseCp: 1150 },
      { species: "Suicune", types: ["Water"], rarity: "legendary", baseCatchRate: 0.15, baseCp: 2350 },
    ],
  },
  advanced_hoenn: {
    id: "advanced_hoenn",
    name: "Advanced Hoenn (Gen 3)",
    shortName: "Hoenn",
    gen: 3,
    years: "2002 - 2006",
    badge: "🟢 EX SERIES",
    themeColor: "#10b981",
    bgGradient: "from-emerald-500 to-teal-700",
    description: "Ruby, Sapphire & Emerald weather wars. The iconic EX cards and ancient dragons.",
    legendaries: ["Rayquaza", "Kyogre", "Groudon", "Metagross", "Salamence", "Latios", "Latias"],
    speciesPool: [
      { species: "Rayquaza", types: ["Dragon", "Flying"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2980 },
      { species: "Blaziken", types: ["Fire", "Fighting"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1790 },
      { species: "Gardevoir", types: ["Psychic", "Fairy"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1540 },
      { species: "Metagross", types: ["Steel", "Psychic"], rarity: "legendary", baseCatchRate: 0.2, baseCp: 2480 },
      { species: "Salamence", types: ["Dragon", "Flying"], rarity: "legendary", baseCatchRate: 0.2, baseCp: 2460 },
      { species: "Kyogre", types: ["Water"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2920 },
      { species: "Groudon", types: ["Ground"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2920 },
      { species: "Milotic", types: ["Water"], rarity: "rare", baseCatchRate: 0.35, baseCp: 1610 },
      { species: "Flygon", types: ["Ground", "Dragon"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1450 },
      { species: "Sceptile", types: ["Grass"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1680 },
      { species: "Swampert", types: ["Water", "Ground"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Absol", types: ["Dark"], rarity: "uncommon", baseCatchRate: 0.52, baseCp: 1120 },
    ],
  },
  diamond_sinnoh: {
    id: "diamond_sinnoh",
    name: "Diamond Sinnoh (Gen 4)",
    shortName: "Sinnoh",
    gen: 4,
    years: "2006 - 2010",
    badge: "🔵 LV.X ERA",
    themeColor: "#3b82f6",
    bgGradient: "from-blue-600 to-indigo-800",
    description: "Diamond, Pearl & Platinum cosmic deities. LV.X cards, Lucario, and time/space legends.",
    legendaries: ["Dialga", "Palkia", "Giratina", "Darkrai", "Garchomp", "Arceus"],
    speciesPool: [
      { species: "Lucario", types: ["Fighting", "Steel"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1820 },
      { species: "Garchomp", types: ["Dragon", "Ground"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2580 },
      { species: "Dialga", types: ["Steel", "Dragon"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2940 },
      { species: "Palkia", types: ["Water", "Dragon"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2910 },
      { species: "Giratina", types: ["Ghost", "Dragon"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2950 },
      { species: "Darkrai", types: ["Dark"], rarity: "legendary", baseCatchRate: 0.15, baseCp: 2680 },
      { species: "Togekiss", types: ["Fairy", "Flying"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1520 },
      { species: "Infernape", types: ["Fire", "Fighting"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1740 },
      { species: "Electivire", types: ["Electric"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1580 },
      { species: "Magmortar", types: ["Fire"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1570 },
      { species: "Weavile", types: ["Dark", "Ice"], rarity: "uncommon", baseCatchRate: 0.5, baseCp: 1250 },
      { species: "Luxray", types: ["Electric"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1410 },
    ],
  },
  modern_paldea: {
    id: "modern_paldea",
    name: "Modern Paldea (Gen 9 & Ultra)",
    shortName: "Paldea",
    gen: 9,
    years: "2022 - Present",
    badge: "🟣 PARADOX & EX",
    themeColor: "#a855f7",
    bgGradient: "from-purple-600 to-pink-600",
    description: "Scarlet & Violet Terastallization, Ancient & Future Paradox powerhouses.",
    legendaries: ["Miraidon", "Koraidon", "Roaring Moon", "Iron Valiant", "Chien-Pao", "Terapagos"],
    speciesPool: [
      { species: "Miraidon", types: ["Electric", "Dragon"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 3020 },
      { species: "Koraidon", types: ["Fighting", "Dragon"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 3020 },
      { species: "Roaring Moon", types: ["Dragon", "Dark"], rarity: "legendary", baseCatchRate: 0.15, baseCp: 2750 },
      { species: "Iron Valiant", types: ["Fairy", "Fighting"], rarity: "epic", baseCatchRate: 0.22, baseCp: 2280 },
      { species: "Meowscarada", types: ["Grass", "Dark"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1760 },
      { species: "Skeledirge", types: ["Fire", "Ghost"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1780 },
      { species: "Quaquaval", types: ["Water", "Fighting"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1750 },
      { species: "Tinkaton", types: ["Fairy", "Steel"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1490 },
      { species: "Ceruledge", types: ["Fire", "Ghost"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1640 },
      { species: "Dragapult", types: ["Dragon", "Ghost"], rarity: "epic", baseCatchRate: 0.25, baseCp: 2150 },
      { species: "Baxcalibur", types: ["Dragon", "Ice"], rarity: "legendary", baseCatchRate: 0.2, baseCp: 2490 },
      { species: "Gholdengo", types: ["Steel", "Ghost"], rarity: "rare", baseCatchRate: 0.35, baseCp: 1690 },
    ],
  },
  black_unova: {
    id: "black_unova",
    name: "Black Unova (Gen 5)",
    shortName: "Unova",
    gen: 5,
    years: "2010 - 2013",
    badge: "⬛ BW ERA",
    themeColor: "#6366f1",
    bgGradient: "from-indigo-600 to-slate-800",
    description: "Black & White urban routes. Castelia, desert, and the original dragon.",
    legendaries: ["Reshiram", "Zekrom", "Kyurem", "Victini", "Hydreigon"],
    speciesPool: [
      { species: "Reshiram", types: ["Dragon", "Fire"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2960 },
      { species: "Zekrom", types: ["Dragon", "Electric"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2960 },
      { species: "Hydreigon", types: ["Dark", "Dragon"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2480 },
      { species: "Volcarona", types: ["Bug", "Fire"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1880 },
      { species: "Haxorus", types: ["Dragon"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1760 },
      { species: "Chandelure", types: ["Ghost", "Fire"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1540 },
      { species: "Excadrill", types: ["Ground", "Steel"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1490 },
      { species: "Zoroark", types: ["Dark"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1520 },
      { species: "Serperior", types: ["Grass"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1680 },
      { species: "Emboar", types: ["Fire", "Fighting"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Samurott", types: ["Water"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1700 },
      { species: "Victini", types: ["Psychic", "Fire"], rarity: "legendary", baseCatchRate: 0.15, baseCp: 2380 },
    ],
  },
  mega_kalos: {
    id: "mega_kalos",
    name: "Mega Kalos (Gen 6)",
    shortName: "Kalos",
    gen: 6,
    years: "2013 - 2016",
    badge: "💗 XY MEGA",
    themeColor: "#ec4899",
    bgGradient: "from-pink-500 to-rose-700",
    description: "X & Y megas and fairy-type debut. Lumiose, prism, and the life/destruction duo.",
    legendaries: ["Xerneas", "Yveltal", "Zygarde", "Diancie", "Greninja"],
    speciesPool: [
      { species: "Xerneas", types: ["Fairy"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2940 },
      { species: "Yveltal", types: ["Dark", "Flying"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2940 },
      { species: "Greninja", types: ["Water", "Dark"], rarity: "epic", baseCatchRate: 0.28, baseCp: 1840 },
      { species: "Aegislash", types: ["Steel", "Ghost"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Goodra", types: ["Dragon"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1680 },
      { species: "Talonflame", types: ["Fire", "Flying"], rarity: "uncommon", baseCatchRate: 0.5, baseCp: 1280 },
      { species: "Sylveon", types: ["Fairy"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1460 },
      { species: "Pangoro", types: ["Fighting", "Dark"], rarity: "uncommon", baseCatchRate: 0.48, baseCp: 1320 },
      { species: "Hawlucha", types: ["Fighting", "Flying"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1380 },
      { species: "Noivern", types: ["Flying", "Dragon"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1510 },
      { species: "Chesnaught", types: ["Grass", "Fighting"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1700 },
      { species: "Delphox", types: ["Fire", "Psychic"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1710 },
    ],
  },
  sun_alola: {
    id: "sun_alola",
    name: "Sun Alola (Gen 7)",
    shortName: "Alola",
    gen: 7,
    years: "2016 - 2019",
    badge: "🌞 TRIALS",
    themeColor: "#f59e0b",
    bgGradient: "from-amber-400 to-orange-700",
    description: "Sun & Moon island trials. Totems, Z-moves, and Ultra Beasts.",
    legendaries: ["Solgaleo", "Lunala", "Necrozma", "Tapu Koko", "Nihilego"],
    speciesPool: [
      { species: "Solgaleo", types: ["Psychic", "Steel"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2980 },
      { species: "Lunala", types: ["Psychic", "Ghost"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 2980 },
      { species: "Tapu Koko", types: ["Electric", "Fairy"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2320 },
      { species: "Lycanroc", types: ["Rock"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1480 },
      { species: "Incineroar", types: ["Fire", "Dark"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1760 },
      { species: "Primarina", types: ["Water", "Fairy"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1740 },
      { species: "Decidueye", types: ["Grass", "Ghost"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Mimikyu", types: ["Ghost", "Fairy"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1390 },
      { species: "Toxapex", types: ["Poison", "Water"], rarity: "uncommon", baseCatchRate: 0.5, baseCp: 1240 },
      { species: "Kommo-o", types: ["Dragon", "Fighting"], rarity: "legendary", baseCatchRate: 0.2, baseCp: 2460 },
      { species: "Tsareena", types: ["Grass"], rarity: "rare", baseCatchRate: 0.45, baseCp: 1410 },
      { species: "Nihilego", types: ["Rock", "Poison"], rarity: "legendary", baseCatchRate: 0.18, baseCp: 2280 },
    ],
  },
  sword_galar: {
    id: "sword_galar",
    name: "Sword Galar (Gen 8)",
    shortName: "Galar",
    gen: 8,
    years: "2019 - 2022",
    badge: "⚔️ DYNAMAX",
    themeColor: "#fb7185",
    bgGradient: "from-rose-500 to-red-800",
    description: "Sword & Shield dynamax dens. Wild Area weather and the Darkest Day.",
    legendaries: ["Zacian", "Zamazenta", "Eternatus", "Dragapult", "Calyrex"],
    speciesPool: [
      { species: "Zacian", types: ["Fairy", "Steel"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 3040 },
      { species: "Zamazenta", types: ["Fighting", "Steel"], rarity: "legendary", baseCatchRate: 0.12, baseCp: 3020 },
      { species: "Dragapult", types: ["Dragon", "Ghost"], rarity: "epic", baseCatchRate: 0.25, baseCp: 2150 },
      { species: "Corviknight", types: ["Flying", "Steel"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1560 },
      { species: "Toxtricity", types: ["Electric", "Poison"], rarity: "rare", baseCatchRate: 0.42, baseCp: 1490 },
      { species: "Cinderace", types: ["Fire"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1760 },
      { species: "Inteleon", types: ["Water"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1720 },
      { species: "Rillaboom", types: ["Grass"], rarity: "epic", baseCatchRate: 0.3, baseCp: 1740 },
      { species: "Grimmsnarl", types: ["Dark", "Fairy"], rarity: "rare", baseCatchRate: 0.38, baseCp: 1580 },
      { species: "Sirfetch'd", types: ["Fighting"], rarity: "uncommon", baseCatchRate: 0.48, baseCp: 1340 },
      { species: "Eternatus", types: ["Poison", "Dragon"], rarity: "legendary", baseCatchRate: 0.1, baseCp: 3120 },
      { species: "Duraludon", types: ["Steel", "Dragon"], rarity: "rare", baseCatchRate: 0.4, baseCp: 1610 },
    ],
  },
};

export interface ParkBiomeDef {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: { xPct: number; yPct: number };
  rareMultiplier: number;
  featuredNestSpecies: string[];
}


export const RADAR_DISCOVERY_RADIUS_METERS = 45;

export const DRESDEN_PARK_GEO = {
  lat: 33.8824,
  lng: -84.2811,
  name: "Dresden Park",
  city: "Chamblee, GA",
};

/**
 * Calculates high-precision distance between two geographic coordinates in meters
 * using the Haversine spherical formula.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Offsets a coordinate by dx, dy meters into real-world latitude and longitude.
 */
export function geoOffsetFromMeters(
  lat: number,
  lng: number,
  dxMeters: number,
  dyMeters: number
): { lat: number; lng: number } {
  const latOffset = dyMeters / 111320;
  const lngOffset = dxMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: +(lat + latOffset).toFixed(6),
    lng: +(lng + lngOffset).toFixed(6),
  };
}

/** Slippy-map zoom used by the living-world walk camera. */
export const MAP_ZOOM_DEFAULT = 17;
const TILE_PX = 256;

/** Web Mercator world pixels at a given zoom (OSM/Carto tile space). */
export function latLngToWorldPixels(
  lat: number,
  lng: number,
  zoom = MAP_ZOOM_DEFAULT
): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * TILE_PX;
  const sinLat = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n * TILE_PX;
  return { x, y };
}

/** Pixel offset of a geo target relative to the player (player sits at screen center). */
export function geoScreenOffset(
  player: { lat: number; lng: number },
  target: { lat: number; lng: number },
  zoom = MAP_ZOOM_DEFAULT
): { dx: number; dy: number } {
  const p = latLngToWorldPixels(player.lat, player.lng, zoom);
  const t = latLngToWorldPixels(target.lat, target.lng, zoom);
  return { dx: t.x - p.x, dy: t.y - p.y };
}

export function metersPerPixel(lat: number, zoom = MAP_ZOOM_DEFAULT): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

type GeoPin = { xPct: number; yPct: number; distanceMeters: number; lat?: number; lng?: number };

/** Pin percent-plane POIs onto real lat/lng around a walk origin (God's Eye teleport / GPS). */
export function pinWorldPoisToGeo<T extends { discoveryPoints: GeoPin[]; battleArenas: GeoPin[]; cardCaches: GeoPin[] }>(
  state: T,
  center: { lat: number; lng: number }
): T {
  const pin = <P extends GeoPin>(item: P): P => {
    const dxM = (item.xPct - 50) * 8;
    const dyM = (50 - item.yPct) * 8;
    const geo = geoOffsetFromMeters(center.lat, center.lng, dxM, dyM);
    return {
      ...item,
      lat: geo.lat,
      lng: geo.lng,
      distanceMeters: haversineMeters(center.lat, center.lng, geo.lat, geo.lng),
    };
  };
  return {
    ...state,
    discoveryPoints: state.discoveryPoints.map(pin),
    battleArenas: state.battleArenas.map(pin),
    cardCaches: state.cardCaches.map(pin),
  };
}

export const DRESDEN_PARK_ZONE: ParkBiomeDef = {
  id: "dresden_park",
  name: "Dresden Park Nature Reserve",
  shortName: "Dresden Park",
  subtitle: "Rare Nest Biome · 5x Rare / Epic / Legendary Spawns",
  bounds: { minX: 16, maxX: 46, minY: 34, maxY: 62 },
  center: { xPct: 31, yPct: 48 },
  rareMultiplier: 5.0,
  featuredNestSpecies: [
    "Dragonite",
    "Rayquaza",
    "Tyranitar",
    "Lucario",
    "Garchomp",
    "Roaring Moon",
    "Mewtwo",
    "Charizard",
    "Gengar",
    "Metagross",
  ],
};

export function isInsidePark(xPct: number, yPct: number, park: ParkBiomeDef = DRESDEN_PARK_ZONE): boolean {
  return (
    xPct >= park.bounds.minX &&
    xPct <= park.bounds.maxX &&
    yPct >= park.bounds.minY &&
    yPct <= park.bounds.maxY
  );
}

export function getEraRotationStatus(timestamp = Date.now()) {
  const eraKeys = ERA_ROTATION_ORDER;
  const index = Math.floor(timestamp / ERA_CYCLE_DURATION_MS) % eraKeys.length;
  const activeEraId = eraKeys[index];
  const nextEraId = eraKeys[(index + 1) % eraKeys.length];

  const elapsedMs = timestamp % ERA_CYCLE_DURATION_MS;
  const remainingMs = ERA_CYCLE_DURATION_MS - elapsedMs;
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const progressPct = Math.min(100, Math.round((elapsedMs / ERA_CYCLE_DURATION_MS) * 100));

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    activeEra: POKEMON_ERAS[activeEraId],
    nextEra: POKEMON_ERAS[nextEraId],
    activeEraId,
    nextEraId,
    remainingSeconds,
    remainingMinutes: minutes,
    formattedCountdown,
    progressPct,
  };
}

export const ERA_POKEDEX_GEN: Record<PokemonEraId, number> = {
  vintage_kanto: 1,
  neo_johto: 2,
  advanced_hoenn: 3,
  diamond_sinnoh: 4,
  black_unova: 5,
  mega_kalos: 6,
  sun_alola: 7,
  sword_galar: 8,
  modern_paldea: 9,
};

export type EraSpawnOptions = {
  /** Dresden Park nest is a real-world hub — only seed it when standing there. */
  includeParkNest?: boolean;
  localOrigin?: { xPct: number; yPct: number };
};

export function generateEraSpawns(
  eraId?: PokemonEraId,
  count = 7,
  timestamp = Date.now(),
  centerGeo: { lat: number; lng: number } = DRESDEN_PARK_GEO,
  opts: EraSpawnOptions = {}
): WildCreature[] {
  const eraKey = eraId || getEraRotationStatus(timestamp).activeEraId;
  const spawns: WildCreature[] = [];
  const gen = ERA_POKEDEX_GEN[eraKey] || 9;
  let pool: NationalDexPokemon[] = getPokemonByGen(gen);

  if (!pool || pool.length === 0) {
    pool = ALL_POKEMON;
  }

  const nearDresden =
    haversineMeters(centerGeo.lat, centerGeo.lng, DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng) <= 800;
  const includePark = opts.includeParkNest ?? nearDresden;
  const origin = opts.localOrigin || (includePark ? { xPct: 31, yPct: 48 } : { xPct: 50, yPct: 50 });

  // 1. Dresden Park nest — real-world hub only, never mixed into other region planes
  const parkCount = includePark ? 3 : 0;
  const generalCount = includePark ? Math.max(3, count - parkCount) : Math.max(3, count);

  // Dresden Park nest pool: draws rare/epic/legendary from full franchise
  const highTierFranchisePool = ALL_POKEMON.filter(
    (p) => p.rarity === "rare" || p.rarity === "epic" || p.rarity === "legendary"
  );

  for (let i = 0; i < parkCount; i++) {
    const chosen =
      highTierFranchisePool[Math.floor(Math.random() * highTierFranchisePool.length)] ||
      pool[0];

    const parkX = Math.round(18 + Math.random() * 24); // 18-42%
    const parkY = Math.round(36 + Math.random() * 22); // 36-58%
    const level = Math.round(32 + Math.random() * 16);
    const cp = Math.round(chosen.baseCp * (1 + (level - 20) * 0.04) * 1.25);

    // Nest geo is always Dresden Park, not the active region's center
    const dxM = (parkX - 31) * 8; // meters
    const dyM = (parkY - 48) * 8;
    const geo = geoOffsetFromMeters(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, dxM, dyM);
    const distMeters = haversineMeters(centerGeo.lat, centerGeo.lng, geo.lat, geo.lng);

    spawns.push({
      id: `spawn-dresden-${chosen.id}-${i}-${timestamp}`,
      species: chosen.name,
      nationalDexId: chosen.id,
      cp,
      level,
      types: chosen.types,
      rarity: chosen.rarity,
      xPct: parkX,
      yPct: parkY,
      lat: geo.lat,
      lng: geo.lng,
      distanceMeters: distMeters,
      isDiscovered: distMeters <= RADAR_DISCOVERY_RADIUS_METERS,
      weatherBoosted: Math.random() < 0.5,
      spawnTimestamp: timestamp,
      despawnTimestamp: timestamp + ERA_CYCLE_DURATION_MS,
      baseCatchRate: Math.min(0.85, chosen.baseCatchRate + 0.1),
      relatedCardsCount: Math.round(8 + Math.random() * 20),
      eraId: eraKey,
      isParkNest: true,
      parkName: "Dresden Park",
    });
  }

  // 2. Generate remaining general spawns from the active era pool
  for (let i = 0; i < generalCount; i++) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    let x = Math.round(origin.xPct - 28 + Math.random() * 56);
    let y = Math.round(origin.yPct - 28 + Math.random() * 56);
    x = Math.min(90, Math.max(10, x));
    y = Math.min(90, Math.max(10, y));
    if (includePark && isInsidePark(x, y)) {
      x = x < 31 ? 12 : 72;
    }

    const level = Math.round(16 + Math.random() * 20);
    const cp = Math.round(chosen.baseCp * (1 + (level - 20) * 0.04));

    const dxM = (x - origin.xPct) * 12;
    const dyM = (y - origin.yPct) * 12;
    const geo = geoOffsetFromMeters(centerGeo.lat, centerGeo.lng, dxM, dyM);
    const distMeters = haversineMeters(centerGeo.lat, centerGeo.lng, geo.lat, geo.lng);

    spawns.push({
      id: `spawn-${chosen.id}-${i}-${timestamp}`,
      species: chosen.name,
      nationalDexId: chosen.id,
      cp,
      level,
      types: chosen.types,
      rarity: chosen.rarity,
      xPct: x,
      yPct: y,
      lat: geo.lat,
      lng: geo.lng,
      distanceMeters: distMeters,
      isDiscovered: distMeters <= RADAR_DISCOVERY_RADIUS_METERS,
      weatherBoosted: Math.random() < 0.35,
      spawnTimestamp: timestamp,
      despawnTimestamp: timestamp + ERA_CYCLE_DURATION_MS,
      baseCatchRate: chosen.baseCatchRate,
      relatedCardsCount: Math.round(4 + Math.random() * 12),
      eraId: eraKey,
      isParkNest: false,
    });
  }

  return spawns;
}

export interface WildCreature {
  id: string;
  species: string;
  nationalDexId?: number;
  cp: number;
  level: number;
  types: string[];
  rarity: CreatureRarity;
  xPct: number;
  yPct: number;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  isDiscovered?: boolean;
  discoveryTimestamp?: number;
  weatherBoosted: boolean;
  spawnTimestamp: number;
  despawnTimestamp: number;
  baseCatchRate: number;
  relatedCardsCount: number;
  eraId?: PokemonEraId;
  isParkNest?: boolean;
  parkName?: string;
}

export interface DiscoveryPoint {
  id: string;
  title: string;
  subtitle: string;
  xPct: number;
  yPct: number;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  lastSpunTimestamp: number;
  cooldownMs: number;
  photoUrl: string;
}

export interface BattleArena {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  championSpecies: string;
  championLevel: number;
  prestigePoints: number;
  defenseType: string;
  rewardPool: { coins: number; xp: number; rareCandyChance: number };
}

export interface CardCacheDrop {
  id: string;
  title: string;
  rarityTier: "Holo Rare" | "Ultra Rare" | "Secret Rare" | "Vintage Classic";
  xPct: number;
  yPct: number;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  claimed: boolean;
  cardPayload: {
    name: string;
    setName: string;
    number: string;
    marketPrice: number;
    projectedGrade: string;
    imageUrl: string;
  };
}

export interface ExplorationRoute {
  id: string;
  title: string;
  distanceKm: number;
  difficulty: "Easy" | "Medium" | "Challenging";
  checkpointsCount: number;
  currentCheckpoint: number;
  completed: boolean;
  rewards: { xp: number; coins: number; rareCandy: number; stone?: EvolutionStoneId };
}

export interface AdventureQuest {
  id: string;
  title: string;
  description: string;
  category: "daily" | "special" | "collection";
  currentProgress: number;
  targetProgress: number;
  rewardCoins: number;
  rewardXp: number;
  rewardRareCandy: number;
  completed: boolean;
  claimed: boolean;
}

export interface WorldState {
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  biome: string;
  eventName: string;
  eventMultiplier: number;
  playerCoords: { xPct: number; yPct: number };
  playerGeo?: { lat: number; lng: number; accuracy?: number; heading?: number };
  useRealGps?: boolean;
  mapStyle?: "carto_dark" | "osm_streets" | "satellite";
  activeEraId?: PokemonEraId;
  lastEraRotationTimestamp?: number;
  isInsidePark?: boolean;
  /** God's Eye region currently loaded as the walk plane (not the global % field). */
  activeRegionId?: string;
  /** `gba` = original pixel overworld on the map; `go` = OSM/Carto streets (real hubs). */
  walkSkin?: "go" | "gba";
}

export interface AdventureState {
  player: PlayerProfile;
  inventory: AdventureInventory;
  buddy: BuddyCompanion;
  world: WorldState;
  wildCreatures: WildCreature[];
  discoveryPoints: DiscoveryPoint[];
  battleArenas: BattleArena[];
  cardCaches: CardCacheDrop[];
  routes: ExplorationRoute[];
  quests: AdventureQuest[];
}


export function cloneAdventureState(state: AdventureState): AdventureState {
  return JSON.parse(JSON.stringify(state));
}

const STORAGE_KEY = "pv_adventure_world_state_v1";
const memoryFallback = new Map<string, AdventureState>();

export function calculateXpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.45));
}

export function getDefaultAdventureState(): AdventureState {
  const state: AdventureState = {
    player: {
      id: "trainer-kenny-01",
      displayName: "Ace Trainer Kenny",
      avatarSeed: "trainer-avatar-blue",
      level: 18,
      xp: 3420,
      xpToNextLevel: calculateXpToNextLevel(18),
      totalDistanceKm: 42.8,
      creaturesDiscovered: 84,
      creaturesCaught: 68,
      evolutionsCompleted: 14,
      questsCompleted: 29,
      discoveryPointsSpun: 47,
      streakDays: 4,
      lastDailyClaimTimestamp: 0,
    },
    inventory: {
      coins: 850,
      energy: 92,
      maxEnergy: 100,
      rareCandy: 6,
      speciesCandies: {
        Eevee: 75,
        Pikachu: 64,
        Charmander: 48,
        Bulbasaur: 35,
        Squirtle: 42,
        Gengar: 22,
        Lucario: 15,
        Togepi: 30,
        Murkrow: 45,
        Vulpix: 55,
      },
      stones: {
        fire_stone: 2,
        water_stone: 1,
        thunder_stone: 3,
        leaf_stone: 1,
        moon_stone: 2,
        sun_stone: 1,
        shiny_stone: 1,
        dusk_stone: 2,
        dawn_stone: 1,
        ice_stone: 1,
      },
      captureItems: {
        poke_ball: 45,
        great_ball: 22,
        ultra_ball: 8,
        master_ball: 1,
        razz_berry: 18,
        nanab_berry: 12,
        pinap_berry: 15,
        golden_razz: 3,
      },
      boosts: {
        incense: 2,
        lucky_egg: 1,
        coin_booster: 2,
        encounter_radar: 1,
      },
      cardCachesDiscovered: 7,
    },
    buddy: {
      species: "Pikachu",
      nickname: "Sparky",
      friendshipTier: "adventurer",
      mood: "excited",
      totalKmWalked: 18.5,
      candiesFound: 18,
      giftsDelivered: 5,
      heartsToday: 4,
      maxHeartsToday: 6,
    },
    world: {
      timeOfDay: "day",
      weather: "clear",
      biome: "Viridian Greenlands & Route 2",
      eventName: "⚡ Kanto Electric Surge — 2x Catch Candies Active!",
      eventMultiplier: 2.0,
      playerCoords: { xPct: 50, yPct: 50 },
      playerGeo: { lat: DRESDEN_PARK_GEO.lat, lng: DRESDEN_PARK_GEO.lng, accuracy: 10, heading: 0 },
      activeEraId: "vintage_kanto",
      lastEraRotationTimestamp: Date.now(),
      isInsidePark: false,
      walkSkin: "go",
    },
    wildCreatures: [
      {
        id: "wild-eevee-01",
        species: "Eevee",
        cp: 645,
        level: 22,
        types: ["Normal"],
        rarity: "rare",
        xPct: 42,
        yPct: 38,
        distanceMeters: 45,
        weatherBoosted: false,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.65,
        relatedCardsCount: 14,
      },
      {
        id: "wild-pikachu-02",
        species: "Pikachu",
        cp: 780,
        level: 26,
        types: ["Electric"],
        rarity: "uncommon",
        xPct: 62,
        yPct: 45,
        distanceMeters: 75,
        weatherBoosted: true,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.55,
        relatedCardsCount: 22,
      },
      {
        id: "wild-charmander-03",
        species: "Charmander",
        cp: 820,
        level: 25,
        types: ["Fire"],
        rarity: "rare",
        xPct: 35,
        yPct: 65,
        distanceMeters: 110,
        weatherBoosted: false,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.5,
        relatedCardsCount: 18,
      },
      {
        id: "wild-gengar-04",
        species: "Gengar",
        cp: 1950,
        level: 38,
        types: ["Ghost", "Poison"],
        rarity: "epic",
        xPct: 70,
        yPct: 30,
        distanceMeters: 140,
        weatherBoosted: false,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.25,
        relatedCardsCount: 9,
      },
      {
        id: "wild-dragonite-05",
        species: "Dragonite",
        cp: 2840,
        level: 45,
        types: ["Dragon", "Flying"],
        rarity: "legendary",
        xPct: 80,
        yPct: 75,
        distanceMeters: 210,
        weatherBoosted: true,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.15,
        relatedCardsCount: 12,
      },
    ],
    discoveryPoints: [
      {
        id: "stop-viridian-fountain",
        title: "Viridian Oasis Landmark",
        subtitle: "Ancient water spring where water Pokémon gather",
        xPct: 28,
        yPct: 40,
        distanceMeters: 80,
        lastSpunTimestamp: 0,
        cooldownMs: 300000,
        photoUrl: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&q=80",
      },
      {
        id: "stop-pewter-monument",
        title: "Ancient Stone Archway",
        subtitle: "Monolith carved by ancient Kanto geologists",
        xPct: 68,
        yPct: 60,
        distanceMeters: 120,
        lastSpunTimestamp: 0,
        cooldownMs: 300000,
        photoUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80",
      },
    ],
    battleArenas: [
      {
        id: "gym-viridian-tower",
        name: "Viridian Platinum Arena",
        xPct: 75,
        yPct: 20,
        distanceMeters: 190,
        championSpecies: "Charizard",
        championLevel: 50,
        prestigePoints: 48500,
        defenseType: "Fire / Flying",
        rewardPool: { coins: 150, xp: 500, rareCandyChance: 0.5 },
      },
    ],
    cardCaches: [
      {
        id: "cache-vintage-holo-01",
        title: "Quantum Holographic Card Cache",
        rarityTier: "Vintage Classic",
        xPct: 48,
        yPct: 72,
        distanceMeters: 95,
        claimed: false,
        cardPayload: {
          name: "Charizard",
          setName: "Base Set Holo",
          number: "4/102",
          marketPrice: 385.0,
          projectedGrade: "PSA 9 MINT",
          imageUrl: "https://images.pokemontcg.io/base1/4_hires.png",
        },
      },
      {
        id: "cache-ultra-rare-02",
        title: "Prismatic Secret Rare Drop",
        rarityTier: "Secret Rare",
        xPct: 22,
        yPct: 68,
        distanceMeters: 160,
        claimed: false,
        cardPayload: {
          name: "Gengar VMAX",
          setName: "Fusion Strike Alt Art",
          number: "271/264",
          marketPrice: 245.0,
          projectedGrade: "CGC 10 PRISTINE",
          imageUrl: "https://images.pokemontcg.io/swsh8/271_hires.png",
        },
      },
    ],
    routes: [
      {
        id: "route-viridian-trail",
        title: "Viridian Canopy Walkway",
        distanceKm: 1.2,
        difficulty: "Easy",
        checkpointsCount: 4,
        currentCheckpoint: 2,
        completed: false,
        rewards: { xp: 350, coins: 120, rareCandy: 1, stone: "leaf_stone" },
      },
      {
        id: "route-thunder-mountain",
        title: "Power Plant Ridge Path",
        distanceKm: 2.5,
        difficulty: "Challenging",
        checkpointsCount: 6,
        currentCheckpoint: 0,
        completed: false,
        rewards: { xp: 750, coins: 250, rareCandy: 2, stone: "thunder_stone" },
      },
    ],
    quests: [
      {
        id: "quest-catch-3",
        title: "Master Tracker",
        description: "Encounter and successfully catch 3 wild Pokémon.",
        category: "daily",
        currentProgress: 1,
        targetProgress: 3,
        rewardCoins: 50,
        rewardXp: 150,
        rewardRareCandy: 1,
        completed: false,
        claimed: false,
      },
      {
        id: "quest-spin-stops",
        title: "Landmark Scout",
        description: "Spin 2 Discovery Points in the exploration map.",
        category: "daily",
        currentProgress: 1,
        targetProgress: 2,
        rewardCoins: 40,
        rewardXp: 120,
        rewardRareCandy: 0,
        completed: false,
        claimed: false,
      },
      {
        id: "quest-stone-evolve",
        title: "Elemental Catalyst",
        description: "Evolve 1 Pokémon using an Evolution Stone.",
        category: "special",
        currentProgress: 0,
        targetProgress: 1,
        rewardCoins: 100,
        rewardXp: 300,
        rewardRareCandy: 2,
        completed: false,
        claimed: false,
      },
      {
        id: "quest-walk-1km",
        title: "Trailblazer Steps",
        description: "Explore 1.0 km in Adventure Mode with your Buddy.",
        category: "daily",
        currentProgress: 0.7,
        targetProgress: 1.0,
        rewardCoins: 60,
        rewardXp: 200,
        rewardRareCandy: 1,
        completed: false,
        claimed: false,
      },
    ],
  };
  return pinWorldPoisToGeo(state, DRESDEN_PARK_GEO);
}

function hydrateAdventureGeo(state: AdventureState): AdventureState {
  const geo = state.world.playerGeo || {
    lat: DRESDEN_PARK_GEO.lat,
    lng: DRESDEN_PARK_GEO.lng,
    accuracy: 10,
    heading: 0,
  };
  let next = state;
  let dirty = false;
  if (!state.world.playerGeo) {
    next = cloneAdventureState(state);
    next.world.playerGeo = geo;
    dirty = true;
  }
  // Legacy: carto_dark basemap required an API key and showed "API KEY REQUIRED" watermarks.
  // Force Esri-equivalent dark (app map uses Esri; persisted style just shouldn't stay on carto).
  if (next.world.mapStyle === "carto_dark") {
    if (!dirty) next = cloneAdventureState(next);
    next.world.mapStyle = "osm_streets";
    dirty = true;
  }
  const needsPin = [...next.discoveryPoints, ...next.battleArenas, ...next.cardCaches].some(
    (p) => typeof p.lat !== "number" || typeof p.lng !== "number"
  );
  const pinned = needsPin ? pinWorldPoisToGeo(next, { lat: geo.lat, lng: geo.lng }) : next;
  if (dirty && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
    } catch { /* ignore quota */ }
  }
  return pinned;
}

export function loadAdventureState(): AdventureState {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return hydrateAdventureGeo(JSON.parse(raw));
      }
    } catch {}
  }
  const mem = memoryFallback.get(STORAGE_KEY);
  if (mem) return hydrateAdventureGeo(mem);

  const def = getDefaultAdventureState();
  saveAdventureState(def);
  return def;
}

export function saveAdventureState(state: AdventureState): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
  memoryFallback.set(STORAGE_KEY, state);
}

// ─────────────────────────────────────────────────────────────────────────────
// ECONOMY & PROGRESSION ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function addAdventureXp(
  state: AdventureState,
  amount: number
): { state: AdventureState; leveledUp: boolean; newLevel: number } {
  const updated = cloneAdventureState(state);
  let currentXp = updated.player.xp + amount;
  let currentLevel = updated.player.level;
  let needed = calculateXpToNextLevel(currentLevel);
  let leveledUp = false;

  while (currentXp >= needed) {
    currentXp -= needed;
    currentLevel += 1;
    needed = calculateXpToNextLevel(currentLevel);
    leveledUp = true;
    updated.inventory.coins += currentLevel * 25;
    updated.inventory.energy = updated.inventory.maxEnergy;
    updated.inventory.rareCandy += 1;
  }

  updated.player.xp = currentXp;
  updated.player.level = currentLevel;
  updated.player.xpToNextLevel = needed;

  saveAdventureState(updated);
  return { state: updated, leveledUp, newLevel: currentLevel };
}

export function modifyCoins(state: AdventureState, delta: number): AdventureState {
  const updated = cloneAdventureState(state);
  updated.inventory.coins = Math.max(0, updated.inventory.coins + delta);
  saveAdventureState(updated);
  return updated;
}

export function modifyEnergy(state: AdventureState, delta: number): AdventureState {
  const updated = cloneAdventureState(state);
  updated.inventory.energy = Math.max(
    0,
    Math.min(updated.inventory.maxEnergy, updated.inventory.energy + delta)
  );
  saveAdventureState(updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// RARE CANDY & EVOLUTION STONES
// ─────────────────────────────────────────────────────────────────────────────

export function convertRareCandyToSpecies(
  state: AdventureState,
  species: string,
  amount: number
): { success: boolean; state: AdventureState; error?: string } {
  if (state.inventory.rareCandy < amount || amount <= 0) {
    return { success: false, state, error: "Insufficient Rare Candy." };
  }

  const updated = cloneAdventureState(state);
  updated.inventory.rareCandy -= amount;
  updated.inventory.speciesCandies[species] =
    (updated.inventory.speciesCandies[species] || 0) + amount;

  saveAdventureState(updated);
  return { success: true, state: updated };
}

export function canEvolveCreature(
  state: AdventureState,
  fromSpecies: string,
  stoneId?: EvolutionStoneId
): { eligible: boolean; targetSpecies?: string; missingReason?: string; cost: { stoneRequired?: EvolutionStoneId; candiesRequired: number } } {
  if (stoneId) {
    const stoneDef = EVOLUTION_STONES[stoneId];
    if (!stoneDef) return { eligible: false, missingReason: "Unknown Evolution Stone", cost: { candiesRequired: 0 } };

    const match = stoneDef.eligibleSpecies.find(
      (s) => s.from.toLowerCase() === fromSpecies.toLowerCase()
    );
    if (!match) {
      return {
        eligible: false,
        missingReason: `${fromSpecies} cannot evolve using a ${stoneDef.name}.`,
        cost: { stoneRequired: stoneId, candiesRequired: 0 },
      };
    }

    const hasStone = (state.inventory.stones[stoneId] || 0) >= 1;
    const currentCandies =
      (state.inventory.speciesCandies[fromSpecies] || 0) + state.inventory.rareCandy;

    if (!hasStone) {
      return {
        eligible: false,
        targetSpecies: match.to,
        missingReason: `Requires 1x ${stoneDef.name}.`,
        cost: { stoneRequired: stoneId, candiesRequired: match.candiesRequired },
      };
    }

    if (currentCandies < match.candiesRequired) {
      return {
        eligible: false,
        targetSpecies: match.to,
        missingReason: `Requires ${match.candiesRequired} ${fromSpecies} Candies (Have ${currentCandies} including Rare Candies).`,
        cost: { stoneRequired: stoneId, candiesRequired: match.candiesRequired },
      };
    }

    return {
      eligible: true,
      targetSpecies: match.to,
      cost: { stoneRequired: stoneId, candiesRequired: match.candiesRequired },
    };
  }

  for (const [id, def] of Object.entries(EVOLUTION_STONES)) {
    const sId = id as EvolutionStoneId;
    const match = def.eligibleSpecies.find(
      (s) => s.from.toLowerCase() === fromSpecies.toLowerCase()
    );
    if (match) {
      return canEvolveCreature(state, fromSpecies, sId);
    }
  }

  return { eligible: false, missingReason: `${fromSpecies} has no stone-triggered evolutions.`, cost: { candiesRequired: 0 } };
}

export function executeEvolution(
  state: AdventureState,
  fromSpecies: string,
  stoneId: EvolutionStoneId
): { success: boolean; state: AdventureState; evolvedTo?: string; error?: string } {
  const check = canEvolveCreature(state, fromSpecies, stoneId);
  if (!check.eligible || !check.targetSpecies) {
    return { success: false, state, error: check.missingReason || "Ineligible for evolution" };
  }

  const updated = cloneAdventureState(state);
  updated.inventory.stones[stoneId] = Math.max(0, (updated.inventory.stones[stoneId] || 1) - 1);

  let candiesNeeded = check.cost.candiesRequired;
  const currentSpeciesCandies = updated.inventory.speciesCandies[fromSpecies] || 0;
  if (currentSpeciesCandies >= candiesNeeded) {
    updated.inventory.speciesCandies[fromSpecies] -= candiesNeeded;
  } else {
    candiesNeeded -= currentSpeciesCandies;
    updated.inventory.speciesCandies[fromSpecies] = 0;
    updated.inventory.rareCandy = Math.max(0, updated.inventory.rareCandy - candiesNeeded);
  }

  updated.player.evolutionsCompleted += 1;
  const xpRes = addAdventureXp(updated, 500);

  xpRes.state.quests.forEach((q) => {
    if (q.id === "quest-stone-evolve" && !q.completed) {
      q.currentProgress = Math.min(q.targetProgress, q.currentProgress + 1);
      if (q.currentProgress >= q.targetProgress) q.completed = true;
    }
  });

  saveAdventureState(xpRes.state);
  return { success: true, state: xpRes.state, evolvedTo: check.targetSpecies };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCOUNTER & CAPTURE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export function attemptCapture(
  state: AdventureState,
  creatureId: string,
  ballId: CaptureItemId,
  berryId?: CaptureItemId,
  throwPrecision: "nice" | "great" | "excellent" = "great"
): {
  success: boolean;
  state: AdventureState;
  creature?: WildCreature;
  rewards?: { xp: number; coins: number; candies: number; rareCandyChance: boolean };
} {
  const creature = state.wildCreatures.find((c) => c.id === creatureId);
  if (!creature) return { success: false, state };

  const updated = cloneAdventureState(state);
  if ((updated.inventory.captureItems[ballId] || 0) <= 0) {
    return { success: false, state };
  }
  updated.inventory.captureItems[ballId] -= 1;

  let berryMultiplier = 1.0;
  let doubleCandy = false;
  if (berryId && (updated.inventory.captureItems[berryId] || 0) > 0) {
    updated.inventory.captureItems[berryId] -= 1;
    const bDef = CAPTURE_ITEMS[berryId];
    berryMultiplier = bDef.multiplier;
    if (berryId === "pinap_berry") doubleCandy = true;
  }

  const ballMultiplier = CAPTURE_ITEMS[ballId].multiplier;
  const throwMultiplier =
    throwPrecision === "excellent" ? 1.7 : throwPrecision === "great" ? 1.3 : 1.0;

  const finalRate = Math.min(
    1.0,
    creature.baseCatchRate * ballMultiplier * berryMultiplier * throwMultiplier
  );
  const caught = Math.random() <= finalRate || ballId === "master_ball";

  if (caught) {
    updated.wildCreatures = updated.wildCreatures.filter((c) => c.id !== creatureId);
    updated.player.creaturesCaught += 1;

    const nestMultiplier = creature.isParkNest ? 1.5 : 1.0;
    const baseCandies = (doubleCandy ? 6 : 3) * (updated.world.eventMultiplier || 1.0);
    const candyAmount = Math.round(baseCandies * nestMultiplier);
    updated.inventory.speciesCandies[creature.species] =
      (updated.inventory.speciesCandies[creature.species] || 0) + candyAmount;

    const gotRareCandy =
      creature.rarity === "legendary" ||
      creature.isParkNest ||
      (creature.rarity === "epic" && Math.random() < 0.4);
    if (gotRareCandy) {
      updated.inventory.rareCandy += 1;
    }

    const baseXpGain = creature.rarity === "legendary" ? 1000 : creature.rarity === "epic" ? 500 : 150;
    const xpGain = Math.round(baseXpGain * (creature.isParkNest ? 1.5 : 1.0));
    const coinsGain = Math.floor(xpGain / 4);
    updated.inventory.coins += coinsGain;
    const xpRes = addAdventureXp(updated, xpGain);

    xpRes.state.quests.forEach((q) => {
      if (q.id === "quest-catch-3" && !q.completed) {
        q.currentProgress = Math.min(q.targetProgress, q.currentProgress + 1);
        if (q.currentProgress >= q.targetProgress) q.completed = true;
      }
    });

    saveAdventureState(xpRes.state);
    return {
      success: true,
      state: xpRes.state,
      creature,
      rewards: { xp: xpGain, coins: coinsGain, candies: candyAmount, rareCandyChance: gotRareCandy },
    };
  }

  saveAdventureState(updated);
  return { success: false, state: updated, creature };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY POINTS (POKESTOP-STYLE LANDMARKS)
// ─────────────────────────────────────────────────────────────────────────────

export function spinDiscoveryPoint(
  state: AdventureState,
  pointId: string
): {
  success: boolean;
  state: AdventureState;
  loot?: {
    xp: number;
    coins: number;
    ballsAwarded: number;
    berriesAwarded: number;
    stoneAwarded?: EvolutionStoneId;
  };
  cooldownRemainingSec?: number;
} {
  const updated = cloneAdventureState(state);
  const point = updated.discoveryPoints.find((p) => p.id === pointId);
  if (!point) return { success: false, state };

  const now = Date.now();
  const elapsed = now - point.lastSpunTimestamp;
  if (point.lastSpunTimestamp > 0 && elapsed < point.cooldownMs) {
    return {
      success: false,
      state,
      cooldownRemainingSec: Math.ceil((point.cooldownMs - elapsed) / 1000),
    };
  }

  point.lastSpunTimestamp = now;
  updated.player.discoveryPointsSpun += 1;

  const xpAward = 50;
  const coinsAward = Math.floor(25 + Math.random() * 25);
  const ballsAward = 3;
  const berriesAward = 2;

  updated.inventory.coins += coinsAward;
  updated.inventory.captureItems.poke_ball =
    (updated.inventory.captureItems.poke_ball || 0) + ballsAward;
  updated.inventory.captureItems.razz_berry =
    (updated.inventory.captureItems.razz_berry || 0) + berriesAward;

  let stoneAwarded: EvolutionStoneId | undefined;
  if (Math.random() < 0.15) {
    const stoneKeys = Object.keys(EVOLUTION_STONES) as EvolutionStoneId[];
    stoneAwarded = stoneKeys[Math.floor(Math.random() * stoneKeys.length)];
    updated.inventory.stones[stoneAwarded] = (updated.inventory.stones[stoneAwarded] || 0) + 1;
  }

  const xpRes = addAdventureXp(updated, xpAward);

  xpRes.state.quests.forEach((q) => {
    if (q.id === "quest-spin-stops" && !q.completed) {
      q.currentProgress = Math.min(q.targetProgress, q.currentProgress + 1);
      if (q.currentProgress >= q.targetProgress) q.completed = true;
    }
  });

  saveAdventureState(xpRes.state);
  return {
    success: true,
    state: xpRes.state,
    loot: {
      xp: xpAward,
      coins: coinsAward,
      ballsAwarded: ballsAward,
      berriesAwarded: berriesAward,
      stoneAwarded,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD CACHES (TCG VAULT BRIDGE)
// ─────────────────────────────────────────────────────────────────────────────

export function claimCardCache(
  state: AdventureState,
  cacheId: string
): { success: boolean; state: AdventureState; cache?: CardCacheDrop } {
  const updated = cloneAdventureState(state);
  const cache = updated.cardCaches.find((c) => c.id === cacheId);
  if (!cache || cache.claimed) return { success: false, state };

  cache.claimed = true;
  updated.inventory.cardCachesDiscovered += 1;
  updated.inventory.coins += 100;

  const xpRes = addAdventureXp(updated, 300);
  saveAdventureState(xpRes.state);
  return { success: true, state: xpRes.state, cache };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDDY COMPANION INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function feedBuddy(
  state: AdventureState,
  berryId: CaptureItemId = "razz_berry"
): { success: boolean; state: AdventureState; message: string } {
  if ((state.inventory.captureItems[berryId] || 0) <= 0) {
    return { success: false, state, message: `No ${CAPTURE_ITEMS[berryId].name} left in bag.` };
  }

  const updated = cloneAdventureState(state);
  updated.inventory.captureItems[berryId] -= 1;
  updated.buddy.heartsToday = Math.min(
    updated.buddy.maxHeartsToday,
    updated.buddy.heartsToday + 1
  );
  updated.buddy.mood = "excited";

  const xpRes = addAdventureXp(updated, 25);
  saveAdventureState(xpRes.state);
  return { success: true, state: xpRes.state, message: `${updated.buddy.nickname} loved the berry! (+1 Heart, +25 XP)` };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOP PURCHASE
// ─────────────────────────────────────────────────────────────────────────────

export function buyShopItem(
  state: AdventureState,
  itemType: "stone" | "capture" | "boost" | "rare_candy",
  itemId: string,
  quantity: number = 1
): { success: boolean; state: AdventureState; error?: string } {
  const updated = cloneAdventureState(state);
  let unitPrice = 0;

  if (itemType === "rare_candy") {
    unitPrice = 100;
  } else if (itemType === "stone") {
    const s = EVOLUTION_STONES[itemId as EvolutionStoneId];
    if (!s) return { success: false, state, error: "Invalid stone" };
    unitPrice = s.priceCoins;
  } else if (itemType === "capture") {
    const c = CAPTURE_ITEMS[itemId as CaptureItemId];
    if (!c) return { success: false, state, error: "Invalid capture item" };
    unitPrice = c.priceCoins;
  } else if (itemType === "boost") {
    const b = BOOST_ITEMS[itemId as BoostItemId];
    if (!b) return { success: false, state, error: "Invalid boost" };
    unitPrice = b.priceCoins;
  }

  const totalCost = unitPrice * quantity;
  if (updated.inventory.coins < totalCost) {
    return { success: false, state, error: `Need ${totalCost} Coins (Have ${updated.inventory.coins}).` };
  }

  updated.inventory.coins -= totalCost;

  if (itemType === "rare_candy") {
    updated.inventory.rareCandy += quantity;
  } else if (itemType === "stone") {
    const sId = itemId as EvolutionStoneId;
    updated.inventory.stones[sId] = (updated.inventory.stones[sId] || 0) + quantity;
  } else if (itemType === "capture") {
    const cId = itemId as CaptureItemId;
    updated.inventory.captureItems[cId] = (updated.inventory.captureItems[cId] || 0) + quantity;
  } else if (itemType === "boost") {
    const bId = itemId as BoostItemId;
    updated.inventory.boosts[bId] = (updated.inventory.boosts[bId] || 0) + quantity;
  }

  saveAdventureState(updated);
  return { success: true, state: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM QUEST REWARDS
// ─────────────────────────────────────────────────────────────────────────────

export function claimQuest(
  state: AdventureState,
  questId: string
): { success: boolean; state: AdventureState; rewards?: { coins: number; xp: number; rareCandy: number } } {
  const updated = cloneAdventureState(state);
  const quest = updated.quests.find((q) => q.id === questId);
  if (!quest || !quest.completed || quest.claimed) {
    return { success: false, state };
  }

  quest.claimed = true;
  updated.player.questsCompleted += 1;
  updated.inventory.coins += quest.rewardCoins;
  updated.inventory.rareCandy += quest.rewardRareCandy;

  const xpRes = addAdventureXp(updated, quest.rewardXp);
  saveAdventureState(xpRes.state);

  return {
    success: true,
    state: xpRes.state,
    rewards: { coins: quest.rewardCoins, xp: quest.rewardXp, rareCandy: quest.rewardRareCandy },
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// ERA ROTATION ENGINE (30-MINUTE CYCLES)
// ─────────────────────────────────────────────────────────────────────────────

export function checkAndRotateEra(
  state: AdventureState,
  currentTimestamp = Date.now()
): { state: AdventureState; didRotate: boolean; activeEra: PokemonEra } {
  const rotation = getEraRotationStatus(currentTimestamp);
  const currentEraId = state.world.activeEraId || "vintage_kanto";

  if (currentEraId !== rotation.activeEraId) {
    const updated = cloneAdventureState(state);
    updated.world.activeEraId = rotation.activeEraId;
    updated.world.lastEraRotationTimestamp = currentTimestamp;
    updated.wildCreatures = generateEraSpawns(rotation.activeEraId, 7, currentTimestamp);
    saveAdventureState(updated);
    return { state: updated, didRotate: true, activeEra: rotation.activeEra };
  }

  return { state, didRotate: false, activeEra: rotation.activeEra };
}

export function forceSwitchEra(
  state: AdventureState,
  targetEraId: PokemonEraId
): { state: AdventureState; activeEra: PokemonEra } {
  const updated = cloneAdventureState(state);
  updated.world.activeEraId = targetEraId;
  updated.world.lastEraRotationTimestamp = Date.now();
  updated.wildCreatures = generateEraSpawns(targetEraId, 7, Date.now());
  saveAdventureState(updated);
  return { state: updated, activeEra: POKEMON_ERAS[targetEraId] };
}


/**
 * Updates player coordinates and recalculates distance to all wild creatures.
 * Strictly triggers discovery when a player moves within RADAR_DISCOVERY_RADIUS_METERS (45m).
 */
export function updatePlayerLocation(
  state: AdventureState,
  newCoords: { xPct: number; yPct: number },
  distMeters: number,
  newGeo?: { lat: number; lng: number; accuracy?: number; heading?: number }
): {
  state: AdventureState;
  newlyDiscovered: WildCreature[];
} {
  const updated = cloneAdventureState(state);
  updated.world.playerCoords = newCoords;
  if (newGeo) {
    updated.world.playerGeo = newGeo;
  }
  updated.player.totalDistanceKm += distMeters / 1000;
  updated.buddy.totalKmWalked += distMeters / 1000;

  const newlyDiscovered: WildCreature[] = [];
  const playerLat = updated.world.playerGeo?.lat || DRESDEN_PARK_GEO.lat;
  const playerLng = updated.world.playerGeo?.lng || DRESDEN_PARK_GEO.lng;

  // Recalculate distances and evaluate 45m discovery radius
  updated.wildCreatures = updated.wildCreatures.map((c) => {
    let dist = c.distanceMeters;
    if (c.lat && c.lng) {
      dist = haversineMeters(playerLat, playerLng, c.lat, c.lng);
    } else {
      const dx = c.xPct - newCoords.xPct;
      const dy = c.yPct - newCoords.yPct;
      dist = Math.round(Math.hypot(dx, dy) * 10);
    }

    const wasDiscovered = !!c.isDiscovered;
    const isNowDiscovered = dist <= RADAR_DISCOVERY_RADIUS_METERS || wasDiscovered;

    if (!wasDiscovered && isNowDiscovered) {
      newlyDiscovered.push({ ...c, distanceMeters: dist, isDiscovered: true, discoveryTimestamp: Date.now() });
    }

    return {
      ...c,
      distanceMeters: dist,
      isDiscovered: isNowDiscovered,
      discoveryTimestamp: isNowDiscovered ? (c.discoveryTimestamp || Date.now()) : undefined,
    };
  });

  // Free-roam: if every wild is far away, seed a fresh cluster around the player
  const nearest = updated.wildCreatures.reduce(
    (min, c) => Math.min(min, c.distanceMeters ?? 9999),
    9999
  );
  if (updated.wildCreatures.length === 0 || nearest > 220) {
    const eraId = updated.world.activeEraId;
    const fresh = generateEraSpawns(eraId, 10, Date.now(), {
      lat: playerLat,
      lng: playerLng,
    });
    const keep = updated.wildCreatures
      .filter((c) => (c.distanceMeters ?? 9999) <= 180)
      .slice(0, 3);
    updated.wildCreatures = [...keep, ...fresh].slice(0, 14);
  }

  const poiDist = (p: { xPct: number; yPct: number; lat?: number; lng?: number }) => {
    if (typeof p.lat === "number" && typeof p.lng === "number") {
      return haversineMeters(playerLat, playerLng, p.lat, p.lng);
    }
    const dx = p.xPct - newCoords.xPct;
    const dy = p.yPct - newCoords.yPct;
    return Math.round(Math.hypot(dx, dy) * 10);
  };

  updated.discoveryPoints = updated.discoveryPoints.map((p) => ({
    ...p,
    distanceMeters: poiDist(p),
  }));

  updated.cardCaches = updated.cardCaches.map((cc) => ({
    ...cc,
    distanceMeters: poiDist(cc),
  }));

  updated.battleArenas = updated.battleArenas.map((a) => ({
    ...a,
    distanceMeters: poiDist(a),
  }));

  // Update Walk 1km Quest progress
  updated.quests.forEach((q) => {
    if (q.id === "quest-walk-1km" && !q.completed) {
      q.currentProgress = Math.min(
        q.targetProgress,
        +(q.currentProgress + distMeters / 1000).toFixed(2)
      );
      if (q.currentProgress >= q.targetProgress) q.completed = true;
    }
  });

  saveAdventureState(updated);
  return { state: updated, newlyDiscovered };
}
