/** How an adventure battle move is shown. The HD arena uses this, not the first regex hit. */

export type MovePattern =
  | "beam"
  | "spray"
  | "burst"
  | "rain"
  | "slash"
  | "wave"
  | "smash"
  | "orbit"
  | "swarm";

export type MoveShow = { pattern: MovePattern; hue: string; type: string };

/** Every move the living-world party, partner, or gym foe can select. */
export const ADVENTURE_MOVE_SHOW: Record<string, MoveShow> = {
  Thunderbolt: { pattern: "beam", hue: "#fde047", type: "Electric" },
  "Iron Tail": { pattern: "slash", hue: "#cbd5e1", type: "Steel" },
  "Volt Tackle": { pattern: "smash", hue: "#fde047", type: "Electric" },
  "Quick Attack": { pattern: "slash", hue: "#e2e8f0", type: "Normal" },
  Flamethrower: { pattern: "spray", hue: "#ff4500", type: "Fire" },
  "Dragon Claw": { pattern: "slash", hue: "#f59e0b", type: "Dragon" },
  "Fire Blast": { pattern: "burst", hue: "#ff5722", type: "Fire" },
  "Wing Attack": { pattern: "wave", hue: "#bae6fd", type: "Flying" },
  Tackle: { pattern: "smash", hue: "#f97316", type: "Normal" },
  "Vine Whip": { pattern: "slash", hue: "#16a34a", type: "Grass" },
  Ember: { pattern: "burst", hue: "#ff6b35", type: "Fire" },
  "Water Gun": { pattern: "wave", hue: "#0ea5e9", type: "Water" },
  "Razor Leaf": { pattern: "slash", hue: "#22c55e", type: "Grass" },
  Absorb: { pattern: "orbit", hue: "#22c55e", type: "Grass" },
  Leafage: { pattern: "swarm", hue: "#22c55e", type: "Grass" },
  "Branch Poke": { pattern: "smash", hue: "#65a30d", type: "Grass" },
  "Quick Strike": { pattern: "smash", hue: "#fb923c", type: "Fighting" },
};

export function moveAssetSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Full-frame still for this move. Missing files hide themselves in the battle overlay. */
export function moveRenderUrl(name: string): string {
  return `/adventure-assets/moves/${moveAssetSlug(name)}.jpg`;
}

export function adventureMoveShow(name: string, type: string): MoveShow {
  return ADVENTURE_MOVE_SHOW[name] || { pattern: "burst", hue: "#e2e8f0", type: type || "Normal" };
}
