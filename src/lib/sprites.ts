// Species sprites from PokeAPI / Pokémon Showdown / Official Pokémon Home 3D Art
export const LOCAL_SPRITE_SLUGS = new Set([
  "bulbasaur", "charmander", "squirtle", "pikachu", "caterpie", "pidgey",
  "rattata", "jigglypuff", "meowth", "psyduck", "machop", "geodude",
  "gastly", "eevee", "snorlax", "dratini", "mewtwo", "chikorita",
  "totodile", "cyndaquil", "jynx", "onix", "charizard", "blastoise",
  "venusaur", "rayquaza", "gengar", "lucario", "umbreon", "espeon"
]);

export function spriteSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[♀♂δ★:'']/g, "")
    .replace(/\b(v|vmax|vstar|gx|ex|tag team|prime|break|lv\.?x|legend)\b/gi, "")
    .replace(/\s+&\s+\w+/g, "")
    .replace(/\b(alolan|galarian|hisuian|paldean|mega|radiant|shining|dark|light|origin|primal|tera)\b/g, "")
    .replace(/\./g, "")
    .trim();

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export function localGen5Url(name: string): string | null {
  const s = spriteSlug(name);
  return LOCAL_SPRITE_SLUGS.has(s) ? `/sprites/gen5/${s}.png` : null;
}

export function localGen5BackUrl(name: string): string | null {
  const s = spriteSlug(name);
  return LOCAL_SPRITE_SLUGS.has(s) ? `/sprites/gen5-back/${s}.png` : null;
}

export function fallbackSpriteUrls(name: string): string[] {
  const s = spriteSlug(name);
  const local = localGen5Url(name);
  
  // Prioritize high-res Official Home 3D Render, Showdown Animated Model & Official Artwork
  return [
    `https://img.pokemondb.net/sprites/home/normal/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`,
    `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/dex/${s}.png`,
    `https://img.pokemondb.net/artwork/large/${s}.jpg`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${s}.png`,
    ...(local ? [local] : []),
  ];
}

export function animatedSpriteUrl(name: string): string {
  return fallbackSpriteUrls(name)[0];
}

export function staticSpriteUrl(name: string): string {
  return fallbackSpriteUrls(name)[0];
}

export function backSpriteUrl(name: string): string {
  return localGen5BackUrl(name) ?? `https://play.pokemonshowdown.com/sprites/ani-back/${spriteSlug(name)}.gif`;
}

export function backSpriteFallback(name: string): string {
  return localGen5BackUrl(name) ?? `https://play.pokemonshowdown.com/sprites/gen5-back/${spriteSlug(name)}.png`;
}
