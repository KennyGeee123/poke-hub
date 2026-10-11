import { createFileRoute } from "@tanstack/react-router";
import boxSetExtras from "@/lib/box-set-extras.json";

const UPSTREAM = "https://api.tcgdex.net/v2";
const FX: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0064,
  CAD: 0.73,
  AUD: 0.66,
};

/** Sets known to ship with null TCGdex pricing until market data catches up. */
const PENDING_NEW_SETS = new Set(["30th", "30th-c", "me55", "me55c"]);

/** TCGdex set id ↔ pokemontcg.io set id. */
const SET_ID_ALIAS: Record<string, string[]> = {
  "30th": ["30th", "me55"],
  me55: ["me55", "30th"],
  "30th-c": ["30th-c", "me55c"],
  me55c: ["me55c", "30th-c"],
  me2pt5: ["me2pt5", "me02.5"],
  "me02.5": ["me02.5", "me2pt5"],
};

/** TCGPlayer group ids via tcgcsv.com (public CSV mirror). */
const TCGCSV_GROUP: Record<string, number> = {
  "30th": 24722,
  me55: 24722,
  "30th-c": 24837,
  me55c: 24837,
};

export type PriceQuote = {
  market: number;
  source: string;
  soldAvg?: number;
  listingMarket?: number;
  pending?: boolean;
};

function usd(n: number, unit?: string): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * (FX[(unit || "USD").toUpperCase()] ?? 1) * 100) / 100;
}

/**
 * TCGPlayer print rows, base print first. TCGdex uses hyphenated keys
 * ("reverse-holofoil"), pokemontcg.io camelCase ("reverseHolofoil"). The old
 * list only had camelCase, so TCGdex commons fell through to whichever row
 * came first — usually reverse holo — and showed the wrong variant's price.
 */
const TP_PRINTS = [
  "normal",
  "holofoil",
  "unlimited-holofoil",
  "unlimitedHolofoil",
  "unlimited",
  "1st-edition-holofoil",
  "1stEditionHolofoil",
  "1st-edition",
  "1stEdition",
  "reverse-holofoil",
  "reverseHolofoil",
];

function pickTpField(tp: any, field: "marketPrice" | "midPrice" | "lowPrice"): number {
  if (!tp || typeof tp !== "object") return 0;
  const unit = tp.unit || "USD";
  for (const k of TP_PRINTS) {
    const n = usd(Number(tp[k]?.[field]), unit);
    if (n > 0) return n;
  }
  for (const [k, v] of Object.entries(tp)) {
    if (!v || typeof v !== "object" || k === "updated" || k === "unit" || k === "url") continue;
    const n = usd(Number((v as any)[field]), unit);
    if (n > 0) return n;
  }
  return 0;
}

/** Lowest positive value of one TCGPlayer field across every finish on this card. */
function minTpField(tp: any, field: "marketPrice" | "midPrice" | "lowPrice" | "directLowPrice"): number {
  if (!tp || typeof tp !== "object") return 0;
  const unit = tp.unit || "USD";
  let best = 0;
  const consider = (n: number) => {
    if (n > 0 && (best === 0 || n < best)) best = n;
  };
  for (const k of TP_PRINTS) consider(usd(Number(tp[k]?.[field]), unit));
  for (const [k, v] of Object.entries(tp)) {
    if (!v || typeof v !== "object" || k === "updated" || k === "unit" || k === "url") continue;
    consider(usd(Number((v as any)[field]), unit));
  }
  return best;
}

function isListingLow(q: PriceQuote | null | undefined): boolean {
  if (!q || !(q.market > 0)) return false;
  const s = q.source || "";
  return s === "lowest-online" || s === "cardmarket-low" || s.endsWith("-low");
}

/**
 * Cardmarket's raw low is often a played copy. It can win only when it is at
 * least half the TCGPlayer ask, so a damaged outlier does not become the price.
 */
function listingLow(tpAsk: number, cmLow: number): number {
  if (tpAsk > 0 && cmLow > 0 && cmLow >= tpAsk * 0.5) return Math.min(tpAsk, cmLow);
  if (tpAsk > 0) return tpAsk;
  return cmLow > 0 ? cmLow : 0;
}

/**
 * Current buy price: the cheapest TCGPlayer listing low on this card, or the
 * Cardmarket low in USD when that ask is in the same range. Sold averages stay
 * on soldAvg and are only the price when no listing low exists.
 */
