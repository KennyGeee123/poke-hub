import { afterEach, describe, expect, it } from "bun:test";
import { searchCards } from "./pokemon-api";
import { fillMissingPrints, setIdAliases, setIdLookupOrder } from "./set-ids";
import {
  EMPTY_TCGDEX_SETS,
  getAltArtworks,
  mapTcgdexSet,
  tcgdexGetSetCards,
  tcgdexGetSets,
} from "./tcgdex";

const box = (id: string, name: string, n: number, prefix = "") => ({
  id,
  name,
  cardCount: { total: n, official: n },
  cards: Array.from({ length: n }, (_, i) => ({
    id: `${id}-${String(i + 1).padStart(3, "0")}`,
    localId: String(i + 1).padStart(3, "0"),
    name: `${prefix}Card ${i + 1}`,
  })),
});
const CELEB = box("30th", "30th Celebration", 158);
const CLASSIC = box("30th-c", "30th Classic Collection", 30, "Classic ");

const realFetch = globalThis.fetch;
const g = globalThis as any;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete g.window;
});

describe("set lookup order", () => {
  it("tries the exact id before its alias family", () => {
    expect(setIdLookupOrder("30th-c")[0]).toBe("30th-c");
    expect(setIdLookupOrder("me55c")[0]).toBe("me55c");
    expect(setIdLookupOrder("30th-c")).toContain("30th");
    expect(setIdLookupOrder("")).toEqual([]);
  });
});

describe("30th Celebration box", () => {
  it("merges Classic Collection even when the proxy answers with Celebration", async () => {
    g.window = {};
    const urls: string[] = [];
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      urls.push(url);
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      // Old proxy behaviour: every 30th-family id came back as the Celebration box.
      if (url.startsWith("/api/public/tcgdex")) return json(CELEB);
      if (url.endsWith("/sets/30th-c")) return json(CLASSIC);
      if (url.endsWith("/sets/30th")) return json(CELEB);
      return json({ error: "not found" }, 404);
    }) as typeof fetch;

    const cards = await tcgdexGetSetCards("30th");
    expect(cards.length).toBe(188);
    expect(cards.filter((c) => c.id.startsWith("30th-c-")).length).toBe(30);
    expect(urls.some((u) => u.endsWith("/sets/30th-c"))).toBe(true);
  });
});

describe("sets with no card list anywhere", () => {
  it("open empty instead of showing the 16 seed cards", async () => {
    globalThis.fetch = (async () => new Response("down", { status: 502 })) as typeof fetch;
    const res = await searchCards({ q: "set.id:jumbo", page: 1, pageSize: 250 });
    expect(res.data.length).toBe(0);
  });

  it("are left out of the TCGdex set list", async () => {
    const list = [
      { id: "jumbo", name: "Jumbo cards", cardCount: { total: 160 } },
      { id: "rc", name: "Radiant Collection", cardCount: { total: 25 } },
      { id: "wp", name: "W Promotional", cardCount: { total: 7 } },
      { id: "sp", name: "Sample", cardCount: { total: 10 } },
      { id: "bw11", name: "Legendary Treasures", cardCount: { total: 140 } },
    ];
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(list), {
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const sets = await tcgdexGetSets("en");
    expect(sets.map((s) => s.id)).toEqual(["bw11"]);
    expect(EMPTY_TCGDEX_SETS.has("jumbo")).toBe(true);
  });
});

describe("pokemontcg ids with a differently named TCGdex box", () => {
  it.each([
    ["mcd11", "2011bw"],
    ["mcd22", "2022swsh"],
    ["tk1a", "tk-ex-latia"],
    ["tk2b", "tk-ex-m"],
    ["hsp", "hgssp"],
    ["bp", "bog"],
    ["fut20", "fut2020"],
  ])("%s reaches %s", (ptcg, dex) => {
    expect(setIdAliases(ptcg)).toContain(dex);
    expect(setIdAliases(dex)).toContain(ptcg);
  });
});

describe("set and card art URLs", () => {
  it("skips TCGdex set symbols (they 404) but keeps the logo", () => {
    const s = mapTcgdexSet({
      id: "tk-sm-l",
      name: "SM trainer Kit (Lycanroc)",
      logo: "https://assets.tcgdex.net/en/sm/tk-sm-l/logo",
      symbol: "https://assets.tcgdex.net/univ/tk/tk-sm-l/symbol",
    });
    expect(s.images.symbol).toBe("");
    expect(s.images.logo).toBe("https://assets.tcgdex.net/en/sm/tk-sm-l/logo.webp");
  });

  it("does not double the /high.webp suffix on alt-language art", async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      const image = url.includes("/ja/")
        ? "https://assets.tcgdex.net/ja/sv/SV2a/009/high.webp"
        : url.includes("/ko/")
          ? "https://assets.tcgdex.net/ko/sv/SV2a/009"
          : "";
      if (!image) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ id: "x", name: "Blastoise", image }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const alts = await getAltArtworks({
      id: "base1-2",
      name: "Blastoise",
      set: { id: "base1", name: "Base" },
    });
    const byLang = Object.fromEntries(alts.map((a) => [a.lang, a.url]));
    expect(byLang.ja).toBe("https://assets.tcgdex.net/ja/sv/SV2a/009/high.webp");
    expect(byLang.ko).toBe("https://assets.tcgdex.net/ko/sv/SV2a/009/high.webp");
  });
});

