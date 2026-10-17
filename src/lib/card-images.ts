// Card image helpers. Every scan comes from Scrydex (the printed card).
// Tile grids use the medium file; detail uses large. A placeholder file
// advances, and the last stop is the "Art pending" tile — never TCGdex,
// TCGPlayer, or a pokemontcg.io card-back.
import type { TCGCard } from "@/lib/pokemon-api";
import { isAllowedCardImageUrl } from "@/lib/card-image-hosts";
import {
  isScrydexPlaceholderSize,
  scrydexImagesForId,
  scrydexScanUrls,
} from "@/lib/classic-scans";
import { cardLocalId, cardSetId, isSameCard, parseCardId } from "@/lib/card-identity";
import { applyImagePolicy } from "@/lib/image-policy";
import { isAppOnlyCardId } from "@/lib/tcgdex";

/**
 * Branded "Art pending" tile: silhouette + name + set code. Never a blank or
 * black box, and never mistaken for real scan art.
 */
export function generateCardSvgFallback(name: string, number?: string, setName?: string): string {
  const esc = (v: string) => v.replace(/[<>&"']/g, "");
  const safeName = esc(name || "Pokémon Card").slice(0, 26);
  const safeNum = esc(number || "—").slice(0, 12);
  const safeSet = esc(setName || "PokéVault").slice(0, 28);

  const svg = `<svg data-pv-art-pending="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="100%" height="100%">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="55%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#0b1020"/>
      </linearGradient>
      <linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#f87171"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="296" height="416" rx="16" fill="url(#g)" stroke="url(#b)" stroke-width="4"/>
    <circle cx="150" cy="165" r="62" fill="none" stroke="rgba(251,191,36,0.35)" stroke-width="8"/>
    <path d="M 88 165 L 212 165" stroke="rgba(251,191,36,0.35)" stroke-width="8"/>
    <circle cx="150" cy="165" r="18" fill="#111827" stroke="rgba(251,191,36,0.55)" stroke-width="6"/>
    <text x="150" y="265" fill="#f8fafc" font-size="18" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">${safeName}</text>
    <text x="150" y="292" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="middle">${safeSet} · #${safeNum}</text>
    <rect x="90" y="352" width="120" height="26" rx="13" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.5)"/>
    <text x="150" y="369" fill="#fbbf24" font-size="11" font-family="monospace" font-weight="700" text-anchor="middle" letter-spacing="1.5">ART PENDING</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function isArtPending(url?: string | null): boolean {
  return !!url && url.startsWith("data:image/svg+xml") && url.includes("data-pv-art-pending");
}

/**
 * Same-origin proxy for an allow-listed card CDN URL. The server retries
 * busy (5xx) answers and caches at the edge, so a TCGdex 503 burst or a
 * pokemontcg 404 card-back never reaches the tile.
 */
export function proxiedCardImage(url?: string | null): string {
  if (!url || !isAllowedCardImageUrl(url)) return "";
  return `/api/public/card-image?url=${encodeURIComponent(url)}`;
}

/**
 * pokemontcg.io answers a missing scan with HTTP 404 *and* a 640×892 card-back
 * PNG, so <img> fires onLoad. Treat that (and tiny broken bitmaps) as a miss.
 */
export function looksLikePlaceholderScan(
  img: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight" | "currentSrc" | "src">,
): boolean {
  const w = img.naturalWidth || 0;
  const h = img.naturalHeight || 0;
  const src = img.currentSrc || img.src || "";
  if (src.startsWith("data:")) return false;
  if (w < 40 || h < 40) return true;
  // Scrydex serves a fixed placeholder for unknown ids (HTTP 200). Real medium
  // scans are 367×512, one pixel taller than the placeholder.
  if (/images\.scrydex\.com/i.test(src) && isScrydexPlaceholderSize(w, h)) return true;
  return /images\.pokemontcg\.io/i.test(src) && w === 640 && h === 892;
}

/** Rewrite tcgdex .../high.webp → .../low.webp for ~140px tiles. */
export function tcgdexHighToLow(url: string): string {
  if (!url || !/assets\.tcgdex\.net/i.test(url)) return url;
  return url.replace(/\/high\.(webp|png|jpg)$/i, "/low.$1");
}

/** Strip pokemontcg `_hires` so tiles request the small PNG (~160KB) not ~845KB. */
export function stripHiresForTile(url: string): string {
  if (!url) return url;
  return url.replace(/_hires(\.(png|jpg|webp))$/i, "$1");
}

/** TCGPlayer product CDN often ships `_in_1000x1000` (~80KB+) — tiles only need ~400px. */
export function tcgplayerDownsizeForTile(url: string): string {
  if (!url || !/tcgplayer/i.test(url)) return url;
  return url.replace(/_in_(\d+)x(\d+)\.(jpg|jpeg|png|webp)/i, (full, w, h, ext) => {
    const n = Math.max(Number(w) || 0, Number(h) || 0);
    if (n <= 400) return full;
    return `_in_400x400.${String(ext)}`;
  });
}

/** Prefer a lightweight URL for grid/list tiles. */
export function tileImageUrl(url?: string | null): string {
  if (!url) return "";
  return tcgplayerDownsizeForTile(tcgdexHighToLow(stripHiresForTile(url.trim())));
}

type ImgCard = Pick<TCGCard, "id" | "name" | "number" | "set" | "images">;

function isScrydexUrl(url?: string | null): boolean {
  return !!url && /images\.scrydex\.com/i.test(url);
}

/** Printed-card scan. Stored Scrydex URLs count; TCGdex and TCGPlayer do not. */
function scrydexFor(card: ImgCard): { small: string; large: string } | null {
  const built = scrydexImagesForId(card.id, cardSetId(card), cardLocalId(card));
  const stored = [card.images?.small, card.images?.large].filter(isScrydexUrl);
  if (!built && stored.length === 0) return null;
  const small = built?.small || stored[0] || "";
  const large = built?.large || stored[stored.length - 1] || small;
  return { small, large };
}

function directScan(urls: string[]): string {
  return urls.find((u) => !isArtPending(u) && !u.startsWith("/api/")) || urls[0] || "";
}

export function hdImg(
  card: Pick<TCGCard, "images"> & { id?: string; name?: string; number?: string; set?: ImgCard["set"] },
  opts?: { tile?: boolean },
): { src: string; srcSet?: string; sizes?: string } {
  const src = directScan(fallbackCardImages(card as ImgCard, { tile: !!opts?.tile }));
  return { src, sizes: opts?.tile ? "140px" : "600px" };
}

export function hdLarge(
  card: Pick<TCGCard, "images"> & { id?: string; name?: string; number?: string; set?: ImgCard["set"] },
): string {
  return directScan(fallbackCardImages(card as ImgCard));
}

/** Ordered Scrydex scans. Tile → medium, then large. Detail → large, then medium.
 *  The same file through the proxy is the retry. Nothing else is requested.
 *  Last entry is the branded "Art pending" tile. Never blank.
 */
export function fallbackCardImages(card: ImgCard, opts?: { tile?: boolean }): string[] {
  const tile = !!opts?.tile;
  const urls: string[] = [];
  const add = (u?: string | null) => {
    if (!u) return;
    const v = u.trim();
    if (!v || urls.includes(v)) return;
    urls.push(v);
  };

  const pair = scrydexFor(card);
  if (pair) {
    add(tile ? pair.small : pair.large);
    add(tile ? pair.large : pair.small);
  }
  const setId = cardSetId(card);
  const num = cardLocalId(card);
  for (const u of scrydexScanUrls(setId, num, card.id, tile)) add(u);
  if (urls[0]) add(proxiedCardImage(urls[0]));
  add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));
  return applyImagePolicy(urls);
}

/**
 * v2: v1 ("pv-hd-img:") resolved 30th-c-001 as 30th-001 and cached
 * Exeggcute's scan for Classic Charizard (and the other 29 Classic cards).
 * v3 cached the TCGPlayer product photo. v4 drops every non-Scrydex entry:
 * the printed scan is the Scrydex file, not a TCGdex render.
 */
const HD_CACHE_KEY = "pv-hd-img4:";
const HD_CACHE_KEY_V3 = "pv-hd-img3:";
const HD_CACHE_KEY_V2 = "pv-hd-img2:";
const HD_CACHE_KEY_V1 = "pv-hd-img:";

export async function resolveHDImage(
  card: Pick<TCGCard, "id" | "name" | "number" | "set" | "images">,
): Promise<string> {
  const pair = scrydexFor(card);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(HD_CACHE_KEY_V1 + card.id);
      localStorage.removeItem(HD_CACHE_KEY_V2 + card.id);
      localStorage.removeItem(HD_CACHE_KEY_V3 + card.id);
    } catch {}
  }
  try {
    // Set id = everything before the LAST hyphen; never `id.split("-")[0]`.
    // The fetch confirms this card's identity. The image URL is not used.
    const setId = cardSetId(card) || parseCardId(card.id || "").setId;
    const num = cardLocalId(card);
    if (setId && num && !isAppOnlyCardId(card.id)) {
      const r = await fetch(
        `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(`${setId}-${num}`)}`,
      );
      if (r.ok) {
        const j = (await r.json()) as {
          id?: string;
          localId?: string;
          name?: string;
          image?: string;
          set?: { id?: string };
        };
        isSameCard({ ...card, set: { id: setId } }, j);
      }
    }
  } catch {}
  if (pair) {
    try {
      localStorage.setItem(HD_CACHE_KEY + card.id, pair.large);
    } catch {}
    return pair.large;
  }
  return "";
}

export function refreshAllImageCaches() {
  if (typeof localStorage === "undefined") return 0;
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (
      k.startsWith(HD_CACHE_KEY) ||
      k.startsWith(HD_CACHE_KEY_V2) ||
      k.startsWith(HD_CACHE_KEY_V1) ||
      k.startsWith("pv-tcg-cache:")
    ) {
      localStorage.removeItem(k);
      n++;
    }
  }
  return n;
}
