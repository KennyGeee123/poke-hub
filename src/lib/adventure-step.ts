import {
  geoOffsetFromMeters,
  latLngToWorldPixels,
  metersPerPixel,
} from "@/lib/adventure-engine";
import { gbaCellKind, type GbaCell } from "@/lib/gods-eye-world";

export const GBA_CELL_PX = 64;
/** Floor for an unknown era. Kanto tall grass and every named era sit above the old 0.16 roll. */
export const TALL_GRASS_RATE = 0.22;

export type WalkCell = { tx: number; ty: number; kind: GbaCell };

export type WildEncounter = { species: string; type: string; level: number };

/** Tall-grass step rate for each era. Sinnoh is the thickest, matching a Platinum route. */
export const ERA_TALL_RATE: Record<string, number> = {
  vintage_kanto: 0.22,
  neo_johto: 0.24,
  advanced_hoenn: 0.26,
  diamond_sinnoh: 0.36,
  black_unova: 0.28,
  mega_kalos: 0.26,
  sun_alola: 0.28,
  sword_galar: 0.3,
  modern_paldea: 0.32,
};

/** Field grass is real encounters at 60% of that era's tall-grass rate. Path, sand, and water stay quiet. */
const FIELD_GRASS_SHARE = 0.6;

/** Level band [base, span]. rng 0 stays on the base so early Kanto is still level 3. */
const ERA_LEVEL: Record<string, [number, number]> = {
  vintage_kanto: [3, 5],
  neo_johto: [4, 5],
  advanced_hoenn: [5, 6],
  diamond_sinnoh: [4, 6],
  black_unova: [6, 6],
  mega_kalos: [6, 6],
  sun_alola: [7, 6],
  sword_galar: [8, 6],
  modern_paldea: [8, 7],
};

const ERA_WILDS: Record<string, Array<{ species: string; type: string }>> = {
  vintage_kanto: [
    { species: "Pidgey", type: "Flying" },
    { species: "Rattata", type: "Normal" },
    { species: "Caterpie", type: "Bug" },
    { species: "Oddish", type: "Grass" },
    { species: "Spearow", type: "Flying" },
    { species: "Weedle", type: "Bug" },
  ],
  neo_johto: [
    { species: "Sentret", type: "Normal" },
    { species: "Hoothoot", type: "Flying" },
    { species: "Pidgey", type: "Flying" },
    { species: "Ledyba", type: "Bug" },
    { species: "Hoppip", type: "Grass" },
    { species: "Spinarak", type: "Bug" },
  ],
  advanced_hoenn: [
    { species: "Zigzagoon", type: "Normal" },
    { species: "Poochyena", type: "Dark" },
    { species: "Wurmple", type: "Bug" },
    { species: "Taillow", type: "Flying" },
    { species: "Lotad", type: "Water" },
    { species: "Seedot", type: "Grass" },
  ],
  diamond_sinnoh: [
    { species: "Starly", type: "Flying" },
    { species: "Bidoof", type: "Normal" },
    { species: "Shinx", type: "Electric" },
    { species: "Kricketot", type: "Bug" },
    { species: "Budew", type: "Grass" },
    { species: "Buizel", type: "Water" },
  ],
  black_unova: [
    { species: "Patrat", type: "Normal" },
    { species: "Lillipup", type: "Normal" },
    { species: "Pidove", type: "Flying" },
    { species: "Purrloin", type: "Dark" },
    { species: "Sewaddle", type: "Bug" },
    { species: "Blitzle", type: "Electric" },
  ],
  mega_kalos: [
    { species: "Bunnelby", type: "Normal" },
    { species: "Fletchling", type: "Flying" },
    { species: "Scatterbug", type: "Bug" },
    { species: "Litleo", type: "Fire" },
    { species: "Flabebe", type: "Fairy" },
    { species: "Pancham", type: "Fighting" },
  ],
  sun_alola: [
    { species: "Pikipek", type: "Flying" },
    { species: "Yungoos", type: "Normal" },
    { species: "Grubbin", type: "Bug" },
    { species: "Cutiefly", type: "Bug" },
    { species: "Rockruff", type: "Rock" },
    { species: "Stufful", type: "Normal" },
  ],
  sword_galar: [
    { species: "Skwovet", type: "Normal" },
    { species: "Rookidee", type: "Flying" },
    { species: "Blipbug", type: "Bug" },
    { species: "Nickit", type: "Dark" },
    { species: "Wooloo", type: "Normal" },
    { species: "Chewtle", type: "Water" },
  ],
  modern_paldea: [
    { species: "Lechonk", type: "Normal" },
    { species: "Fletchling", type: "Flying" },
    { species: "Tarountula", type: "Bug" },
    { species: "Pawmi", type: "Electric" },
    { species: "Fidough", type: "Fairy" },
    { species: "Nymble", type: "Bug" },
  ],
};

export function encounterPool(eraId: string): Array<{ species: string; type: string }> {
  return ERA_WILDS[eraId] || ERA_WILDS.vintage_kanto;
}

/** Tall grass ("tree") uses the era rate. Open field ("grass") is 60% of that. Everything else is 0. */
export function encounterRateFor(eraId: string, kind: string): number {
  const tall = ERA_TALL_RATE[eraId] ?? TALL_GRASS_RATE;
  if (kind === "tree") return tall;
  if (kind === "grass") return Math.round(tall * FIELD_GRASS_SHARE * 1000) / 1000;
  return 0;
}

