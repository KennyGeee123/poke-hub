// Pokemon TCG API client (api.pokemontcg.io v2) with TCGdex fallback
import {
  mapTcgdexCard,
  tcgdexGetCard,
  tcgdexGetSetCards,
  tcgdexGetSets,
  tcgdexRecentCards,
  tcgdexSearchCards,
  tcgdexSearchName,
} from "@/lib/tcgdex";
import { FALLBACK_CARDS, FALLBACK_SETS, fallbackSearch, stubCardFromId } from "@/lib/tcg-fallback";

const BASE = "https://api.pokemontcg.io/v2";

export type TCGPrice = { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
export type TCGCard = {
  id: string;
  name: string;
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
  images: { symbol: string; logo: string };
};

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

function cacheGet<T>(key: string, opts?: { allowStale?: boolean }): T | null {
  if (memCache.has(key)) return memCache.get(key) as T;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    const stale = Date.now() - parsed.t > CACHE_TTL_MS;
    if (stale && !opts?.allowStale) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memCache.set(key, parsed.v);
    return parsed.v;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, value: T) {
  memCache.set(key, value);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      }
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
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
          const stale = cacheGet<T>(path, { allowStale: true });
          if (stale) return stale;
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

export function getMarketPrice(c: TCGCard): number {
  if (!c) return 0;
  const tp = c.tcgplayer?.prices;
  if (tp && typeof tp === "object") {
    const variants = Object.values(tp).filter(Boolean) as Array<Record<string, unknown>>;
    for (const key of ["market", "mid", "low", "directLow"] as const) {
      for (const v of variants) {
        const val = Number(v?.[key]);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  const cm = c.cardmarket?.prices;
  if (cm) {
    for (const key of ["trendPrice", "averageSellPrice", "lowPrice"] as const) {
      const val = Number(cm[key]);
      if (Number.isFinite(val) && val > 0) return Math.round(val * EUR_USD * 100) / 100;
    }
  }
  return estimatePrice(c);
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
  if (r.includes("secret") || r.includes("rainbow")) return "#ec4899";
  if (r.includes("hyper") || r.includes("special")) return "#f59e0b";
  if (r.includes("ultra") || r.includes("v") || r.includes("ex") || r.includes("gx")) return "#a855f7";
  if (r.includes("holo")) return "#60a5fa";
  if (r.includes("rare")) return "#facc15";
  if (r.includes("uncommon")) return "#4ade80";
  return "#888";
}

const CARD_LIST_SELECT = "id,name,supertype,subtypes,hp,attacks,rarity,number,images,set,tcgplayer,cardmarket,types,artist";

type SearchResult = { data: TCGCard[]; totalCount: number; page: number; pageSize: number };

export async function searchCards(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  select?: string;
}): Promise<SearchResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 24;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  if (opts.select) params.set("select", opts.select);

  let res: SearchResult | null = null;
  try {
    res = await tcgFetch<SearchResult>(`/cards?${params}`);
    if (res?.data?.length) return res;
  } catch {
    /* try tcgdex + seed catalog */
  }

  const name = tcgdexSearchName(opts.q);
  if (name) {
    try {
      const data = await tcgdexSearchCards(name, pageSize);
      if (data.length) return { data, totalCount: data.length, page, pageSize };
    } catch { /* ignore */ }
  }
  const fb = fallbackSearch(opts.q || name || "");
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

export async function getCard(id: string): Promise<TCGCard> {
  const hit = await firstHit<TCGCard>([
    tcgFetch<{ data: TCGCard }>(`/cards/${encodeURIComponent(id)}`)
      .then((res) => (res?.data?.id ? res.data : null))
      .catch(() => null),
    tcgdexGetCard(id).catch(() => null),
  ]);
  if (hit?.id) return hit;
  return FALLBACK_CARDS.find((c) => c.id === id) || stubCardFromId(id);
}

export async function getSets(): Promise<TCGSet[]> {
  const all: TCGSet[] = [];
  let ptcgFailed = false;
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
    ptcgFailed = true;
  }

  if (all.length === 0) all.push(...FALLBACK_SETS);

  if (ptcgFailed || all.length < 50) {
    try {
      const dx = await tcgdexGetSets();
      const seen = new Set(all.map((s) => s.id));
      for (const s of dx) {
        if (!s.id || seen.has(s.id)) continue;
        all.push(s);
        seen.add(s.id);
      }
    } catch {
      // ignore secondary failure
    }
  }
  return all;
}

export async function getCardsBySet(setId: string, page = 1): Promise<{ data: TCGCard[]; totalCount: number; page: number; pageSize: number }> {
  return searchCards({
    q: `set.id:${setId}`,
    page,
    pageSize: 250,
    orderBy: "number",
    select: CARD_LIST_SELECT,
  });
}

/** Load every card in a set, calling onPage after each API page so the grid can paint early. */
export async function getAllCardsBySet(
  setId: string,
  onPage?: (cards: TCGCard[], total: number) => void,
  setName?: string
): Promise<{ data: TCGCard[]; totalCount: number }> {
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
      });
      all = fallback.data ?? [];
      total = Math.max(total, fallback.totalCount ?? all.length, all.length);
      onPage?.(all, total);
    } catch {}
  }

  try {
    const extra = await tcgdexGetSetCards(setId);
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

  return { data: all, totalCount: Math.max(total, all.length) };
}

export async function getDiscoverFast(): Promise<TCGCard[]> {
  try {
    const res = await searchCards({
      q: "supertype:Pokémon",
      pageSize: 32,
      orderBy: "-set.releaseDate",
      select: CARD_LIST_SELECT,
    });
    if (res.data?.length) return res.data;
  } catch {}
  return tcgdexRecentCards(32);
}

export async function getTrending(pageSize = 16, page = 1): Promise<TCGCard[]> {
  try {
    const res = await searchCards({
      q: "(tcgplayer.prices.holofoil.market:[10 TO *] OR tcgplayer.prices.normal.market:[10 TO *] OR tcgplayer.prices.reverseHolofoil.market:[10 TO *])",
      page,
      pageSize,
      orderBy: "-set.releaseDate",
      select: CARD_LIST_SELECT,
    });
    if (res.data?.length) return res.data;
  } catch {}
  return getDiscoverFast();
}

export async function getTopMarket(): Promise<TCGCard[]> {
  try {
    const res = await searchCards({
      q: "supertype:Pokémon",
      pageSize: 50,
      orderBy: "-set.releaseDate",
      select: CARD_LIST_SELECT,
    });
    const priced = (res.data ?? []).filter(c => getMarketPrice(c) > 0).slice(0, 30);
    if (priced.length) return priced;
    if (res.data?.length) return res.data.slice(0, 30);
  } catch { /* fall through */ }
  try {
    const fast = await getDiscoverFast();
    if (fast.length) return fast.slice(0, 30);
  } catch { /* fall through */ }
  return FALLBACK_CARDS;
}

export { mapTcgdexCard, stubCardFromId };
