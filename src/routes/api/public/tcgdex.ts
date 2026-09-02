// Proxies api.tcgdex.net; if that host is down, serve the bundled print catalog
// (JP/CN/KO/TH + EN/EU SV) plus live TCGPlayer market prices.
import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.tcgdex.net/v2";
const LANGS = new Set([
  "en", "fr", "es", "es-mx", "de", "it", "pt", "pt-br", "pt-pt",
  "nl", "pl", "ru", "ja", "ko", "zh-tw", "zh-cn", "id", "th",
]);
const ASIA = new Set(["ja", "ko", "zh-tw", "zh-cn", "id", "th"]);

type CatCard = {
  id: string;
  localId: string;
  setId: string;
  serie: string;
  region?: string;
  names: Record<string, string>;
  rarity?: string;
  hp?: number | null;
  dex?: number[];
  types?: string[];
  illustrator?: string;
  tcgplayer?: number | null;
  cardmarket?: number | null;
  category?: string;
};
type CatSet = {
  id: string;
  official?: number;
  names: Record<string, string>;
  serie: string;
  region?: string;
  releaseDate?: string;
};
type Catalog = { sets: CatSet[]; cards: CatCard[]; dexNames?: Record<string, Record<string, string>> };

const DEX_ALIASES: Record<number, Record<string, string>> = {
  6: { en: "Charizard", ja: "リザードン", ko: "리자몽", "zh-tw": "噴火龍", "zh-cn": "喷火龙", th: "ลิซาร์ดอน", fr: "Dracaufeu", de: "Glurak", es: "Charizard", it: "Charizard", pt: "Charizard" },
  25: { en: "Pikachu", ja: "ピカチュウ", ko: "피카츄", "zh-tw": "皮卡丘", "zh-cn": "皮卡丘", th: "พิคาชู", fr: "Pikachu", de: "Pikachu" },
  150: { en: "Mewtwo", ja: "ミュウツー", ko: "뮤츠", "zh-tw": "超夢", "zh-cn": "超梦", th: "มิวทู", fr: "Mewtwo", de: "Mewtu" },
  249: { en: "Lugia", ja: "ルギア", ko: "루기아", "zh-tw": "洛奇亞", "zh-cn": "洛奇亚", th: "ลูเกีย", fr: "Lugia", de: "Lugia" },
  384: { en: "Rayquaza", ja: "レックウザ", ko: "레쿠자", "zh-tw": "烈空坐", "zh-cn": "烈空坐", th: "เรคควอซา", fr: "Rayquaza", de: "Rayquaza" },
};

let CAT: Catalog | null = null;
const priceCache = new Map<number, { t: number; p: number | null }>();
const PRICE_TTL = 30 * 60 * 1000;

async function loadCatalog(request: Request): Promise<Catalog | null> {
  if (CAT?.cards?.length) return CAT;
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const p of ["public/asia-catalog.json", ".output/public/asia-catalog.json", "dist/client/asia-catalog.json"]) {
      const full = join(process.cwd(), p);
      if (!existsSync(full)) continue;
      CAT = JSON.parse(readFileSync(full, "utf8")) as Catalog;
      if (CAT?.cards?.length) return CAT;
    }
  } catch { /* fall through to HTTP */ }
  try {
    const r = await fetch(new URL("/asia-catalog.json", request.url), {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      CAT = (await r.json()) as Catalog;
      return CAT;
    }
  } catch { /* ignore */ }
  return CAT;
}

function langKey(lang: string): string {
  if (lang === "pt-br" || lang === "pt-pt") return "pt";
  return lang;
}

function namesForDex(catalog: Catalog, dex?: number | null): Record<string, string> {
  if (!dex) return {};
  return { ...(catalog.dexNames?.[String(dex)] || {}), ...(DEX_ALIASES[dex] || {}) };
}

function pickName(names: Record<string, string> | undefined, lang: string, extra?: Record<string, string>): string {
  const merged = { ...(extra || {}), ...(names || {}) };
  const pt = langKey(lang);
  const order = [lang, pt];
  if (lang === "zh-cn") order.push("zh-tw", "en", "ja");
  else if (lang === "zh-tw") order.push("zh-cn", "en", "ja");
  else if (ASIA.has(lang)) order.push("ja", "zh-tw", "en");
  else order.push("en", "fr", "de", "es", "it", "pt", "ja");
  order.push("ko", "th", "id", "zh-cn", "zh-tw");
  const seen = new Set<string>();
  for (const k of order) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (merged[k]) return merged[k];
  }
  return Object.values(merged)[0] || "";
}

