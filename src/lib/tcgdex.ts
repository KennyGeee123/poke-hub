// TCGdex API — free, no key. Multi-language alt artworks + catalog fallback.
// https://api.tcgdex.net/v2/<lang>/cards/<id>  (id format: <set-id>-<number>)
import type { TCGCard, TCGPrice, TCGSet } from "@/lib/pokemon-api";

const BASE = "https://api.tcgdex.net/v2";
const EN = `${BASE}/en`;

export type TCGdexCard = {
  id: string;
  name: string;
  image?: string; // base URL without quality/extension
  localId?: string | number;
  variants?: Record<string, boolean>;
  rarity?: string;
  hp?: number | string;
  types?: string[];
  illustrator?: string;
  category?: string;
  evolveFrom?: string;
  description?: string;
  set?: any;
  serie?: { id?: string; name?: string };
  pricing?: any;
  attacks?: any[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreat?: number;
};

async function j<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export type AltArt = { lang: string; url: string };

function assetUrl(base?: string | null, ext = "webp"): string {
  if (!base) return "";
  if (/\.(png|jpg|jpeg|webp)$/i.test(base)) return base;
  return `${base}.${ext}`;
}

function cardImages(card: { image?: string; id?: string; localId?: string | number; set?: any; number?: string }): { small: string; large: string } {
  const img = card.image;
  if (typeof img === "string" && img) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(img) && !/\/(high|low)\./i.test(img)) {
      return { small: `${img}/low.webp`, large: `${img}/high.webp` };
    }
    return { small: img, large: img };
  }
  const setId = card.set?.id || (card.id || "").split("-")[0];
  const num = String(card.localId ?? card.number ?? (card.id || "").split("-").slice(1).join("-") ?? "");
  if (setId && num) {
    return {
      small: `https://images.pokemontcg.io/${setId}/${num}.png`,
      large: `https://images.pokemontcg.io/${setId}/${num}_hires.png`,
    };
  }
  return { small: "", large: "" };
}

const TP_VARIANT: Record<string, string> = {
  normal: "normal",
  holofoil: "holofoil",
  holo: "holofoil",
  reverse: "reverseHolofoil",
  "reverse-holofoil": "reverseHolofoil",
  reverseholofoil: "reverseHolofoil",
  "1st-edition": "1stEdition",
  "1st-edition-holofoil": "1stEditionHolofoil",
  unlimited: "unlimited",
  "unlimited-holofoil": "unlimitedHolofoil",
};

function mapTcgplayerPrices(pricing: any): Record<string, TCGPrice> | undefined {
  const tp = pricing?.tcgplayer;
  if (!tp || typeof tp !== "object") return undefined;
  const prices: Record<string, TCGPrice> = {};
  for (const [k, raw] of Object.entries(tp)) {
    if (!raw || typeof raw !== "object" || k === "updated" || k === "unit") continue;
    const p = raw as any;
    const mapped: TCGPrice = {};
    const market = Number(p.marketPrice ?? p.market);
    const mid = Number(p.midPrice ?? p.mid);
    const low = Number(p.lowPrice ?? p.low);
    const directLow = Number(p.directLowPrice ?? p.directLow);
    const high = Number(p.highPrice ?? p.high);
    if (Number.isFinite(market) && market > 0) mapped.market = market;
    if (Number.isFinite(mid) && mid > 0) mapped.mid = mid;
    if (Number.isFinite(low) && low > 0) mapped.low = low;
    if (Number.isFinite(directLow) && directLow > 0) mapped.directLow = directLow;
    if (Number.isFinite(high) && high > 0) mapped.high = high;
    if (Object.keys(mapped).length) prices[TP_VARIANT[k] ?? k] = mapped;
  }
  return Object.keys(prices).length ? prices : undefined;
}

export function mapTcgdexSet(s: any): TCGSet {
  const total = Number(s?.cardCount?.total ?? s?.total ?? s?.cardCount?.official ?? 0) || 0;
  const printed = Number(s?.cardCount?.official ?? s?.printedTotal ?? total) || 0;
  return {
    id: String(s?.id ?? ""),
    name: String(s?.name ?? ""),
    series: String(s?.serie?.name ?? s?.series ?? ""),
    printedTotal: printed,
    total,
    releaseDate: String(s?.releaseDate ?? ""),
    images: {
      symbol: assetUrl(s?.symbol ?? s?.images?.symbol),
      logo: assetUrl(s?.logo ?? s?.images?.logo),
    },
  };
}

