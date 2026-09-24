/**
 * Map real card metadata → tilt-view foil overlay.
 * Prefer printed finish over a generic sparkle.
 */

export type FoilStyle =
  | "prism_rainbow" // classic linear / rainbow stripe (WOTC Rare Holo)
  | "cosmos_holo" // neo/e-Card/EX-era cosmos starfield — ONLY when implied
  | "reverse_holo"
  | "secret_gold"
  | "shattered" // VMAX / cracked-ice style
  | "texture_sheen" // modern illustration / 30th textured foil (NO stars/circles)
  | "specular"; // non-holo: clean light only

/** Alias used by InteractiveHoloCard historically */
export type HoloStyle = FoilStyle | "cosmic_galaxy";

export const CELEBRATION_SET_IDS = new Set(["30th", "30th-c", "me55", "me55c"]);

/** Sets whose standard Rare Holos were printed as cosmos (star/circle) sheets */
const COSMOS_ERA_SET_IDS = new Set([
  // Neo
  "neo1",
  "neo2",
  "neo3",
  "neo4",
  // e-Card
  "ecard1",
  "ecard2",
  "ecard3",
  // EX (many cosmos / crosshatch holos)
  "ex1",
  "ex2",
  "ex3",
  "ex4",
  "ex5",
  "ex6",
  "ex7",
  "ex8",
  "ex9",
  "ex10",
  "ex11",
  "ex12",
  "ex13",
  "ex14",
  "ex15",
  "ex16",
  "np",
  "rk1",
  "popupseries",
]);

/** Classic WOTC linear rainbow stripe holos */
const CLASSIC_STRIPE_SET_IDS = new Set([
  "base1",
  "base2",
  "base3",
  "base4",
  "base5",
  "base6",
  "gym1",
  "gym2",
  "si1",
  "basep",
  "bp",
]);

export type FoilCardInput = {
  id?: string;
  name?: string;
  rarity?: string;
  subtypes?: string[];
  set?: { id?: string; name?: string; series?: string; releaseDate?: string };
  tcgplayer?: { prices?: Record<string, unknown> };
};

function norm(s?: string) {
  return (s || "").toLowerCase().trim();
}

function setIdOf(card: FoilCardInput): string {
  const fromSet = norm(card.set?.id);
  if (fromSet) return fromSet;
  const id = norm(card.id);
  const dash = id.indexOf("-");
  return dash > 0 ? id.slice(0, dash) : id;
}

function rarityBlob(card: FoilCardInput): string {
  return `${norm(card.rarity)} ${norm(card.subtypes?.join(" "))} ${norm(card.name)}`;
}

function pricesOf(card: FoilCardInput): string[] {
  return Object.keys(card.tcgplayer?.prices || {}).map((k) => k.toLowerCase());
}

/** True when the printed finish is some kind of foil (holo / reverse / textured). */
export function cardHasFoilFinish(card: FoilCardInput): boolean {
  const r = rarityBlob(card);
  const prices = pricesOf(card);
  if (prices.some((k) => /holo|reverse/i.test(k))) return true;
  if (
    /holo|holofoil|reverse|secret|illustration|special\s*illustration|hyper|rainbow|gold|amazing|radiant|shiny|ace\s*spec|ultra\s*rare|rare\s*ultra/i.test(
      r,
    )
  ) {
    return true;
  }
  // V / VMAX / ex / GX frames almost always carry foil texture
  if (/\b(vmax|vstar|gx|\bv\b|\bex\b)\b/i.test(r)) return true;
  if (CELEBRATION_SET_IDS.has(setIdOf(card)) && /rare|promo|classic/i.test(r)) return true;
  return false;
}

/**
 * Resolve the overlay that best matches the physical card.
 * Celebration / illustration cards never get cosmos starfields.
 */
