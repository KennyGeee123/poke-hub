/**
 * God's Eye — multi-region PokéVault world atlas.
 * Atlas positions are equirectangular lat/lng (0–100). Teleport loads a
 * region-local walk plane (xPct/yPct) plus that region's era spawn table.
 */
import type { PokemonEraId } from "@/lib/adventure-engine";

const DRESDEN_GEO = { lat: 33.8824, lng: -84.2811 };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
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

export type GodsEyeNode = {
  id: string;
  name: string;
  subtitle: string;
  /** Equirectangular atlas position (0–100), derived from lat/lng. */
  atlasX: number;
  atlasY: number;
  /** Drop the trainer here on the region-local walk plane. */
  xPct: number;
  yPct: number;
  lat: number;
  lng: number;
  eraId: PokemonEraId;
  kind: "region" | "nest" | "city" | "landmark";
  accent: string;
  spawnHint: string;
};

type GodsEyeNodeSeed = Omit<GodsEyeNode, "atlasX" | "atlasY">;

/** Equirectangular projection onto the 0–100 atlas plane. */
export function latLngToAtlasPct(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y)),
  };
}

function withAtlas(seed: GodsEyeNodeSeed): GodsEyeNode {
  const atlas = latLngToAtlasPct(seed.lat, seed.lng);
  return { ...seed, atlasX: atlas.x, atlasY: atlas.y };
}

/** Huge franchise + real-world hub network for teleport + walk/catch. */
const GODS_EYE_SEEDS: GodsEyeNodeSeed[] = [
  {
    id: "kanto",
    name: "Kanto",
    subtitle: "Gen 1 · Pewter–Indigo",
    xPct: 50,
    yPct: 50,
    lat: 35.68,
    lng: 139.76,
    eraId: "vintage_kanto",
    kind: "region",
    accent: "#ef4444",
    spawnHint: "Classic starters & birds",
  },
  {
    id: "johto",
    name: "Johto",
    subtitle: "Gen 2 · Violet–Olivine",
    xPct: 50,
    yPct: 50,
    lat: 35.01,
    lng: 135.77,
    eraId: "neo_johto",
    kind: "region",
    accent: "#f59e0b",
    spawnHint: "Togepi nests & bells",
  },
  {
    id: "hoenn",
    name: "Hoenn",
    subtitle: "Gen 3 · Littleroot seas",
    xPct: 50,
    yPct: 50,
    lat: 26.21,
    lng: 127.68,
    eraId: "advanced_hoenn",
    kind: "region",
    accent: "#22c55e",
    spawnHint: "Surf & weather legends",
  },
  {
    id: "sinnoh",
    name: "Sinnoh",
    subtitle: "Gen 4 · Snowpoint north",
    xPct: 50,
    yPct: 50,
    lat: 43.06,
    lng: 141.35,
    eraId: "diamond_sinnoh",
    kind: "region",
    accent: "#38bdf8",
    spawnHint: "Mountain & lake spirits",
  },
  {
    id: "unova",
    name: "Unova",
    subtitle: "Gen 5 · Castelia",
    xPct: 50,
    yPct: 50,
    lat: 40.71,
    lng: -74.0,
    eraId: "black_unova",
    kind: "region",
    accent: "#a78bfa",
    spawnHint: "Urban + desert routes",
  },
  {
    id: "kalos",
    name: "Kalos",
    subtitle: "Gen 6 · Lumiose",
    xPct: 50,
    yPct: 50,
    lat: 48.86,
    lng: 2.35,
    eraId: "mega_kalos",
    kind: "region",
    accent: "#f472b6",
    spawnHint: "Fairy & mega vibes",
  },
  {
    id: "alola",
    name: "Alola",
    subtitle: "Gen 7 · Melemele",
    xPct: 50,
    yPct: 50,
    lat: 21.3,
    lng: -157.85,
    eraId: "sun_alola",
    kind: "region",
    accent: "#fbbf24",
    spawnHint: "Island trial waters",
  },
  {
    id: "galar",
    name: "Galar",
    subtitle: "Gen 8 · Wyndon",
    xPct: 50,
    yPct: 50,
    lat: 51.5,
    lng: -0.12,
    eraId: "sword_galar",
    kind: "region",
    accent: "#fb7185",
    spawnHint: "Dynamax dens",
  },
  {
    id: "paldea",
    name: "Paldea",
    subtitle: "Gen 9 · Mesagoza",
    xPct: 50,
    yPct: 50,
    lat: 40.4,
    lng: -3.7,
    eraId: "modern_paldea",
    kind: "region",
    accent: "#34d399",
    spawnHint: "Open-world terastals",
  },
  {
    id: "dresden",
    name: "Dresden Park",
    subtitle: "Rare nest · Chamblee GA",
    xPct: 31,
    yPct: 48,
    lat: 33.8824,
    lng: -84.2811,
    eraId: "vintage_kanto",
    kind: "nest",
    accent: "#FFDE00",
    spawnHint: "5× rare / epic / legendary",
  },
  {
    id: "central-park",
    name: "Central Park",
    subtitle: "NYC dens & stops",
    xPct: 50,
    yPct: 50,
    lat: 40.7829,
    lng: -73.9654,
    eraId: "black_unova",
    kind: "city",
    accent: "#60a5fa",
    spawnHint: "Dense stops & lures",
  },
  {
    id: "akihabara",
    name: "Akihabara",
    subtitle: "Tokyo raid district",
    xPct: 50,
    yPct: 50,
    lat: 35.6984,
    lng: 139.7731,
    eraId: "vintage_kanto",
    kind: "city",
    accent: "#f87171",
    spawnHint: "Legendary raid pressure",
  },
  {
    id: "santa-monica",
    name: "Santa Monica",
    subtitle: "Pier water biome",
    xPct: 50,
    yPct: 50,
    lat: 34.01,
    lng: -118.5,
    eraId: "advanced_hoenn",
    kind: "landmark",
    accent: "#2dd4bf",
    spawnHint: "Water & rare surf",
  },
  {
    id: "sydney",
    name: "Sydney Quay",
    subtitle: "Oceanic event hub",
    xPct: 50,
    yPct: 50,
    lat: -33.86,
    lng: 151.21,
    eraId: "sun_alola",
    kind: "landmark",
    accent: "#818cf8",
    spawnHint: "Oceanic event spawns",
  },
  {
    id: "indigo",
    name: "Indigo Plateau",
    subtitle: "Hall of Fame gate",
    xPct: 50,
    yPct: 22,
    lat: 36.2,
    lng: 140.1,
    eraId: "vintage_kanto",
    kind: "landmark",
    accent: "#eab308",
    spawnHint: "Elite Four pressure",
  },
  {
    id: "hisui",
    name: "Hisui Wilds",
    subtitle: "Obsidian Fieldlands",
    xPct: 50,
    yPct: 50,
    lat: 43.8,
    lng: 142.4,
    eraId: "diamond_sinnoh",
    kind: "region",
    accent: "#94a3b8",
    spawnHint: "Ancient forms",
  },
];

