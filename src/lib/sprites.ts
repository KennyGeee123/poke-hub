// Derive a Pokémon sprite URL from a TCG card name.
// Adventure wilds/gyms: local PokeAPI gen5 PNGs under /sprites/ (vendored).
// Everyone else: Pokémon Showdown animated GIFs, then HD HOME, then gen5.

/** Species we vendored from PokeAPI/sprites (gen5). Not a Nintendo license. */
export const LOCAL_SPRITE_SLUGS = new Set([
  "bulbasaur", "charmander", "squirtle", "pikachu", "caterpie", "pidgey",
  "rattata", "jigglypuff", "meowth", "psyduck", "machop", "geodude",
  "gastly", "eevee", "snorlax", "dratini", "mewtwo", "chikorita",
  "totodile", "cyndaquil", "jynx", "onix",
]);

export function spriteSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[♀♂δ★.'']/g, "")
    .replace(/\b(v|vmax|vstar|gx|ex|tag team|prime|break|lv\.?x|legend)\b/gi, "")
    .replace(/\s+&\s+\w+/g, "")
    .replace(/\b(alolan|galarian|hisuian|paldean|mega|radiant|shining|dark|light|origin|primal|tera)\b/g, "")
    .replace(/\b(x|y)\b/g, "")
    .trim();

  return cleaned
    .split(/\s+/)
    .find(Boolean)
    ?.replace(/[^a-z0-9-]/g, "") ?? "";
}

export function localGen5Url(name: string): string | null {
  const s = spriteSlug(name);
  return LOCAL_SPRITE_SLUGS.has(s) ? `/sprites/gen5/${s}.png` : null;
}
export function localGen5BackUrl(name: string): string | null {
  const s = spriteSlug(name);
  return LOCAL_SPRITE_SLUGS.has(s) ? `/sprites/gen5-back/${s}.png` : null;
}

// Animated battle sprite — local gen5 first for vendored names.
export function animatedSpriteUrl(name: string): string {
  return localGen5Url(name) ?? `https://play.pokemonshowdown.com/sprites/ani/${spriteSlug(name)}.gif`;
}

export function staticSpriteUrl(name: string): string {
  return localGen5Url(name) ?? `https://play.pokemonshowdown.com/sprites/home/${spriteSlug(name)}.png`;
}

export function fallbackSpriteUrls(name: string): string[] {
  const s = spriteSlug(name);
  const local = localGen5Url(name);
  return [
    ...(local ? [local] : []),
    `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`,
    `https://play.pokemonshowdown.com/sprites/home/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`,
  ];
}

export function backSpriteUrl(name: string): string {
  return localGen5BackUrl(name) ?? `https://play.pokemonshowdown.com/sprites/ani-back/${spriteSlug(name)}.gif`;
}
export function backSpriteFallback(name: string): string {
  return localGen5BackUrl(name) ?? `https://play.pokemonshowdown.com/sprites/gen5-back/${spriteSlug(name)}.png`;
}
