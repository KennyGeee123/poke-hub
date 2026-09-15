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
});
