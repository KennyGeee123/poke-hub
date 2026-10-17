/**
 * Where card art may come from.
 * Card scans are Scrydex (images.scrydex.com). TCGdex and pokemontcg.io stay
 * on the allow-list so a strict build can still recognize those hosts, but
 * the image chain does not request them. TCGPlayer photos are not scans.
 * Set VITE_STRICT_API_IMAGES=1 to refuse every non-API host: those cards then show "Art pending" until an API publishes art.
 */
export const STRICT_API_IMAGES = String(import.meta.env?.VITE_STRICT_API_IMAGES ?? "") === "1";

const API_ART_HOSTS = /^(assets\.tcgdex\.net|images\.pokemontcg\.io|images\.scrydex\.com)$/i;

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
