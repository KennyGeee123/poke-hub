/**
 * One place that answers "which card is this?" from a card id.
 *
 * TCGdex set ids can contain hyphens (30th-c, tk-ex-latia, P-A), and local
 * ids never do, so the set id is everything before the LAST hyphen. The old
 * `id.split("-")[0]` turned 30th Classic Collection Charizard (30th-c-001)
 * into 30th-001, which is Exeggcute from 30th Celebration: the detail page
 * showed Exeggcute's scan under Charizard's name and price.
 */

export type CardIdParts = { setId: string; localId: string };

type CardLike = {
  id?: string;
  number?: string;
  name?: string;
  set?: { id?: string; printedTotal?: number; total?: number; name?: string };
};

/** Split a card id into set id + local number. `setIdHint` wins when it prefixes the id. */
export function parseCardId(id: string, setIdHint?: string): CardIdParts {
  const raw = String(id || "").trim();
  const hint = String(setIdHint || "").trim();
  // A hint only wins when the rest is a whole local id: a Classic card stamped
  // with the canonical box id "30th" must still parse 30th-c-001 as 30th-c / 001.
  if (hint && raw.toLowerCase().startsWith(`${hint.toLowerCase()}-`)) {
    const rest = raw.slice(hint.length + 1);
    if (rest && !rest.includes("-")) return { setId: raw.slice(0, hint.length), localId: rest };
  }
  const cut = raw.lastIndexOf("-");
  if (cut <= 0 || cut === raw.length - 1) return { setId: raw, localId: "" };
  return { setId: raw.slice(0, cut), localId: raw.slice(cut + 1) };
}

/** Set id for a card: its own set first, else parsed from the id. */
export function cardSetId(card: CardLike): string {
  return String(card.set?.id || "").trim() || parseCardId(card.id || "").setId;
}

/** Local print number for a card: its own number first, else parsed from the id. */
export function cardLocalId(card: CardLike): string {
  const num = String(card.number ?? "").trim();
  if (num) return num;
  return parseCardId(card.id || "", card.set?.id).localId;
}

/** Same print number ignoring zero padding ("001" = "1", "SV001" = "SV1"). */
export function sameLocalId(a: string, b: string): boolean {
  const norm = (s: string) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\d+/g, (d) => String(Number(d)));
  return !!a && !!b && norm(a) === norm(b);
}

/** Card names compared loosely: case, accents (Poké/Poke) and punctuation ignored. */
export function normCardName(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function sameCardName(a?: string, b?: string): boolean {
  const x = normCardName(a || "");
  const y = normCardName(b || "");
  return !!x && x === y;
}

/**
 * True when a looked-up record (TCGdex card, price row) is the SAME card:
 * same set, same number, and (when both carry one) the same name.
 */
export function isSameCard(
  card: CardLike,
  other: {
    id?: string;
    localId?: string | number;
    number?: string;
    name?: string;
    set?: { id?: string };
  },
): boolean {
  const want = { setId: cardSetId(card), localId: cardLocalId(card) };
  const otherParts = parseCardId(String(other.id || ""), other.set?.id);
  const otherSet = String(other.set?.id || otherParts.setId || "");
  const otherLocal = String(other.localId ?? other.number ?? otherParts.localId ?? "");
  if (!want.setId || otherSet.toLowerCase() !== want.setId.toLowerCase()) return false;
  if (!sameLocalId(want.localId, otherLocal)) return false;
  if (card.name && other.name && !sameCardName(card.name, other.name)) return false;
  return true;
}

/**
 * Header number: "001/128". Sets with no printed total (TCGdex reports
 * official: 0 for 30th Classic Collection, Promos-A, MEP promos) used to
 * render "#001/0". Box sets fall back to their card count; promo lines just
 * show the number.
 */
export function formatCardNumber(card: CardLike): string {
  const num = cardLocalId(card);
  if (!num) return "";
  const printed = Number(card.set?.printedTotal || 0);
  if (printed > 0) return `${num}/${printed}`;
  const total = Number(card.set?.total || 0);
  const promo =
    /promo/i.test(card.set?.name || "") ||
    /^(p-a|mep|svp|swshp|smp|xyp|bwp)$/i.test(cardSetId(card));
  if (total > 0 && !promo) return `${num}/${String(total).padStart(Math.min(3, num.length), "0")}`;
  return num;
}
