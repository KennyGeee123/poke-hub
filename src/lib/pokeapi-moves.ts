// Fetch real Pokémon move learnsets from PokéAPI and convert to GBMove.
import { spriteSlug } from "./sprites";
import type { GBMove } from "./gbgame";

export type LearnEntry = { level: number; move: GBMove };

const learnCache = new Map<string, LearnEntry[]>();
const moveCache = new Map<string, GBMove>();
const inflight = new Map<string, Promise<LearnEntry[]>>();

const TYPE_MAP: Record<string, string> = {
  normal: "Colorless", fire: "Fire", water: "Water", grass: "Grass",
  electric: "Lightning", ice: "Water", fighting: "Fighting", poison: "Darkness",
  ground: "Fighting", flying: "Colorless", psychic: "Psychic", bug: "Grass",
  rock: "Fighting", ghost: "Psychic", dragon: "Dragon", dark: "Darkness",
  steel: "Metal", fairy: "Fairy",
};

const titleCase = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function fetchMove(url: string): Promise<GBMove | null> {
  if (moveCache.has(url)) return moveCache.get(url)!;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    const m: GBMove = {
      name: titleCase(j.name),
      damage: j.power ?? 0,
      type: TYPE_MAP[j.type?.name] ?? "Colorless",
      text: j.effect_entries?.find((e: any) => e.language?.name === "en")?.short_effect,
    };
    moveCache.set(url, m);
    return m;
  } catch {
    return null;
  }
}

export async function fetchLearnset(name: string): Promise<LearnEntry[]> {
  const slug = spriteSlug(name);
  if (!slug) return [];
  if (learnCache.has(slug)) return learnCache.get(slug)!;
  if (inflight.has(slug)) return inflight.get(slug)!;
  const p = (async () => {
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
      if (!r.ok) return [];
      const j: any = await r.json();
      const entries: { level: number; url: string }[] = [];
      for (const mv of j.moves ?? []) {
        // Pick best (latest) version-group detail with level-up method.
        const lvl = mv.version_group_details
          .filter((v: any) => v.move_learn_method?.name === "level-up")
          .map((v: any) => v.level_learned_at)
          .sort((a: number, b: number) => a - b)[0];
        if (typeof lvl === "number") entries.push({ level: lvl, url: mv.move.url });
      }
      entries.sort((a, b) => a.level - b.level);
      // Fetch move details (cap to first 30 unique entries to keep it light).
      const limited = entries.slice(0, 30);
      const moves = await Promise.all(limited.map((e) => fetchMove(e.url)));
      const learn: LearnEntry[] = limited
        .map((e, i) => (moves[i] ? { level: Math.max(1, e.level), move: moves[i]! } : null))
        .filter((x): x is LearnEntry => !!x && x.move.damage > 0);
      learnCache.set(slug, learn);
      return learn;
    } catch {
      return [];
    } finally {
      inflight.delete(slug);
    }
  })();
  inflight.set(slug, p);
  return p;
}

/** Replace attacks with the 4 strongest level-up moves the Pokémon knows by `level`. */
export async function movesAtLevel(name: string, level: number, fallback: GBMove[]): Promise<GBMove[]> {
  const learn = await fetchLearnset(name);
  const known = learn.filter((e) => e.level <= level).map((e) => e.move);
  if (!known.length) return fallback;
  // Keep 4 strongest, but include the latest learned for flavor.
  const sortedByPower = [...known].sort((a, b) => b.damage - a.damage);
  const top = sortedByPower.slice(0, 3);
  const latest = known[known.length - 1];
  const set = [latest, ...top.filter((m) => m.name !== latest.name)];
  return set.slice(0, 4);
}

/** Moves newly learned when going from oldLevel → newLevel. */
export async function newlyLearned(name: string, oldLevel: number, newLevel: number): Promise<GBMove[]> {
  const learn = await fetchLearnset(name);
  return learn.filter((e) => e.level > oldLevel && e.level <= newLevel).map((e) => e.move);
}