describe("prints TCGdex is missing", () => {
  const card = (id: string, name: string, number: string) => ({ id, name, number });

  it("adds SM 'a' reprints and 30th Mew B/G/R up to the box total", () => {
    const box = [card("sm8-172", "Electropower", "172"), card("sm8-1", "Bulbasaur", "001")];
    const ptcg = [
      card("sm8-1", "Bulbasaur", "1"),
      card("sm8-172", "Electropower", "172"),
      card("sm8-172a", "Electropower", "172a"),
    ];
    expect(fillMissingPrints(box, ptcg, 3).map((c) => c.id)).toEqual([
      "sm8-172",
      "sm8-1",
      "sm8-172a",
    ]);
    const celeb = [card("30th-001", "Exeggcute", "001")];
    const me55 = [card("me55-1", "Exeggcute", "1"), card("me55-B", "Mew", "B")];
    expect(fillMissingPrints(celeb, me55, 191).map((c) => c.id)).toEqual(["30th-001", "me55-B"]);
  });

  it("never duplicates a print spelled differently and never passes the total", () => {
    const box = [card("sv03.5-029", "Nidoran♀", "029"), card("x-sv1", "Shiny", "SV001")];
    const ptcg = [
      card("sv3pt5-29", "Nidoran ♀", "29"),
      card("x-SV1", "Shiny", "SV1"),
      card("x-2", "Two", "2"),
      card("x-3", "Three", "3"),
    ];
    expect(fillMissingPrints(box, ptcg, 3).map((c) => c.id)).toEqual([
      "sv03.5-029",
      "x-sv1",
      "x-2",
    ]);
    expect(fillMissingPrints(box, ptcg, 2)).toBe(box);
  });
});

describe("busy TCGdex answers", () => {
  it("retries a 502 once instead of leaving the box empty", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("busy", { status: 502 });
      return new Response(JSON.stringify(box("swsh11tg", "Lost Origin Trainer Gallery", 30)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const cards = await tcgdexGetSetCards("swsh11tg");
    expect(cards.length).toBe(30);
    expect(calls).toBe(2);
  });

  it("does not retry a 404 (that id just is not on TCGdex)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("nope", { status: 404 });
    }) as typeof fetch;
    const cards = await tcgdexGetSetCards("xyz123");
    expect(cards.length).toBe(0);
    expect(calls).toBe(1);
  });
});
