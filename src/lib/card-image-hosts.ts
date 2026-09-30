// Card-scan CDNs the app is allowed to read pixels from (image proxy + AI paint).
export const CARD_IMAGE_HOSTS = new Set([
  "images.pokemontcg.io",
  "assets.tcgdex.net",
  "tcgplayer-cdn.tcgplayer.com",
  "product-images.tcgplayer.com",
  "images.scrydex.com",
]);

export function isAllowedCardImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && CARD_IMAGE_HOSTS.has(u.hostname) && !u.username && !u.port;
  } catch {
    return false;
  }
}
