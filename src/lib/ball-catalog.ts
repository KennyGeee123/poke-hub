/** Painted Poké Ball colors. Top and bottom are the two halves. */

export type BallId =
  | "poke_ball"
  | "great_ball"
  | "ultra_ball"
  | "master_ball"
  | "safari_ball"
  | "sport_ball"
  | "net_ball"
  | "dive_ball"
  | "nest_ball"
  | "repeat_ball"
  | "timer_ball"
  | "luxury_ball"
  | "premier_ball"
  | "dusk_ball"
  | "heal_ball"
  | "quick_ball"
  | "cherish_ball"
  | "park_ball"
  | "dream_ball"
  | "beast_ball"
  | "level_ball"
  | "lure_ball"
  | "moon_ball"
  | "friend_ball"
  | "love_ball"
  | "heavy_ball"
  | "fast_ball"
  | "feather_ball"
  | "wing_ball"
  | "jet_ball"
  | "leaden_ball"
  | "gigaton_ball"
  | "origin_ball";

export interface BallColors {
  top: string;
  bottom: string;
  band: string;
  button: string;
}

export interface BallDef {
  id: BallId;
  name: string;
  multiplier: number;
  priceCoins: number;
  stock: number;
  description: string;
  colors: BallColors;
}

const paint = (top: string, bottom: string, band = "#1a1a1a", button = "#f5f5f5"): BallColors => ({
  top,
  bottom,
  band,
  button,
});

function ball(
  id: BallId,
  name: string,
  multiplier: number,
  priceCoins: number,
  stock: number,
  colors: BallColors,
  description: string,
): BallDef {
  return { id, name, multiplier, priceCoins, stock, colors, description };
}

