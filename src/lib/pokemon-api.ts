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

function quotedFromTcgplayer(tp: Record<string, TCGPrice> | undefined): number {
  if (!tp) return 0;
  for (const k of PRINT_PREF) {
    const v = tp[k];
    if (!v) continue;
    for (const key of ["market", "mid", "low", "directLow"] as const) {
      const val = Number(v[key]);
      if (Number.isFinite(val) && val > 0) return val;
    }
  }
  for (const v of Object.values(tp)) {
    if (!v) continue;
    for (const key of ["market", "mid", "low", "directLow"] as const) {
      const val = Number(v[key]);
      if (Number.isFinite(val) && val > 0) return val;
    }
  }
  return 0;
}

/** Real TCGPlayer/Cardmarket quote. Does not invent a hash estimate. */
export function getMarketPrice(c: TCGCard, opts?: { allowEstimate?: boolean }): number {
  if (!c) return 0;
  const quoted = quotedFromTcgplayer(c.tcgplayer?.prices);
  if (quoted > 0) return quoted;
  const cm = c.cardmarket?.prices;
  if (cm) {
    for (const key of ["trendPrice", "averageSellPrice", "lowPrice"] as const) {
      const val = Number(cm[key]);
      if (Number.isFinite(val) && val > 0) return Math.round(val * EUR_USD * 100) / 100;
    }
  }
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

export async function getSets(lang = "en"): Promise<TCGSet[]> {
  const cacheKeyLang = lang || "en";
  // IndexedDB read-through (24h TTL). Keep a stale copy for offline/API failure.
  const cached = await getCachedSets<TCGSet[]>();
  const stale = cacheKeyLang === "en" ? await getCachedSets<TCGSet[]>(Number.MAX_SAFE_INTEGER) : null;
  if (
    cached?.length &&
    cacheKeyLang === "en" &&
    cached.length >= 150 &&
    cached.some((s) => s.id === "base1sl") &&
    cached.some((s) => s.id === "error")
  ) {
    return injectSpecialSets(cached);
  }

  if (lang !== "en") {
    const dx = await tcgdexGetSets(lang);
    if (dx.length) return injectSpecialSets(dx);
  }

  const all: TCGSet[] = [];
  try {
    let page = 1;
    for (;;) {
      const res = await tcgFetch<{ data: TCGSet[]; totalCount: number }>(
        `/sets?orderBy=-releaseDate&pageSize=250&page=${page}`
      );
      all.push(...(res.data ?? []));
      const total = res.totalCount ?? all.length;
      if (!res.data?.length || all.length >= total || res.data.length < 250) break;
      page += 1;
      if (page > 8) break;
    }
  } catch {
    /* TCGdex merge below */
  }

  if (all.length === 0) all.push(...FALLBACK_SETS);

  try {
    const dx = await tcgdexGetSets(lang);
    const merged = mergeSetLists(all, dx);
    all.length = 0;
    all.push(...merged);
  } catch {
    // ignore secondary failure
  }

  if (all.length < 10 && stale?.length) return injectSpecialSets(stale);
  if (cached?.length && all.length < cached.length) {
    const merged = injectSpecialSets(mergeSetLists(all, cached));
    if (cacheKeyLang === "en") void setCachedSets(merged);
    return merged;
  }
  const final = injectSpecialSets(all);
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

/** Load every card in a set, calling onPage after each API page so the grid can paint early. */
export async function getAllCardsBySet(
  setId: string,
  onPage?: (cards: TCGCard[], total: number) => void,
  setName?: string,
  lang = "en",
): Promise<{ data: TCGCard[]; totalCount: number }> {
  // Fresh IDB hit (7d). Keep an unlimited stale copy for API blackouts.
  const special = getSpecialSetCards(setId);
  if (special) {
    special.forEach(rememberCard);
    onPage?.(special, special.length);
    return { data: special, totalCount: special.length };
  }
  let staleCards: TCGCard[] | null = null;
  if (lang === "en") {
    const cached = await getCachedSetCards<TCGCard[]>(setId);
    staleCards = await getCachedSetCards<TCGCard[]>(setId, Number.MAX_SAFE_INTEGER);
    if (cached?.length) {
      cached.forEach(rememberCard);
      onPage?.(cached, cached.length);
      return { data: cached, totalCount: cached.length };
    }
  }

  if (lang !== "en") {
    const extra = await tcgdexGetSetCards(setId, lang);
    extra.forEach(rememberCard);
    onPage?.(extra, extra.length);
    return { data: extra, totalCount: extra.length };
  }
  let all: TCGCard[] = [];
  let total = 0;
  try {
    let page = 1;
    for (;;) {
      const next = await getCardsBySet(setId, page);
      if (!next.data?.length) break;
      all = all.concat(next.data);
      total = Math.max(total, next.totalCount ?? 0, all.length);
      onPage?.(all, total);
      page += 1;
      if (page > 20) break;
    }
  } catch {
    // pokemontcg.io failed; TCGdex merge below
  }

  if (all.length === 0 && setName) {
    try {
      const fallback = await searchCards({
        q: `set.name:"${setName.replace(/"/g, "")}"`,
        pageSize: 250,
        orderBy: "number",
        select: CARD_LIST_SELECT,
        lang,
      });
      all = fallback.data ?? [];
      total = Math.max(total, fallback.totalCount ?? all.length, all.length);
      onPage?.(all, total);
    } catch {}
  }

  try {
    const extra = await tcgdexGetSetCards(setId, lang);
    if (extra.length) {
      const seen = new Set(all.map((c) => c.id));
      let added = false;
      for (const c of extra) {
        if (!c.id || seen.has(c.id)) continue;
        all.push(c);
        seen.add(c.id);
        added = true;
      }
      if (added) {
        total = Math.max(total, all.length);
        onPage?.(all, total);
      }
    }
  } catch {}

  // Last-good IDB when both APIs came back empty (me2pt5 / Ascended Heroes class failures)
  if (all.length === 0 && staleCards?.length) {
    staleCards.forEach(rememberCard);
    onPage?.(staleCards, staleCards.length);
    return { data: staleCards, totalCount: staleCards.length };
  }

  const result = { data: all, totalCount: Math.max(total, all.length) };
  if (result.data.length) void setCachedSetCards(setId, result.data);
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
