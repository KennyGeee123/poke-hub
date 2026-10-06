// Card image helpers — promote every TCG card to HD art with TCGdex & SVG fallbacks.
// Tile grids prefer small/low assets; detail/fullscreen keep high/hires.
import type { TCGCard } from "@/lib/pokemon-api";
import { isAllowedCardImageUrl } from "@/lib/card-image-hosts";
import { pokemontcgImagePath } from "@/lib/tcgdex";
import { cardLocalId, cardSetId, isSameCard, parseCardId } from "@/lib/card-identity";

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

function isTcgdex(url: string): boolean {
  return /assets\.tcgdex\.net/i.test(url);
}

function tcgdexBase(url: string): string | null {
  if (!isTcgdex(url)) return null;
  const m = url.replace(/\/(high|low)\.(webp|png|jpg)$/i, "");
  return m !== url ? m : null;
}

export function hdImg(
  card: Pick<TCGCard, "images">,
  opts?: { tile?: boolean },
): { src: string; srcSet?: string; sizes?: string } {
  const small = card.images?.small ?? "";
  const large = card.images?.large ?? small;
  if (opts?.tile) {
    // Tiles take the 245px low.webp only. A 600w high.webp in srcset made every
    // retina tile pull ~100KB from TCGdex, and 191-card boxes tripped its 503s.
    const tileSrc = tileImageUrl(small) || tileImageUrl(large) || small || large;
    const low =
      (small && isTcgdex(small) ? tcgdexHighToLow(small) : "") ||
      (large && isTcgdex(large) ? tcgdexHighToLow(large) : "") ||
      tileSrc;
    return { src: low || tileSrc, sizes: "140px" };
  }
  return {
    src: large || small,
    srcSet: small && large ? `${small} 245w, ${large} 600w` : undefined,
  };
}

export function hdLarge(card: Pick<TCGCard, "images">): string {
  return card.images?.large || card.images?.small || "";
}

type ImgCard = Pick<TCGCard, "id" | "name" | "number" | "set" | "images">;

function parentSetId(setId: string, cardId?: string): string | null {
  if (setId === "base1sl" || setId === "bss") return "base1";
  if (setId === "error") {
    return cardId?.includes("jungle")
      ? "base2"
      : cardId?.includes("fossil")
        ? "base3"
        : cardId?.includes("rocket")
          ? "base5"
          : "base1";
  }
  return null;
}

