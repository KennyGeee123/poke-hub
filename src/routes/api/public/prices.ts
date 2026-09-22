import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.tcgdex.net/v2";
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, JPY: 0.0064, CAD: 0.73, AUD: 0.66 };

/** Sets known to ship with null TCGdex pricing until market data catches up. */
const PENDING_NEW_SETS = new Set(["30th", "30th-c", "me55", "me55c"]);

/** TCGdex set id ↔ pokemontcg.io set id. */
const SET_ID_ALIAS: Record<string, string[]> = {
  "30th": ["30th", "me55"],
  me55: ["me55", "30th"],
  "30th-c": ["30th-c", "me55c"],
  me55c: ["me55c", "30th-c"],
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

const TP_PRINTS = ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "unlimitedHolofoil", "normal", "unlimited"];

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

/** Prefer Cardmarket sold averages, then TCGPlayer market/mid/low. */
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

  const tpMarket = pickTpField(raw?.pricing?.tcgplayer, "marketPrice");
  const tpMid = pickTpField(raw?.pricing?.tcgplayer, "midPrice");
  const tpLow = pickTpField(raw?.pricing?.tcgplayer, "lowPrice");
  const listingMarket = tpMarket || tpMid || tpLow || cmLow || undefined;

  if (soldAvg > 0) {
    return {
      market: soldAvg,
      source: "sold-avg",
      soldAvg,
      listingMarket: listingMarket && listingMarket !== soldAvg ? listingMarket : undefined,
    };
  }
  if (cmLow > 0) {
    return {
      market: cmLow,
      source: "cardmarket-low",
      listingMarket: listingMarket !== cmLow ? listingMarket : undefined,
    };
  }
  if (tpMarket > 0) {
    return {
      market: tpMarket,
      source: "tcgplayer-market",
      listingMarket: tpMid || tpLow || undefined,
    };
  }
  if (tpMid > 0) {
    return { market: tpMid, source: "tcgplayer-mid", listingMarket: tpLow || undefined };
  }
  if (tpLow > 0) {
    return { market: tpLow, source: "tcgplayer-low" };
  }
  return null;
}

function parseCardId(id: string): { setKey: string; localId: string; rawLocal: string } | null {
  const m = id.match(/^([a-z0-9-]+?)-(\d+[a-z]?)$/i);
  if (!m) return null;
  return { setKey: m[1].toLowerCase(), localId: m[2].replace(/^0+/, "") || "0", rawLocal: m[2] };
}

