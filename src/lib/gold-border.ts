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

export function isGoldBorderCard(card: GoldBorderInput): boolean {
  if (isClassicCollectionCard(card)) return true;
  return GOLD_RARITY.test(`${card.rarity || ""} ${card.name || ""}`);
}
