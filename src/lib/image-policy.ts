/**
 * Where card art may come from.
 * Default: API art first (TCGdex / pokemontcg.io, the same sources the MCP tools `get_card` and `get_hd_image` use),
 * then the shipped TCGPlayer / Scrydex scans for cards NO API has art for (today: the 30 Classic Collection cards,
 * whose TCGdex image is null in every language and whose pokemontcg.io ids 404), then the "Art pending" tile.
 * Set VITE_STRICT_API_IMAGES=1 to refuse every non-API host: those cards then show "Art pending" until an API publishes art.
 */
export const STRICT_API_IMAGES = String(import.meta.env?.VITE_STRICT_API_IMAGES ?? "") === "1";

const API_ART_HOSTS = /^(assets\.tcgdex\.net|images\.pokemontcg\.io)$/i;

/** True for a URL the TCG APIs serve (directly or through our same-origin proxy), or a data: placeholder. */
export function isApiArtUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  try {
    if (url.startsWith("/api/public/card-image")) {
      const inner = new URL(url, "https://x.invalid").searchParams.get("url") || "";
      return API_ART_HOSTS.test(new URL(inner).hostname);
    }
    return API_ART_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function applyImagePolicy(urls: string[], strict: boolean = STRICT_API_IMAGES): string[] {
  return strict ? urls.filter(isApiArtUrl) : urls;
}
