import { describe, expect, it, beforeEach } from "bun:test";
import {
  getDefaultAdventureState,
  addAdventureXp,
  modifyCoins,
  modifyEnergy,
  convertRareCandyToSpecies,
  canEvolveCreature,
  executeEvolution,
  attemptCapture,
  spinDiscoveryPoint,
  claimCardCache,
  claimQuest,
  EVOLUTION_STONES,
  CAPTURE_ITEMS,
  getEraRotationStatus,
  isInsidePark,
  generateEraSpawns,
  forceSwitchEra,
  cloneAdventureState,
} from "./adventure-engine";

describe("Adventure Living World Engine & Economy", () => {
  let state = getDefaultAdventureState();

  beforeEach(() => {
    state = getDefaultAdventureState();
  });

  it("initializes with default trainer profile, buddy, and 10 evolution stones", () => {
    expect(state.player.level).toBe(18);
    expect(state.inventory.coins).toBe(850);
    expect(state.inventory.energy).toBe(92);
    expect(state.inventory.rareCandy).toBe(6);
    expect(state.buddy.species).toBe("Pikachu");

    // All 10 canonical evolution stones exist
    expect(Object.keys(EVOLUTION_STONES).length).toBe(10);
    expect(EVOLUTION_STONES.fire_stone.name).toBe("Fire Stone");
    expect(EVOLUTION_STONES.water_stone.name).toBe("Water Stone");
    expect(EVOLUTION_STONES.thunder_stone.name).toBe("Thunder Stone");
    expect(EVOLUTION_STONES.leaf_stone.name).toBe("Leaf Stone");
    expect(EVOLUTION_STONES.moon_stone.name).toBe("Moon Stone");
    expect(EVOLUTION_STONES.sun_stone.name).toBe("Sun Stone");
    expect(EVOLUTION_STONES.shiny_stone.name).toBe("Shiny Stone");
    expect(EVOLUTION_STONES.dusk_stone.name).toBe("Dusk Stone");
    expect(EVOLUTION_STONES.dawn_stone.name).toBe("Dawn Stone");
    expect(EVOLUTION_STONES.ice_stone.name).toBe("Ice Stone");
  });

  it("handles XP advancement, level up rewards, and energy replenishment", () => {
    const startLevel = state.player.level;
    const { state: updated, leveledUp, newLevel } = addAdventureXp(state, 50000);

    expect(leveledUp).toBe(true);
    expect(newLevel).toBeGreaterThan(startLevel);
    expect(updated.inventory.rareCandy).toBeGreaterThan(state.inventory.rareCandy);
    expect(updated.inventory.energy).toBe(updated.inventory.maxEnergy);
  });

  it("manages Coin transactions and Energy clamping", () => {
    const richer = modifyCoins(state, 500);
    expect(richer.inventory.coins).toBe(1350);

    const poorer = modifyCoins(richer, -2000);
    expect(poorer.inventory.coins).toBe(0); // Clamped at 0

    const energyBoost = modifyEnergy(state, 50);
    expect(energyBoost.inventory.energy).toBe(100); // Clamped at maxEnergy
  });

  it("converts universal Rare Candy into species-specific candy", () => {
    const eeveeCandiesBefore = state.inventory.speciesCandies["Eevee"] || 0;
    const rareBefore = state.inventory.rareCandy;

    const res = convertRareCandyToSpecies(state, "Eevee", 3);
    expect(res.success).toBe(true);
    expect(res.state.inventory.speciesCandies["Eevee"]).toBe(eeveeCandiesBefore + 3);
    expect(res.state.inventory.rareCandy).toBe(rareBefore - 3);

    // Fails on insufficient rare candy
    const failRes = convertRareCandyToSpecies(res.state, "Eevee", 999);
    expect(failRes.success).toBe(false);
  });

  it("correctly identifies evolution eligibility across the 10 stones", () => {
    // Eevee + Fire Stone -> Flareon
    const fireCheck = canEvolveCreature(state, "Eevee", "fire_stone");
    expect(fireCheck.eligible).toBe(true);
    expect(fireCheck.targetSpecies).toBe("Flareon");

    // Eevee + Water Stone -> Vaporeon
    const waterCheck = canEvolveCreature(state, "Eevee", "water_stone");
    expect(waterCheck.eligible).toBe(true);
    expect(waterCheck.targetSpecies).toBe("Vaporeon");

    // Pikachu + Thunder Stone -> Raichu
    const thunderCheck = canEvolveCreature(state, "Pikachu", "thunder_stone");
    expect(thunderCheck.eligible).toBe(true);
    expect(thunderCheck.targetSpecies).toBe("Raichu");

    // Pikachu + Fire Stone (Ineligible)
    const badCheck = canEvolveCreature(state, "Pikachu", "fire_stone");
    expect(badCheck.eligible).toBe(false);
    expect(badCheck.missingReason).toContain("cannot evolve using a Fire Stone");
  });

  it("executes evolution, consumes stone & candy, awards XP and advances quests", () => {
    const stonesBefore = state.inventory.stones.fire_stone;
    const res = executeEvolution(state, "Eevee", "fire_stone");

    expect(res.success).toBe(true);
    expect(res.evolvedTo).toBe("Flareon");
    expect(res.state.inventory.stones.fire_stone).toBe(stonesBefore - 1);
    expect(res.state.player.evolutionsCompleted).toBe(state.player.evolutionsCompleted + 1);

    // Quest "quest-stone-evolve" should now be completed
    const evoQuest = res.state.quests.find((q) => q.id === "quest-stone-evolve");
    expect(evoQuest?.completed).toBe(true);
  });

  it("executes wild encounter captures and distributes candy & XP", () => {
    const creature = state.wildCreatures[0];
    const initialBalls = state.inventory.captureItems.poke_ball;

    // Use Master Ball for guaranteed catch
    const res = attemptCapture(state, creature.id, "master_ball");
    expect(res.success).toBe(true);
    expect(res.rewards).toBeDefined();
    expect(res.rewards?.candies).toBeGreaterThan(0);
    expect(res.state.player.creaturesCaught).toBe(state.player.creaturesCaught + 1);
  });

  it("spins Discovery Points, grants bubble loot, and sets 5-minute cooldown", () => {
    const point = state.discoveryPoints[0];
    const res = spinDiscoveryPoint(state, point.id);

    expect(res.success).toBe(true);
    expect(res.loot?.coins).toBeGreaterThan(0);
    expect(res.loot?.xp).toBe(50);
    expect(res.loot?.ballsAwarded).toBe(3);

    // Immediate second spin fails due to cooldown
    const secondSpin = spinDiscoveryPoint(res.state, point.id);
    expect(secondSpin.success).toBe(false);
    expect(secondSpin.cooldownRemainingSec).toBeGreaterThan(0);
  });

  it("claims Card Caches and integrates with the TCG Vault", () => {
    const cache = state.cardCaches[0];
    const res = claimCardCache(state, cache.id);

    expect(res.success).toBe(true);
    expect(res.cache?.claimed).toBe(true);
    expect(res.state.inventory.cardCachesDiscovered).toBe(state.inventory.cardCachesDiscovered + 1);
    expect(res.state.inventory.coins).toBe(state.inventory.coins + 100);
  });

  it("claims completed research quests and disburses rewards", () => {
    // Manually mark quest complete
    const modified = { ...state };
    modified.quests[0].completed = true;

    const res = claimQuest(modified, modified.quests[0].id);
    expect(res.success).toBe(true);
    expect(res.rewards?.coins).toBe(modified.quests[0].rewardCoins);
    expect(res.state.player.questsCompleted).toBe(state.player.questsCompleted + 1);
  });
  it("rotates Pokémon eras on a deterministic 30-minute cycle", () => {
    const epoch0 = 0;
    const stat0 = getEraRotationStatus(epoch0);
    expect(stat0.activeEraId).toBe("vintage_kanto");
    expect(stat0.nextEraId).toBe("neo_johto");

    // 30 minutes later (1800000 ms)
    const epoch30m = 30 * 60 * 1000;
    const stat30m = getEraRotationStatus(epoch30m);
    expect(stat30m.activeEraId).toBe("neo_johto");
    expect(stat30m.nextEraId).toBe("advanced_hoenn");

    // 60 minutes later
    const epoch60m = 60 * 60 * 1000;
    const stat60m = getEraRotationStatus(epoch60m);
    expect(stat60m.activeEraId).toBe("advanced_hoenn");
  });

  it("detects Dresden Park Nature Reserve boundaries and nest zones", () => {
    // Inside Dresden Park (center is x:31, y:48, bounds 16-46, 34-62)
    expect(isInsidePark(31, 48)).toBe(true);
    expect(isInsidePark(20, 40)).toBe(true);

    // Outside Dresden Park
    expect(isInsidePark(5, 5)).toBe(false);
    expect(isInsidePark(80, 80)).toBe(false);
  });

  it("generates era-specific wild spawns with guaranteed Dresden Park nest encounters", () => {
    const hoennSpawns = generateEraSpawns("advanced_hoenn", 7, 1000);
    expect(hoennSpawns.length).toBe(7);

    // Check that at least some are park nest spawns
    const parkSpawns = hoennSpawns.filter((s) => s.isParkNest);
    expect(parkSpawns.length).toBeGreaterThanOrEqual(2);
    expect(parkSpawns[0].parkName).toBe("Dresden Park");
    expect(["rare", "epic", "legendary"]).toContain(parkSpawns[0].rarity);

    // All spawns should be from Advanced Hoenn
    expect(hoennSpawns.every((s) => s.eraId === "advanced_hoenn")).toBe(true);
  });

  it("awards 50% bonus candies and boosted rewards for Dresden Park nest catches", () => {
    const parkCreature = {
      id: "test-nest-rayquaza",
      species: "Rayquaza",
      cp: 2980,
      level: 45,
      types: ["Dragon", "Flying"],
      rarity: "legendary" as const,
      xPct: 31,
      yPct: 48,
      distanceMeters: 20,
      weatherBoosted: false,
      spawnTimestamp: Date.now(),
      despawnTimestamp: Date.now() + 1800000,
      baseCatchRate: 1.0,
      relatedCardsCount: 15,
      isParkNest: true,
      parkName: "Dresden Park",
    };

    const testState = cloneAdventureState(state);
    testState.wildCreatures.push(parkCreature);

    const res = attemptCapture(testState, parkCreature.id, "master_ball");
    expect(res.success).toBe(true);
    expect(res.rewards?.candies).toBeGreaterThanOrEqual(4);
    expect(res.rewards?.rareCandyChance).toBe(true);
  });

  it("supports force switching eras and updating wild fauna", () => {
    const switched = forceSwitchEra(state, "modern_paldea");
    expect(switched.state.world.activeEraId).toBe("modern_paldea");
    expect(switched.activeEra.id).toBe("modern_paldea");
    expect(switched.state.wildCreatures.some((c) => c.eraId === "modern_paldea")).toBe(true);
  });

  it("does not dump Dresden Park nests onto a foreign region walk plane", () => {
    const kanto = generateEraSpawns(
      "vintage_kanto",
      14,
      1000,
      { lat: 35.68, lng: 139.76 },
      {
        includeParkNest: false,
        localOrigin: { xPct: 50, yPct: 50 },
      },
    );
    expect(kanto.some((s) => s.isParkNest)).toBe(false);
    expect(kanto.every((s) => s.eraId === "vintage_kanto")).toBe(true);
  });

  it("keeps unique gen pools for Unova/Kalos/Alola/Galar instead of Paldea", async () => {
    const { getPokemonByGen } = await import("./all-pokemon-data");
    const unova = generateEraSpawns(
      "black_unova",
      8,
      2000,
      { lat: 40.71, lng: -74 },
      { includeParkNest: false },
    );
    const kalos = generateEraSpawns(
      "mega_kalos",
      8,
      2000,
      { lat: 48.86, lng: 2.35 },
      { includeParkNest: false },
    );
    const alola = generateEraSpawns(
      "sun_alola",
      8,
      2000,
      { lat: 21.3, lng: -157.85 },
      { includeParkNest: false },
    );
    const galar = generateEraSpawns(
      "sword_galar",
      8,
      2000,
      { lat: 51.5, lng: -0.12 },
      { includeParkNest: false },
    );
    const paldea = generateEraSpawns(
      "modern_paldea",
      8,
      2000,
      { lat: 40.4, lng: -3.7 },
      { includeParkNest: false },
    );

    const ids = (spawns: typeof unova) =>
      new Set(spawns.map((s) => s.nationalDexId).filter(Boolean) as number[]);
    const genOf = (id: number) => {
      if (id <= 151) return 1;
      if (id <= 251) return 2;
      if (id <= 386) return 3;
      if (id <= 493) return 4;
      if (id <= 649) return 5;
      if (id <= 721) return 6;
      if (id <= 809) return 7;
      if (id <= 905) return 8;
      return 9;
    };

    expect(getPokemonByGen(5).length).toBe(156);
    expect([...ids(unova)].every((id) => genOf(id) === 5)).toBe(true);
    expect([...ids(kalos)].every((id) => genOf(id) === 6)).toBe(true);
    expect([...ids(alola)].every((id) => genOf(id) === 7)).toBe(true);
    expect([...ids(galar)].every((id) => genOf(id) === 8)).toBe(true);
    expect([...ids(paldea)].every((id) => genOf(id) === 9)).toBe(true);
  });
});

