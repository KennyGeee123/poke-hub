// Dropship shop core: pure helpers (classification, matching, pricing, parsers).
export type MarkupRule = { min_price: number; max_price: number | null; flat_usd: number; percent: number };
/** Default tiers (admin can override via public.shop_markup_rules). */
export const DEFAULT_MARKUP_RULES: MarkupRule[] = [
  { min_price: 0, max_price: 20, flat_usd: 5, percent: 0 },
  { min_price: 20, max_price: 100, flat_usd: 10, percent: 0 },
  { min_price: 100, max_price: null, flat_usd: 0, percent: 8 },
];

export function markupFor(price: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES): number {
  const r = [...rules].sort((a, b) => b.min_price - a.min_price).find((r) => price >= r.min_price && (r.max_price == null || price < r.max_price));
  if (!r) return 0;
  return Number(r.flat_usd || 0) + (price * Number(r.percent || 0)) / 100;
}
export const SOURCE_FX: Record<string, number> = { USD: 1, CAD: 0.73 };

export type ProductKind = "sealed" | "single";
export type SourceListing = {
  source: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  inStock: boolean;
};

export function salePrice(sourcePriceUsd: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES): number {
  return Math.round((sourcePriceUsd + markupFor(sourcePriceUsd, rules)) * 100) / 100;
}

export function toUsd(price: number, currency: string): number {
  return Math.round(price * (SOURCE_FX[currency] ?? 1) * 100) / 100;
}

const TYPES: [RegExp, string][] = [
  [/\bcase\b/i, "case"],
  [/pok[eé]mon center elite trainer box/i, "pc_etb"],
  [/elite trainer box|\betb\b/i, "etb"],
  [/booster box|booster display/i, "booster_box"],
  [/booster bundle/i, "bundle"],
  [/booster pack/i, "pack"],
  [/blister/i, "blister"],
  [/\btin\b/i, "tin"],
  [/ultra[- ]premium collection|\bupc\b/i, "upc"],
  [/collection|\bbox\b/i, "collection"],
];

export function sealedType(name: string): string | null {
  if (/code card|sleeve|deck box|binder|portfolio|playmat|\bdice\b/i.test(name)) return null;
  for (const [re, t] of TYPES) if (re.test(name)) return t;
  return null;
}

/** Strip TCGplayer group prefixes like "ME06: " and "SV: ". */
export function cleanSetName(group: string): string {
  return group.replace(/^[A-Z0-9]{1,6}:\s*/, "").trim();
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\b(pokemon|tcg|scarlet (and|&) violet|sword (and|&) shield|mega evolution|the|english|and|&)\b/g, " ")
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sealedMatchKey(setName: string, type: string): string {
  return `${type}|${norm(cleanSetName(setName))}`;
}

/** Does an external retailer title describe the same sealed product? */
export function titleMatches(title: string, setName: string, type: string): boolean {
  if (sealedType(title) !== type) return false;
  const want = norm(cleanSetName(setName)).split(" ").filter((w) => w.length > 1);
  if (!want.length) return false;
  const have = new Set(norm(title).split(" "));
  return want.every((w) => have.has(w));
}

/** Parse a Shopify /search/suggest.json payload. */
export function parseShopifySuggest(
  json: unknown,
  source: string,
  origin: string,
  currency: string,
): SourceListing[] {
  const products =
    (json as { resources?: { results?: { products?: Record<string, unknown>[] } } })?.resources
      ?.results?.products ?? [];
  return products
    .map((p) => ({
      source,
      title: String(p.title ?? ""),
      price: parseFloat(String(p.price ?? "")),
      currency,
      url: origin + String(p.url ?? "").split("?")[0],
      inStock: p.available !== false,
    }))
    .filter((l) => l.title && Number.isFinite(l.price) && l.price > 0);
}

export function cheapest<T extends { price: number; inStock: boolean; currency: string }>(
  ls: T[],
): T | null {
  const ok = ls.filter((l) => l.inStock && l.price > 0);
  ok.sort((a, b) => toUsd(a.price, a.currency) - toUsd(b.price, b.currency));
  return ok[0] ?? null;
}
