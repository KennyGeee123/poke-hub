import {
  geoOffsetFromMeters,
  latLngToWorldPixels,
  metersPerPixel,
} from "@/lib/adventure-engine";
import { gbaCellKind, type GbaCell } from "@/lib/gods-eye-world";

export const GBA_CELL_PX = 64;
/** Tall-grass step, matching the retro grass tile rate. */
export const TALL_GRASS_RATE = 0.16;

export type WalkCell = { tx: number; ty: number; kind: GbaCell };

export type WildEncounter = { species: string; type: string; level: number };

const ERA_WILDS: Record<string, Array<{ species: string; type: string }>> = {
  vintage_kanto: [
    { species: "Pidgey", type: "Flying" },
    { species: "Rattata", type: "Normal" },
    { species: "Caterpie", type: "Bug" },
  ],
  neo_johto: [
    { species: "Sentret", type: "Normal" },
    { species: "Hoothoot", type: "Flying" },
    { species: "Pidgey", type: "Flying" },
  ],
  advanced_hoenn: [
    { species: "Zigzagoon", type: "Normal" },
    { species: "Poochyena", type: "Dark" },
    { species: "Wurmple", type: "Bug" },
  ],
  diamond_sinnoh: [
    { species: "Starly", type: "Flying" },
    { species: "Bidoof", type: "Normal" },
    { species: "Kricketot", type: "Bug" },
  ],
  black_unova: [
    { species: "Patrat", type: "Normal" },
    { species: "Lillipup", type: "Normal" },
    { species: "Pidove", type: "Flying" },
  ],
  mega_kalos: [
    { species: "Bunnelby", type: "Normal" },
    { species: "Fletchling", type: "Flying" },
    { species: "Scatterbug", type: "Bug" },
  ],
  sun_alola: [
    { species: "Pikipek", type: "Flying" },
    { species: "Yungoos", type: "Normal" },
    { species: "Grubbin", type: "Bug" },
  ],
  sword_galar: [
    { species: "Skwovet", type: "Normal" },
    { species: "Rookidee", type: "Flying" },
    { species: "Blipbug", type: "Bug" },
  ],
  modern_paldea: [
    { species: "Lechonk", type: "Normal" },
    { species: "Fletchling", type: "Flying" },
    { species: "Tarountula", type: "Bug" },
  ],
};

export function gbaCellAt(lat: number, lng: number, zoom: number, cellPx = GBA_CELL_PX): WalkCell {
  const world = latLngToWorldPixels(lat, lng, zoom);
  const tx = Math.floor(world.x / cellPx);
  const ty = Math.floor(world.y / cellPx);
  return { tx, ty, kind: gbaCellKind(tx, ty) };
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

function rollEncounter(
  eraId: string,
  rng: () => number,
): WildEncounter | null {
  if (rng() >= TALL_GRASS_RATE) return null;
  const pool = ERA_WILDS[eraId] || ERA_WILDS.vintage_kanto;
  const pick = pool[Math.floor(rng() * pool.length) % pool.length];
  const level = 3 + Math.floor(rng() * 4);
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
 * Walk the GBA route. Water blocks. Tall grass (the "tree" cell, tex-tallgrass)
 * can start a wild fight only when the trainer enters that cell. Path, field, and sand do not.
 * A blocked diagonal slides along the open axis.
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
    if (entered && cell.kind === "tree" && !encounter) {
      encounter = rollEncounter(eraId, rng);
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