function padLocal(n: string): string {
  const digits = n.replace(/\D/g, "");
  if (!digits) return n.toLowerCase();
  return digits.padStart(3, "0");
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

async function quoteTcgplayerProduct(productId: number): Promise<number | null> {
  try {
    const r = await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}?range=quarter`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const variants = j?.result?.[0]?.variants;
    if (!Array.isArray(variants)) return null;
    let best = Infinity;
    for (const v of variants) {
      const n = Number(v.marketPrice);
      if (Number.isFinite(n) && n > 0 && n < best) best = n;
    }
    return Number.isFinite(best) && best < Infinity ? best : null;
  } catch {
    return null;
  }
}

type CsvRow = { productId: number; name: string; number: string; market: number };
type CsvCache = { at: number; byNum: Map<string, CsvRow>; byName: Map<string, CsvRow>; rows: CsvRow[] };
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
    const priceByPid = new Map<number, number>();
    for (const p of prices?.results || []) {
      const pid = Number(p.productId);
      const m = Number(p.marketPrice) || Number(p.midPrice) || Number(p.lowPrice) || 0;
      if (pid > 0 && m > 0) {
        const prev = priceByPid.get(pid) || Infinity;
        if (m < prev) priceByPid.set(pid, m);
      }
    }
    const byNum = new Map<string, CsvRow>();
    const byName = new Map<string, CsvRow>();
    const rows: CsvRow[] = [];
    for (const r of prods?.results || []) {
      const pid = Number(r.productId);
      const market = priceByPid.get(pid) || 0;
      if (!(market > 0)) continue;
      let number = "";
      for (const ed of r.extendedData || []) {
        if (ed?.name === "Number" && ed.value) {
          number = String(ed.value).split("/")[0].trim();
          break;
        }
      }
      const name = String(r.name || "").replace(/\s*-\s*\d+\/\d+\s*$/, "").trim();
      const row: CsvRow = { productId: pid, name, number, market };
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

function matchByName(cache: CsvCache, name: string): CsvRow | undefined {
  const nk = normName(name);
  if (!nk) return undefined;
  const exact = cache.byName.get(nk);
  if (exact) return exact;
  // Classic reprints often add parenthetical suffixes ("Genesect EX (Team Plasma)")
  let best: CsvRow | undefined;
  for (const [k, v] of cache.byName) {
    if (k === nk || k.startsWith(nk)) {
      if (!best || k.length < normName(best.name).length) best = v;
    }
  }
  return best;
}

async function quoteTcgcsv(setKey: string, localId: string, name?: string): Promise<PriceQuote | null> {
  const groupId = TCGCSV_GROUP[setKey];
  if (!groupId) return null;
  const cache = await loadTcgcsvGroup(groupId);
  if (!cache) return null;

  // 30th-c (TCGdex): sequential 001..030 — MUST match by name (001=Charizard, 004=Genesect).
  // me55c (pokemontcg): original print numbers — match by number (4=Charizard) then name.
  let row: CsvRow | undefined;
  if (setKey === "30th-c") {
    if (name) row = matchByName(cache, name);
  } else if (setKey === "me55c") {
    const padded = padLocal(localId);
    row = cache.byNum.get(padded) || cache.byNum.get(localId) || cache.byNum.get(localId.replace(/^0+/, "") || localId);
    if (!row && name) row = matchByName(cache, name);
  } else {
    const padded = padLocal(localId);
    row = cache.byNum.get(padded) || cache.byNum.get(localId);
    if (!row && name) row = matchByName(cache, name);
  }
  if (!row || !(row.market > 0)) return null;
  return { market: Math.round(row.market * 100) / 100, source: "tcgcsv-market" };
}

function isClassicSet(setKey: string): boolean {
  return setKey === "30th-c" || setKey === "me55c";
}

function pokemonAliases(id: string): string[] {
  const parsed = parseCardId(id);
  if (!parsed) return [id];
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
  for (const field of ["market", "mid", "low"] as const) {
    for (const k of ["holofoil", "1stEditionHolofoil", "reverseHolofoil", "normal", "unlimited"]) {
      const n = Number(prices[k]?.[field]);
      if (Number.isFinite(n) && n > 0) {
        const source =
          field === "market" ? "pokemontcg-market" : field === "mid" ? "pokemontcg-mid" : "pokemontcg-low";
        return { market: n, source };
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
      const name = typeof data.name === "string" && data.name.trim() ? String(data.name).trim() : undefined;
      if (name || quote) return { name, quote };
    } catch {
      /* try next alias */
    }
  }
  return { quote: null };
}

async function quotePokemonTcg(id: string): Promise<PriceQuote | null> {
  const meta = await fetchPokemonCardMeta(id);
  return meta.quote;
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
    if (q && q.market > 0) return { name, localId, quote: q };
    const pid = Number(
      raw?.pricing?.tcgplayer?.holofoil?.productId ||
        raw?.pricing?.tcgplayer?.normal?.productId ||
        raw?.pricing?.tcgplayer?.reverseHolofoil?.productId,
    );
    if (pid > 0) {
      const tp = await quoteTcgplayerProduct(pid);
      if (tp && tp > 0) return { name, localId, quote: { market: tp, source: "tcgplayer-market" } };
    }
    return { name, localId, quote: null };
  } catch {
    return { quote: null };
  }
}

async function quoteOne(id: string): Promise<PriceQuote | null> {
  const parsed = parseCardId(id);
  const setKey = parsed?.setKey || "";
  let cardName: string | undefined;
  let cardLocal: string | undefined;

  // 1) TCGdex — requested id + safe aliases (Celebration: me55↔30th; Classic: same-set pad only)
  for (const candidate of tcgdexIdCandidates(id).slice(0, 8)) {
    const got = await tryTcgdexCard(candidate);
    if (got.name && !cardName) cardName = got.name;
    if (got.localId && !cardLocal) cardLocal = got.localId;
    if (got.quote && got.quote.market > 0) return got.quote;
    if (cardName) break;
  }

  // 2) pokemontcg — name (needed for Classic tcgcsv) + embedded market if present
  let pkmnQuote: PriceQuote | null = null;
  if (!cardName || (setKey && TCGCSV_GROUP[setKey])) {
    const meta = await fetchPokemonCardMeta(id);
    if (meta.name && !cardName) cardName = meta.name;
    pkmnQuote = meta.quote;
  }

  // 3) tcgcsv (TCGPlayer mirror) — Classic matches by name only
  if (setKey && TCGCSV_GROUP[setKey]) {
    const csv = await quoteTcgcsv(setKey, cardLocal || parsed?.rawLocal || "", cardName);
    if (csv) return csv;
    // Also try aliased set keys (me55c → 30th-c group is the same id, but be explicit)
    for (const alt of SET_ID_ALIAS[setKey] || []) {
      if (alt === setKey) continue;
      const csvAlt = await quoteTcgcsv(alt, cardLocal || parsed?.rawLocal || "", cardName);
      if (csvAlt) return csvAlt;
    }
  }

  if (pkmnQuote) return pkmnQuote;
  if (!pkmnQuote) {
    const late = await quotePokemonTcg(id);
    if (late) return late;
  }

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
        const chunk = 6;
        for (let i = 0; i < ids.length; i += chunk) {
          const part = ids.slice(i, i + chunk);
          const got = await Promise.all(part.map((id) => quoteOne(id)));
          part.forEach((id, idx) => {
            const q = got[idx];
            if (!q) return;
            prices[id] = q;
            // Stamp safe aliases so me55c-4 / me55c-004 share the quote (not cross-set Classic #s)
            for (const alias of priceCacheAliases(id)) {
              if (!prices[alias]) prices[alias] = q;
            }
          });
        }
        return Response.json(
          { prices, generatedAt: new Date().toISOString() },
          { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
        );
      },
    },
  },
});