/** Ordered list of image URLs to try when the primary scan fails.
 *  `{ tile: true }` → small/low first (never hires/high early).
 *  Default / detail → high/hires preference preserved.
 *
 *  Order: real CDN art → same CDN alternate size → same-origin proxy (server
 *  retries 5xx, edge-cached) → constructed URLs (proxy only, so a 404 card-back
 *  can never paint) → branded "Art pending" placeholder. Never blank.
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

  const small = (card.images?.small || "").trim();
  const large = (card.images?.large || "").trim();
  const setId = cardSetId(card);
  const num = cardLocalId(card);
  const parentSet = setId ? parentSetId(setId, card.id) : null;
  const safeSet = !!setId && /^[a-z0-9.]+$/.test(setId);
  const serie = safeSet ? setId.replace(/[0-9].*$/, "").replace(/\.$/, "") : "";
  const tcgBase = tcgdexBase(small) || tcgdexBase(large);
  // TCGdex-only boxes (30th, 30th-c, dotted ids) have no pokemontcg.io scans.
  const ptcgOk = safeSet && !setId.includes(".") && !/^(30th|30th-c|me55c)$/i.test(setId);
  // Dotted TCGdex ids (sm7.5, swsh4.5sv, cel25cc…) keep their scans under
  // pokemontcg's own id — reach them even when a cached card has the old URL.
  const ptcgAlias =
    safeSet && num && (setId.includes(".") || /^cel25cc$/i.test(setId))
      ? pokemontcgImagePath(setId, num)
      : null;

  if (tile) {
    const first = tileImageUrl(small) || tileImageUrl(large) || small || large;
    add(first);
    add(tileImageUrl(large));
    if (tcgBase) add(`${tcgBase}/low.webp`);
    // Busy CDN (TCGdex 503 bursts): same art through our proxy, which retries.
    add(proxiedCardImage(first));
    if (tcgBase) {
      add(`${tcgBase}/high.webp`);
      add(proxiedCardImage(`${tcgBase}/low.png`));
    }
    if (large && large !== first) add(proxiedCardImage(large));
    if (!tcgBase && serie && num) {
      add(proxiedCardImage(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.webp`));
    }
    if (ptcgAlias) add(`https://images.pokemontcg.io/${ptcgAlias}.png`);
    if (ptcgOk && num) add(proxiedCardImage(`https://images.pokemontcg.io/${setId}/${num}.png`));
    if (parentSet && num) {
      add(proxiedCardImage(`https://images.pokemontcg.io/${parentSet}/${num}.png`));
    }
    add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));
    return urls;
  }

  // Detail / fullscreen — keep high/hires preference
  add(large);
  add(small);
  if (tcgBase) {
    add(`${tcgBase}/high.webp`);
    add(`${tcgBase}/low.webp`);
  }
  add(proxiedCardImage(large || small));
  if (tcgBase) add(proxiedCardImage(`${tcgBase}/high.png`));
  if (ptcgAlias) {
    add(`https://images.pokemontcg.io/${ptcgAlias}_hires.png`);
    add(`https://images.pokemontcg.io/${ptcgAlias}.png`);
  }
  if (ptcgOk && num) {
    add(proxiedCardImage(`https://images.pokemontcg.io/${setId}/${num}_hires.png`));
    add(proxiedCardImage(`https://images.pokemontcg.io/${setId}/${num}.png`));
  }
  if (parentSet && num) {
    add(proxiedCardImage(`https://images.pokemontcg.io/${parentSet}/${num}_hires.png`));
  }
  if (!tcgBase && serie && num) {
    add(proxiedCardImage(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/high.webp`));
  }
  add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));
  return urls;
}

/**
 * v2: v1 ("pv-hd-img:") resolved 30th-c-001 as 30th-001 and cached
 * Exeggcute's scan for Classic Charizard (and the other 29 Classic cards).
 * Those poisoned entries are ignored and dropped.
 */
const HD_CACHE_KEY = "pv-hd-img2:";
const HD_CACHE_KEY_V1 = "pv-hd-img:";

export async function resolveHDImage(
  card: Pick<TCGCard, "id" | "name" | "number" | "set" | "images">,
): Promise<string> {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(HD_CACHE_KEY_V1 + card.id);
    } catch {}
    const cached = localStorage.getItem(HD_CACHE_KEY + card.id);
    if (cached) return cached;
  }
  const fallback = hdLarge(card);
  try {
    // Set id = everything before the LAST hyphen; never `id.split("-")[0]`.
    const setId = cardSetId(card) || parseCardId(card.id || "").setId;
    const num = cardLocalId(card);
    if (setId && num) {
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
        // Only take the scan when TCGdex answered with THIS card (same set,
        // number and name); otherwise keep the card's own image.
        if (j.image && isSameCard({ ...card, set: { id: setId } }, j)) {
          const url = `${j.image}/high.webp`;
          try {
            localStorage.setItem(HD_CACHE_KEY + card.id, url);
          } catch {}
          return url;
        }
      }
    }
  } catch {}
  return fallback;
}

export function refreshAllImageCaches() {
  if (typeof localStorage === "undefined") return 0;
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (
      k.startsWith(HD_CACHE_KEY) ||
      k.startsWith(HD_CACHE_KEY_V1) ||
      k.startsWith("pv-tcg-cache:")
    ) {
      localStorage.removeItem(k);
      n++;
    }
  }
  return n;
}