describe("National Pokédex Registry (All 1,025 Pokémon) & 45m Discovery Engine", () => {
  it("contains all 1,025 National Pokédex entries across Gen 1 to Gen 9", async () => {
    const { ALL_POKEMON, getPokemonById, getPokemonByGen } = await import("./all-pokemon-data");
    expect(ALL_POKEMON.length).toBe(1025);

    // First and last
    const first = getPokemonById(1);
    const mew = getPokemonById(151);
    const last = getPokemonById(1025);

    expect(first?.name).toBe("Bulbasaur");
    expect(first?.types).toContain("Grass");
    expect(mew?.name).toBe("Mew");
    expect(mew?.types).toContain("Psychic");
    expect(last?.name).toBe("Pecharunt");
    expect(last?.types).toContain("Poison");

    // All generations have valid counts
    expect(getPokemonByGen(1).length).toBe(151);
    expect(getPokemonByGen(2).length).toBe(100);
    expect(getPokemonByGen(3).length).toBe(135);
    expect(getPokemonByGen(4).length).toBe(107);
    expect(getPokemonByGen(5).length).toBe(156);
    expect(getPokemonByGen(6).length).toBe(72);
    expect(getPokemonByGen(7).length).toBe(88);
    expect(getPokemonByGen(8).length).toBe(96);
    expect(getPokemonByGen(9).length).toBe(120);

    // Verify all 1025 have positive CP and valid stats
    for (const p of ALL_POKEMON) {
      expect(p.id).toBeGreaterThanOrEqual(1);
      expect(p.id).toBeLessThanOrEqual(1025);
      expect(p.types.length).toBeGreaterThanOrEqual(1);
      expect(p.baseCp).toBeGreaterThan(0);
      expect(p.baseStats.hp).toBeGreaterThan(0);
    }
  });

  it("calculates accurate real-world geographic distances via Haversine formula", async () => {
    const { haversineMeters, geoOffsetFromMeters, DRESDEN_PARK_GEO } =
      await import("./adventure-engine");

    // Same point should be 0 meters
    const zeroDist = haversineMeters(
      DRESDEN_PARK_GEO.lat,
      DRESDEN_PARK_GEO.lng,
      DRESDEN_PARK_GEO.lat,
      DRESDEN_PARK_GEO.lng,
    );
    expect(zeroDist).toBe(0);

    // Offset 50 meters North
    const offsetPoint = geoOffsetFromMeters(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, 0, 50);
    const measuredDist = haversineMeters(
      DRESDEN_PARK_GEO.lat,
      DRESDEN_PARK_GEO.lng,
      offsetPoint.lat,
      offsetPoint.lng,
    );
    expect(Math.abs(measuredDist - 50)).toBeLessThanOrEqual(2);
  });

  it("strictly enforces 45m discovery radius for wild Pokémon hidden spawns", async () => {
    const {
      getDefaultAdventureState,
      updatePlayerLocation,
      RADAR_DISCOVERY_RADIUS_METERS,
      DRESDEN_PARK_GEO,
      geoOffsetFromMeters,
    } = await import("./adventure-engine");

    const state = getDefaultAdventureState();

    // Spawn 1: 150 meters away (Far - should be hidden)
    const farGeo = geoOffsetFromMeters(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, 100, 100);
    // Spawn 2: 30 meters away (Close - should be discovered)
    const closeGeo = geoOffsetFromMeters(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, 20, 20);

    state.wildCreatures = [
      {
        id: "test-far",
        species: "Dragonite",
        nationalDexId: 149,
        cp: 2800,
        level: 35,
        types: ["Dragon", "Flying"],
        rarity: "rare",
        xPct: 75,
        yPct: 75,
        lat: farGeo.lat,
        lng: farGeo.lng,
        distanceMeters: 140,
        isDiscovered: false,
        weatherBoosted: false,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.2,
        relatedCardsCount: 8,
      },
      {
        id: "test-close",
        species: "Pikachu",
        nationalDexId: 25,
        cp: 650,
        level: 18,
        types: ["Electric"],
        rarity: "uncommon",
        xPct: 52,
        yPct: 52,
        lat: closeGeo.lat,
        lng: closeGeo.lng,
        distanceMeters: 28,
        isDiscovered: false,
        weatherBoosted: false,
        spawnTimestamp: Date.now(),
        despawnTimestamp: Date.now() + 1800000,
        baseCatchRate: 0.5,
        relatedCardsCount: 12,
      },
    ];

    // Player is at Dresden Park center
    const result = updatePlayerLocation(state, { xPct: 50, yPct: 50 }, 10, {
      lat: DRESDEN_PARK_GEO.lat,
      lng: DRESDEN_PARK_GEO.lng,
    });

    const farCreature = result.state.wildCreatures.find((c) => c.id === "test-far");
    const closeCreature = result.state.wildCreatures.find((c) => c.id === "test-close");

    // Distant creature must remain hidden
    expect(farCreature?.distanceMeters).toBeGreaterThan(RADAR_DISCOVERY_RADIUS_METERS);
    expect(farCreature?.isDiscovered).toBe(false);

    // Nearby creature must be discovered and returned in newlyDiscovered
    expect(closeCreature?.distanceMeters).toBeLessThanOrEqual(RADAR_DISCOVERY_RADIUS_METERS);
    expect(closeCreature?.isDiscovered).toBe(true);
    expect(result.newlyDiscovered.some((c) => c.id === "test-close")).toBe(true);
  });
});

