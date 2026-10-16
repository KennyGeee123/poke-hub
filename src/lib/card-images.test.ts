import { describe, expect, it } from "bun:test";
import {
  fallbackCardImages,
  hdImg,
  isArtPending,
  looksLikePlaceholderScan,
  proxiedCardImage,
} from "./card-images";

const greninja = {
  id: "30th-148",
  name: "Greninja ex",
  number: "148",
  set: { id: "30th", name: "30th Celebration" } as any,
  images: {
    small: "https://assets.tcgdex.net/en/me/30th/148/low.webp",
    large: "https://assets.tcgdex.net/en/me/30th/148/high.webp",
  },
};

describe("card image chain", () => {
  it("tiles never lead with high.webp and carry no high srcset", () => {
    const t = hdImg(greninja, { tile: true });
    expect(t.src).toEndWith("/low.webp");
    expect(t.srcSet).toBeUndefined();
  });

  it("retries the same art through the proxy before anything else", () => {
    const urls = fallbackCardImages(greninja, { tile: true });
    expect(urls[0]).toBe("https://assets.tcgdex.net/en/me/30th/148/low.webp");
    expect(urls[1]).toBe(proxiedCardImage(urls[0]));
    expect(urls.some((u) => u.includes("high.webp"))).toBe(true);
  });

  it("never paints a direct pokemontcg URL for TCGdex-only 30th boxes", () => {
    for (const tile of [true, false]) {
      const urls = fallbackCardImages(greninja, { tile });
      expect(urls.some((u) => /^https:\/\/images\.pokemontcg\.io/.test(u))).toBe(false);
      expect(urls.some((u) => /pokemontcg\.io%2F30th/.test(u))).toBe(false);
    }
  });

  it("ends with the branded Art pending tile, never blank", () => {
    const urls = fallbackCardImages(
      {
        id: "x-1",
        name: "Mystery",
        number: "1",
        set: { id: "x", name: "X" } as any,
        images: {} as any,
      },
      { tile: true },
    );
    expect(urls.length).toBeGreaterThan(0);
    expect(isArtPending(urls[urls.length - 1])).toBe(true);
    expect(decodeURIComponent(urls[urls.length - 1])).toContain("ART PENDING");
  });

  it("proxy only accepts allow-listed card CDNs", () => {
    expect(proxiedCardImage("https://evil.example/x.png")).toBe("");
    expect(proxiedCardImage("https://assets.tcgdex.net/en/a/b/1/low.webp")).toStartWith(
      "/api/public/card-image?url=",
    );
  });

  it("flags pokemontcg's 404 card-back as a miss", () => {
    const back = {
      naturalWidth: 640,
      naturalHeight: 892,
      currentSrc: "https://images.pokemontcg.io/30th/148.png",
      src: "",
    };
    expect(looksLikePlaceholderScan(back)).toBe(true);
    const real = {
      naturalWidth: 245,
      naturalHeight: 337,
      currentSrc: greninja.images.small,
      src: "",
    };
    expect(looksLikePlaceholderScan(real)).toBe(false);
  });

  it("flags the Scrydex placeholder sizes and keeps a real medium scan", () => {
    expect(
      looksLikePlaceholderScan({
        naturalWidth: 367,
        naturalHeight: 511,
        currentSrc: "https://images.scrydex.com/pokemon/sv08-1/medium",
        src: "",
      }),
    ).toBe(true);
    expect(
      looksLikePlaceholderScan({
        naturalWidth: 367,
        naturalHeight: 512,
        currentSrc: "https://images.scrydex.com/pokemon/sv8-1/medium",
        src: "",
      }),
    ).toBe(false);
  });

  it("classic tiles lead with the Scrydex scan even when a TCGPlayer photo is stored", () => {
    const urls = fallbackCardImages(
      {
        id: "30th-c-004",
        name: "Genesect EX",
        number: "004",
        set: { id: "30th-c", name: "Classic Collection" } as any,
        images: {
          small: "https://tcgplayer-cdn.tcgplayer.com/product/716158_200w.jpg",
          large: "https://tcgplayer-cdn.tcgplayer.com/product/716158_in_1000x1000.jpg",
        },
      },
      { tile: true },
    );
    expect(urls[0]).toBe("https://images.scrydex.com/pokemon/me55c-11g/medium");
    expect(urls[0]).not.toContain("me55c-11/medium");
  });

  it("other box sets try a Scrydex scan before Art pending", () => {
    const urls = fallbackCardImages(greninja, { tile: true });
    const at = urls.findIndex((u) => u === "https://images.scrydex.com/pokemon/me55-148/medium");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(urls.length - 1);
    expect(isArtPending(urls[urls.length - 1])).toBe(true);
    expect(urls[0]).toBe(greninja.images.small);
  });
});

import { pokemontcgImagePath } from "./tcgdex";

describe("image-less TCGdex boxes map to pokemontcg scans", () => {
  it("uses pokemontcg's own set id and number", () => {
    expect(pokemontcgImagePath("sm7.5", "1")).toBe("sm75/1");
    expect(pokemontcgImagePath("sm3.5", "1")).toBe("sm35/1");
    expect(pokemontcgImagePath("swsh4.5sv", "SV001")).toBe("swsh45sv/SV001");
    expect(pokemontcgImagePath("swsh12.5gg", "GG01")).toBe("swsh12pt5gg/GG01");
    expect(pokemontcgImagePath("cel25cc", "CC001")).toBe("cel25c/2_A");
    expect(pokemontcgImagePath("cel25cc", "CC016")).toBe("cel25c/15_D");
    expect(pokemontcgImagePath("base1", "004")).toBe("base1/4");
  });
});
