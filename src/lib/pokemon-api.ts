// Pokemon TCG API client (api.pokemontcg.io v2) with TCGdex fallback
import {
  mapTcgdexCard,
  tcgdexGetCard,
  tcgdexGetSetCards,
  tcgdexGetSets,
  tcgdexRecentCards,
  tcgdexSearchCards,
  tcgdexSearchGold,
  tcgdexSearchName,
} from "@/lib/tcgdex";
import { FALLBACK_CARDS, FALLBACK_SETS, fallbackSearch, stubCardFromId } from "@/lib/tcg-fallback";
import { isGoldCard, parseSearchQuery } from "@/lib/card-search";
import {
  getSpecialCard,
  getSpecialSetCards,
  injectSpecialSets,
  mergeSetLists,
  searchSpecialCards,
} from "@/lib/special-sets";
import { getCachedSets, setCachedSets, getCachedSetCards, setCachedSetCards, getHttpCache, setHttpCache } from "./catalog-cache";
import {
  expectedSetTotal,
  mergeSetCardsByLocalId,
  setCardsLookComplete,
  setIdAliases,
  sortSetCards,
} from "./set-ids";

const BASE = "https://api.pokemontcg.io/v2";

export type TCGPrice = { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
export type TCGCard = {
  id: string;
  name: string;
  lang?: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  rarity?: string;
  number?: string;
  artist?: string;
  flavorText?: string;
  set: {
    id: string;
    name: string;
    series?: string;
    printedTotal?: number;
    total?: number;
    releaseDate?: string;
    images?: { symbol?: string; logo?: string };
  };
  images: { small: string; large: string };
  abilities?: { name: string; text: string; type: string }[];
  attacks?: { name: string; cost?: string[]; convertedEnergyCost?: number; damage?: string; text?: string }[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreatCost?: string[];
  legalities?: Record<string, string>;
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TCGPrice>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      avg1?: number; avg7?: number; avg30?: number;
      reverseHoloTrend?: number;
    };
  };
};

export type TCGSet = {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  lang?: string;
  images: { symbol: string; logo: string };
};

const cardMemo = new Map<string, TCGCard>();
export function rememberCard(c: TCGCard) {
  if (!c?.id) return;
  cardMemo.set(c.id, c);
  cardMemo.set(`${c.lang || "en"}:${c.id}`, c);
}

function getApiKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("pokeApiKey");
}

// ─── Cache + in-flight dedup ────────────────────────────────────────────
// pokemontcg.io without an API key is heavily rate-limited and slow, so we
// cache responses in localStorage with a TTL and dedupe concurrent requests.
const CACHE_PREFIX = "pv-tcg-cache:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const memCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function cacheGet<T>(key: string, _opts?: { allowStale?: boolean }): T | null {
  // Sync path: memory only. Durable hits come from await getHttpCache in tcgFetch.
  if (memCache.has(key)) return memCache.get(key) as T;
  return null;
}

function cacheSet<T>(key: string, value: T) {
  memCache.set(key, value);
  // Discuss consensus: stop writing catalog/API payloads into 5MB localStorage.
  void setHttpCache(key, value);
  if (typeof localStorage !== "undefined") {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      }
    } catch {}
  }
}