describe("GO walk camera — geo projection + POI pins", () => {
  it("projects a north target above the player in screen pixels", async () => {
    const { geoScreenOffset, pinWorldPoisToGeo, getDefaultAdventureState, DRESDEN_PARK_GEO } =
      await import("./adventure-engine");
    const north = { lat: DRESDEN_PARK_GEO.lat + 0.001, lng: DRESDEN_PARK_GEO.lng };
    const off = geoScreenOffset(DRESDEN_PARK_GEO, north, 17);
    expect(off.dy).toBeLessThan(0);
    expect(Math.abs(off.dx)).toBeLessThan(Math.abs(off.dy) + 2);

    const pinned = pinWorldPoisToGeo(getDefaultAdventureState(), DRESDEN_PARK_GEO);
    expect(pinned.battleArenas[0].lat).toBeDefined();
    expect(pinned.discoveryPoints[0].lng).toBeDefined();
    expect(pinned.cardCaches[0].lat).toBeDefined();
    expect(pinned.battleArenas[0].distanceMeters).toBeGreaterThan(0);
  });
});

describe("God's Eye planet atlas", () => {
  it("projects player/nodes from lat/lng and gives Unova/Kalos/Alola/Galar unique eras", async () => {
    const { GODS_EYE_NODES, latLngToAtlasPct } = await import("./gods-eye-world");
    const tokyo = latLngToAtlasPct(35.68, 139.76);
    const nyc = latLngToAtlasPct(40.71, -74.0);
    expect(tokyo.x).toBeGreaterThan(nyc.x);
    expect(tokyo.y).toBeGreaterThan(4);

    const byId = Object.fromEntries(GODS_EYE_NODES.map((n) => [n.id, n]));
    expect(byId.unova.eraId).toBe("black_unova");
    expect(byId.kalos.eraId).toBe("mega_kalos");
    expect(byId.alola.eraId).toBe("sun_alola");
    expect(byId.galar.eraId).toBe("sword_galar");
    expect(byId.paldea.eraId).toBe("modern_paldea");
    expect(byId.dresden.kind).toBe("nest");
    expect(byId.dresden.lat).toBeCloseTo(33.8824, 3);
  });

  it("uses GBA walk skin for franchise regions and GO skin for real hubs", async () => {
    const { GODS_EYE_NODES, walkSkinForNode, gbaCellKind } = await import("./gods-eye-world");
    const byId = Object.fromEntries(GODS_EYE_NODES.map((n) => [n.id, n]));
    expect(walkSkinForNode(byId.kanto)).toBe("gba");
    expect(walkSkinForNode(byId.galar)).toBe("gba");
    expect(walkSkinForNode(byId.dresden)).toBe("go");
    expect(walkSkinForNode(byId["central-park"])).toBe("go");
    expect(gbaCellKind(0, 0)).toMatch(/grass|path|water|tree|dirt/);
  });
});

describe("Adventure visuals — on-disk trainer + local sprites first", () => {
  it("picks 4-dir trainer assets and prefers vendored gen5 sprites", async () => {
    const { trainerFacingUrl, fallbackSpriteUrls } = await import("./sprites");
    expect(trainerFacingUrl(0)).toBe("/adventure-assets/trainer-up.png");
    expect(trainerFacingUrl(90)).toBe("/adventure-assets/trainer-right.png");
    expect(trainerFacingUrl(180)).toBe("/adventure-assets/trainer-down.png");
    expect(trainerFacingUrl(270)).toBe("/adventure-assets/trainer-left.png");
    expect(fallbackSpriteUrls("Pikachu")[0]).toBe("/sprites/gen5/pikachu.png");
    expect(fallbackSpriteUrls("Pecharunt")[0]).toContain("pokemondb.net");
  });
});