const LIST: BallDef[] = [
  ball("poke_ball", "Poké Ball", 1, 10, 45, paint("#ef2d2d", "#f5f5f5"), "Standard capsule."),
  ball("great_ball", "Great Ball", 1.5, 30, 22, paint("#2f6bff", "#f5f5f5"), "Blue ball with a higher catch rate."),
  ball("ultra_ball", "Ultra Ball", 2, 80, 8, paint("#1a1a1a", "#f5c518"), "Black and yellow. Double the usual rate."),
  ball("master_ball", "Master Ball", 100, 1000, 1, paint("#7b2d8e", "#f5f5f5", "#1a1a1a", "#e85d9a"), "Catches without fail."),
  ball("safari_ball", "Safari Ball", 1.5, 40, 4, paint("#6b8f3a", "#c4b45a", "#3e4a28", "#6b8f3a"), "Camo ball from the Safari Zone."),
  ball("sport_ball", "Sport Ball", 1.5, 30, 6, paint("#f5f5f5", "#e23b3b", "#1a1a1a", "#1a1a1a"), "White top, red bottom. Bug-Catching Contest ball."),
  ball("net_ball", "Net Ball", 2, 80, 5, paint("#1a9b8e", "#1a1a1a", "#f5f5f5", "#f5f5f5"), "Works better on Bug and Water Pokémon."),
  ball("dive_ball", "Dive Ball", 2, 80, 3, paint("#2ec7e6", "#1a4f8b", "#0e2a4a"), "Works better underwater."),
  ball("nest_ball", "Nest Ball", 1.5, 40, 6, paint("#8bc34a", "#c4a574", "#5d4037", "#8bc34a"), "Kinder to lower-level Pokémon."),
  ball("repeat_ball", "Repeat Ball", 2, 80, 4, paint("#ef2d2d", "#f5f5f5", "#1a1a1a", "#1a1a1a"), "Kinder when you already own that species."),
  ball("timer_ball", "Timer Ball", 1.5, 80, 3, paint("#f7f7f7", "#f7f7f7", "#1a1a1a", "#e23b3b"), "White ball with a red button. Better as the fight goes on."),
  ball("luxury_ball", "Luxury Ball", 1, 200, 1, paint("#111111", "#111111", "#d4af37", "#d4af37"), "Black ball with a gold band. Makes a caught Pokémon friendlier."),
  ball("premier_ball", "Premier Ball", 1, 20, 8, paint("#f7f7f7", "#f7f7f7", "#e23b3b", "#f7f7f7"), "White commemorative ball with a red band."),
  ball("dusk_ball", "Dusk Ball", 3, 150, 2, paint("#2e7d4f", "#111111", "#f5a623", "#f5a623"), "Green and black. Better at night and in caves."),
  ball("heal_ball", "Heal Ball", 1, 30, 4, paint("#f48fb1", "#f5f5f5", "#f48fb1"), "Pink ball. The Pokémon arrives healed."),
  ball("quick_ball", "Quick Ball", 4, 200, 2, paint("#f5d90a", "#2f6bff"), "Yellow and blue. Best on the first turn."),
  ball("cherish_ball", "Cherish Ball", 1, 500, 1, paint("#e23b3b", "#f48fb1", "#f7f7f7", "#f7f7f7"), "Event ball. Red top, pink bottom."),
  ball("park_ball", "Park Ball", 2.5, 40, 3, paint("#3e8f3e", "#d4af37", "#3e4a28"), "Pal Park ball. Green and gold."),
  ball("dream_ball", "Dream Ball", 1, 300, 1, paint("#f48fb1", "#d1c4e9", "#f48fb1"), "Pink and lavender. Catches a sleeping Pokémon."),
  ball("beast_ball", "Beast Ball", 5, 800, 1, paint("#4fc3f7", "#5e35b1"), "Made for Ultra Beasts. Cyan and violet."),
  ball("level_ball", "Level Ball", 2, 50, 2, paint("#1a1a1a", "#f5d90a"), "Apricorn ball. Black and yellow."),
  ball("lure_ball", "Lure Ball", 2, 50, 2, paint("#1565c0", "#26c6da", "#0d47a1"), "Apricorn ball for fishing. Blue and cyan."),
  ball("moon_ball", "Moon Ball", 2, 50, 2, paint("#1a237e", "#f5d90a", "#1a237e"), "Apricorn ball. Navy and yellow."),
  ball("friend_ball", "Friend Ball", 1, 50, 2, paint("#2e7d32", "#81c784", "#c62828"), "Apricorn ball. Green with a red band."),
  ball("love_ball", "Love Ball", 1.5, 50, 2, paint("#f48fb1", "#f5f5f5", "#e91e63", "#e91e63"), "Apricorn ball. Pink with a heart-red band."),
  ball("heavy_ball", "Heavy Ball", 1.5, 50, 2, paint("#546e7a", "#cfd8dc", "#37474f", "#90a4ae"), "Apricorn ball. Slate and silver."),
  ball("fast_ball", "Fast Ball", 2, 50, 2, paint("#e23b3b", "#f5d90a"), "Apricorn ball. Red and yellow."),
  ball("feather_ball", "Feather Ball", 1, 40, 3, paint("#efe6d4", "#8d6e63", "#efe6d4", "#8d6e63"), "Hisui ball. Light and easy to throw."),
  ball("wing_ball", "Wing Ball", 1.5, 80, 2, paint("#eceff1", "#90a4ae", "#cfd8dc"), "Hisui ball. Flies a little farther."),
  ball("jet_ball", "Jet Ball", 2, 150, 1, paint("#111111", "#e23b3b", "#111111"), "Hisui ball. Black and red. Long throw."),
  ball("leaden_ball", "Leaden Ball", 2, 150, 1, paint("#37474f", "#263238", "#455a64", "#90a4ae"), "Hisui ball. Heavy, short throw, stronger catch."),
  ball("gigaton_ball", "Gigaton Ball", 2.5, 250, 1, paint("#455a64", "#111111", "#cfd8dc"), "Hisui ball. Very heavy."),
  ball("origin_ball", "Origin Ball", 3, 400, 1, paint("#e8dcc8", "#8d6e63", "#d4af37", "#d4af37"), "Hisui ball made for the ancient dragon."),
];

export const BALLS: Record<BallId, BallDef> = LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<BallId, BallDef>,
);

export function defaultBallCounts(): Record<BallId, number> {
  const counts = {} as Record<BallId, number>;
  for (const item of LIST) counts[item.id] = item.stock;
  return counts;
}

export function ballList(): BallDef[] {
  return LIST.slice();
}
