// Species sprites from local Gen 5, Pokémon Home, Showdown, and PokeAPI official artwork.
// Official artwork is addressed by national dex number. A slug in that URL never resolves.
import { DEX_BY_SLUG } from "./dex-by-slug";

export const LOCAL_SPRITE_SLUGS = new Set([
  "bulbasaur",
  "charmander",
  "squirtle",
  "pikachu",
  "caterpie",
  "pidgey",
  "rattata",
  "jigglypuff",
  "meowth",
  "psyduck",
  "machop",
  "geodude",
  "gastly",
  "eevee",
  "snorlax",
  "dratini",
  "mewtwo",
  "chikorita",
  "totodile",
  "cyndaquil",
  "jynx",
  "onix",
]);

export function spriteSlug(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Flabébé -> flabebe
    .replace(/[\u2018\u2019]/g, "") // Farfetch’d / Sirfetch’d
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[♀♂δ★:'']/g, "")
    .replace(/\b(v|vmax|vstar|gx|ex|tag team|prime|break|lv\.?x|legend)\b/gi, "")
    .replace(/\s+&\s+\w+/g, "")
    .replace(
      /\b(alolan|galarian|hisuian|paldean|mega|radiant|shining|dark|light|origin|primal|tera)\b/g,
      "",
    )
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

/** PokeAPI official artwork. The file name is the national dex number. */
export function officialArtworkUrl(name: string): string | null {
  const id = DEX_BY_SLUG[spriteSlug(name)];
  if (!id) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export function fallbackSpriteUrls(name: string): string[] {
  const s = spriteSlug(name);
  const local = localGen5Url(name);
  const art = officialArtworkUrl(name);

  // Local gen5 first (already vendored). Home, Showdown, then official artwork by dex number.
  // Printed card scans stay on the card tile. They are not a creature sprite.
  return [
    ...(local ? [local] : []),
    `https://img.pokemondb.net/sprites/home/normal/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`,
    `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/dex/${s}.png`,
    `https://img.pokemondb.net/artwork/large/${s}.jpg`,
    ...(art ? [art] : []),
  ];
}

/** Original 4-dir trainer already in public/adventure-assets (not PokeAPI trainers/1.png). */
export function trainerFacingUrl(facingAngleDeg: number): string {
  const a = ((facingAngleDeg % 360) + 360) % 360;
  const dir =
    a >= 315 || a < 45
      ? "up"
      : a >= 45 && a < 135
        ? "right"
        : a >= 135 && a < 225
          ? "down"
          : "left";
  return `/adventure-assets/trainer-${dir}.png`;
}

/**
 * Living-world sprite chain. Animated Showdown frame first, then the vendored
 * gen5 PNG, then Home / static Showdown. Battle art stays on fallbackSpriteUrls.
 */
export function worldSpriteUrls(name: string): string[] {
  const s = spriteSlug(name);
  const local = localGen5Url(name);
  const art = officialArtworkUrl(name);
  return [
    `https://play.pokemonshowdown.com/sprites/ani/${s}.gif`,
    ...(local ? [local] : []),
    `https://img.pokemondb.net/sprites/home/normal/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`,
    `https://play.pokemonshowdown.com/sprites/dex/${s}.png`,
    ...(art ? [art] : []),
  ];
}

export function worldSpriteUrl(name: string): string {
  return worldSpriteUrls(name)[0];
}

export function animatedSpriteUrl(name: string): string {
  return fallbackSpriteUrls(name)[0];
}

export function staticSpriteUrl(name: string): string {
  return fallbackSpriteUrls(name)[0];
}

export function backSpriteUrl(name: string): string {
  return (
    localGen5BackUrl(name) ??
    `https://play.pokemonshowdown.com/sprites/ani-back/${spriteSlug(name)}.gif`
  );
}

export function backSpriteFallback(name: string): string {
  return (
    localGen5BackUrl(name) ??
    `https://play.pokemonshowdown.com/sprites/gen5-back/${spriteSlug(name)}.png`
  );
}
