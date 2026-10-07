// TCGdex API — free, no key. Multi-language alt artworks + catalog fallback.
// https://api.tcgdex.net/v2/<lang>/cards/<id>  (id format: <set-id>-<number>)
import type { TCGCard, TCGPrice, TCGSet } from "@/lib/pokemon-api";
import { boxSetNetExtraCount, shippedPrint } from "@/lib/box-set-extras";
import { parseCardId } from "@/lib/card-identity";
import { mergeSetCardsByLocalId, setIdAliases } from "@/lib/set-ids";

/**
 * TCGdex set shells with no cards on TCGdex or pokemontcg (checked 2026-10-03:
 * /sets/{id} returns 0 cards). They can never open, so the grid skips them.
 * Radiant Collection's 25 cards already load inside Legendary Treasures (RC1-RC25).
 */
export const EMPTY_TCGDEX_SETS = new Set(["wp", "jumbo", "sp", "rc"]);

const BASE = "https://api.tcgdex.net/v2";

function tcgdexUrl(lang: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return `/api/public/tcgdex?lang=${encodeURIComponent(lang)}&path=${encodeURIComponent(p)}`;
  }
  return `${BASE}/${lang}${p}`;
}

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

/** HTTP statuses worth one more try: the proxy/upstream was busy, not "no such set". */
const RETRYABLE = new Set([500, 502, 503, 504]);

async function j<T>(url: string): Promise<T | null> {
  // One retry on a busy (5xx) answer or a dropped connection: api.tcgdex.net and
  // the /api/public/tcgdex proxy blip for a few seconds at a time, and a single
  // miss used to leave a box empty ("Catalog returned no cards") or at 16 seeds.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (r.ok) return (await r.json()) as T;
      if (!RETRYABLE.has(r.status)) return null;
    } catch {
      /* network error / CORS-less error page / timeout: retry once */
    }
    if (attempt === 0) await new Promise((res) => setTimeout(res, 400));
  }
  return null;
}

export type AltArt = { lang: string; url: string };

function assetUrl(base?: string | null, ext = "webp"): string {
  if (!base) return "";
  if (/\.(png|jpg|jpeg|webp)$/i.test(base)) return base;
  return `${base}.${ext}`;
}

function cardImages(card: {
  image?: string;
  id?: string;
  localId?: string | number;
  set?: any;
  number?: string;
}): { small: string; large: string } {
  const img = card.image;
  if (typeof img === "string" && img) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(img) && !/\/(high|low)\./i.test(img)) {
      return { small: `${img}/low.webp`, large: `${img}/high.webp` };
    }
    return { small: img, large: img };
  }
  // Set id = everything before the LAST hyphen (30th-c-001 → 30th-c, not 30th).
  const parsed = parseCardId(card.id || "", card.set?.id);
  const setId = card.set?.id || parsed.setId;
  const num = String(card.localId ?? card.number ?? parsed.localId ?? "");
  // Classic Collection (30th-c / me55c) and letter prints have no pokemontcg.io
  // path that matches the TCGdex localId (Magikarp is me55c-203, not 30th-c/030).
  // Leave blank so addBoxSetExtras / fallbackCardImages can fill a real scan.
  if (setId && num && !/^(30th-c|me55c)$/i.test(String(setId))) {
    const ptcg = pokemontcgImagePath(String(setId), num);
    if (!ptcg) return { small: "", large: "" };
    return {
      small: `https://images.pokemontcg.io/${ptcg}.png`,
      large: `https://images.pokemontcg.io/${ptcg}_hires.png`,
    };
  }
  return { small: "", large: "" };
}

/**
 * Celebrations Classic Collection: TCGdex CC001-CC025 → pokemontcg.io scan
 * file (cel25c/2_A …). Checked against PokemonTCG/pokemon-tcg-data 2026-10-05.
 */