export const GODS_EYE_NODES: GodsEyeNode[] = GODS_EYE_SEEDS.map(withAtlas);

export function findGodsEyeNode(id: string): GodsEyeNode | undefined {
  return GODS_EYE_NODES.find((n) => n.id === id);
}

export function regionWalkOrigin(node: GodsEyeNode): { xPct: number; yPct: number } {
  return { xPct: node.xPct, yPct: node.yPct };
}

/** Franchise regions walk a GBA-style overworld on the map; real hubs stay GO/OSM. */
export function walkSkinForNode(node: GodsEyeNode): "go" | "gba" {
  return node.kind === "region" ? "gba" : "go";
}

export type GbaCell = "grass" | "path" | "water" | "tree" | "dirt";

export const GBA_CELL_COLORS: Record<GbaCell, [string, string]> = {
  grass: ["#3d9b3a", "#2f7a2c"],
  path: ["#d4b06a", "#c49a4e"],
  water: ["#3a7ec4", "#2d649e"],
  tree: ["#1e4d1a", "#163b13"],
  dirt: ["#8b5a2b", "#6e4620"],
};

/** Blender-rendered GBA tiles in public/adventure-assets. Original geometry, not a Nintendo tileset. */
export const GBA_CELL_TEXTURE: Record<GbaCell, string> = {
  grass: "/adventure-assets/tex-grass.png",
  path: "/adventure-assets/tex-path.png",
  water: "/adventure-assets/tex-water.png",
  tree: "/adventure-assets/tex-tallgrass.png",
  dirt: "/adventure-assets/tex-sand.png",
};

