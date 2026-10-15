import type { TCGCard } from "./pokemon-api";

export type CardHint = {
  name?: string | null;
  hp?: string | null;
  setNumber?: string | null;
  setName?: string | null;
};

const norm = (s: string | null | undefined) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Score a search hit against what the vision model read off the card. */
export function scoreCardHit(card: TCGCard, hint: CardHint): number {
  let s = 0;
  const n = norm(hint.name);
  if (n && norm(card.name) === n) s += 20;
  else if (n && norm(card.name).startsWith(n.split(" ")[0])) s += 5;
  const sn = String(hint.setNumber || "").match(/^\s*([A-Za-z]*\d+[A-Za-z]*)\s*(?:\/\s*(\d+))?/);
  if (sn) {
    const num = sn[1].replace(/^0+/, "").toLowerCase();
    if (String(card.number || "").replace(/^0+/, "").toLowerCase() === num) s += 40;
    const total = sn[2] ? Number(sn[2]) : null;
    if (total && card.set?.printedTotal === total) s += 25;
  }
  if (hint.hp && String(card.hp || "") === String(hint.hp).replace(/\D/g, "")) s += 10;
  const hs = norm(hint.setName);
  const cs = norm(card.set?.name);
  if (hs && cs) {
    if (hs === cs) s += 15;
    else if (cs.includes(hs) || hs.includes(cs)) s += 8;
  }
  return s;
}

/** Stable sort: best printing match first; ties keep the API order. */
export function rankCardHits(cards: TCGCard[], hint: CardHint): TCGCard[] {
  return cards
    .map((c, i) => ({ c, i, s: scoreCardHit(c, hint) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}
