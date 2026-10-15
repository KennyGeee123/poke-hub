// Dropship shop core: pure helpers (classification, matching, pricing, parsers).
export type MarkupRule = { min_price: number; max_price: number | null; flat_usd: number; percent: number; min_profit_usd?: number | null };
export type PricingSettings = { min_profit_usd: number; round_99: boolean };

/** Default sliding-scale tiers (admin-editable via public.shop_markup_rules). Percent of the source price. */
export const DEFAULT_MARKUP_RULES: MarkupRule[] = [
  { min_price: 0, max_price: 1, flat_usd: 0, percent: 50, min_profit_usd: 0.1 },
  { min_price: 1, max_price: 5, flat_usd: 0, percent: 40, min_profit_usd: 0.25 },
  { min_price: 5, max_price: 20, flat_usd: 0, percent: 30, min_profit_usd: 0 },
  { min_price: 20, max_price: 50, flat_usd: 0, percent: 20, min_profit_usd: 0 },
  { min_price: 50, max_price: 100, flat_usd: 0, percent: 15, min_profit_usd: 0 },
  { min_price: 100, max_price: 250, flat_usd: 0, percent: 10, min_profit_usd: 0 },
  { min_price: 250, max_price: null, flat_usd: 0, percent: 8, min_profit_usd: 0 },
];
/** Global settings: an optional store-wide profit floor (default 0, per-tier floors do the work) and .99 rounding. */
export const DEFAULT_PRICING: PricingSettings = { min_profit_usd: 0, round_99: false };

/** Dollars → integer cents (exact for 2-decimal inputs; tolerates float noise like 19.999999). */
export const toCents = (usd: number): number => Math.round(Number(usd) * 100);
export const fromCents = (c: number): number => c / 100;

/** Tier for a source price (in cents). Highest matching min wins; min inclusive, max exclusive. */
export function tierFor(sourceCents: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES): MarkupRule | null {
  return [...rules].sort((a, b) => b.min_price - a.min_price)
    .find((r) => sourceCents >= toCents(r.min_price) && (r.max_price == null || sourceCents < toCents(r.max_price))) ?? null;
}

/** Markup in integer cents: flat + percent (half-up), then max(tier floor, global floor). */
export function markupCents(sourceCents: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES, settings: PricingSettings = DEFAULT_PRICING): number {
  const r = tierFor(sourceCents, rules);
  const bp = r ? Math.round(Number(r.percent || 0) * 100) : 0; // basis points, e.g. 12.5% → 1250
  const pct = Math.floor((sourceCents * bp + 5000) / 10000);
  const m = (r ? toCents(r.flat_usd || 0) : 0) + pct;
  return Math.max(m, toCents(r?.min_profit_usd || 0), toCents(settings.min_profit_usd || 0));
}

/** Smallest X.99 at or above the given cents (e.g. 1720 → 1799, 1800 → 1899, 1799 → 1799). */
export function roundUp99(cents: number): number {
  return Math.ceil((cents + 1) / 100) * 100 - 1;
}

export function salePriceCents(sourceCents: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES, settings: PricingSettings = DEFAULT_PRICING): number {
  const c = sourceCents + markupCents(sourceCents, rules, settings);
  return settings.round_99 ? roundUp99(c) : c;
}

/** Back-compat: dollars in, dollars out (computed in cents). */
export function markupFor(price: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES, settings: PricingSettings = DEFAULT_PRICING): number {
  return fromCents(markupCents(toCents(price), rules, settings));
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

export function salePrice(sourcePriceUsd: number, rules: MarkupRule[] = DEFAULT_MARKUP_RULES, settings: PricingSettings = DEFAULT_PRICING): number {
  return fromCents(salePriceCents(toCents(sourcePriceUsd), rules, settings));
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