function marketFromTcgdex(raw: any): PriceQuote | null {
  const cm = raw?.pricing?.cardmarket;
  let soldAvg = 0;
  let cmLow = 0;
  if (cm && typeof cm === "object") {
    const unit = cm.unit || "EUR";
    for (const key of ["avg7", "avg30", "avg", "trend"] as const) {
      const n = usd(Number(cm[key]), unit);
      if (n > 0) {
        soldAvg = n;
        break;
      }
    }
    cmLow = usd(Number(cm.low), unit);
  }

  const tp = raw?.pricing?.tcgplayer;
  const tpMarket = pickTpField(tp, "marketPrice");
  const tpMid = pickTpField(tp, "midPrice");
  const tpAsks = [minTpField(tp, "lowPrice"), minTpField(tp, "directLowPrice")].filter((n) => n > 0);
  const tpAsk = tpAsks.length ? Math.min(...tpAsks) : 0;
  const listingMarket = tpMarket || tpMid || undefined;
  const lowest = listingLow(tpAsk, cmLow);

  if (lowest > 0) {
    return {
      market: lowest,
      source: "lowest-online",
      soldAvg: soldAvg > 0 ? soldAvg : undefined,
      listingMarket: listingMarket && listingMarket !== lowest ? listingMarket : undefined,
    };
  }
  if (soldAvg > 0) {
    return {
      market: soldAvg,
      source: "sold-avg",
      soldAvg,
      listingMarket,
    };
  }
  if (tpMarket > 0) {
    return {
      market: tpMarket,
      source: "tcgplayer-market",
      listingMarket: tpMid || undefined,
    };
  }
  if (tpMid > 0) {
    return { market: tpMid, source: "tcgplayer-mid" };
  }
  if (cmLow > 0) {
    return { market: cmLow, source: "cardmarket-low" };
  }
  return null;
}

function parseCardId(id: string): { setKey: string; localId: string; rawLocal: string } | null {
  const m = id.match(/^([a-z0-9.-]+?)-(\d+[a-z]?)$/i);
  if (!m) return null;
  return { setKey: m[1].toLowerCase(), localId: m[2].replace(/^0+/, "") || "0", rawLocal: m[2] };
}

/**
 * Zero-pad the numeric part, KEEP any letter suffix: "1" → "001", "172a" →
 * "172a". Dropping the suffix made sm2-172a an alias of sm2-172 and
 * me55c-106m (M Gardevoir EX) an alias of me55c-106 (Shining Celebi), so one
 * card could be quoted with another card's price.
 */
function padLocal(n: string): string {
  const m = String(n || "")
    .trim()
    .match(/^0*(\d+)([a-z]*)$/i);
  if (!m) return String(n || "").toLowerCase();
  return `${m[1].padStart(3, "0")}${m[2].toLowerCase()}`;
}

function normName(s: string): string {
  // Accent-blind so TCGdex "Poké Pad" and TCGPlayer "Poke Pad" are one name.
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** A TCGPlayer product name belongs to this card ("Gengar (Prime)" ↔ "Gengar"). */
function productNameAgrees(productName: string, cardName?: string): boolean {
  if (!cardName) return true;
  const a = normName(productName);
  const b = normName(cardName);
  return !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a));
}

async function quoteTcgplayerProduct(
  productId: number,
): Promise<{ price: number; fromLow: boolean } | null> {
  try {
    const r = await fetch(
      `https://infinite-api.tcgplayer.com/price/history/${productId}?range=quarter`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!r.ok) return null;
    const j: any = await r.json();
    const variants = j?.result?.[0]?.variants;
    if (!Array.isArray(variants)) return null;
    let bestLow = Infinity;
    let bestMkt = Infinity;
    for (const v of variants) {
      const low = Number(v.lowPrice);
      const mkt = Number(v.marketPrice);
      if (Number.isFinite(low) && low > 0 && low < bestLow) bestLow = low;
      if (Number.isFinite(mkt) && mkt > 0 && mkt < bestMkt) bestMkt = mkt;
    }
    if (bestLow < Infinity) return { price: bestLow, fromLow: true };
    if (bestMkt < Infinity) return { price: bestMkt, fromLow: false };
    return null;
  } catch {
    return null;
  }
}

