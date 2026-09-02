import type { TCGCard, TCGSet } from "@/lib/pokemon-api";

function card(
  id: string,
  name: string,
  setId: string,
  setName: string,
  number: string,
  rarity: string,
  market: number,
): TCGCard {
  return {
    id,
    name,
    rarity,
    number,
    set: { id: setId, name: setName, series: "", printedTotal: 0, total: 0, releaseDate: "" },
    images: {
      small: `https://images.pokemontcg.io/${setId}/${number}.png`,
      large: `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
    },
    tcgplayer: { prices: { holofoil: { market } } },
  };
}

/** Seed catalog so Discover / Market / Search still paint when pokemontcg.io 502s. */
export const FALLBACK_CARDS: TCGCard[] = [
  card("base1-4", "Charizard", "base1", "Base", "4", "Rare Holo", 399.99),
  card("base1-2", "Blastoise", "base1", "Base", "2", "Rare Holo", 149.99),
  card("base1-15", "Venusaur", "base1", "Base", "15", "Rare Holo", 129.99),
  card("base1-58", "Pikachu", "base1", "Base", "58", "Common", 8.5),
  card("base1-10", "Mewtwo", "base1", "Base", "10", "Rare Holo", 89.99),
  card("swsh12pt5-160", "Lugia VSTAR", "swsh12pt5", "Crown Zenith", "160", "Rare Rainbow", 74.5),
  card("swsh7-218", "Rayquaza VMAX", "swsh7", "Evolving Skies", "218", "Rare Rainbow", 199.99),
  card("sv3pt5-234", "Charizard ex", "sv3pt5", "151", "234", "Special Illustration Rare", 249.99),
  card("sv3pt5-173", "Mew ex", "sv3pt5", "151", "173", "Ultra Rare", 24.99),
  card("sv1-198", "Miraidon ex", "sv1", "Scarlet & Violet", "198", "Special Illustration Rare", 39.99),
  card("sv2-215", "Koraidon ex", "sv2", "Paldea Evolved", "215", "Special Illustration Rare", 34.99),
  card("swsh4-25", "Charizard VMAX", "swsh4", "Vivid Voltage", "25", "Rare Holo VMAX", 12.5),
  card("xy12-20", "Mewtwo-EX", "xy12", "Evolutions", "20", "Rare Holo EX", 18.5),
  card("sm115-56", "Pikachu", "sm115", "Hidden Fates", "56", "Rare", 14.99),
  card("swsh3-178", "Umbreon VMAX", "swsh3", "Darkness Ablaze", "178", "Rare Rainbow", 89.99),
  card("swsh8-215", "Gengar VMAX", "swsh8", "Fusion Strike", "215", "Rare Rainbow", 64.99),
];

function set(id: string, name: string, series: string, total: number, releaseDate: string): TCGSet {
  return {
    id,
    name,
    series,
    printedTotal: total,
    total,
    releaseDate,
    images: {
      symbol: `https://images.pokemontcg.io/${id}/symbol.png`,
      logo: `https://images.pokemontcg.io/${id}/logo.png`,
    },
  };
}

export const FALLBACK_SETS: TCGSet[] = [
  set("sv8", "Surging Sparks", "Scarlet & Violet", 252, "2024/11/08"),
  set("sv7", "Stellar Crown", "Scarlet & Violet", 175, "2024/09/13"),
  set("sv6pt5", "Shrouded Fable", "Scarlet & Violet", 99, "2024/08/02"),
  set("sv6", "Twilight Masquerade", "Scarlet & Violet", 226, "2024/05/24"),
  set("sv5", "Temporal Forces", "Scarlet & Violet", 218, "2024/03/22"),
  set("sv4pt5", "Paldean Fates", "Scarlet & Violet", 245, "2024/01/26"),
  set("sv3pt5", "151", "Scarlet & Violet", 207, "2023/09/22"),
  set("sv3", "Obsidian Flames", "Scarlet & Violet", 230, "2023/08/11"),
  set("swsh12pt5", "Crown Zenith", "Sword & Shield", 159, "2023/01/20"),
  set("swsh7", "Evolving Skies", "Sword & Shield", 203, "2021/08/27"),
  set("base1", "Base", "Base", 102, "1999/01/09"),
  set("base6", "Legendary Collection", "Base", 110, "2002/05/24"),
];

export function fallbackSearch(q: string): TCGCard[] {
  const n = q.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!n) return FALLBACK_CARDS;
  return FALLBACK_CARDS.filter((c) =>
    c.name.toLowerCase().includes(n) || c.set.name.toLowerCase().includes(n) || c.id.toLowerCase().includes(n),
  );
}

/** Always-paint stub so a 500 from pokemontcg.io never blanks the detail page. */
export function stubCardFromId(id: string): TCGCard {
  const hit = FALLBACK_CARDS.find((c) => c.id === id);
  if (hit) return hit;
  const parts = String(id || "").split("-");
  const setId = parts[0] || "base1";
  const number = parts.slice(1).join("-") || "1";
  return {
    id,
    name: id.replace(/-/g, " "),
    number,
    set: { id: setId, name: setId, series: "", printedTotal: 0, total: 0, releaseDate: "" },
    images: {
      small: `https://images.pokemontcg.io/${setId}/${number}.png`,
      large: `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
    },
  };
}