const CEL25C_SCANS: Record<string, string> = {
  CC001: "2_A",
  CC002: "4_A",
  CC003: "15_A",
  CC004: "73_A",
  CC005: "8_A",
  CC006: "15_B",
  CC007: "15_C",
  CC008: "24_A",
  CC009: "20_A",
  CC010: "66_A",
  CC011: "9_A",
  CC012: "86_A",
  CC013: "88_A",
  CC014: "93_A",
  CC015: "17_A",
  CC016: "15_D",
  CC017: "109_A",
  CC018: "145_A",
  CC019: "107_A",
  CC020: "113_A",
  CC021: "114_A",
  CC022: "54_A",
  CC023: "97_A",
  CC024: "76_A",
  CC025: "60_A",
};

/**
 * TCGdex has image:null for whole boxes (Dragon Majesty sm7.5, Shining Legends
 * sm3.5, Shiny Vault swsh4.5sv, Galarian Gallery swsh12.5gg, Celebrations
 * Classic cel25cc). Inventing images.pokemontcg.io/sm7.5/1.png 404'd into a
 * card-back for every tile. pokemontcg.io keeps those scans under its own id
 * (sm75/1, swsh45sv/SV001, swsh12pt5gg/GG01), so map to that id.
 */
export function pokemontcgImagePath(setId: string, num: string): string | null {
  const id = (setId || "").trim();
  if (!id || !num) return null;
  if (/^cel25cc$/i.test(id)) {
    const file = CEL25C_SCANS[num.toUpperCase()];
    return file ? `cel25c/${file}` : null;
  }
  let ptcgSet = id;
  if (id.includes(".")) {
    ptcgSet = setIdAliases(id).find((a) => !a.includes(".") && a !== id.toLowerCase()) || "";
    if (!ptcgSet) return null;
  }
  // pokemontcg numbers are unpadded for plain numerics (sv3pt5/1, not /001).
  const n = /^\d+$/.test(num) ? String(Number(num)) : num;
  return `${ptcgSet}/${n}`;
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

const FX: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  KRW: 0.00072,
  CNY: 0.14,
  TWD: 0.031,
};

function toUsd(value: number, unit?: string): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const rate = FX[(unit || "USD").toUpperCase()] ?? 1;
  return Math.round(value * rate * 100) / 100;
}

export function mapTcgdexSet(s: any, lang = "en"): TCGSet {
  const listed = Number(s?.cardCount?.total ?? s?.total ?? s?.cardCount?.official ?? 0) || 0;
  // Set tiles must match the opened box: add the official prints we ship
  // (30th Mew R/G/B, Unown A-Z, SM "a" prints). 30th tile: 158+3 + 30 = 191.
  const total =
    listed && lang === "en" ? listed + boxSetNetExtraCount(String(s?.id ?? "")) : listed;
  const printed = Number(s?.cardCount?.official ?? s?.printedTotal ?? total) || 0;
  return {
    id: String(s?.id ?? ""),
    name: String(s?.name ?? ""),
    series:
      String(s?.serie?.name ?? s?.series ?? "") ||
      (/^(?:[ab]\d+[a-z]?|p-[ab])$/i.test(String(s?.id ?? "")) ? "Pokémon TCG Pocket" : ""),
    printedTotal: printed,
    total,
    releaseDate: String(s?.releaseDate ?? ""),
    lang,
    images: {
      // assets.tcgdex.net set symbols 404 as .webp and .png (checked 2026-10-03),
      // so they only fired failed requests; merged sets keep pokemontcg's symbol.
      symbol: /assets\.tcgdex\.net/.test(String(s?.symbol ?? s?.images?.symbol ?? ""))
        ? ""
        : assetUrl(s?.symbol ?? s?.images?.symbol),
      logo: assetUrl(s?.logo ?? s?.images?.logo),
    },
  };
}

