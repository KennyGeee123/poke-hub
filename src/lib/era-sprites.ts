// Era-matched pixel sprites for battles, from the PokeAPI sprites repo
// (github.com/PokeAPI/sprites, files addressed by national dex number).
//
// Coverage was measured from that repo's real file tree on 2026-10-16:
//   versions/generation-iii/firered-leafgreen  front+back  #1-386
//   versions/generation-iv/heartgold-soulsilver front+back #1-493
//   versions/generation-iii/emerald            front+back  #1-386
//   versions/generation-iv/platinum            front+back  #1-493
//   versions/generation-v/black-white          front+back  #1-1025 (every species)
//   pokemon/{id}.png and pokemon/back/{id}.png front+back  #1-1025 (every species)
//   .../shiny/{id}.png and .../back/shiny/{id}.png exist for every set above, same ranges
// So each era shows its own game's sprites for its whole dex run, and every
// other species drops to the complete Black/White pixel set, never a 3D render.
import { ALL_POKEMON } from "./all-pokemon-data";
import type { PokemonEraId } from "./adventure-engine";
import { spriteSlug } from "./sprites";

const BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

type SpriteSet = { label: string; path: string; maxId: number };

const BW: SpriteSet = { label: "Black/White", path: "versions/generation-v/black-white", maxId: 1025 };

export const ERA_SPRITE_SET: Record<PokemonEraId, SpriteSet> = {
  vintage_kanto: { label: "FireRed/LeafGreen", path: "versions/generation-iii/firered-leafgreen", maxId: 386 },
  neo_johto: { label: "HeartGold/SoulSilver", path: "versions/generation-iv/heartgold-soulsilver", maxId: 493 },
  advanced_hoenn: { label: "Emerald", path: "versions/generation-iii/emerald", maxId: 386 },
  diamond_sinnoh: { label: "Platinum", path: "versions/generation-iv/platinum", maxId: 493 },
  black_unova: BW,
  mega_kalos: BW,
  sun_alola: BW,
  sword_galar: BW,
  modern_paldea: BW,
};

let bySlug: Map<string, number> | null = null;

/** National dex number for a species name (forms and card suffixes stripped). */
export function dexIdOf(name: string): number | null {
  if (!bySlug) bySlug = new Map(ALL_POKEMON.map((p) => [spriteSlug(p.name), p.id]));
  return bySlug.get(spriteSlug(name)) ?? null;
}

/** Ordered sprite URLs for a species in an era: era game set, then Black/White, then PokeAPI default. */
export function eraSpriteUrls(name: string, eraId: PokemonEraId | undefined, back = false, shiny = false): string[] {
  const id = dexIdOf(name);
  if (!id) return [];
  // shiny folders mirror the normal ones in every set (checked: complete for each range)
  const side = (back ? "/back" : "") + (shiny ? "/shiny" : "");
  const set = (eraId && ERA_SPRITE_SET[eraId]) || BW;
  const urls: string[] = [];
  if (id <= set.maxId) urls.push(`${BASE}/${set.path}${side}/${id}.png`);
  if (set !== BW) urls.push(`${BASE}/${BW.path}${side}/${id}.png`);
  urls.push(`${BASE}${side}/${id}.png`);
  return urls;
}
