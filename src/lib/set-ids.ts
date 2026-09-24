/** pokemontcg.io ↔ TCGdex set-id aliases (me2pt5 ↔ me02.5, me1 ↔ me01, …). */

const SET_ID_GROUPS: string[][] = [
  ["me1", "me01"],
  ["me2", "me02"],
  ["me2pt5", "me02.5"],
  ["me3", "me03"],
  ["me4", "me04"],
  ["me5", "me05"],
  ["me55", "30th"],
  ["me55c", "30th-c"],
  ["zsv10pt5", "sv10.5b"],
  ["wsv10pt5", "sv10.5w"],
  ["sv8", "sv08"],
  ["sv3", "sv03"],
  ["sv3pt5", "sv03.5"],
];

export type SetCardLike = {
  id: string;
  number?: string;
  name?: string;
  tcgplayer?: { prices?: unknown } | undefined;
  cardmarket?: unknown;
  set?: { total?: number; printedTotal?: number };
};

function aliasRank(id: string): number {
  if (id.includes(".")) return 0;
  if (/^[a-z]+\d+pt\d+/i.test(id)) return 3;
  if (/^[a-z]+0\d/i.test(id)) return 1;
  return 2;
}

/** Every known id for a box set, TCGdex-native forms first. */
export function setIdAliases(id: string): string[] {
  const raw = (id || "").trim();
  if (!raw) return [];
  const out = new Set<string>();
  const lower = raw.toLowerCase();
  out.add(raw);
  out.add(lower);

  for (const group of SET_ID_GROUPS) {
    if (group.some((g) => g.toLowerCase() === lower)) {
      for (const g of group) out.add(g);
    }
  }

  const plain = lower.match(/^([a-z]+)(\d+)$/);
  if (plain) {
    const [, prefix, digits] = plain;
    out.add(`${prefix}${String(Number(digits))}`);
    if (digits.length === 1) out.add(`${prefix}${digits.padStart(2, "0")}`);
  }

  const pt = lower.match(/^([a-z]+)(\d+)pt(\d+)$/);
  if (pt) {
    const [, prefix, a, b] = pt;
    const aPad = a.length === 1 ? a.padStart(2, "0") : a;
    out.add(`${prefix}${a}.${b}`);
    out.add(`${prefix}${aPad}.${b}`);
    out.add(`${prefix}${Number(a)}.${b}`);
  }

  const dotted = lower.match(/^([a-z]+)(\d+)\.(\d+)([a-z]?)$/);
  if (dotted) {
    const [, prefix, a, b, suf] = dotted;
    out.add(`${prefix}${Number(a)}pt${b}${suf}`);
    out.add(`${prefix}${a}pt${b}${suf}`);
    if (prefix === "sv" && suf === "b") out.add(`zsv${Number(a)}pt${b}`);
    if (prefix === "sv" && suf === "w") out.add(`wsv${Number(a)}pt${b}`);
  }

  return [...out].sort((a, b) => aliasRank(a) - aliasRank(b) || a.localeCompare(b));
}

export function localCardNumber(card: SetCardLike): string {
  const fromNum = String(card.number || "").trim();
  const fromId = String(card.id || "").split("-").slice(1).join("-");
  const raw = fromNum || fromId;
  const stripped = raw.replace(/^0+(?=\d)/, "");
  return (stripped || raw || "0").toLowerCase();
}

/** Merge two dumps of the same box set; pad-variant ids (me02.5-001 / me2pt5-1) collapse. */
export function mergeSetCardsByLocalId<T extends SetCardLike>(primary: T[], extra: T[]): T[] {
  const out: T[] = [];
  const byId = new Set<string>();
  const byLocal = new Map<string, T>();

  const take = (c: T) => {
    if (!c?.id) return;
    const id = c.id.toLowerCase();
    const local = `${(c.name || "").toLowerCase().trim()}::${localCardNumber(c)}`;
    if (byId.has(id)) {
      const prev = byLocal.get(local);
      if (prev && !prev.tcgplayer?.prices && c.tcgplayer?.prices) {
        prev.tcgplayer = c.tcgplayer;
        if (c.cardmarket && !prev.cardmarket) prev.cardmarket = c.cardmarket;
      }
      return;
    }
    const prev = byLocal.get(local);
    if (prev) {
      if (!prev.tcgplayer?.prices && c.tcgplayer?.prices) {
        prev.tcgplayer = c.tcgplayer;
        if (c.cardmarket && !prev.cardmarket) prev.cardmarket = c.cardmarket;
      }
      byId.add(id);
      return;
    }
    out.push(c);
    byId.add(id);
    byLocal.set(local, c);
  };

  for (const c of primary) take(c);
  for (const c of extra) take(c);
  return out;
}

/** Copy live quotes onto the box list. Never adds extra rows. */
export function overlaySetPrices<T extends SetCardLike>(box: T[], quotes: T[]): T[] {
  if (!quotes.length) return box;
  const byLocal = new Map<string, T>();
  for (const c of box) {
    byLocal.set(`${(c.name || "").toLowerCase().trim()}::${localCardNumber(c)}`, c);
  }
  for (const q of quotes) {
    const hit = byLocal.get(`${(q.name || "").toLowerCase().trim()}::${localCardNumber(q)}`);
    if (!hit) continue;
    if (!hit.tcgplayer?.prices && q.tcgplayer?.prices) hit.tcgplayer = q.tcgplayer;
    if (!hit.cardmarket && q.cardmarket) hit.cardmarket = q.cardmarket;
  }
  return box;
}

export function expectedSetTotal(cards: SetCardLike[], fallback = 0): number {
  let max = fallback;
  for (const c of cards) {
    const total = Number(c.set?.total || 0);
    const printed = Number(c.set?.printedTotal || 0);
    if (total > max) max = total;
    if (printed > max) max = printed;
  }
  return max;
}

export function setCardsLookComplete(cards: unknown[] | null | undefined, expected = 0): boolean {
  const n = cards?.length ?? 0;
  if (!n) return false;
  // Unknown expected size is NOT complete — keep fetching the rest of the box.
  if (expected <= 0) return false;
  return n >= expected;
}

export function sortSetCards<T extends SetCardLike>(cards: T[]): T[] {
  return cards.slice().sort((a, b) => {
    const na = Number(String(a.number || "").replace(/[^\d]/g, ""));
    const nb = Number(String(b.number || "").replace(/[^\d]/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.number || a.id).localeCompare(String(b.number || b.id), undefined, { numeric: true });
  });
}