export function gbaCellAt(lat: number, lng: number, zoom: number, cellPx = GBA_CELL_PX): WalkCell {
  const world = latLngToWorldPixels(lat, lng, zoom);
  const tx = Math.floor(world.x / cellPx);
  const ty = Math.floor(world.y / cellPx);
  return { tx, ty, kind: gbaCellKind(tx, ty) };
}

/**
 * Dresden's pin sits in the river band. A GBA boot uses the nearest dry cell,
 * preferring the path, so the first step can reach grass.
 */
export function dryRouteStart(
  lat: number,
  lng: number,
  zoom: number,
  cellPx = GBA_CELL_PX,
): { lat: number; lng: number; cell: WalkCell } {
  const here = gbaCellAt(lat, lng, zoom, cellPx);
  if (here.kind !== "water") return { lat, lng, cell: here };
  const cellM = cellPx * metersPerPixel(lat, zoom);
  let dry: { lat: number; lng: number; cell: WalkCell } | null = null;
  for (let ring = 1; ring <= 6; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const next = geoOffsetFromMeters(lat, lng, dx * cellM, dy * cellM);
        const cell = gbaCellAt(next.lat, next.lng, zoom, cellPx);
        if (cell.kind === "water") continue;
        if (cell.kind === "path") return { lat: next.lat, lng: next.lng, cell };
        if (!dry) dry = { lat: next.lat, lng: next.lng, cell };
      }
    }
  }
  return dry || { lat, lng, cell: here };
}

function sameCell(a: WalkCell, b: WalkCell): boolean {
  return a.tx === b.tx && a.ty === b.ty;
}

function tryStep(
  lat: number,
  lng: number,
  dx: number,
  dy: number,
  zoom: number,
  cellPx: number,
): { lat: number; lng: number; cell: WalkCell } | null {
  if (dx === 0 && dy === 0) return null;
  const next = geoOffsetFromMeters(lat, lng, dx, dy);
  const cell = gbaCellAt(next.lat, next.lng, zoom, cellPx);
  if (cell.kind === "water") return null;
  return { lat: next.lat, lng: next.lng, cell };
}

export function rollWild(eraId: string, kind: string, rng: () => number): WildEncounter | null {
  const rate = encounterRateFor(eraId, kind);
  if (rate <= 0 || rng() >= rate) return null;
  const pool = encounterPool(eraId);
  const pick = pool[Math.floor(rng() * pool.length) % pool.length];
  const band = ERA_LEVEL[eraId] || [3, 4];
  const level = band[0] + Math.floor(rng() * band[1]);
  return { species: pick.species, type: pick.type, level };
}

export type MarchResult = {
  lat: number;
  lng: number;
  moved: boolean;
  blocked: boolean;
  meters: number;
  cell: WalkCell;
  encounter: WildEncounter | null;
};

/**
 * Walk the GBA route. Water blocks. Entering tall grass or open field rolls that era's
 * encounter rate. Path, sand, and water do not. A blocked diagonal slides along the open axis.
 */
export function marchGbaWalk(opts: {
  lat: number;
  lng: number;
  metersX: number;
  metersY: number;
  zoom: number;
  eraId?: string;
  rng?: () => number;
  cellPx?: number;
}): MarchResult {
  const zoom = opts.zoom;
  const cellPx = opts.cellPx ?? GBA_CELL_PX;
  const rng = opts.rng ?? Math.random;
  const eraId = opts.eraId || "vintage_kanto";
  const start = gbaCellAt(opts.lat, opts.lng, zoom, cellPx);
  const dist = Math.hypot(opts.metersX, opts.metersY);
  if (dist < 0.25) {
    return {
      lat: opts.lat,
      lng: opts.lng,
      moved: false,
      blocked: false,
      meters: 0,
      cell: start,
      encounter: null,
    };
  }

  const cellMeters = Math.max(8, cellPx * metersPerPixel(opts.lat, zoom) * 0.45);
  const steps = Math.max(1, Math.ceil(dist / cellMeters));
  const sx = opts.metersX / steps;
  const sy = opts.metersY / steps;

  let lat = opts.lat;
  let lng = opts.lng;
  let cell = start;
  let encounter: WildEncounter | null = null;
  let moved = false;

  for (let i = 0; i < steps; i++) {
    const landed = tryStep(lat, lng, sx, sy, zoom, cellPx)
      || tryStep(lat, lng, sx, 0, zoom, cellPx)
      || tryStep(lat, lng, 0, sy, zoom, cellPx);
    if (!landed) break;
    const entered = !sameCell(cell, landed.cell);
    lat = landed.lat;
    lng = landed.lng;
    cell = landed.cell;
    moved = true;
    if (entered && !encounter && (cell.kind === "tree" || cell.kind === "grass")) {
      encounter = rollWild(eraId, cell.kind, rng);
    }
  }

  const meters = Math.hypot(
    (lng - opts.lng) * 111320 * Math.cos((opts.lat * Math.PI) / 180),
    (lat - opts.lat) * 111320,
  );

  return {
    lat,
    lng,
    moved,
    blocked: !moved,
    meters: moved ? Math.max(1, meters) : 0,
    cell,
    encounter,
  };
}
