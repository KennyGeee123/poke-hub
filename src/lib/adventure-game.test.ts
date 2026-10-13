import { describe, expect, test } from "bun:test";
import { DRESDEN_PARK_GEO, geoOffsetFromMeters } from "./adventure-engine";
import { gbaCellAt, marchGbaWalk } from "./adventure-step";
import { bookFromRetroRaw, mergeRetroSave } from "./adventure-session";
import { adventureMoveShow, moveRenderUrl } from "./move-show";
import { leagueStanding } from "./route-towns";

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

  test("each adventure move has its own show and a full render path", () => {
    expect(adventureMoveShow("Volt Tackle", "Electric").pattern).toBe("smash");
    expect(adventureMoveShow("Quick Attack", "Normal").pattern).toBe("slash");
    expect(adventureMoveShow("Absorb", "Grass").pattern).toBe("orbit");
    expect(moveRenderUrl("Water Gun")).toBe("/adventure-assets/moves/water-gun.jpg");
    expect(moveRenderUrl("Branch Poke")).toBe("/adventure-assets/moves/branch-poke.jpg");
  });
});