/**
 * Repeating route, locked to world cells so it stays put while the trainer walks.
 * Each 20-cell block is a river, a crossroad, tall grass beside the path, and open field.
 * Textures are the original adventure-assets set, not a Nintendo tileset.
 */
export function gbaCellKind(tx: number, ty: number): GbaCell {
  const x = ((tx % 20) + 20) % 20;
  const y = ((ty % 20) + 20) % 20;
  if (y <= 1) return "water";
  if (y >= 9 && y <= 11) return "path";
  if (x >= 9 && x <= 11) return "path";
  if ((y === 7 || y === 8 || y === 12 || y === 13) && (x < 8 || x > 12)) return "tree";
  if (y >= 18) return "tree";
  if (x <= 2 && y >= 3 && y <= 6) return "dirt";
  return "grass";
}

/** Esri World Imagery. Same service as God's Eye. Tile order is z/y/x. */
export const ESRI_WORLD_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export function esriWorldImageryTile(z: number, y: number, x: number): string {
  return `${ESRI_WORLD_IMAGERY}/${z}/${y}/${x}`;
}

/**
 * How much of the painted route covers the satellite.
 * Field grass stays open so World Imagery reads through.
 */
export function gbaCellCover(kind: GbaCell): number {
  if (kind === "path") return 0.92;
  if (kind === "dirt") return 0.8;
  if (kind === "tree") return 0.78;
  if (kind === "water") return 0.58;
  return 0.42;
}

/** Land cell that touches the river, so the shore can take a foam edge. */
export function gbaShoreEdge(tx: number, ty: number): boolean {
  if (gbaCellKind(tx, ty) === "water") return false;
  return (
    gbaCellKind(tx, ty + 1) === "water" ||
    gbaCellKind(tx, ty - 1) === "water" ||
    gbaCellKind(tx + 1, ty) === "water" ||
    gbaCellKind(tx - 1, ty) === "water"
  );
}

/** One light per era. The route geometry stays shared. The wash is the region. */
export const ERA_WORLD_LIGHT: Record<string, { wash: string; label: string }> = {
  vintage_kanto: { wash: "rgba(255, 186, 72, 0.22)", label: "Kanto gold hour" },
  neo_johto: { wash: "rgba(134, 196, 92, 0.20)", label: "Johto cedar" },
  advanced_hoenn: { wash: "rgba(56, 189, 196, 0.22)", label: "Hoenn tide" },
  diamond_sinnoh: { wash: "rgba(148, 176, 214, 0.24)", label: "Sinnoh frost" },
  black_unova: { wash: "rgba(120, 132, 156, 0.18)", label: "Unova city" },
  mega_kalos: { wash: "rgba(214, 140, 176, 0.18)", label: "Kalos bloom" },
  sun_alola: { wash: "rgba(255, 140, 64, 0.22)", label: "Alola sun" },
  sword_galar: { wash: "rgba(168, 176, 188, 0.16)", label: "Galar steel" },
  modern_paldea: { wash: "rgba(196, 92, 168, 0.18)", label: "Paldea dusk" },
};

export function eraWorldLight(eraId: string | undefined): { wash: string; label: string } {
  return ERA_WORLD_LIGHT[eraId || ""] || ERA_WORLD_LIGHT.vintage_kanto;
}

export function isDresdenHub(node: GodsEyeNode): boolean {
  return node.id === "dresden" || node.kind === "nest";
}

export function nearestGodsEyeNodeByGeo(lat: number, lng: number): GodsEyeNode {
  let best = GODS_EYE_NODES[0];
  let bestD = Infinity;
  for (const n of GODS_EYE_NODES) {
    const d = haversineMeters(lat, lng, n.lat, n.lng);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** @deprecated Walk-plane xPct is region-local; prefer nearestGodsEyeNodeByGeo. */
export function nearestGodsEyeNode(xPct: number, yPct: number): GodsEyeNode {
  let best = GODS_EYE_NODES[0];
  let bestD = Infinity;
  for (const n of GODS_EYE_NODES) {
    const d = (n.xPct - xPct) ** 2 + (n.yPct - yPct) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function isNearDresdenGeo(lat: number, lng: number, radiusMeters = 450): boolean {
  return haversineMeters(lat, lng, DRESDEN_GEO.lat, DRESDEN_GEO.lng) <= radiusMeters;
}
