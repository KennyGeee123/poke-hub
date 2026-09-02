// Card image helpers — promote every TCG card to HD art with TCGdex fallback.
import type { TCGCard } from "@/lib/pokemon-api";

/**
 * Return `src` + `srcSet` for a card thumbnail.
 * Uses `images.small` as the 1x source and `images.large` as the 2x source so
 * retina/zoom views render the high-res official scan instead of the tiny one.
 */
export function hdImg(card: Pick<TCGCard, "images">, opts?: { tile?: boolean }): { src: string; srcSet?: string; sizes?: string } {
  const small = card.images?.small ?? "";
  const large = card.images?.large ?? small;
  if (opts?.tile) {
    // Tile CSS width is ~140px. 245w small is enough even on retina; do not
    // pull the 600w+ official scan for a rail of 16–60 cards.
    return {
      src: small || large,
      srcSet: small && large ? `${small} 245w, ${large} 600w` : undefined,
      sizes: "140px",
    };
  }
  return {
    src: large || small,
    srcSet: small && large ? `${small} 245w, ${large} 600w` : undefined,
  };
}

/** Always returns the largest official artwork available. */
export function hdLarge(card: Pick<TCGCard, "images">): string {
  return card.images?.large || card.images?.small || "";
}

type ImgCard = Pick<TCGCard, "id" | "number" | "set" | "images">;

/** Ordered list of image URLs to try when the primary scan 404s. */
export function fallbackCardImages(card: ImgCard): string[] {
  const urls: string[] = [];
  const add = (u?: string | null) => {
    if (!u) return;
    const v = u.trim();
    if (!v || urls.includes(v)) return;
    urls.push(v);
  };

  add(card.images?.large);
  add(card.images?.small);

  const large = card.images?.large || "";
  if (/assets\.tcgdex\.net/i.test(large)) {
    const base = large.replace(/\/(high|low)\.(webp|png|jpg)$/i, "");
    add(`${base}/high.webp`);
    add(`${base}/low.webp`);
    add(`${base}/high.png`);
    add(`${base}/low.png`);
  }

  const setId = card.set?.id || (card.id || "").split("-")[0];
  const num = card.number || (card.id || "").split("-").slice(1).join("-");
  if (setId && num) {
    add(`https://images.pokemontcg.io/${setId}/${num}_hires.png`);
    add(`https://images.pokemontcg.io/${setId}/${num}.png`);
  }

  const id = card.id || (setId && num ? `${setId}-${num}` : "");
  if (id && /^[a-z0-9.]+-[a-z0-9]+$/i.test(id) && setId && num) {
    const serie = setId.replace(/[0-9].*$/, "").replace(/\.$/, "") || setId;
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/high.webp`);
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.webp`);
  }

  return urls;
}

const HD_CACHE_KEY = "pv-hd-img:";

/**
 * Resolve an even-higher-res alt image via TCGdex (high.webp) when available.
 * Cached in localStorage. Async — call lazily from detail views.
 */
export async function resolveHDImage(card: Pick<TCGCard, "id" | "number" | "set" | "images">): Promise<string> {
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

/** Wipe all cached image + TCG API responses so the next load re-pulls everything. */
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