function cardImage(c: CatCard, lang: string): string {
  if (c.tcgplayer) return `https://tcgplayer-cdn.tcgplayer.com/product/${c.tcgplayer}_in_1000x1000.jpg`;
  const serie = (c.serie || "sv").toLowerCase().replace(/[^a-z0-9]/g, "") || "sv";
  const assetLang = lang === "pt-br" ? "pt" : lang;
  return `https://assets.tcgdex.net/${assetLang}/${serie}/${c.setId}/${c.localId}/high.webp`;
}

function toTcgdexCard(c: CatCard, lang: string, setName: string, price?: number | null, catalog?: Catalog | null) {
  const img = cardImage(c, lang);
  const pricing: any = {};
  if (typeof price === "number" && price > 0) {
    pricing.tcgplayer = {
      unit: "USD",
      url: c.tcgplayer ? `https://www.tcgplayer.com/product/${c.tcgplayer}` : undefined,
      normal: { marketPrice: price, lowPrice: price },
    };
  }
  const extra = namesForDex(catalog || CAT || { sets: [], cards: [] }, c.dex?.[0]);
  return {
    id: c.id,
    name: pickName(c.names, lang, extra),
    localId: c.localId,
    image: img || undefined,
    rarity: c.rarity,
    hp: c.hp,
    types: c.types,
    illustrator: c.illustrator,
    category: c.category,
    set: { id: c.setId, name: setName, serie: { name: c.serie }, releaseDate: (catalog || CAT)?.sets.find((s) => s.id === c.setId)?.releaseDate },
    pricing: Object.keys(pricing).length ? pricing : undefined,
  };
}

