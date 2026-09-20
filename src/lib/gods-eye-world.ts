/**
 * God's Eye — multi-region PokéVault world atlas.
 * Local map still uses xPct/yPct; atlas nodes teleport into that plane
 * and optionally force an era so wilds match the destination region.
 */
import type { PokemonEraId } from "@/lib/adventure-engine";

export type GodsEyeNode = {
  id: string;
  name: string;
  subtitle: string;
  /** Position on the God's Eye atlas (0–100). */
  atlasX: number;
  atlasY: number;
  /** Drop the trainer here on the Living World plane. */
  xPct: number;
  yPct: number;
  lat: number;
  lng: number;
  eraId: PokemonEraId;
  kind: "region" | "nest" | "city" | "landmark";
  accent: string;
  spawnHint: string;
};

/** Huge franchise + real-world hub network for teleport + walk/catch. */
export const GODS_EYE_NODES: GodsEyeNode[] = [
  { id: "kanto", name: "Kanto", subtitle: "Gen 1 · Pewter–Indigo", atlasX: 18, atlasY: 42, xPct: 28, yPct: 45, lat: 35.68, lng: 139.76, eraId: "vintage_kanto", kind: "region", accent: "#ef4444", spawnHint: "Classic starters & birds" },
  { id: "johto", name: "Johto", subtitle: "Gen 2 · Violet–Olivine", atlasX: 28, atlasY: 38, xPct: 36, yPct: 40, lat: 35.01, lng: 135.77, eraId: "neo_johto", kind: "region", accent: "#f59e0b", spawnHint: "Togepi nests & bells" },
  { id: "hoenn", name: "Hoenn", subtitle: "Gen 3 · Littleroot seas", atlasX: 38, atlasY: 55, xPct: 48, yPct: 62, lat: 26.21, lng: 127.68, eraId: "advanced_hoenn", kind: "region", accent: "#22c55e", spawnHint: "Surf & weather legends" },
  { id: "sinnoh", name: "Sinnoh", subtitle: "Gen 4 · Snowpoint north", atlasX: 48, atlasY: 28, xPct: 55, yPct: 32, lat: 43.06, lng: 141.35, eraId: "diamond_sinnoh", kind: "region", accent: "#38bdf8", spawnHint: "Mountain & lake spirits" },
  { id: "unova", name: "Unova", subtitle: "Gen 5 · Castelia", atlasX: 62, atlasY: 40, xPct: 62, yPct: 44, lat: 40.71, lng: -74.0, eraId: "modern_paldea", kind: "region", accent: "#a78bfa", spawnHint: "Urban + desert routes" },
  { id: "kalos", name: "Kalos", subtitle: "Gen 6 · Lumiose", atlasX: 55, atlasY: 48, xPct: 58, yPct: 50, lat: 48.86, lng: 2.35, eraId: "modern_paldea", kind: "region", accent: "#f472b6", spawnHint: "Fairy & mega vibes" },
  { id: "alola", name: "Alola", subtitle: "Gen 7 · Melemele", atlasX: 78, atlasY: 62, xPct: 74, yPct: 70, lat: 21.3, lng: -157.85, eraId: "modern_paldea", kind: "region", accent: "#fbbf24", spawnHint: "Island trial waters" },
  { id: "galar", name: "Galar", subtitle: "Gen 8 · Wyndon", atlasX: 42, atlasY: 22, xPct: 44, yPct: 26, lat: 51.5, lng: -0.12, eraId: "modern_paldea", kind: "region", accent: "#fb7185", spawnHint: "Dynamax dens" },
  { id: "paldea", name: "Paldea", subtitle: "Gen 9 · Mesagoza", atlasX: 70, atlasY: 58, xPct: 70, yPct: 58, lat: 40.4, lng: -3.7, eraId: "modern_paldea", kind: "region", accent: "#34d399", spawnHint: "Open-world terastals" },
  { id: "dresden", name: "Dresden Park", subtitle: "Rare nest · Chamblee GA", atlasX: 22, atlasY: 68, xPct: 31, yPct: 48, lat: 33.8824, lng: -84.2811, eraId: "vintage_kanto", kind: "nest", accent: "#FFDE00", spawnHint: "5× rare / epic / legendary" },
  { id: "central-park", name: "Central Park", subtitle: "NYC dens & stops", atlasX: 64, atlasY: 36, xPct: 35, yPct: 42, lat: 40.7829, lng: -73.9654, eraId: "modern_paldea", kind: "city", accent: "#60a5fa", spawnHint: "Dense stops & lures" },
  { id: "akihabara", name: "Akihabara", subtitle: "Tokyo raid district", atlasX: 84, atlasY: 34, xPct: 72, yPct: 28, lat: 35.6984, lng: 139.7731, eraId: "vintage_kanto", kind: "city", accent: "#f87171", spawnHint: "Legendary raid pressure" },
  { id: "santa-monica", name: "Santa Monica", subtitle: "Pier water biome", atlasX: 12, atlasY: 58, xPct: 22, yPct: 68, lat: 34.01, lng: -118.5, eraId: "advanced_hoenn", kind: "landmark", accent: "#2dd4bf", spawnHint: "Water & rare surf" },
  { id: "sydney", name: "Sydney Quay", subtitle: "Oceanic event hub", atlasX: 88, atlasY: 78, xPct: 84, yPct: 78, lat: -33.86, lng: 151.21, eraId: "modern_paldea", kind: "landmark", accent: "#818cf8", spawnHint: "Oceanic event spawns" },
  { id: "indigo", name: "Indigo Plateau", subtitle: "Hall of Fame gate", atlasX: 24, atlasY: 30, xPct: 30, yPct: 22, lat: 36.2, lng: 140.1, eraId: "vintage_kanto", kind: "landmark", accent: "#eab308", spawnHint: "Elite Four pressure" },
  { id: "hisui", name: "Hisui Wilds", subtitle: "Obsidian Fieldlands", atlasX: 50, atlasY: 18, xPct: 52, yPct: 18, lat: 43.8, lng: 142.4, eraId: "diamond_sinnoh", kind: "region", accent: "#94a3b8", spawnHint: "Ancient forms" },
];

export function findGodsEyeNode(id: string): GodsEyeNode | undefined {
  return GODS_EYE_NODES.find((n) => n.id === id);
}

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
