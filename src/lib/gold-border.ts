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
 * Classic Collection prints whose real scan has NO uniform gold frame
 * (edge check 2026-10-16). Genesect EX, M Gardevoir EX, and Mew VMAX are
 * full-bleed and only carry the gold "30" stamp.
 * me55c-4 is Charizard 4/102, which does have the printed gold edge.
 * Do not treat every id ending in 4 as that full-bleed slot.
 */
export const CLASSIC_NOT_GOLD_FRAMED = new Set(["30th-c-004", "30th-c-023", "30th-c-026"]);

const FULL_BLEED_SCRYDEX = new Set(["me55c-11g", "me55c-106m", "me55c-114"]);

/** Sequential Classic slots only (30th-c-004). Not the number printed on the original card. */
const FULL_BLEED_SLOTS = new Set(["4", "23", "26"]);

function classicSlot(id?: string): string {
  const set = String(id || "").match(/^(?:30th-c|cel25c)-(\d+)$/i);
  if (!set) return "";
  const n = parseInt(set[1], 10);
  return Number.isFinite(n) ? String(n) : "";
}

export function isGoldBorderCard(card: GoldBorderInput): boolean {
  if (isClassicCollectionCard(card)) {
    const id = String(card.id || "").toLowerCase();
    if (FULL_BLEED_SCRYDEX.has(id) || CLASSIC_NOT_GOLD_FRAMED.has(id)) return false;
    if (FULL_BLEED_SLOTS.has(classicSlot(card.id))) return false;
    return true;
  }
  if (/^crown$/i.test(String(card.rarity || "").trim())) return true; // TCGdex's name for Crown Zenith's gold Crown Rares
  return GOLD_RARITY.test(`${card.rarity || ""} ${card.name || ""}`);
}