export function mapTcgdexCard(card: any, setOverride?: any, lang = "en"): TCGCard {
  const setSrc = setOverride ?? card?.set ?? {};
  const setMapped = mapTcgdexSet(setSrc, lang);
  const number = String(card?.localId ?? card?.number ?? "");
  const hp = card?.hp == null ? undefined : String(card.hp);
  const unit = String(card?.pricing?.tcgplayer?.unit || card?.pricing?.cardmarket?.unit || "USD");
  const tpPrices = mapTcgplayerPrices(card?.pricing);
  if (tpPrices && unit && unit.toUpperCase() !== "USD") {
    for (const p of Object.values(tpPrices)) {
      if (p.market) p.market = toUsd(p.market, unit);
      if (p.mid) p.mid = toUsd(p.mid, unit);
      if (p.low) p.low = toUsd(p.low, unit);
      if (p.directLow) p.directLow = toUsd(p.directLow, unit);
      if (p.high) p.high = toUsd(p.high, unit);
    }
  }
  const cm = card?.pricing?.cardmarket;
  let images = cardImages({ ...card, set: setSrc, number });
  // TCGdex has image:null for the whole 30th Classic Collection. Use the scan
  // shipped for THIS card id + name; never a number-based guess from another set.
  const shipped = shippedPrint(String(card?.id ?? ""), String(card?.name ?? ""));
  if (shipped && !images.small && !images.large) images = shipped.images;
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
    lang,
    supertype: card?.category,
    hp,
    types: card?.types,
    evolvesFrom: card?.evolveFrom,
    rarity: card?.rarity,
    number,
    printedNumber: shipped?.printedNumber,
    artist: card?.illustrator ?? card?.artist,
    flavorText: card?.description,
    set: {
      id: setMapped.id || String(setSrc?.id ?? parseCardId(String(card?.id ?? "")).setId),
      name: setMapped.name || String(setSrc?.name ?? ""),
      series: setMapped.series || setSrc?.serie?.name,
      printedTotal: setMapped.printedTotal,
      total: setMapped.total,
      releaseDate: setMapped.releaseDate || setSrc?.releaseDate,
      images: { logo: setMapped.images.logo, symbol: setMapped.images.symbol },
    },
    images,
    attacks,
    abilities: Array.isArray(card?.abilities)
      ? card.abilities.map((a: any) => ({
          name: String(a?.name ?? ""),
          text: String(a?.effect ?? a?.text ?? ""),
          type: String(a?.type ?? "Ability"),
        }))
      : undefined,
    subtypes: [
      /stage\s*2|stage2/i.test(String(card?.stage ?? ""))
        ? "Stage 2"
        : /stage\s*1|stage1/i.test(String(card?.stage ?? ""))
          ? "Stage 1"
          : /basic/i.test(String(card?.stage ?? ""))
            ? "Basic"
            : "",
      /\bex\b/i.test(String(card?.name ?? "")) ? "ex" : "",
    ].filter(Boolean),
    weaknesses: card?.weaknesses,
    resistances: card?.resistances,
    retreatCost: Number.isFinite(Number(card?.retreat))
      ? Array.from({ length: Math.max(0, Number(card.retreat)) }, () => "Colorless")
      : undefined,
  };
  if (tpPrices) {
    out.tcgplayer = {
      url: card?.pricing?.tcgplayer?.url,
      updatedAt: card?.pricing?.tcgplayer?.updated,
      prices: tpPrices,
    };
  }
  if (cm && typeof cm === "object") {
    out.cardmarket = {
      updatedAt: cm.updated,
      prices: {
        averageSellPrice: cm.avg7 ?? cm.avg ?? cm.averageSellPrice,
        lowPrice: cm.low ?? cm.lowPrice,
        trendPrice: cm.trend ?? cm.trendPrice,
        avg1: cm.avg1,
        avg7: cm.avg7,
        avg30: cm.avg30,
        reverseHoloTrend: cm["trend-holo"] ?? cm.reverseHoloTrend,
      },
    };
    if (!out.tcgplayer) {
      // Prefer sold averages (avg7/avg/trend), never stub with listing low.
      const usd = toUsd(Number(cm.avg7 ?? cm.avg ?? cm.trend ?? 0), String(cm.unit || "EUR"));
      if (usd > 0) out.tcgplayer = { prices: { normal: { market: usd } } };
    }
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

export async function tcgdexGetCard(id: string, lang = "en"): Promise<TCGCard | null> {
  const raw = await j<any>(tcgdexUrl(lang, `/cards/${encodeURIComponent(id)}`));
  if (!raw?.id) return null;
  return mapTcgdexCard(raw, undefined, lang);
}

const GOLD_RARITY_QUERIES = ["Hyper rare", "Mega Hyper Rare", "Secret Rare", "Rare Holo Star"];

export async function tcgdexSearchGold(name = "", limit = 400, lang = "en"): Promise<TCGCard[]> {
  const lists = await Promise.all([
    j<any[]>(tcgdexUrl(lang, `/cards?name=${encodeURIComponent(name.trim() || "gold")}&limit=400`)),
    ...GOLD_RARITY_QUERIES.map((r) =>
      j<any[]>(tcgdexUrl(lang, `/cards?rarity=${encodeURIComponent(r)}&limit=400`)),
    ),
  ]);
  const seen = new Set<string>();
  const out: TCGCard[] = [];
  const nameQ = name.trim().toLowerCase();
  for (const raw of lists) {
    if (!Array.isArray(raw)) continue;
    for (const c of raw) {
      const card = mapTcgdexCard(c, undefined, lang);
      if (!card.id || seen.has(card.id)) continue;
      if (nameQ) {
        const hay = card.name.toLowerCase();
        if (!hay.includes(nameQ) && !hay.startsWith(nameQ)) continue;
      }
      seen.add(card.id);
      out.push(card);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function tcgdexSearchCards(name: string, limit = 50, lang = "en"): Promise<TCGCard[]> {
  const q = name.trim();
  if (!q) return [];
  const raw = await j<any[]>(tcgdexUrl(lang, `/cards?name=${encodeURIComponent(q)}`));
  if (!Array.isArray(raw) || !raw.length) return [];
  const qn = q.toLowerCase();
  const mapped = raw.map((c) => mapTcgdexCard(c, undefined, lang));
  const matched = mapped.filter((c) => {
    const n = (c.name || "").toLowerCase();
    return n.includes(qn) || qn.includes(n) || n.startsWith(qn);
  });
  return (matched.length ? matched : mapped).slice(0, limit);
}

export async function tcgdexGetSets(lang = "en"): Promise<TCGSet[]> {
  const raw = await j<any[]>(tcgdexUrl(lang, `/sets`));
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => mapTcgdexSet(s, lang))
    .filter((s) => s.id && !(lang === "en" && EMPTY_TCGDEX_SETS.has(s.id)));
}

async function fetchTcgdexSetPayload(setId: string, lang: string): Promise<any | null> {
  const path = `/sets/${encodeURIComponent(setId)}`;
  const first = await j<any>(tcgdexUrl(lang, path));
  if (Array.isArray(first?.cards) && first.cards.length) return first;
  // Browser proxy 404s English box sets missing from asia-catalog (me2pt5 / me02.5).
  if (typeof window !== "undefined") {
    const direct = await j<any>(`${BASE}/${lang}${path}`);
    if (Array.isArray(direct?.cards) && direct.cards.length) return direct;
  }
  return first;
}

export async function tcgdexGetSetCards(setId: string, lang = "en"): Promise<TCGCard[]> {
  let best: TCGCard[] = [];
  const aliases = setIdAliases(setId);
  const mergeFamilies = aliases.some((a) => /^(30th|me55)/i.test(a));
  const merged = new Set<string>();
  for (const id of aliases) {
    let raw = await fetchTcgdexSetPayload(id, lang);
    if (mergeFamilies) {
      // The proxy used to fall back across the alias family, so /sets/30th-c
      // came back as the Celebration box and Magikarp never appeared. Always
      // ask TCGdex for the exact id (browser OR server) when the payload's id
      // does not match, and never merge one box twice.
      const gotId = String(raw?.id ?? "").toLowerCase();
      if (gotId && gotId !== id.toLowerCase()) {
        const exact = await j<any>(`${BASE}/${lang}/sets/${encodeURIComponent(id)}`);
        if (Array.isArray(exact?.cards) && exact.cards.length) raw = exact;
      }
      const boxId = String(raw?.id ?? id).toLowerCase();
      // Still the wrong box (stale CDN / alias) — skip rather than double-count.
      if (
        boxId &&
        boxId !== id.toLowerCase() &&
        !boxId.includes(id.toLowerCase()) &&
        !id.toLowerCase().includes(boxId)
      ) {
        continue;
      }
      if (merged.has(boxId || id.toLowerCase())) continue;
      merged.add(boxId || id.toLowerCase());
    }
    const cards = Array.isArray(raw?.cards) ? raw.cards : Array.isArray(raw) ? raw : [];
    if (!cards.length) continue;
    const mapped = cards.map((c: any) => mapTcgdexCard(c, raw, lang)).filter((c: TCGCard) => c?.id);
    if (mergeFamilies) {
      best = mergeSetCardsByLocalId(best, mapped);
      continue;
    }
    if (mapped.length > best.length) best = mapped;
    const want = Number(raw?.cardCount?.total || raw?.cardCount?.official || 0);
    if (want > 0 && mapped.length >= want) return mapped;
  }
  return best;
}

export async function tcgdexRecentCards(limit = 32, lang = "en"): Promise<TCGCard[]> {
  const raw = await j<any[]>(tcgdexUrl(lang, `/cards?sort=recent&limit=${limit}`));
  if (Array.isArray(raw) && raw.length) {
    return raw.slice(0, limit).map((c) => mapTcgdexCard(c, undefined, lang));
  }
  const sets = await j<any[]>(tcgdexUrl(lang, `/sets`));
  if (!Array.isArray(sets) || !sets.length) return [];
  const recent = sets.slice(-8).reverse();
  const out: TCGCard[] = [];
  for (const s of recent) {
    if (!s?.id) continue;
    const full = await j<any>(tcgdexUrl(lang, `/sets/${encodeURIComponent(s.id)}`));
    const cards = full?.cards ?? [];
    for (const c of cards) {
      out.push(mapTcgdexCard(c, full ?? s, lang));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// pokemontcg.io IDs look like "swsh4-25". TCGdex uses similar ids but with their own set codes.
// We try direct lookup; falls back to search-by-name within the same set series.
export async function getAltArtworks(card: {
  id: string;
  name: string;
  number?: string;
  set: { id: string; name: string };
}): Promise<AltArt[]> {
  const langs = ["en", "ja", "zh-tw", "zh-cn", "ko", "th", "fr", "de", "es", "it", "pt-br"];
  const results: AltArt[] = [];

  // Same set as the card (30th-c-001 stays 30th-c-001, never 30th-001 = Exeggcute).
  const { setId } = parseCardId(card.id, card.set?.id);
  const candidateId = card.number && setId ? `${setId}-${card.number}` : card.id;

  await Promise.all(
    langs.map(async (lang) => {
      const direct = await j<TCGdexCard>(
        tcgdexUrl(lang, `/cards/${encodeURIComponent(candidateId)}`),
      );
      if (direct?.image) {
        results.push({ lang, url: cardImages({ image: direct.image }).large });
        return;
      }
      const search = await j<TCGdexCard[]>(
        tcgdexUrl(lang, `/cards?name=${encodeURIComponent(card.name)}`),
      );
      const hit = search?.find((c) => c.image);
      // Proxy hits can already be full URLs (…/high.webp, TCGplayer .jpg): no double suffix.
      if (hit?.image) results.push({ lang, url: cardImages({ image: hit.image }).large });
    }),
  );

  return results;
}