function envApiKey(): string | null {
  try {
    const env = import.meta.env as Record<string, string | undefined>;
    const v = env.VITE_POKEMONTCG_API_KEY;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function isUsablePayload(json: unknown): boolean {
  if (json == null) return false;
  if (typeof json !== "object") return true;
  const o = json as Record<string, unknown>;
  if ("error" in o && o.data == null) return false;
  return true;
}

function fetchUrls(path: string): string[] {
  const urls: string[] = [];
  if (typeof window !== "undefined") urls.push(`/api/public/tcg?path=${encodeURIComponent(path)}`);
  urls.push(`${BASE}${path}`);
  return urls;
}

async function tcgFetch<T>(path: string): Promise<T> {
  const cached = cacheGet<T>(path);
  if (cached) return cached;
  const idbHit = await getHttpCache<T>(path, CACHE_TTL_MS);
  if (idbHit) {
    memCache.set(path, idbHit);
    return idbHit;
  }
  if (inflight.has(path)) return inflight.get(path) as Promise<T>;

  const p = (async () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const key = getApiKey() || envApiKey();
    if (key) headers["X-Api-Key"] = key;

    let lastErr: Error | null = null;
    const urls = fetchUrls(path);
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = urls[Math.min(attempt, urls.length - 1)];
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(4500) });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`Card API ${res.status}`);
          const stale = cacheGet<T>(path, { allowStale: true })
            || (await getHttpCache<T>(path, CACHE_TTL_MS, { allowStale: true }));
          if (stale) {
            memCache.set(path, stale);
            return stale;
          }
          await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
          continue;
        }
        if (!res.ok) throw new Error(`Card API ${res.status}`);
        const json = (await res.json()) as T;
        if (!isUsablePayload(json)) {
          lastErr = new Error("Card API empty");
          continue;
        }
        cacheSet(path, json);
        return json;
      } catch (e: any) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        const stale = cacheGet<T>(path, { allowStale: true });
        if (stale) return stale;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      }
    }
    const stale = cacheGet<T>(path, { allowStale: true });
    if (stale) return stale;
    throw lastErr ?? new Error("Card API unavailable");
  })().finally(() => inflight.delete(path));

  inflight.set(path, p);
  return p as Promise<T>;
}

const EUR_USD = 1.08;

const PRINT_PREF = [
  "holofoil",
  "1stEditionHolofoil",
  "unlimitedHolofoil",
  "reverseHolofoil",
  "shadowless",
  "1stEdition",
  "unlimited",
  "normal",
];