export function resolveFoilStyle(card: FoilCardInput): FoilStyle {
  const setId = setIdOf(card);
  const r = rarityBlob(card);
  const prices = pricesOf(card);
  const series = norm(card.set?.series);
  const setName = norm(card.set?.name);

  const isReverse =
    /reverse/.test(r) ||
    prices.some((k) => k.includes("reverse")) ||
    /reverse\s*holo/.test(setName);

  const isSecretish =
    /secret|hyper\s*rare|gold\s*star|rainbow\s*rare|gold\s*rare|crown\s*rare|amazing\s*rare/i.test(
      r,
    );

  const isIllustration =
    /illustration|special\s*art|alt\s*art|full\s*art|trainer\s*gallery/i.test(r) ||
    /\b(sir|sar|sr)\b/i.test(norm(card.rarity));

  const isVmax = /\bvmax\b|\bvstar\b/i.test(r);
  const isModernEx = /\bex\b/i.test(r) && !/gx/i.test(r);
  const isVOrGx = /\b(gx|\bv\b)\b/i.test(r);

  const celebration =
    CELEBRATION_SET_IDS.has(setId) ||
    /30th|classic\s*collection|celebration/i.test(`${setId} ${setName} ${series}`);

  // ─── 30th / Classic Celebration / modern illustration ───
  // Real cards: textured / soft rainbow foil in art — NEVER cosmos stars or circle fields.
  if (celebration) {
    if (isReverse) return "reverse_holo";
    if (isSecretish) return "texture_sheen";
    if (cardHasFoilFinish(card) || /rare|promo|classic|holo/i.test(r)) return "texture_sheen";
    return "specular";
  }

  if (isReverse) return "reverse_holo";
  if (isSecretish) return "secret_gold";
  if (isVmax) return "shattered";
  if (isIllustration) return "texture_sheen";

  // Cosmos ONLY when set era / rarity explicitly implies cosmos holo sheet
  const cosmosImplied =
    COSMOS_ERA_SET_IDS.has(setId) ||
    /cosmos/.test(r) ||
    (/rare\s*holo|holo\s*rare/i.test(r) &&
      /neo|e-card|e card|ex series|nintendo black star/i.test(`${series} ${setName}`));

  if (cosmosImplied && /holo/i.test(r) && !isReverse) {
    return "cosmos_holo";
  }

  // Classic Base / Jungle / Fossil style linear rainbow stripe
  if (
    CLASSIC_STRIPE_SET_IDS.has(setId) ||
    /wizards|base\s*set|jungle|fossil|team\s*rocket|gym\s*(heroes|challenge)/i.test(
      `${series} ${setName}`,
    )
  ) {
    if (/holo/i.test(r) || prices.some((k) => /holofoil/i.test(k) && !/reverse/i.test(k))) {
      return "prism_rainbow";
    }
  }

  if (isVOrGx || isModernEx) return "texture_sheen";

  if (cardHasFoilFinish(card) || /holo/i.test(r)) {
    // Default modern / unknown holo → prism stripe, NOT cosmos
    return "prism_rainbow";
  }

  return "specular";
}

export function foilStyleLabel(style: FoilStyle): string {
  switch (style) {
    case "prism_rainbow":
      return "Rainbow stripe";
    case "cosmos_holo":
      return "Cosmos holo";
    case "reverse_holo":
      return "Reverse holo";
    case "secret_gold":
      return "Secret / gold";
    case "shattered":
      return "Shattered";
    case "texture_sheen":
      return "Texture foil";
    case "specular":
      return "Specular";
  }
}

/** Normalize legacy UI style ids */
export function normalizeHoloStyle(style: HoloStyle | FoilStyle | string | undefined): FoilStyle {
  if (!style) return "prism_rainbow";
  if (style === "cosmic_galaxy") return "cosmos_holo";
  if (
    style === "prism_rainbow" ||
    style === "cosmos_holo" ||
    style === "reverse_holo" ||
    style === "secret_gold" ||
    style === "shattered" ||
    style === "texture_sheen" ||
    style === "specular"
  ) {
    return style;
  }
  return "prism_rainbow";
}
