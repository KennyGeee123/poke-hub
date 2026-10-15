import { searchCards, type TCGCard } from "./pokemon-api";
import { rankCardHits, type CardHint } from "./card-match";

const SUFFIX = /\s+(ex|EX|V|VMAX|VSTAR|GX|BREAK|LV\.?X)$/i;

/** Most-specific-first lookup for a card the vision model read; results ranked by printing match. */
export async function findCardsForHint(hint: CardHint & { supertype?: string | null }): Promise<TCGCard[]> {
  const cleaned = String(hint.name || "").replace(/[“”"]/g, "").trim();
  if (!cleaned) return [];
  const core = cleaned.replace(SUFFIX, "").trim() || cleaned;
  const quote = (s: string) => `"${s.replace(/"/g, "")}"`;
  const num = String(hint.setNumber || "").match(/^\s*([A-Za-z]*\d+[A-Za-z]*)/)?.[1]?.replace(/^0+(?=\d)/, "");
  const queries: string[] = [];
  if (num) queries.push(`name:${quote(cleaned)} number:${num}`);
  if (num && core !== cleaned) queries.push(`name:${quote(core)}* number:${num}`);
  if (hint.hp) queries.push(`name:${quote(core)}* hp:${String(hint.hp).replace(/\D/g, "")}`);
  queries.push(`name:${quote(cleaned)}`);
  queries.push(`name:${quote(core)}*`);
  for (const q of queries) {
    try {
      const r = await searchCards({ q, pageSize: 40, orderBy: "-set.releaseDate" });
      if (r.data?.length) return rankCardHits(r.data, hint);
    } catch {
      /* try the next, broader query */
    }
  }
  return [];
}
