// Derive a Pokémon sprite URL from a TCG card name.
// Uses Pokémon Showdown's animated GIF sprites first, then HD HOME renders.
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

// Animated battle sprite.
export function animatedSpriteUrl(name: string): string {
  const s = spriteSlug(name);
  return `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`;
}

// Fallbacks: animated gif → HD HOME render → static gen5 png.
export function staticSpriteUrl(name: string): string {
  const s = spriteSlug(name);
  return `https://play.pokemonshowdown.com/sprites/home/${s}.png`;
}

export function fallbackSpriteUrls(name: string): string[] {
  const s = spriteSlug(name);
  return [
    `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`,
    `https://play.pokemonshowdown.com/sprites/home/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`,
  ];
}

// Back-facing sprite (player POV in battle).
export function backSpriteUrl(name: string): string {
  const s = spriteSlug(name);
  return `https://play.pokemonshowdown.com/sprites/ani-back/${s}.gif`;
}
export function backSpriteFallback(name: string): string {
  const s = spriteSlug(name);
  return `https://play.pokemonshowdown.com/sprites/gen5-back/${s}.png`;
}
