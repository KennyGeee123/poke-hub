/**
 * Which cards get the gold frame on set/search tiles.
 * Gold = the printed gold-tier rarities plus the Classic Collection reprints (their frames are gold in print).
 * The old tile test only knew Hyper/Secret/Gold-star, so nothing in the 30th box (Special Illustration Rare,
 * Classic Collection with no rarity at all) ever got one.
 */
export type GoldBorderInput = {
  id?: string;
  name?: string;
  rarity?: string | null;
  set?: { id?: string; name?: string } | null;
};

const GOLD_RARITY =
  /\b(hyper\s*rare|mega\s*hyper|rare\s*holo\s*star|gold\s*star|gold\s*rare|secret\s*rare|rare\s*secret|special\s*illustration|crown\s*rare|rainbow\s*rare)\b/i;
const CLASSIC_SET_ID = /^(30th-c|me55c|cel25c)$/i;

export function isClassicCollectionCard(card: GoldBorderInput): boolean {
  const fromId = String(card.id || "").match(/^(.*)-[^-]+$/)?.[1] || "";
  return (
    CLASSIC_SET_ID.test(String(card.set?.id || "")) ||
    CLASSIC_SET_ID.test(fromId) ||
    /classic\s*collection/i.test(String(card.set?.name || ""))
  );
}

/**
 * Classic Collection prints whose real scan has NO gold frame (verified by eye + edge-colour check, 2026-10-16):
 * these are full-bleed EX / VMAX frames that only carry the gold "30" stamp. Everything else in the set is a printed gold frame.
 */
export const CLASSIC_NOT_GOLD_FRAMED = new Set(["30th-c-004", "30th-c-023", "30th-c-026"]);

/** Same three prints under every id spelling (30th-c-004, me55c-4, me55c-004). */
const PLAIN_CLASSIC_NUMBERS = new Set(["4", "23", "26"]);

function classicLocalNumber(id?: string): string {
  const raw = String(id || "").split("-").pop() || "";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? String(n) : "";
}

export function isGoldBorderCard(card: GoldBorderInput): boolean {
  if (isClassicCollectionCard(card)) {
    if (PLAIN_CLASSIC_NUMBERS.has(classicLocalNumber(card.id))) return false;
    return true;
  }
  return GOLD_RARITY.test(`${card.rarity || ""} ${card.name || ""}`);
}
