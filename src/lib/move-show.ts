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

/** How the move crosses the floor ring. Original shapes, matched to travel-then-hit staging. */
export type StageShape =
  | "bolt"
  | "spiral"
  | "slash"
  | "column"
  | "orbs"
  | "wave"
  | "swarm"
  | "burst"
  | "rain";

export const PATTERN_STAGE: Record<MovePattern, StageShape> = {
  beam: "bolt",
  spray: "spiral",
  burst: "burst",
  rain: "rain",
  slash: "slash",
  wave: "wave",
  smash: "column",
  orbit: "orbs",
  swarm: "swarm",
};

/** Who can select this move in the living-world party, a hometown partner, or a foe. */
export const MOVE_USERS: Record<string, string> = {
  Thunderbolt: "Pikachu (Sparky), the default lead.",
  "Iron Tail": "Pikachu (Sparky).",
  "Volt Tackle": "Pikachu (Sparky).",
  "Quick Attack": "Pikachu (Sparky).",
  Flamethrower: "Charizard (Blaze), the second party slot.",
  "Dragon Claw": "Charizard (Blaze).",
  "Fire Blast": "Charizard (Blaze).",
  "Wing Attack": "Charizard (Blaze).",
  Tackle: "Every hometown partner, and every wild, gym, and league foe.",
  "Vine Whip": "Bulbasaur, Snivy, and Chespin.",
  Ember: "Charmander, Cyndaquil, Torchic, Chimchar, Tepig, Fennekin, Litten, Scorbunny, and Fuecoco. Every Fire wild, gym, or league foe.",
  "Water Gun": "Squirtle, Totodile, Mudkip, Piplup, Oshawott, Froakie, Popplio, Sobble, and Quaxly. Every Water foe.",
  "Razor Leaf": "Chikorita.",
  Absorb: "Treecko and Turtwig.",
  Leafage: "Rowlet and Sprigatito.",
  "Branch Poke": "Grookey, the Galar grass partner.",
  "Quick Strike": "Every wild, gym, and league foe whose first type is not Fire or Water.",
};

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

export function moveStage(name: string, type: string): StageShape {
  return PATTERN_STAGE[adventureMoveShow(name, type).pattern];
}

export function moveUsers(name: string): string {
  return MOVE_USERS[name] || "Any fighter whose learned move uses this name.";
}
