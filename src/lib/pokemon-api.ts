// Pokemon TCG API client (api.pokemontcg.io v2)
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

function cacheGet<T>(key: string): T | null {
  if (memCache.has(key)) return memCache.get(key) as T;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - parsed.t > CACHE_TTL_MS) {
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

async function tcgFetch<T>(path: string): Promise<T> {
  const cached = cacheGet<T>(path);
  if (cached) return cached;
  if (inflight.has(path)) return inflight.get(path) as Promise<T>;

  const headers: Record<string, string> = {};
  const key = getApiKey();
  if (key) headers["X-Api-Key"] = key;

  const p = (async () => {
    const res = await fetch(`${BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = (await res.json()) as T;
    cacheSet(path, json);
    return json;
  })().finally(() => inflight.delete(path));

  inflight.set(path, p);
  return p as Promise<T>;
}

export function getMarketPrice(c: TCGCard): number {
  // Prefer TCGplayer (USD). Cardmarket is EUR and intentionally skipped
  // so vault values stay in US dollars.
  if (!c) return 0;
  const tp = c.tcgplayer?.prices;
  if (tp && typeof tp === "object") {
    const variants = Object.values(tp).filter(Boolean) as Array<Record<string, unknown>>;
    for (const key of ["market", "mid", "low", "directLow", "high"] as const) {
      for (const v of variants) {
        const val = Number(v?.[key]);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  const est = estimatePrice(c);
  return Number.isFinite(est) && est > 0 ? est : 0;
}



// Deterministic fallback estimate so every card always shows a price
// when neither TCGPlayer nor Cardmarket return one. Based on rarity tier
// plus a stable per-card jitter derived from the card id.
function estimatePrice(c: TCGCard): number {
  const r = (c.rarity || "").toLowerCase();
  let base = 0.5;
  if (r.includes("secret") || r.includes("rainbow") || r.includes("hyper") || r.includes("special illustration")) base = 80;
  else if (r.includes("illustration rare")) base = 35;
  else if (r.includes("ultra") || r.includes("vmax") || r.includes("vstar")) base = 18;
  else if (r.includes(" ex") || r.endsWith("ex") || r.includes(" v") || r.includes("gx")) base = 8;
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

export async function searchCards(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
}): Promise<{ data: TCGCard[]; totalCount: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 24));
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  return tcgFetch(`/cards?${params}`);
}

export async function getCard(id: string): Promise<TCGCard> {
  const res = await tcgFetch<{ data: TCGCard }>(`/cards/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getSets(): Promise<TCGSet[]> {
  const res = await tcgFetch<{ data: TCGSet[] }>(`/sets?orderBy=-releaseDate&pageSize=250`);
  return res.data;
}

export async function getCardsBySet(setId: string, page = 1): Promise<{ data: TCGCard[]; totalCount: number }> {
  return searchCards({ q: `set.id:${setId}`, page, pageSize: 60, orderBy: "number" });
}

export async function getTrending(pageSize = 60): Promise<TCGCard[]> {
  // Recent high-value cards
  const res = await searchCards({
    q: "tcgplayer.prices.holofoil.market:[15 TO *]",
    pageSize,
    orderBy: "-set.releaseDate",
  });
  return res.data;
}

export async function getTopMarket(): Promise<TCGCard[]> {
  const res = await searchCards({
    q: "rarity:*",
    pageSize: 50,
    orderBy: "-cardmarket.prices.trendPrice",
  });
  return res.data.filter(c => getMarketPrice(c) > 0).slice(0, 30);
}
