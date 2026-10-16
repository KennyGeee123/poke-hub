// Fetch real Pokémon move learnsets from PokéAPI and convert to GBMove.
import { spriteSlug } from "./sprites";
import { isDittoName, TRANSFORM_MOVE, type GBMove } from "./gbgame";

export type LearnEntry = { level: number; move: GBMove };

const learnCache = new Map<string, LearnEntry[]>();
const moveCache = new Map<string, GBMove>();
const inflight = new Map<string, Promise<LearnEntry[]>>();

const TYPE_MAP: Record<string, string> = {
  normal: "Colorless",
  fire: "Fire",
  water: "Water",
  grass: "Grass",
  electric: "Lightning",
  ice: "Water",
  fighting: "Fighting",
  poison: "Darkness",
  ground: "Fighting",
  flying: "Colorless",
  psychic: "Psychic",
  bug: "Grass",
  rock: "Fighting",
  ghost: "Psychic",
  dragon: "Dragon",
  dark: "Darkness",
  steel: "Metal",
  fairy: "Fairy",
};

const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
        .filter((x): x is LearnEntry => {
          if (!x) return false;
          if (x.move.name === "Transform") return true;
          return x.move.damage > 0;
        });
      if (slug === "ditto" && !learn.some((e) => e.move.name === "Transform")) {
        learn.unshift({ level: 1, move: { ...TRANSFORM_MOVE } });
      }
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

