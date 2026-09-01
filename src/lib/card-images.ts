// Card image helpers — promote every TCG card to HD art with TCGdex fallback.
import type { TCGCard } from "@/lib/pokemon-api";

/**
 * Return `src` + `srcSet` for a card thumbnail.
 * Uses `images.small` as the 1x source and `images.large` as the 2x source so
 * retina/zoom views render the high-res official scan instead of the tiny one.
 */
export function hdImg(card: Pick<TCGCard, "images">): { src: string; srcSet: string } {
  const small = card.images?.small ?? "";
  const large = card.images?.large ?? small;
  return {
    src: large || small,
    srcSet: small && large ? `${small} 1x, ${large} 2x` : large || small,
  };
}

/** Always returns the largest official artwork available. */
export function hdLarge(card: Pick<TCGCard, "images">): string {
  return card.images?.large || card.images?.small || "";
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