export function mapTcgdexCard(card: any, setOverride?: any): TCGCard {
  const setSrc = setOverride ?? card?.set ?? {};
  const setMapped = mapTcgdexSet(setSrc);
  const number = String(card?.localId ?? card?.number ?? "");
  const hp = card?.hp == null ? undefined : String(card.hp);
  const tpPrices = mapTcgplayerPrices(card?.pricing);
  const cm = card?.pricing?.cardmarket;
  const images = cardImages({ ...card, set: setSrc, number });
  const attacks = Array.isArray(card?.attacks)
    ? card.attacks.map((a: any) => ({
        name: String(a?.name ?? ""),
        cost: a?.cost,
        convertedEnergyCost: a?.convertedEnergyCost,
        damage: a?.damage == null ? undefined : String(a.damage),
        text: a?.text ?? a?.effect,
      }))
    : undefined;
  const out: TCGCard = {
    id: String(card?.id ?? ""),
    name: String(card?.name ?? ""),
    supertype: card?.category,
    hp,
    types: card?.types,
    evolvesFrom: card?.evolveFrom,
    rarity: card?.rarity,
    number,
    artist: card?.illustrator ?? card?.artist,
    flavorText: card?.description,
    set: {
      id: setMapped.id || String(setSrc?.id ?? (card?.id || "").split("-")[0] ?? ""),
      name: setMapped.name || String(setSrc?.name ?? ""),
      series: setMapped.series || setSrc?.serie?.name,
      printedTotal: setMapped.printedTotal,
      total: setMapped.total,
      releaseDate: setMapped.releaseDate || setSrc?.releaseDate,
      images: { logo: setMapped.images.logo, symbol: setMapped.images.symbol },
    },
    images,
    attacks,
    weaknesses: card?.weaknesses,
    resistances: card?.resistances,
  };
  if (tpPrices) {
    out.tcgplayer = {
      updatedAt: card?.pricing?.tcgplayer?.updated,
      prices: tpPrices,
    };
  }
  if (cm && typeof cm === "object") {
    out.cardmarket = {
      updatedAt: cm.updated,
      prices: {
        averageSellPrice: cm.avg ?? cm.averageSellPrice,
        lowPrice: cm.low ?? cm.lowPrice,
        trendPrice: cm.trend ?? cm.trendPrice,
        avg1: cm.avg1,
        avg7: cm.avg7,
        avg30: cm.avg30,
        reverseHoloTrend: cm["trend-holo"] ?? cm.reverseHoloTrend,
      },
    };
  }
  return out;
}

export function tcgdexSearchName(q?: string): string {
  if (!q) return "";
  const nameMatch = q.match(/name:\s*"?([^"*:]+)/i);
  if (nameMatch) return nameMatch[1].trim();
  let s = q;
  s = s.replace(/\b[\w.]+:\[[^\]]+\]/g, " ");
  s = s.replace(/\b[\w.]+:[^\s]+/g, " ");
  s = s.replace(/["*():]/g, " ");
  s = s.replace(/\b(AND|OR|NOT)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

export async function tcgdexGetCard(id: string): Promise<TCGCard | null> {
  const raw = await j<any>(`${EN}/cards/${encodeURIComponent(id)}`);
  if (!raw?.id) return null;
  return mapTcgdexCard(raw);
}

export async function tcgdexSearchCards(name: string, limit = 50): Promise<TCGCard[]> {
  const q = name.trim();
  if (!q) return [];
  const raw = await j<any[]>(`${EN}/cards?name=${encodeURIComponent(q)}`);
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.slice(0, limit).map((c) => mapTcgdexCard(c));
}

export async function tcgdexGetSets(): Promise<TCGSet[]> {
  const raw = await j<any[]>(`${EN}/sets`);
  if (!Array.isArray(raw)) return [];
  return raw.map(mapTcgdexSet).filter((s) => s.id);
}

export async function tcgdexGetSetCards(setId: string): Promise<TCGCard[]> {
  const raw = await j<any>(`${EN}/sets/${encodeURIComponent(setId)}`);
  if (!raw) return [];
  const cards = Array.isArray(raw.cards) ? raw.cards : [];
  return cards.map((c: any) => mapTcgdexCard(c, raw));
}

export async function tcgdexRecentCards(limit = 32): Promise<TCGCard[]> {
  const sets = await j<any[]>(`${EN}/sets`);
  if (!Array.isArray(sets) || !sets.length) return [];
  const recent = sets.slice(-8).reverse();
  const out: TCGCard[] = [];
  for (const s of recent) {
    if (!s?.id) continue;
    const full = await j<any>(`${EN}/sets/${encodeURIComponent(s.id)}`);
    const cards = full?.cards ?? [];
    for (const c of cards) {
      out.push(mapTcgdexCard(c, full ?? s));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// pokemontcg.io IDs look like "swsh4-25". TCGdex uses similar ids but with their own set codes.
// We try direct lookup; falls back to search-by-name within the same set series.
export async function getAltArtworks(card: { id: string; name: string; number?: string; set: { id: string; name: string } }): Promise<AltArt[]> {
  const langs = ["en", "fr", "es", "it", "de", "pt", "ja"];
  const results: AltArt[] = [];

  const candidateId = card.number ? `${card.id.split("-")[0]}-${card.number}` : card.id;

  await Promise.all(langs.map(async (lang) => {
    const direct = await j<TCGdexCard>(`${BASE}/${lang}/cards/${candidateId}`);
    if (direct?.image) {
      results.push({ lang, url: `${direct.image}/high.webp` });
      return;
    }
    const search = await j<TCGdexCard[]>(`${BASE}/${lang}/cards?name=${encodeURIComponent(card.name)}`);
    const hit = search?.find(c => c.image);
    if (hit?.image) results.push({ lang, url: `${hit.image}/high.webp` });
  }));

  return results;
}
