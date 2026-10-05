import type { TCGCard } from "@/lib/pokemon-api";
import { localCardNumber } from "@/lib/set-ids";
import extras from "./box-set-extras.json";

/**
 * Official prints the TCGdex box list does not carry (SM "a" reprints, Unseen
 * Forces Unown A-Z/!/?, 30th Celebration Mew R/G/B, Classic Collection
 * Magikarp + 29 other classic reprints). Data ships with the app so these
 * cards show even when api.pokemontcg.io is down. Matched by name + print
 * number: Celebration #030 (Pikachu) and Classic #030 (Magikarp) are both kept.
 * Existing cards with a blank/broken image get the shipped scan overlaid.
 */
type ExtraCard = Omit<TCGCard, "set"> & {
  number: string;
  tcgplayerProductId?: number;
};
type ExtraSet = {
  keys: string[];
  name: string;
  tcgplayerGroupId?: number;
  cards: ExtraCard[];
};

const SETS = (extras as { sets: ExtraSet[] }).sets;
const byKey = new Map<string, ExtraSet[]>();
for (const s of SETS) {
  for (const k of s.keys) {
    const key = k.toLowerCase();
    const list = byKey.get(key) || [];
    list.push(s);
    byKey.set(key, list);
  }
}

function extraSetsFor(setId: string): ExtraSet[] {
  const id = (setId || "").trim().toLowerCase();
  // Exact ids only — alias families would hand Classic Collection to the wrong box.
  return id ? byKey.get(id) || [] : [];
}

function printKey(c: { id?: string; number?: string; name?: string }): string {
  const name = (c.name || "").toLowerCase().replace(/\s+/g, " ").trim();
  const num = localCardNumber({ id: c.id || "", number: c.number }).replace(/\d+/g, (d) =>
    String(Number(d)),
  );
  return `${name}::${num}`;
}

function imageBroken(c: TCGCard): boolean {
  const small = c.images?.small || "";
  const large = c.images?.large || "";
  if (!small && !large) return true;
  // TCGdex Classic cards have image:null → we invent pokemontcg.io/30th-c/030.png
  // which 404s. Treat those invented misses as broken so the shipped scan wins.
  if (/images\.pokemontcg\.io\/(30th-c|me55c)\//i.test(small + large)) return true;
  return false;
}

/** How many shipped extras exist for a set (0 when none). */
export function boxSetExtraCount(setId: string): number {
  return extraSetsFor(setId).reduce((n, s) => n + s.cards.length, 0);
}

/**
 * Prints these extras add on top of the TCGdex count for a set. Classic
 * Collection is excluded: TCGdex already lists it as 30th-c (30 cards) and the
 * 30th family sums Celebration + Classic once, so counting it here would make
 * the 30th tile say 221 instead of 191.
 */
export function boxSetNetExtraCount(setId: string): number {
  return extraSetsFor(setId)
    .filter((s) => !s.keys.some((k) => /^(30th-c|me55c)$/i.test(k)))
    .reduce((n, s) => n + s.cards.length, 0);
}

/** Box cards plus any official prints the box is missing, set info copied from the box. */
export function addBoxSetExtras(setId: string, box: TCGCard[]): TCGCard[] {
  const lists = extraSetsFor(setId);
  if (!lists.length || !box.length) return box;
  const byLocal = new Map<string, TCGCard>();
  const out = box.map((c) => {
    const copy = { ...c, images: { ...c.images } };
    byLocal.set(printKey(copy), copy);
    return copy;
  });
  const set = box[0].set;
  for (const extra of lists) {
    for (const c of extra.cards) {
      const key = printKey(c);
      const hit = byLocal.get(key);
      if (hit) {
        if (imageBroken(hit) && (c.images?.small || c.images?.large)) {
          hit.images = {
            small: c.images.small || hit.images.small,
            large: c.images.large || c.images.small || hit.images.large,
          };
        }
        continue;
      }
      const added: TCGCard = { ...c, set, images: { ...c.images } };
      byLocal.set(key, added);
      out.push(added);
    }
  }
  return out;
}
