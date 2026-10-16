import { describe, expect, it } from "bun:test";
import { applyImagePolicy, isApiArtUrl } from "./image-policy";

describe("image policy", () => {
  const api = "https://assets.tcgdex.net/en/me/30th/001/low.webp";
  const proxied = `/api/public/card-image?url=${encodeURIComponent("https://images.pokemontcg.io/sv3/199.png")}`;
  const tcgp = "https://tcgplayer-cdn.tcgplayer.com/product/1_200w.jpg";
  const scry = "https://images.scrydex.com/x.png";
  const pending = "data:image/svg+xml;utf8,%3Csvg%3E";

  it("recognises API art, direct or through the proxy", () => {
    expect(isApiArtUrl(api)).toBe(true);
    expect(isApiArtUrl(proxied)).toBe(true);
    expect(isApiArtUrl(pending)).toBe(true);
    expect(isApiArtUrl(tcgp)).toBe(false);
    expect(isApiArtUrl(scry)).toBe(false);
    expect(isApiArtUrl(`/api/public/card-image?url=${encodeURIComponent(tcgp)}`)).toBe(false);
  });

  it("strict mode drops every non-API host and keeps the Art pending tile last", () => {
    expect(applyImagePolicy([tcgp, api, scry, proxied, pending], true)).toEqual([
      api,
      proxied,
      pending,
    ]);
  });

  it("default keeps the shipped fallback so cards no API has art for still show a scan", () => {
    expect(applyImagePolicy([tcgp, api, pending], false)).toEqual([tcgp, api, pending]);
  });
});