async function tcgplayerPrice(productId: number): Promise<number | null> {
  const hit = priceCache.get(productId);
  if (hit && Date.now() - hit.t < PRICE_TTL) return hit.p;
  try {
    const r = await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}?range=quarter`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) {
      priceCache.set(productId, { t: Date.now(), p: null });
      return null;
    }
    const j: any = await r.json();
    const variants = j?.result?.[0]?.variants;
    if (!Array.isArray(variants)) {
      priceCache.set(productId, { t: Date.now(), p: null });
      return null;
    }
    let best = Infinity;
    for (const v of variants) {
      const n = Number(v.marketPrice);
      if (Number.isFinite(n) && n > 0 && n < best) best = n;
    }
    const p = Number.isFinite(best) && best < Infinity ? best : null;
    priceCache.set(productId, { t: Date.now(), p });
    return p;
  } catch {
    return null;
  }
}

async function hydratePrices(cards: CatCard[], limit = 16): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const slice = cards.filter((c) => c.tcgplayer).slice(0, limit);
  const chunk = 8;
  for (let i = 0; i < slice.length; i += chunk) {
    const part = slice.slice(i, i + chunk);
    const prices = await Promise.all(part.map((c) => tcgplayerPrice(c.tcgplayer!)));
    part.forEach((c, idx) => {
      const p = prices[idx];
      if (typeof p === "number" && p > 0) out.set(c.id, p);
    });
  }
  return out;
}

function preferRegion(cards: CatCard[], lang: string): CatCard[] {
  const region = ASIA.has(lang) ? "asia" : "intl";
  const first = cards.filter((c) => (c.region || "asia") === region);
  return first.length ? first.concat(cards.filter((c) => (c.region || "asia") !== region)) : cards;
}

function matchQuery(c: CatCard, q: string, _catalog: Catalog): boolean {
  if (!q) return false;
  if (Object.values(c.names || {}).some((n) => String(n).toLowerCase().includes(q))) return true;
  if (c.id.toLowerCase().includes(q) || c.localId.toLowerCase() === q) return true;
  const alias = DEX_ALIASES[c.dex?.[0] || 0];
  if (alias && Object.values(alias).some((n) => String(n).toLowerCase().includes(q))) return true;
  return false;
}

function matchScore(c: CatCard, q: string, lang: string): number {
  const n = pickName(c.names, lang).toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  if (Object.values(c.names || {}).some((v) => String(v).toLowerCase() === q)) return 3;
  return 4;
}

async function fromCatalog(lang: string, path: string, catalog: Catalog): Promise<Response | null> {
  const CAT = catalog;
  if (!CAT?.cards?.length) return null;
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" },
    });

  let pathname = path;
  let sp: URLSearchParams;
  try {
    const u = new URL(path, "https://catalog.local");
    pathname = u.pathname;
    sp = u.searchParams;
  } catch {
    sp = new URLSearchParams();
  }

  const setName = (id: string) => pickName(CAT.sets.find((s) => s.id === id)?.names, lang) || id;
  const region = ASIA.has(lang) ? "asia" : "intl";

  if (pathname === "/cards") {
    const name = (sp.get("name") || "").trim().toLowerCase();
    const sort = sp.get("sort") || "";
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit") || 40) || 40));

    if (name) {
      const want = ASIA.has(lang) ? "asia" : "intl";
      const hits = CAT.cards
        .filter((c) => matchQuery(c, name, CAT))
        .sort((a, b) => {
          const ra = (a.region || "asia") === want ? 0 : 1;
          const rb = (b.region || "asia") === want ? 0 : 1;
          if (ra !== rb) return ra - rb;
          return matchScore(a, name, lang) - matchScore(b, name, lang);
        })
        .slice(0, 40);
      const prices = await hydratePrices(hits);
      return json(hits.map((c) => toTcgdexCard(c, lang, setName(c.setId), prices.get(c.id), CAT)));
    }

    if (sort === "recent" || !sp.toString()) {
      const priced = preferRegion(
        CAT.cards.filter((c) => c.tcgplayer && (c.category === "Pokemon" || !c.category)),
        lang,
      );
      const withCards = new Set(CAT.cards.map((c) => c.setId));
      const newestSetIds = CAT.sets
        .filter((s) => (s.region || "asia") === region && withCards.has(s.id))
        .slice()
        .sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")))
        .slice(0, 8)
        .map((s) => s.id);
      const recent = priced.filter((c) => newestSetIds.includes(c.setId));
      const pool = (recent.length >= 12 ? recent : priced).slice(0, limit);
      const prices = await hydratePrices(pool, 16);
      return json(pool.map((c) => toTcgdexCard(c, lang, setName(c.setId), prices.get(c.id), CAT)));
    }
  }

  const cardOne = pathname.match(/^\/cards\/([^/]+)$/);
  if (cardOne) {
    const id = decodeURIComponent(cardOne[1]);
    const c = CAT.cards.find((x) => x.id === id);
    if (!c) return json({ error: "Not found" }, 404);
    const prices = await hydratePrices([c]);
    return json(toTcgdexCard(c, lang, setName(c.setId), prices.get(c.id), CAT));
  }

  if (pathname === "/sets") {
    const withCards = new Set(CAT.cards.map((c) => c.setId));
    const list = CAT.sets
      .filter((s) => {
        if (!withCards.has(s.id)) return false;
        if (ASIA.has(lang)) return (s.region || "asia") === "asia" && (s.names[lang] || s.names.ja || s.names["zh-tw"]);
        return (s.region || "intl") === "intl" || s.names[lang] || s.names.en;
      })
      .map((s) => ({
        id: s.id,
        name: pickName(s.names, lang) || s.id,
        cardCount: { official: s.official || 0, total: s.official || 0 },
        serie: { name: s.serie },
        releaseDate: s.releaseDate || "",
      }));
    return json(list);
  }

  const setOne = pathname.match(/^\/sets\/([^/]+)$/);
  if (setOne) {
    const id = decodeURIComponent(setOne[1]);
    const s = CAT.sets.find((x) => x.id === id);
    const cards = CAT.cards.filter((c) => c.setId === id);
    if (!s && !cards.length) return json({ error: "Not found" }, 404);
    const prices = await hydratePrices(cards, 20);
    const name = s ? pickName(s.names, lang) : id;
    return json({
      id,
      name,
      cardCount: { official: s?.official || cards.length, total: cards.length },
      serie: { name: s?.serie || "SV" },
      releaseDate: s?.releaseDate || "",
      cards: cards.map((c) => toTcgdexCard(c, lang, name, prices.get(c.id), CAT)),
    });
  }

  return null;
}

export const Route = createFileRoute("/api/public/tcgdex")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lang = (url.searchParams.get("lang") ?? "en").toLowerCase();
        const path = url.searchParams.get("path") ?? "";
        if (!LANGS.has(lang)) return Response.json({ error: "Invalid lang" }, { status: 400 });
        if (!path.startsWith("/") || path.includes("://") || path.includes("..")) {
          return Response.json({ error: "Invalid path" }, { status: 400 });
        }

        const catalog = await loadCatalog(request);
        if (catalog) {
          const hit = await fromCatalog(lang, path, catalog);
          if (hit) return hit;
        }

        try {
          const r = await fetch(`${UPSTREAM}/${lang}${path}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(1200),
          });
          if (r.ok) {
            const body = await r.text();
            return new Response(body, {
              status: 200,
              headers: {
                "content-type": r.headers.get("content-type") || "application/json",
                "cache-control": "public, s-maxage=180, stale-while-revalidate=900",
              },
            });
          }
        } catch { /* api.tcgdex.net is often unreachable from cloud IPs */ }

        const late = catalog || await loadCatalog(request);
        const fallback = late ? await fromCatalog(lang, path, late) : null;
        if (fallback) return fallback;
        return Response.json({ error: "TCGdex unavailable" }, { status: 502 });
      },
    },
  },
});
