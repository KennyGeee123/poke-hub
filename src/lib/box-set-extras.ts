import type { TCGCard } from "@/lib/pokemon-api";
import { localCardNumber } from "@/lib/set-ids";
import extras from "./box-set-extras.json";

/**
 * Official prints the TCGdex box list does not carry (SM "a" reprints, Unseen
 * Forces Unown A-Z/!/?, 30th Celebration Mew R/G/B). Data comes from the
 * pokemontcg.io dump (PokemonTCG/pokemon-tcg-data), shipped with the app so
 * these cards show even when api.pokemontcg.io is down. Matched by print
 * number only: a card the box already has is never added twice.
 */
type ExtraCard = Omit<TCGCard, "set"> & { number: string };
type ExtraSet = { keys: string[]; name: string; cards: ExtraCard[] };

const SETS = (extras as { sets: ExtraSet[] }).sets;
const byKey = new Map<string, ExtraSet>();
for (const s of SETS) for (const k of s.keys) byKey.set(k.toLowerCase(), s);

function extraSetFor(setId: string): ExtraSet | undefined {
  const id = (setId || "").trim().toLowerCase();
  // Exact ids only (keys carry both the pokemontcg and TCGdex id). Alias
  // families would hand 30th Classic Collection the Celebration Mews.
  return id ? byKey.get(id) : undefined;
}

function printKey(c: { id: string; number?: string }): string {
  return localCardNumber(c).replace(/\d+/g, (d) => String(Number(d)));
}

/** How many shipped extras exist for a set (0 when none). */
export function boxSetExtraCount(setId: string): number {
  return extraSetFor(setId)?.cards.length ?? 0;
}

/** Box cards plus any official prints the box is missing, set info copied from the box. */
export function addBoxSetExtras(setId: string, box: TCGCard[]): TCGCard[] {
  const extra = extraSetFor(setId);
  if (!extra || !box.length) return box;
  const have = new Set(box.map(printKey));
  const set = box[0].set;
  const out = box.slice();
  for (const c of extra.cards) {
    const key = printKey(c);
    if (have.has(key)) continue;
    have.add(key);
    out.push({ ...c, set });
  }
  return out;
}
