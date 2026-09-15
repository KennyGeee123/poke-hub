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

export interface WildCreature {
  id: string;
  species: string;
  cp: number;
  level: number;
  types: string[];
  rarity: CreatureRarity;
  xPct: number;
  yPct: number;
  distanceMeters: number;
  weatherBoosted: boolean;
  spawnTimestamp: number;
  despawnTimestamp: number;
  baseCatchRate: number;
  relatedCardsCount: number;
}

export interface DiscoveryPoint {
  id: string;
  title: string;
  subtitle: string;
  xPct: number;
  yPct: number;
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
  return {
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
}

export function loadAdventureState(): AdventureState {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
  }
  const mem = memoryFallback.get(STORAGE_KEY);
  if (mem) return mem;

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

    const candyAmount = (doubleCandy ? 6 : 3) * (updated.world.eventMultiplier || 1.0);
    updated.inventory.speciesCandies[creature.species] =
      (updated.inventory.speciesCandies[creature.species] || 0) + candyAmount;

    const gotRareCandy =
      creature.rarity === "legendary" || (creature.rarity === "epic" && Math.random() < 0.4);
    if (gotRareCandy) {
      updated.inventory.rareCandy += 1;
    }

    const xpGain = creature.rarity === "legendary" ? 1000 : creature.rarity === "epic" ? 500 : 150;
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