type CsvRow = {
  productId: number;
  name: string;
  number: string;
  market: number;
  fromLow: boolean;
};
type CsvCache = {
  at: number;
  byNum: Map<string, CsvRow>;
  byName: Map<string, CsvRow>;
  rows: CsvRow[];
};
const csvCache = new Map<number, CsvCache>();
const CSV_TTL_MS = 30 * 60 * 1000;

async function loadTcgcsvGroup(groupId: number): Promise<CsvCache | null> {
  const hit = csvCache.get(groupId);
  if (hit && Date.now() - hit.at < CSV_TTL_MS) return hit;
  try {
    const csvHeaders = {
      Accept: "application/json",
      "User-Agent": "PokeVault/1.0 (https://pokedex-hub-lime.vercel.app; prices-fallback)",
    };
    const [prodsR, pricesR] = await Promise.all([
      fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`, {
        headers: csvHeaders,
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`, {
        headers: csvHeaders,
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!prodsR.ok || !pricesR.ok) return hit || null;
    const prods: any = await prodsR.json();
    const prices: any = await pricesR.json();
    const priceByPid = new Map<number, { n: number; fromLow: boolean }>();
    for (const p of prices?.results || []) {
      const pid = Number(p.productId);
      const low = Number(p.lowPrice) || 0;
      const mkt = Number(p.marketPrice) || Number(p.midPrice) || 0;
      if (!(pid > 0)) continue;
      const prev = priceByPid.get(pid);
      if (low > 0 && (!prev || !prev.fromLow || low < prev.n)) {
        priceByPid.set(pid, { n: low, fromLow: true });
      } else if (mkt > 0 && (!prev || (!prev.fromLow && mkt < prev.n))) {
        priceByPid.set(pid, { n: mkt, fromLow: false });
      }
    }
    const byNum = new Map<string, CsvRow>();
    const byName = new Map<string, CsvRow>();
    const rows: CsvRow[] = [];
    for (const r of prods?.results || []) {
      const pid = Number(r.productId);
      const hit = priceByPid.get(pid);
      const market = hit?.n || 0;
      const fromLow = !!hit?.fromLow;
      if (!(market > 0)) continue;
      let number = "";
      for (const ed of r.extendedData || []) {
        if (ed?.name === "Number" && ed.value) {
          number = String(ed.value).split("/")[0].trim();
          break;
        }
      }
      const name = String(r.name || "")
        .replace(/\s*-\s*\d+\/\d+\s*$/, "")
        .trim();
      const row: CsvRow = { productId: pid, name, number, market, fromLow };
      rows.push(row);
      if (number) {
        const key = padLocal(number);
        const prev = byNum.get(key);
        if (!prev || market < prev.market) byNum.set(key, row);
      }
      const nk = normName(name);
      if (nk) {
        const prev = byName.get(nk);
        if (!prev || market < prev.market) byName.set(nk, row);
      }
    }
    const entry: CsvCache = { at: Date.now(), byNum, byName, rows };
    csvCache.set(groupId, entry);
    return entry;
  } catch {
    return hit || null;
  }
}

/**
 * Name lookup that only answers when exactly ONE product carries that name.
 * The old "shortest prefix" pick handed Darkrai & Cresselia LEGEND (Bottom)
 * the (Top) half's price, and a name shared by several prints picked the
 * cheapest. Ambiguous → no quote (the UI shows a dash), never another card's.
 */
function matchByName(cache: CsvCache, name: string): CsvRow | undefined {
  const nk = normName(name);
  if (!nk) return undefined;
  const exact = cache.rows.filter((r) => normName(r.name) === nk);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  // Classic reprints often add parenthetical suffixes ("Genesect EX (Team Plasma)")
  const prefixed = cache.rows.filter((r) => normName(r.name).startsWith(nk));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

/**
 * Rows printed with this number (zero-padding ignored) that also carry this
 * card's name. Several Classic reprints share an original number (106/106
 * Palkia, 106/160 M Gardevoir, 106/105 Shining Celebi), so a bare number is
 * not an identity: more than one candidate → no match.
 */
function matchByNumber(cache: CsvCache, localId: string, name?: string): CsvRow | undefined {
  if (!localId) return undefined;
  const want = padLocal(localId);
  const hits = cache.rows.filter(
    (r) => r.number && padLocal(r.number) === want && productNameAgrees(r.name, name),
  );
  return hits.length === 1 ? hits[0] : undefined;
}

async function quoteTcgcsv(
  setKey: string,
  localId: string,
  name?: string,
): Promise<PriceQuote | null> {
  const groupId = TCGCSV_GROUP[setKey];
  if (!groupId) return null;
  const cache = await loadTcgcsvGroup(groupId);
  if (!cache) return null;

  // 30th-c (TCGdex): sequential 001..030 — MUST match by name (001=Charizard, 004=Genesect).
  // me55c (pokemontcg): original print numbers — match by number (4=Charizard) then name.
  // Every hit must be ONE product that is this card (name + set + number);
  // anything ambiguous returns no quote so the UI shows a dash.
  let row: CsvRow | undefined;
  if (setKey === "30th-c") {
    if (name) row = matchByName(cache, name);
  } else {
    row = matchByNumber(cache, localId, name);
    // Name-only lookup is allowed only when we have no number to key on.
    if (!row && name && !localId) row = matchByName(cache, name);
    if (!row && name && setKey === "me55c") row = matchByName(cache, name);
  }
  if (!row || !(row.market > 0)) return null;
  return {
    market: Math.round(row.market * 100) / 100,
    source: row.fromLow ? "lowest-online" : "tcgcsv-market",
  };
}

/** Shipped box-set extras (Unown A-Z, 30th Mew R/G/B) with their TCGPlayer product. */
const EXTRA_PRODUCTS = new Map<string, { groupId: number; productId: number }>();
for (const s of (boxSetExtras as any).sets || []) {
  if (!s.tcgplayerGroupId) continue;
  for (const c of s.cards || []) {
    if (c.tcgplayerProductId) {
      EXTRA_PRODUCTS.set(String(c.id).toLowerCase(), {
        groupId: Number(s.tcgplayerGroupId),
        productId: Number(c.tcgplayerProductId),
      });
    }
  }
}

const groupPriceCache = new Map<number, { at: number; byPid: Map<number, number> }>();

/** TCGPlayer market for one product via tcgcsv (daily TCGPlayer mirror). */
async function quoteTcgcsvProduct(groupId: number, productId: number): Promise<PriceQuote | null> {
  let hit = groupPriceCache.get(groupId);
  if (!hit || Date.now() - hit.at > CSV_TTL_MS) {
    try {
      const r = await fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PokeVault/1.0 (https://pokedex-hub-lime.vercel.app; prices-fallback)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const j: any = await r.json();
        const byPid = new Map<number, number>();
        for (const p of j?.results || []) {
          const pid = Number(p.productId);
          const m = Number(p.marketPrice) || Number(p.midPrice) || 0;
          const prev = byPid.get(pid);
          if (pid > 0 && m > 0 && (prev === undefined || m < prev)) byPid.set(pid, m);
        }
        hit = { at: Date.now(), byPid };
        groupPriceCache.set(groupId, hit);
      }
    } catch {
      /* keep stale */
    }
  }
  const m = hit?.byPid.get(productId) || 0;
  return m > 0 ? { market: Math.round(m * 100) / 100, source: "tcgcsv-market" } : null;
}

function isClassicSet(setKey: string): boolean {
  return setKey === "30th-c" || setKey === "me55c";
}

function pokemonAliases(id: string): string[] {
  const parsed = parseCardId(id);
  if (!parsed) return [id];
  // Classic: same-set pad only — never me55c↔30th-c by number (different card at same #).
  if (isClassicSet(parsed.setKey)) {
    const locals = [...new Set([parsed.rawLocal, parsed.localId, padLocal(parsed.rawLocal)])];
    return [...new Set(locals.map((loc) => `${parsed.setKey}-${loc}`))];
  }
  const sets = SET_ID_ALIAS[parsed.setKey] || [parsed.setKey];
  const locals = new Set<string>();
  const raw = parsed.rawLocal;
  const unpadded = parsed.localId;
  const padded = padLocal(raw);
  locals.add(raw);
  locals.add(unpadded);
  locals.add(padded);
  // pokemontcg often uses unpadded: me55-1
  const out: string[] = [];
  for (const s of sets) {
    for (const loc of locals) {
      out.push(`${s}-${loc}`);
    }
  }
  return [...new Set(out)];
}

/**
 * TCGdex id candidates for a card id.
 * Classic Collection (me55c / 30th-c): pokemontcg numbers are original print #s
 * (e.g. me55c-4 = Charizard) while TCGdex uses sequential 001..030
 * (30th-c-001 = Charizard, 30th-c-004 = Genesect). Never cross-map by number.
 */
function tcgdexIdCandidates(id: string): string[] {
  const parsed = parseCardId(id);
  if (!parsed) return [id];
  const locals = [...new Set([parsed.rawLocal, parsed.localId, padLocal(parsed.rawLocal)])];
  if (isClassicSet(parsed.setKey)) {
    // Same-set padding only — number is not shared across me55c ↔ 30th-c.
    return [...new Set(locals.map((loc) => `${parsed.setKey}-${loc}`))];
  }
  return pokemonAliases(id);
}

/** Safe cache aliases: full set aliasing except Classic (same-set pad only). */
function priceCacheAliases(id: string): string[] {
  const parsed = parseCardId(id);
  if (!parsed) return [id];
  if (isClassicSet(parsed.setKey)) return tcgdexIdCandidates(id);
  return pokemonAliases(id);
}

function quoteFromPokemonPrices(prices: any): PriceQuote | null {
  if (!prices || typeof prices !== "object") return null;
  let best = 0;
  for (const v of Object.values(prices)) {
    if (!v || typeof v !== "object") continue;
    for (const key of ["low", "directLow"] as const) {
      const n = Number((v as any)[key]);
      if (Number.isFinite(n) && n > 0 && (best === 0 || n < best)) best = n;
    }
  }
  if (best > 0) {
    return { market: Math.round(best * 100) / 100, source: "lowest-online" };
  }
  for (const field of ["market", "mid"] as const) {
    for (const k of [
      "normal",
      "holofoil",
      "unlimitedHolofoil",
      "unlimited",
      "1stEditionHolofoil",
      "1stEdition",
      "reverseHolofoil",
    ]) {
      const n = Number(prices[k]?.[field]);
      if (Number.isFinite(n) && n > 0) {
        return {
          market: n,
          source: field === "market" ? "pokemontcg-market" : "pokemontcg-mid",
        };
      }
    }
  }
  return null;
}

async function fetchPokemonCardMeta(
  id: string,
): Promise<{ name?: string; quote: PriceQuote | null }> {
  for (const alias of pokemonAliases(id).slice(0, 8)) {
    try {
      const r = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(alias)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) continue;
      const j: any = await r.json();
      const data = j?.data;
      if (!data) continue;
      const quote = quoteFromPokemonPrices(data?.tcgplayer?.prices);
      const name =
        typeof data.name === "string" && data.name.trim() ? String(data.name).trim() : undefined;
      if (name || quote) return { name, quote };
    } catch {
      /* try next alias */
    }
  }
  return { quote: null };
}

async function tryTcgdexCard(
  cardId: string,
): Promise<{ name?: string; localId?: string; quote: PriceQuote | null }> {
  try {
    const r = await fetch(`${UPSTREAM}/en/cards/${encodeURIComponent(cardId)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return { quote: null };
    const raw = await r.json();
    const name = typeof raw?.name === "string" ? raw.name : undefined;
    const localId = raw?.localId ? String(raw.localId) : undefined;
    const q = marketFromTcgdex(raw);
    if (q && isListingLow(q)) return { name, localId, quote: q };
    const pid = Number(
      raw?.pricing?.tcgplayer?.holofoil?.productId ||
        raw?.pricing?.tcgplayer?.normal?.productId ||
        raw?.pricing?.tcgplayer?.reverseHolofoil?.productId,
    );
    let history: { price: number; fromLow: boolean } | null = null;
    if (pid > 0) {
      history = await quoteTcgplayerProduct(pid);
      if (history && history.price > 0 && history.fromLow) {
        return {
          name,
          localId,
          quote: {
            market: Math.round(history.price * 100) / 100,
            source: "lowest-online",
            soldAvg: q?.soldAvg,
          },
        };
      }
    }
    if (q && q.market > 0) return { name, localId, quote: q };
    if (history && history.price > 0) {
      return {
        name,
        localId,
        quote: {
          market: Math.round(history.price * 100) / 100,
          source: "tcgplayer-market",
        },
      };
    }
    return { name, localId, quote: null };
  } catch {
    return { quote: null };
  }
}

async function quoteOne(id: string): Promise<PriceQuote | null> {
  const extra = EXTRA_PRODUCTS.get(id.toLowerCase());
  if (extra) {
    // Shipped prints are keyed to their own TCGPlayer product. Never fall
    // through to a name lookup that could land on a different card.
    // This product id only. A listing low on it is the buy price; market is the fallback.
    const group = await loadTcgcsvGroup(extra.groupId);
    const row = group?.rows.find((r) => r.productId === extra.productId);
    if (row && row.market > 0) {
      return {
        market: Math.round(row.market * 100) / 100,
        source: row.fromLow ? "lowest-online" : "tcgcsv-market",
      };
    }
    const q = await quoteTcgcsvProduct(extra.groupId, extra.productId);
    if (q) return q;
  }
  const parsed = parseCardId(id);
  const setKey = parsed?.setKey || "";
  let cardName: string | undefined;
  let cardLocal: string | undefined;
  let fallback: PriceQuote | null = null;
  const remember = (q: PriceQuote | null | undefined) => {
    if (!q || !(q.market > 0) || isListingLow(q)) return;
    if (!fallback) fallback = q;
  };

  // 1) TCGdex — requested id + safe aliases (Celebration: me55↔30th; Classic: same-set pad only)
  for (const candidate of tcgdexIdCandidates(id).slice(0, 8)) {
    const got = await tryTcgdexCard(candidate);
    if (got.name && !cardName) cardName = got.name;
    if (got.localId && !cardLocal) cardLocal = got.localId;
    if (got.quote && isListingLow(got.quote)) return got.quote;
    remember(got.quote);
    if (cardName) break;
  }

  // 2) pokemontcg — a real listing low, else the name Classic tcgcsv needs
  let pkmnQuote: PriceQuote | null = null;
  const meta = await fetchPokemonCardMeta(id);
  if (meta.name && !cardName) cardName = meta.name;
  pkmnQuote = meta.quote;
  const pkmnLow = pkmnQuote && isListingLow(pkmnQuote) ? pkmnQuote : null;
  remember(pkmnQuote);

  // 3) tcgcsv (TCGPlayer mirror) — Classic 30th-c by name; me55c by number then name.
  // Skipped for shipped prints: their product id above is the only safe key.
  let csvLow: PriceQuote | null = null;
  if (!extra && setKey && TCGCSV_GROUP[setKey]) {
    const csv = await quoteTcgcsv(setKey, cardLocal || parsed?.rawLocal || "", cardName);
    if (csv && isListingLow(csv)) csvLow = csv;
    else remember(csv);
    // Aliased set keys share a TCGCSV group. Classic alts: NAME only (never number cross-map).
    for (const alt of SET_ID_ALIAS[setKey] || []) {
      if (alt === setKey) continue;
      const altLocal =
        isClassicSet(setKey) || isClassicSet(alt) ? "" : cardLocal || parsed?.rawLocal || "";
      const csvAlt = await quoteTcgcsv(alt, altLocal, cardName);
      if (csvAlt && isListingLow(csvAlt) && (!csvLow || csvAlt.market < csvLow.market)) {
        csvLow = csvAlt;
      } else remember(csvAlt);
    }
  }

  if (pkmnLow && csvLow) return pkmnLow.market <= csvLow.market ? pkmnLow : csvLow;
  if (pkmnLow) return pkmnLow;
  if (csvLow) return csvLow;
  if (fallback) return fallback;

  // Honest pending marker for known new sets with no public quote yet
  if (PENDING_NEW_SETS.has(setKey)) {
    return { market: 0, source: "pending-new-set", pending: true };
  }
  return null;
}

export const Route = createFileRoute("/api/public/prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ids = (url.searchParams.get("ids") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 24);
        const prices: Record<string, PriceQuote> = {};
        const got = await Promise.all(ids.map((id) => quoteOne(id)));
        ids.forEach((id, idx) => {
          const q = got[idx];
          if (!q) return;
          prices[id] = q;
          for (const alias of priceCacheAliases(id)) {
            if (!prices[alias]) prices[alias] = q;
          }
        });
        return Response.json(
          { prices, generatedAt: new Date().toISOString() },
          { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
        );
      },
    },
  },
});