function pickTpField(tp: Record<string, TCGPrice> | undefined, key: "market" | "mid" | "low" | "directLow"): number {
  if (!tp) return 0;
  for (const k of PRINT_PREF) {
    const v = tp[k];
    if (!v) continue;
    const val = Number(v[key]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  for (const v of Object.values(tp)) {
    if (!v) continue;
    const val = Number(v[key]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return 0;
}

/** Prefer sold market over listing mid/low. */
function quotedFromTcgplayer(tp: Record<string, TCGPrice> | undefined): number {
  return pickTpField(tp, "market") || pickTpField(tp, "mid") || pickTpField(tp, "low") || pickTpField(tp, "directLow");
}

function cardmarketSoldUsd(cm: NonNullable<TCGCard["cardmarket"]>["prices"] | undefined): number {
  if (!cm) return 0;
  for (const key of ["avg7", "avg30", "averageSellPrice", "trendPrice"] as const) {
    const val = Number(cm[key]);
    if (Number.isFinite(val) && val > 0) return Math.round(val * EUR_USD * 100) / 100;
  }
  return 0;
}

/** Real sold-average / TCGPlayer market quote. Does not invent a hash estimate. */
export function getMarketPrice(c: TCGCard, opts?: { allowEstimate?: boolean }): number {
  if (!c) return 0;
  // Prefer Cardmarket sold averages (avg7/avg30/avg/trend) when present.
  const sold = cardmarketSoldUsd(c.cardmarket?.prices);
  if (sold > 0) return sold;
  // Then TCGPlayer market (recent sales), then mid/low listings.
  const marketOnly = pickTpField(c.tcgplayer?.prices, "market");
  if (marketOnly > 0) return marketOnly;
  const quoted = quotedFromTcgplayer(c.tcgplayer?.prices);
  if (quoted > 0) return quoted;
  const low = Number(c.cardmarket?.prices?.lowPrice);
  if (Number.isFinite(low) && low > 0) return Math.round(low * EUR_USD * 100) / 100;
  if (opts?.allowEstimate) return estimatePrice(c);
  return 0;
}

/** Last-resort display price when TCGPlayer/Cardmarket have no print yet (new sets). */
function estimatePrice(c: TCGCard): number {
  const r = (c.rarity || "").toLowerCase();
  let base = 0.5;
  if (r.includes("secret") || r.includes("rainbow") || r.includes("hyper") || r.includes("special illustration")) base = 80;
  else if (r.includes("illustration rare")) base = 35;
  else if (r.includes("ultra") || r.includes("vmax") || r.includes("vstar")) base = 18;
  else if (r.includes(" ex") || r.endsWith("ex") || /\bv\b/.test(r) || r.includes("gx")) base = 8;
  else if (r.includes("double rare")) base = 4;
  else if (r.includes("holo")) base = 2.5;
  else if (r.includes("rare")) base = 1.25;
  else if (r.includes("uncommon")) base = 0.5;
  else if (r.includes("common")) base = 0.25;
  let h = 0;
  const id = c.id || c.name || "x";
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const jitter = 0.7 + (h % 600) / 1000;
  return Math.round(base * jitter * 100) / 100;
}

export function getListedLow(c: TCGCard): number {
  if (!c) return 0;
  const tp = c.tcgplayer?.prices;
  if (tp && typeof tp === "object") {
    const variants = Object.values(tp).filter(Boolean) as Array<Record<string, unknown>>;
    for (const key of ["low", "directLow", "market"] as const) {
      for (const v of variants) {
        const val = Number(v?.[key]);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  const low = Number(c.cardmarket?.prices?.lowPrice);
  if (Number.isFinite(low) && low > 0) return Math.round(low * EUR_USD * 100) / 100;
  return 0;
}

export function getRarityColor(rarity?: string): string {
  if (!rarity) return "#888";
  const r = rarity.toLowerCase();
  if (r.includes("secret") || r.includes("rainbow") || r.includes("gold star") || r.includes("holo star")) return "#ec4899";
  if (r.includes("hyper") || r.includes("special") || r.includes("gold")) return "#f59e0b";
  if (r.includes("ultra") || r.includes("v") || r.includes("ex") || r.includes("gx")) return "#a855f7";
  if (r.includes("holo")) return "#60a5fa";
  if (r.includes("rare")) return "#facc15";
  if (r.includes("uncommon")) return "#4ade80";
  return "#888";
}

const CARD_LIST_SELECT = "id,name,supertype,subtypes,hp,attacks,rarity,number,images,set,tcgplayer,cardmarket,types,artist";

type SearchResult = { data: TCGCard[]; totalCount: number; page: number; pageSize: number };

function mergeCards(...lists: TCGCard[][]): TCGCard[] {
  const seen = new Set<string>();
  const out: TCGCard[] = [];
  for (const list of lists) {
    for (const c of list) {
      if (!c?.id || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

export async function searchCards(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  select?: string;
  lang?: string;
}): Promise<SearchResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 24;
  const lang = opts.lang || "en";
  const extracted = tcgdexSearchName(opts.q);
  const luceneOnly = Boolean(opts.q && /[\w.]+:/.test(opts.q) && !extracted);
  const text = luceneOnly ? "" : (extracted || opts.q || "");
  const parsed = parseSearchQuery(text);
  const corrected = parsed.name || (parsed.print ? "" : text);
  const special = parsed.print === "gold" ? [] : (text.trim() ? searchSpecialCards(text) : []);

  let catalog: TCGCard[] = [];
  if (text.trim()) {
    try {
      catalog = parsed.print === "gold"
        ? await tcgdexSearchGold(parsed.name, Math.max(pageSize, 80), lang)
        : await tcgdexSearchCards(text.trim(), pageSize, lang);
    } catch { /* catalog optional */ }
  }

  if (lang !== "en") {
    const mixed = parsed.print === "gold"
      ? mergeCards(catalog.filter((c) => isGoldCard(c, c.set?.name)))
      : mergeCards(special, catalog);
    mixed.forEach(rememberCard);
    const start = (page - 1) * pageSize;
    return { data: mixed.slice(start, start + pageSize), totalCount: mixed.length, page, pageSize };
  }

  if (parsed.print === "shadowless" || parsed.print === "error") {
    const mixed = mergeCards(special, catalog.filter((c) => /shadowless|error|misprint/i.test(`${c.set?.name || ""} ${c.rarity || ""} ${c.name || ""}`)));
    mixed.forEach(rememberCard);
    if (mixed.length) return { data: mixed.slice(0, pageSize), totalCount: mixed.length, page, pageSize };
  }

  if (parsed.print === "gold") {
    let ptcgGold: TCGCard[] = [];
    // Single-rarity queries are reliable; the big OR lucene 500s on pokemontcg.io.
    const goldQueries = parsed.name
      ? [`name:"${parsed.name.replace(/"/g, "")}*" rarity:"Rare Holo Star"`, `name:"${parsed.name.replace(/"/g, "")}*" rarity:"Hyper Rare"`]
      : [`rarity:"Rare Holo Star"`];
    const goldHits = await Promise.all(
      goldQueries.map((q) =>
        tcgFetch<SearchResult>(
          `/cards?${new URLSearchParams({
            q,
            page: "1",
            pageSize: "50",
            orderBy: opts.orderBy || "-set.releaseDate",
            select: opts.select || CARD_LIST_SELECT,
          })}`,
        ).catch(() => null),
      ),
    );
    for (const goldRes of goldHits) {
      if (goldRes?.data?.length) ptcgGold = ptcgGold.concat(goldRes.data);
    }
    const mixed = mergeCards(
      ptcgGold,
      catalog.filter((c) => isGoldCard(c, c.set?.name)),
      catalog,
    );
    mixed.forEach(rememberCard);
    const start = (page - 1) * pageSize;
    if (mixed.length) {
      return {
        data: mixed.slice(start, start + pageSize),
        totalCount: Math.max(mixed.length, ptcgGold.length),
        page,
        pageSize,
      };
    }
  }

  const params = new URLSearchParams();
  const lucene = opts.q && /[\w.]+:/.test(opts.q) && !parsed.print
    ? opts.q
    : corrected
      ? `name:"${corrected.replace(/"/g, "")}*"`
      : opts.q || "";
  if (lucene) params.set("q", lucene);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  if (opts.select) params.set("select", opts.select);

  let res: SearchResult | null = null;
  try {
    res = await tcgFetch<SearchResult>(`/cards?${params}`);
  } catch {
    /* try catalog + seed */
  }

  const ptcg = res?.data ?? [];
  const merged = mergeCards(
    special,
    catalog.filter((c) => /shadowless|error|misprint/i.test(`${c.set?.name || ""} ${c.rarity || ""} ${c.name || ""}`)),
    ptcg,
    catalog,
  );
  if (merged.length) {
    merged.forEach(rememberCard);
    return { data: merged.slice(0, pageSize), totalCount: Math.max(res?.totalCount ?? 0, merged.length), page, pageSize };
  }

  const fb = fallbackSearch(corrected || text);
  if (fb.length) return { data: fb, totalCount: fb.length, page, pageSize };
  return res ?? { data: [], totalCount: 0, page, pageSize };
}

function firstHit<T>(promises: Promise<T | null>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let left = promises.length;
    let settled = false;
    for (const p of promises) {
      p.then((v) => {
        if (!settled && v) {
          settled = true;
          resolve(v);
        } else if (--left === 0 && !settled) resolve(null);
      }).catch(() => {
        if (--left === 0 && !settled) resolve(null);
      });
    }
  });
}

export async function getCard(id: string, lang?: string): Promise<TCGCard> {
  const special = getSpecialCard(id);
  if (special) {
    rememberCard(special);
    return special;
  }
  const memo = (lang && cardMemo.get(`${lang}:${id}`)) || cardMemo.get(id);
  const useLang = lang || memo?.lang || (/^[A-Z]/.test(id) ? "ja" : "en");
  if (memo && (memo.images?.small || memo.tcgplayer || memo.cardmarket)) {
    firstHit<TCGCard>([
      useLang === "en"
        ? tcgFetch<{ data: TCGCard }>(`/cards/${encodeURIComponent(id)}`)
            .then((res) => (res?.data?.id ? res.data : null))
            .catch(() => null)
        : Promise.resolve(null),
      tcgdexGetCard(id, useLang).catch(() => null),
    ]).then((hit) => { if (hit?.id) rememberCard(hit); }).catch(() => {});
    return memo;
  }
  const hit = await firstHit<TCGCard>([
    useLang === "en"
      ? tcgFetch<{ data: TCGCard }>(`/cards/${encodeURIComponent(id)}`)
          .then((res) => (res?.data?.id ? res.data : null))
          .catch(() => null)
      : Promise.resolve(null),
    tcgdexGetCard(id, useLang).catch(() => null),
    useLang !== "en" ? tcgdexGetCard(id, "en").catch(() => null) : Promise.resolve(null),
  ]);
  if (hit?.id) {
    rememberCard(hit);
    return hit;
  }
  if (memo) return memo;
  return FALLBACK_CARDS.find((c) => c.id === id) || stubCardFromId(id);
}

function setsCacheLooksComplete(list: TCGSet[] | null | undefined): boolean {
  return !!(
    list?.length &&
    list.length >= 150 &&
    list.some((s) => s.id === "base1sl") &&
    list.some((s) => s.id === "error")
  );
}

/** Network refresh for the set catalog; writes IDB when English. */
async function fetchSetsFromNetwork(lang = "en"): Promise<TCGSet[]> {
  if (lang !== "en") {
    const dx = await tcgdexGetSets(lang);
    if (dx.length) return injectSpecialSets(dx);
  }

  // Parallel first page + TCGdex (one-shot list) instead of serial page loop then TCGdex.
  const page1P = tcgFetch<{ data: TCGSet[]; totalCount: number }>(
    `/sets?orderBy=-releaseDate&pageSize=250&page=1`,
  ).catch(() => null);
  const dxP = tcgdexGetSets(lang).catch(() => [] as TCGSet[]);
  const [page1, dx] = await Promise.all([page1P, dxP]);

  const all: TCGSet[] = [...(page1?.data ?? [])];
  const total = page1?.totalCount ?? all.length;
  if (page1?.data?.length && all.length < total && page1.data.length >= 250) {
    let page = 2;
    for (;;) {
      try {
        const res = await tcgFetch<{ data: TCGSet[]; totalCount: number }>(
          `/sets?orderBy=-releaseDate&pageSize=250&page=${page}`,
        );
        all.push(...(res.data ?? []));
        if (!res.data?.length || all.length >= (res.totalCount ?? total) || res.data.length < 250) break;
        page += 1;
        if (page > 8) break;
      } catch {
        break;
      }
    }
  }

  if (all.length === 0) all.push(...FALLBACK_SETS);
  if (dx.length) {
    const merged = mergeSetLists(all, dx);
    all.length = 0;
    all.push(...merged);
  }
  return injectSpecialSets(all);
}

export async function getSets(lang = "en"): Promise<TCGSet[]> {
  const cacheKeyLang = lang || "en";
  // IndexedDB read-through (24h TTL). Keep a stale copy for offline/API failure.
  const cached = await getCachedSets<TCGSet[]>();
  const stale = cacheKeyLang === "en" ? await getCachedSets<TCGSet[]>(Number.MAX_SAFE_INTEGER) : null;

  if (setsCacheLooksComplete(cached) && cacheKeyLang === "en") {
    return injectSpecialSets(cached!);
  }

  // Instant paint: any usable IDB list beats waiting on the full network merge.
  const instant = (setsCacheLooksComplete(stale) ? stale : null)
    || (cached && cached.length >= 50 ? cached : null)
    || (stale && stale.length >= 50 ? stale : null);
  if (instant?.length && cacheKeyLang === "en") {
    void fetchSetsFromNetwork(lang)
      .then((fresh) => {
        if (fresh.length >= 50) void setCachedSets(fresh);
      })
      .catch(() => {});
    return injectSpecialSets(instant);
  }

  if (lang !== "en") {
    const dx = await tcgdexGetSets(lang);
    if (dx.length) return injectSpecialSets(dx);
  }

  const final = await fetchSetsFromNetwork(lang);
  if (final.length < 10 && stale?.length) return injectSpecialSets(stale);
  if (cached?.length && final.length < cached.length) {
    const merged = injectSpecialSets(mergeSetLists(final, cached));
    if (cacheKeyLang === "en") void setCachedSets(merged);
    return merged;
  }
  if (cacheKeyLang === "en" && final.length) void setCachedSets(final);
  return final;
}

export async function getCardsBySet(setId: string, page = 1, lang = "en"): Promise<{ data: TCGCard[]; totalCount: number; page: number; pageSize: number }> {
  const special = getSpecialSetCards(setId);
  if (special) {
    special.forEach(rememberCard);
    return { data: special, totalCount: special.length, page: 1, pageSize: special.length };
  }
  if (lang !== "en") {
    const extra = await tcgdexGetSetCards(setId, lang);
    extra.forEach(rememberCard);
    return { data: extra, totalCount: extra.length, page: 1, pageSize: extra.length };
  }
  return searchCards({
    q: `set.id:${setId}`,
    page,
    pageSize: 250,
    orderBy: "number",
    select: CARD_LIST_SELECT,
    lang,
  });
}

async function readCachedSetCards(setId: string): Promise<{ fresh: TCGCard[] | null; stale: TCGCard[] | null }> {
  let fresh: TCGCard[] | null = null;
  let stale: TCGCard[] | null = null;
  for (const id of setIdAliases(setId)) {
    const hit = await getCachedSetCards<TCGCard[]>(id);
    if (hit?.length && (!fresh || hit.length > fresh.length)) fresh = hit;
    const old = await getCachedSetCards<TCGCard[]>(id, Number.MAX_SAFE_INTEGER);
    if (old?.length && (!stale || old.length > stale.length)) stale = old;
  }
  return { fresh, stale };
}

function writeCachedSetCards(setId: string, cards: TCGCard[]) {
  for (const id of setIdAliases(setId)) void setCachedSetCards(id, cards);
}

async function fetchPokemonTcgSetPages(
  setId: string,
  onPage?: (cards: TCGCard[], total: number) => void,
): Promise<{ cards: TCGCard[]; total: number }> {
  let best: TCGCard[] = [];
  let bestTotal = 0;
  for (const id of setIdAliases(setId)) {
    const chunk: TCGCard[] = [];
    let total = 0;
    try {
      let page = 1;
      for (;;) {
        const next = await getCardsBySet(id, page);
        if (!next.data?.length) break;
        chunk.push(...next.data);
        total = Math.max(total, next.totalCount ?? 0, chunk.length);
        onPage?.(chunk, total);
        page += 1;
        if (page > 24) break;
        if (next.totalCount && chunk.length >= next.totalCount) break;
      }
    } catch {
      /* try next alias */
    }
    if (chunk.length > best.length) {
      best = chunk;
      bestTotal = Math.max(total, chunk.length);
    }
    if (best.length) break;
  }
  return { cards: best, total: bestTotal };
}

/** Load every card in a set, calling onPage after each API page so the grid can paint early. */
export async function getAllCardsBySet(
  setId: string,
  onPage?: (cards: TCGCard[], total: number) => void,
  setName?: string,
  lang = "en",
  expectedCount = 0,
): Promise<{ data: TCGCard[]; totalCount: number }> {
  const special = getSpecialSetCards(setId);
  if (special) {
    special.forEach(rememberCard);
    onPage?.(special, special.length);
    return { data: special, totalCount: special.length };
  }

  const paint = (cards: TCGCard[], total: number) => {
    cards.forEach(rememberCard);
    onPage?.(cards, Math.max(total, cards.length, expectedCount));
  };

  let staleCards: TCGCard[] | null = null;
  let cached: TCGCard[] | null = null;
  if (lang === "en") {
    const stored = await readCachedSetCards(setId);
    cached = stored.fresh;
    staleCards = stored.stale;
    const instant = cached?.length ? cached : staleCards;
    if (instant?.length) {
      const need = Math.max(expectedCount, expectedSetTotal(instant));
      paint(instant, Math.max(instant.length, need));
      // Only skip the network when we already have the full printed box.
      if (cached?.length && expectedCount > 0 && cached.length >= expectedCount) {
        return { data: cached, totalCount: Math.max(cached.length, expectedCount) };
      }
    }
  }

  if (lang !== "en") {
    const extra = await tcgdexGetSetCards(setId, lang);
    extra.forEach(rememberCard);
    onPage?.(extra, extra.length);
    return { data: extra, totalCount: extra.length };
  }

  let all: TCGCard[] = cached?.length ? cached.slice() : [];
  let total = Math.max(expectedCount, all.length, expectedSetTotal(all));

  try {
    const dx = await tcgdexGetSetCards(setId, lang);
    if (dx.length) {
      all = mergeSetCardsByLocalId(dx, all);
      total = Math.max(total, dx.length, all.length, expectedSetTotal(all));
      paint(all, total);
    }
  } catch {
    /* pokemontcg next */
  }

  // Pokémon TCG API is for live prices only. Do not append extra rows — that
  // duplicates the same print (sv03.5-006 + sv3pt5-6).
  if (all.length) {
    void fetchPokemonTcgSetPages(setId).then((ptcg) => {
      if (!ptcg.cards.length) return;
      const merged = mergeSetCardsByLocalId(all, ptcg.cards);
      all = merged;
      paint(all, Math.max(total, all.length));
      if (all.length) writeCachedSetCards(setId, all);
    }).catch(() => {});
  } else {
    try {
      const ptcg = await fetchPokemonTcgSetPages(setId, (pageCards, tot) => {
        all = mergeSetCardsByLocalId(all, pageCards);
        total = Math.max(total, tot, all.length);
        paint(all, total);
      });
      if (ptcg.cards.length) {
        all = mergeSetCardsByLocalId(all, ptcg.cards);
        total = Math.max(total, ptcg.total, all.length);
        paint(all, total);
      }
    } catch {
      /* pokemontcg.io failed */
    }
  }

  if (all.length === 0 && staleCards?.length) {
    staleCards.forEach(rememberCard);
    onPage?.(staleCards, staleCards.length);
    return { data: staleCards, totalCount: staleCards.length };
  }

  all = sortSetCards(mergeSetCardsByLocalId(all, []));
  const result = { data: all, totalCount: Math.max(total, all.length, expectedCount) };
  if (result.data.length >= (cached?.length || 0)) writeCachedSetCards(setId, result.data);
  return result;
}

export async function getDiscoverFast(lang = "en"): Promise<TCGCard[]> {
  const recent = await tcgdexRecentCards(40, lang);
  if (recent.length) return recent;
  if (lang !== "en") return [];
  try {
    const res = await searchCards({
      q: "supertype:Pokémon",
      pageSize: 32,
      orderBy: "-set.releaseDate",
      select: CARD_LIST_SELECT,
      lang,
    });
    if (res.data?.length) return res.data;
  } catch {}
  return [];
}

export async function getTrending(pageSize = 16, page = 1, lang = "en"): Promise<TCGCard[]> {
  // The market-range Lucene query 500s on pokemontcg.io without a key.
  // Discover + local price sort is the reliable trending feed.
  void page;
  const cards = await getDiscoverFast(lang);
  return [...cards]
    .sort((a, b) => getMarketPrice(b) - getMarketPrice(a))
    .slice(0, pageSize);
}

export async function getTopMarket(lang = "en"): Promise<TCGCard[]> {
  // Prefer TCGdex catalog rows with embedded quotes (same path as Discover).
  // pokemontcg.io list quotes often ship empty; TCGPlayer infinite is 403 on Vercel.
  try {
    const recent = await tcgdexRecentCards(48, lang);
    recent.forEach(rememberCard);
    const priced = recent.filter((c) => getMarketPrice(c) > 0);
    const pool = priced.length ? priced : recent;
    if (pool.length) {
      return [...pool]
        .sort((a, b) => getMarketPrice(b) - getMarketPrice(a))
        .slice(0, 30);
    }
  } catch { /* fall through */ }
  if (lang === "en") {
    try {
      const res = await searchCards({
        q: "supertype:Pokémon",
        pageSize: 50,
        orderBy: "-set.releaseDate",
        select: CARD_LIST_SELECT,
      });
      const priced = (res.data ?? []).filter((c) => getMarketPrice(c) > 0).slice(0, 30);
      if (priced.length) return priced;
      if (res.data?.length) return res.data.slice(0, 30);
    } catch { /* fall through */ }
  }
  try {
    const fast = await getDiscoverFast(lang);
    if (fast.length) {
      return [...fast]
        .sort((a, b) => getMarketPrice(b) - getMarketPrice(a))
        .slice(0, 30);
    }
  } catch { /* fall through */ }
  return FALLBACK_CARDS;
}

export { mapTcgdexCard, stubCardFromId };
