// Card image helpers — promote every TCG card to HD art with TCGdex & SVG fallbacks.
// Tile grids prefer small/low assets; detail/fullscreen keep high/hires.
import type { TCGCard } from "@/lib/pokemon-api";

export function generateCardSvgFallback(name: string, number?: string, setName?: string): string {
  const safeName = (name || "Pokémon Card").replace(/[<>&"]/g, "");
  const safeNum = (number || "001").replace(/[<>&"]/g, "");
  const safeSet = (setName || "Vault").replace(/[<>&"]/g, "");
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="100%" height="100%">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>
    </defs>
    <rect width="300" height="420" rx="16" fill="url(#g)" stroke="url(#b)" stroke-width="4"/>
    <circle cx="150" cy="180" r="60" fill="none" stroke="rgba(56,189,248,0.2)" stroke-width="8"/>
    <circle cx="150" cy="180" r="30" fill="rgba(56,189,248,0.1)"/>
    <path d="M 90 180 L 210 180" stroke="rgba(56,189,248,0.4)" stroke-width="4"/>
    <text x="150" y="270" fill="#f8fafc" font-size="16" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">${safeName}</text>
    <text x="150" y="295" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="middle">${safeSet} · #${safeNum}</text>
    <text x="150" y="380" fill="#38bdf8" font-size="10" font-family="monospace" text-anchor="middle">POKEVAULT HD SYNC</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

/** Prefer a lightweight URL for grid/list tiles. */
export function tileImageUrl(url?: string | null): string {
  if (!url) return "";
  return tcgdexHighToLow(stripHiresForTile(url.trim()));
}

function isTcgdex(url: string): boolean {
  return /assets\.tcgdex\.net/i.test(url);
}

function tcgdexBase(url: string): string | null {
  if (!isTcgdex(url)) return null;
  const m = url.replace(/\/(high|low)\.(webp|png|jpg)$/i, "");
  return m !== url ? m : null;
}

export function hdImg(card: Pick<TCGCard, "images">, opts?: { tile?: boolean }): { src: string; srcSet?: string; sizes?: string } {
  const small = card.images?.small ?? "";
  const large = card.images?.large ?? small;
  if (opts?.tile) {
    // Prefer low.webp / small; never lead with hires/high for ~140px tiles.
    const tileSrc =
      tileImageUrl(small) ||
      tileImageUrl(large) ||
      small ||
      large;
    const low =
      (small && isTcgdex(small) ? tcgdexHighToLow(small) : "") ||
      (large && isTcgdex(large) ? tcgdexHighToLow(large) : "") ||
      tileSrc;
    const high =
      (large && isTcgdex(large) && /\/high\./i.test(large) ? large : "") ||
      (small && isTcgdex(small)
        ? small.replace(/\/low\.(webp|png|jpg)$/i, "/high.$1")
        : "");
    return {
      src: low || tileSrc,
      srcSet:
        low && high && low !== high
          ? `${low} 245w, ${high} 600w`
          : low
            ? `${low} 245w`
            : undefined,
      sizes: "140px",
    };
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

/** Ordered list of image URLs to try when the primary scan 404s.
 *  `{ tile: true }` → small/low first (never hires/high early).
 *  Default / detail → high/hires preference preserved.
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

  const small = card.images?.small || "";
  const large = card.images?.large || "";
  const setId = card.set?.id || (card.id || "").split("-")[0];
  const num = card.number || (card.id || "").split("-").slice(1).join("-");
  const parentSet = setId ? parentSetId(setId, card.id) : null;
  const id = card.id || (setId && num ? `${setId}-${num}` : "");
  const serie =
    setId && /^[a-z0-9.]+$/.test(setId)
      ? setId.replace(/[0-9].*$/, "").replace(/\.$/, "") || setId
      : "";

  if (tile) {
    // 1) Prefer existing small / rewritten low
    add(tileImageUrl(small) || small);
    add(tileImageUrl(large));

    // 2) Explicit tcgdex low variants from any known tcgdex URL
    for (const u of [small, large]) {
      const base = tcgdexBase(u);
      if (base) {
        add(`${base}/low.webp`);
        add(`${base}/low.png`);
      }
    }

    // 3) Constructed tcgdex low (never high first)
    if (serie && setId && num && /^[a-z0-9.]+$/.test(setId)) {
      add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.webp`);
      add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.png`);
    }

    // 4) pokemontcg small PNG only (not _hires)
    if (setId && num && /^[a-z0-9.]+$/.test(setId)) {
      add(`https://images.pokemontcg.io/${setId}/${num}.png`);
    }
    if (parentSet && num) {
      add(`https://images.pokemontcg.io/${parentSet}/${num}.png`);
    }

    // 5) SVG — skip hires/high entirely for tiles (~845KB PNGs for 140px)
    add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));
    return urls;
  }

  // Detail / fullscreen — keep high/hires preference
  add(large);
  add(small);

  if (isTcgdex(large) || isTcgdex(small)) {
    const base = tcgdexBase(large) || tcgdexBase(small);
    if (base) {
      add(`${base}/high.webp`);
      add(`${base}/low.webp`);
      add(`${base}/high.png`);
      add(`${base}/low.png`);
    }
  }

  if (setId && num && /^[a-z0-9.]+$/.test(setId)) {
    add(`https://images.pokemontcg.io/${setId}/${num}_hires.png`);
    add(`https://images.pokemontcg.io/${setId}/${num}.png`);
  }
  if (parentSet && num) {
    add(`https://images.pokemontcg.io/${parentSet}/${num}_hires.png`);
    add(`https://images.pokemontcg.io/${parentSet}/${num}.png`);
  }

  if (id && /^[a-z0-9.]+-[a-z0-9]+$/i.test(id) && setId && num && serie) {
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/high.webp`);
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.webp`);
  }

  add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));

  return urls;
}

const HD_CACHE_KEY = "pv-hd-img:";

export async function resolveHDImage(card: Pick<TCGCard, "id" | "name" | "number" | "set" | "images">): Promise<string> {
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem(HD_CACHE_KEY + card.id);
    if (cached) return cached;
  }
  const fallback = hdLarge(card);
  try {
    const setId = card.id?.split("-")[0];
    const num = card.number ?? card.id?.split("-")[1];
    if (setId && num) {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${setId}-${num}`);
      if (r.ok) {
        const j = (await r.json()) as { image?: string };
        if (j.image) {
          const url = `${j.image}/high.webp`;
          try { localStorage.setItem(HD_CACHE_KEY + card.id, url); } catch {}
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
    if (k.startsWith(HD_CACHE_KEY) || k.startsWith("pv-tcg-cache:")) {
      localStorage.removeItem(k);
      n++;
    }
  }
  return n;
}