/** Up to four strong level-up moves known by `level`. A wild foe can take this list as its set. A player's fighter appends any name it does not already know. */
export async function movesAtLevel(
  name: string,
  level: number,
  fallback: GBMove[],
): Promise<GBMove[]> {
  // Ditto's only level-up move has no power. A damage sort would drop it.
  if (isDittoName(name)) return [{ ...TRANSFORM_MOVE }];
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
export async function newlyLearned(
  name: string,
  oldLevel: number,
  newLevel: number,
): Promise<GBMove[]> {
  const learn = await fetchLearnset(name);
  return learn.filter((e) => e.level > oldLevel && e.level <= newLevel).map((e) => e.move);
}

export type MoveSource = "level-up" | "egg" | "machine" | "tutor" | "train" | "other";

export type SpeciesMove = GBMove & { source: MoveSource; level?: number };

const SOURCE_RANK: Record<MoveSource, number> = {
  egg: 0,
  "level-up": 1,
  machine: 2,
  tutor: 3,
  train: 4,
  other: 5,
};

type LearnRow = {
  url: string;
  methods: { name?: string; level?: number }[];
};

/**
 * One row per move. Breeding wins over level-up, then TM, then tutor.
 * Nothing is cut to four or to eighty.
 */
export function orderSpeciesLearnset(
  rows: LearnRow[],
): { url: string; source: MoveSource; level: number }[] {
  const byUrl = new Map<string, { source: MoveSource; level: number }>();
  for (const row of rows) {
    const url = row.url;
    if (!url) continue;
    const methods = row.methods || [];
    const has = (name: string) => methods.some((m) => m.name === name);
    let source: MoveSource | null = null;
    let level = 0;
    if (has("egg") || has("light-ball-egg")) source = "egg";
    else if (has("level-up")) {
      source = "level-up";
      const levels = methods
        .filter((m) => m.name === "level-up" && typeof m.level === "number")
        .map((m) => m.level as number);
      level = levels.length ? Math.min(...levels) : 0;
    } else if (has("machine")) source = "machine";
    else if (has("tutor")) source = "tutor";
    else if (has("train")) source = "train";
    else if (methods.some((m) => m.name)) source = "other";
    if (!source) continue;
    const prev = byUrl.get(url);
    if (!prev || SOURCE_RANK[source] < SOURCE_RANK[prev.source]) {
      byUrl.set(url, { source, level });
    }
  }
  return [...byUrl.entries()]
    .map(([url, row]) => ({ url, source: row.source, level: row.level }))
    .sort(
      (a, b) =>
        SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
        a.level - b.level ||
        a.url.localeCompare(b.url),
    );
}

/** How a full-set move is stored on the adventure card. */
export function packSpeciesMoves(moves: SpeciesMove[]): {
  name: string;
  type: string;
  power: number;
  pp: number;
  maxPp: number;
  description: string;
}[] {
  return moves.map((move) => {
    const pp = move.source === "egg" || move.source === "tutor" ? 10 : move.source === "machine" ? 15 : 20;
    const description =
      move.source === "egg"
        ? "Breeding move."
        : move.source === "machine"
          ? "TM move."
          : move.source === "tutor"
            ? "Tutor move."
            : move.source === "train"
              ? "Train move."
              : move.source === "other"
                ? "Extra move."
                : move.text || "Level-up move.";
    return {
      name: move.name,
      type: move.type || "Normal",
      power: move.damage || 0,
      pp,
      maxPp: pp,
      description,
    };
  });
}

const speciesCache = new Map<string, SpeciesMove[]>();
const speciesInflight = new Map<string, Promise<SpeciesMove[]>>();

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

function learnRows(moves: any[]): LearnRow[] {
  return (moves ?? []).map((mv) => ({
    url: String(mv.move?.url || ""),
    methods: (mv.version_group_details ?? []).map((v: any) => ({
      name: v.move_learn_method?.name,
      level: v.level_learned_at,
    })),
  }));
}

/** Breeding moves are filed on the baby. Pichu holds the moves Pikachu is born with. */
async function ancestorSlugs(slug: string): Promise<string[]> {
  try {
    const species = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${slug}`);
    if (!species.ok) return [];
    const body: any = await species.json();
    const chainUrl = body.evolution_chain?.url as string | undefined;
    if (!chainUrl) return [];
    const chainRes = await fetch(chainUrl);
    if (!chainRes.ok) return [];
    const chain: any = await chainRes.json();
    const found: string[] = [];
    const walk = (node: any, before: string[]): boolean => {
      const name = String(node?.species?.name || "");
      if (name === slug) {
        found.push(...before);
        return true;
      }
      for (const next of node?.evolves_to ?? []) {
        if (walk(next, name ? [...before, name] : before)) return true;
      }
      return false;
    };
    walk(chain.chain, []);
    return found;
  } catch {
    return [];
  }
}

async function loadSpeciesMoves(slug: string): Promise<SpeciesMove[]> {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
  if (!r.ok) return [];
  const j: any = await r.json();
  const ordered = orderSpeciesLearnset(learnRows(j.moves));
  const byUrl = new Map(ordered.map((row) => [row.url, row]));
  for (const ancestor of await ancestorSlugs(slug)) {
    const prior = await fetch(`https://pokeapi.co/api/v2/pokemon/${ancestor}`);
    if (!prior.ok) continue;
    const body: any = await prior.json();
    for (const egg of orderSpeciesLearnset(learnRows(body.moves))) {
      if (egg.source !== "egg") continue;
      const have = byUrl.get(egg.url);
      if (!have) byUrl.set(egg.url, egg);
      else if (SOURCE_RANK.egg < SOURCE_RANK[have.source]) byUrl.set(egg.url, { ...have, source: "egg" });
    }
  }
  ordered.length = 0;
  ordered.push(
    ...[...byUrl.values()].sort(
      (a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.level - b.level || a.url.localeCompare(b.url),
    ),
  );
  const detailed = await mapPool(ordered, 8, (entry) => fetchMove(entry.url));
  const out: SpeciesMove[] = [];
  const names = new Set<string>();
  ordered.forEach((entry, i) => {
    const move = detailed[i];
    if (!move) return;
    const key = move.name.toLowerCase();
    if (names.has(key)) return;
    names.add(key);
    out.push({ ...move, source: entry.source, level: entry.level });
  });
  speciesCache.set(slug, out);
  return out;
}

/**
 * Every move the species can learn: level-up, breeding, TM, and tutor.
 * This list is not cut. Wild battles still use movesAtLevel.
 */
export async function fetchSpeciesMoves(name: string): Promise<SpeciesMove[]> {
  const slug = spriteSlug(name);
  if (!slug) return [];
  if (isDittoName(name)) return [{ ...TRANSFORM_MOVE, source: "level-up" }];
  if (speciesCache.has(slug)) return speciesCache.get(slug)!.map((m) => ({ ...m }));
  const pending = speciesInflight.get(slug);
  if (pending) return (await pending).map((m) => ({ ...m }));
  const job = loadSpeciesMoves(slug)
    .catch(() => [] as SpeciesMove[])
    .finally(() => speciesInflight.delete(slug));
  speciesInflight.set(slug, job);
  return (await job).map((m) => ({ ...m }));
}
