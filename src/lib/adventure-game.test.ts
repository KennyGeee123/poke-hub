import { describe, expect, test } from "bun:test";
import { DRESDEN_PARK_GEO, geoOffsetFromMeters } from "./adventure-engine";
import { dryRouteStart, encounterPool, encounterRateFor, gbaCellAt, marchGbaWalk, rollWild } from "./adventure-step";
import { bookFromRetroRaw, mergeRetroSave } from "./adventure-session";
import {
  ADVENTURE_MOVE_SHOW,
  MOVE_USERS,
  PATTERN_STAGE,
  adventureMoveShow,
  moveRenderUrl,
  moveStage,
  moveUsers,
} from "./move-show";
import { leagueStanding, routeStopsForEra, startersForEra } from "./route-towns";

describe("one adventure session", () => {
  test("water blocks and tall grass can start a fight", () => {
    const zoom = 16;
    const samples: Array<{ lat: number; lng: number; kind: string }> = [];
    for (let y = -600; y <= 600; y += 70) {
      for (let x = -600; x <= 600; x += 70) {
        const g = geoOffsetFromMeters(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, x, y);
        const cell = gbaCellAt(g.lat, g.lng, zoom);
        samples.push({ lat: g.lat, lng: g.lng, kind: cell.kind });
      }
    }
    const dry = samples.find((s) => s.kind !== "water");
    const water = samples.find((s) => s.kind === "water");
    const grass = samples.find((s) => s.kind === "tree");
    expect(dry && water && grass).toBeTruthy();
    if (!dry || !water || !grass) return;

    const intoWater = marchGbaWalk({
      lat: dry.lat,
      lng: dry.lng,
      metersX: (water.lng - dry.lng) * 111320 * Math.cos((dry.lat * Math.PI) / 180),
      metersY: (water.lat - dry.lat) * 111320,
      zoom,
      rng: () => 0,
    });
    expect(intoWater.cell.kind).not.toBe("water");

    const intoGrass = marchGbaWalk({
      lat: dry.lat,
      lng: dry.lng,
      metersX: (grass.lng - dry.lng) * 111320 * Math.cos((dry.lat * Math.PI) / 180),
      metersY: (grass.lat - dry.lat) * 111320,
      zoom,
      eraId: "vintage_kanto",
      rng: () => 0,
    });
    if (intoGrass.cell.kind === "tree") {
      expect(intoGrass.encounter?.species).toBe("Pidgey");
    }

    const quiet = marchGbaWalk({
      lat: grass.lat,
      lng: grass.lng,
      metersX: 1,
      metersY: 0,
      zoom,
      rng: () => 0.9,
    });
    expect(quiet.encounter).toBeNull();
  });

  test("the retro save keeps the same badge book", () => {
    const raw = JSON.stringify({ x: 12, y: 8, badges: ["Zephyr"], worldVersion: 2 });
    const next = mergeRetroSave(raw, { vintage_kanto: ["kanto-pewter", "kanto-home"] });
    const parsed = JSON.parse(next);
    expect(parsed.x).toBe(12);
    expect(parsed.badges).toContain("Boulder");
    expect(parsed.badges).toContain("Zephyr");
    expect(parsed.routeBadges.vintage_kanto).toEqual(["kanto-pewter"]);
    expect(bookFromRetroRaw(next).vintage_kanto).toEqual(["kanto-pewter"]);
  });

  test("four badges open the league and the other gyms stay listed", () => {
    const shut = leagueStanding("vintage_kanto", {});
    expect(shut.open).toBe(false);
    expect(shut.need).toBe(4);
    const open = leagueStanding("vintage_kanto", {
      vintage_kanto: ["kanto-pewter", "kanto-cerulean", "kanto-vermilion", "kanto-celadon"],
    });
    expect(open.open).toBe(true);
    expect(open.species).toBe("Mewtwo");
    expect(open.name).toBe("Indigo League");
  });

  test("each era rolls more wild fights than the old 16 percent tall-grass step", () => {
    const eras = [
      "vintage_kanto",
      "neo_johto",
      "advanced_hoenn",
      "diamond_sinnoh",
      "black_unova",
      "mega_kalos",
      "sun_alola",
      "sword_galar",
      "modern_paldea",
    ];
    for (const era of eras) {
      const tall = encounterRateFor(era, "tree");
      const field = encounterRateFor(era, "grass");
      expect(tall).toBeGreaterThan(0.16);
      expect(tall).toBeLessThan(0.9);
      expect(field).toBeGreaterThan(0);
      expect(field).toBeLessThan(tall);
      expect(encounterRateFor(era, "path")).toBe(0);
      expect(encounterRateFor(era, "water")).toBe(0);
      expect(encounterPool(era)).toHaveLength(6);
    }
    expect(encounterRateFor("diamond_sinnoh", "tree")).toBeGreaterThan(encounterRateFor("vintage_kanto", "tree"));
    expect(encounterPool("vintage_kanto")[0]?.species).toBe("Pidgey");
    expect(encounterPool("diamond_sinnoh").map((mon) => mon.species)).toEqual([
      "Starly",
      "Bidoof",
      "Shinx",
      "Kricketot",
      "Budew",
      "Buizel",
    ]);
    expect(rollWild("vintage_kanto", "tree", () => 0)?.species).toBe("Pidgey");
    expect(rollWild("vintage_kanto", "tree", () => 0)?.level).toBe(3);
    expect(rollWild("vintage_kanto", "tree", () => 0.9)).toBeNull();
    expect(rollWild("diamond_sinnoh", "grass", () => 0)?.species).toBe("Starly");
    expect(rollWild("vintage_kanto", "path", () => 0)).toBeNull();
  });

  test("a river pin steps onto the path before tall grass can start a fight", () => {
    const dry = dryRouteStart(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, 16);
    expect(dry.cell.kind).not.toBe("water");
    expect(gbaCellAt(DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng, 16).kind).toBe("water");
    let lat = dry.lat;
    let lng = dry.lng;
    let fight = false;
    const step = 40;
    for (let i = 0; i < 12 && !fight; i++) {
      const east = marchGbaWalk({ lat, lng, metersX: step, metersY: 0, zoom: 16, eraId: "diamond_sinnoh", rng: () => 0 });
      lat = east.lat;
      lng = east.lng;
      if (east.encounter) fight = true;
    }
    for (let i = 0; i < 12 && !fight; i++) {
      const north = marchGbaWalk({ lat, lng, metersX: 0, metersY: step, zoom: 16, eraId: "diamond_sinnoh", rng: () => 0 });
      lat = north.lat;
      lng = north.lng;
      if (north.cell.kind === "tree" || north.cell.kind === "grass") {
        expect(north.encounter?.species).toBe("Starly");
        fight = true;
      }
    }
    expect(fight).toBe(true);
  });

  test("Sinnoh gyms follow the Platinum badge order", () => {
    const gyms = routeStopsForEra("diamond_sinnoh").filter((stop) => stop.leader);
    expect(gyms.map((stop) => stop.leader)).toEqual([
      "Roark",
      "Gardenia",
      "Fantina",
      "Maylene",
      "Crasher Wake",
      "Byron",
      "Candice",
      "Volkner",
    ]);
    expect(gyms.map((stop) => stop.level)).toEqual([16, 18, 20, 22, 24, 28, 30, 32]);
  });

  test("each adventure move has its own show and a full render path", () => {
    expect(adventureMoveShow("Volt Tackle", "Electric").pattern).toBe("smash");
    expect(adventureMoveShow("Quick Attack", "Normal").pattern).toBe("slash");
    expect(adventureMoveShow("Absorb", "Grass").pattern).toBe("orbit");
    expect(moveRenderUrl("Water Gun")).toBe("/adventure-assets/moves/water-gun.jpg");
    expect(moveRenderUrl("Branch Poke")).toBe("/adventure-assets/moves/branch-poke.jpg");
  });

  test("every adventure move travels or hits on a stage, and every partner move is on that list", () => {
    const names = Object.keys(ADVENTURE_MOVE_SHOW);
    expect(names).toHaveLength(17);
    expect(Object.keys(MOVE_USERS).sort()).toEqual([...names].sort());
    for (const name of names) {
      const show = ADVENTURE_MOVE_SHOW[name];
      expect(PATTERN_STAGE[show.pattern]).toBeTruthy();
      expect(moveStage(name, show.type)).toBe(PATTERN_STAGE[show.pattern]);
      expect(moveUsers(name).length).toBeGreaterThan(8);
    }
    expect(moveStage("Thunderbolt", "Electric")).toBe("bolt");
    expect(moveStage("Flamethrower", "Fire")).toBe("spiral");
    expect(moveStage("Water Gun", "Water")).toBe("wave");
    expect(moveStage("Vine Whip", "Grass")).toBe("slash");
    expect(moveStage("Tackle", "Normal")).toBe("column");
    expect(moveStage("Absorb", "Grass")).toBe("orbs");
    expect(moveStage("Leafage", "Grass")).toBe("swarm");
    expect(moveStage("Fire Blast", "Fire")).toBe("burst");
    const eras = [
      "vintage_kanto",
      "neo_johto",
      "advanced_hoenn",
      "diamond_sinnoh",
      "black_unova",
      "mega_kalos",
      "sun_alola",
      "sword_galar",
      "modern_paldea",
    ] as const;
    for (const era of eras) {
      for (const starter of startersForEra(era)) {
        expect(ADVENTURE_MOVE_SHOW[starter.move]).toBeTruthy();
        expect(moveUsers(starter.move)).toContain(starter.species);
      }
    }
  });
});
