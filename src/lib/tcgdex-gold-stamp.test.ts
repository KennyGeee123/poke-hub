import { afterEach, describe, expect, it } from "bun:test";
import { stampGoldRarities } from "./tcgdex";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("stampGoldRarities", () => {
  it("stamps gold-tier rarities from TCGdex's rarity filter and leaves other cards alone", async () => {
    const asked: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = /Special%20illustration%20rare/i.test(url) ? [{ id: "30th-147" }] : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const cards = [
      { id: "30th-147", name: "Pikachu" },
      { id: "30th-001", name: "Exeggcute" },
      { id: "30th-c-001", name: "Charizard" },
    ] as never[];
    const out = await stampGoldRarities(cards, "en");
    expect(out.find((c) => c.id === "30th-147")?.rarity).toBe("Special illustration rare");
    expect(out.find((c) => c.id === "30th-001")?.rarity).toBeUndefined();
    // one request per set id (30th, 30th-c) per gold rarity
    expect(asked.length).toBe(2 * 5);
  });

  it("returns the cards untouched when TCGdex is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const cards = [{ id: "offline1-147", name: "Pikachu" }] as never[];
    const out = await stampGoldRarities(cards, "en");
    expect(out[0]).toEqual(cards[0]);
  });
});

describe("gold frames for every set, cached per set", () => {
  const answer = (rows: Record<string, string[]>, asked: string[]) =>
    (async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      asked.push(url);
      const rarity = url.match(/rarity=([^&]+)/)?.[1] ?? "";
      return new Response(JSON.stringify((rows[rarity] ?? []).map((id) => ({ id }))), {
        status: 200,
      });
    }) as typeof fetch;

  it("stamps a normal set (Paldean Fates style) and asks TCGdex only once per set", async () => {
    const asked: string[] = [];
    globalThis.fetch = answer(
      { "Special illustration rare": ["sv04.5-232"], "Hyper rare": ["sv04.5-245"] },
      asked,
    );
    const cards = [
      { id: "sv04.5-232", name: "Mew ex" },
      { id: "sv04.5-245", name: "Charizard ex" },
      { id: "sv04.5-001", name: "Pineco" },
    ] as never[];
    const out = await stampGoldRarities(cards, "en");
    expect(out.map((c) => c.rarity)).toEqual([
      "Special illustration rare",
      "Hyper rare",
      undefined,
    ]);
    expect(asked.length).toBe(5);
    const again = await stampGoldRarities(cards, "en");
    expect(again[1].rarity).toBe("Hyper rare");
    expect(asked.length).toBe(5); // served from cache
  });

  it("stamps TCGdex's Crown rarity (Crown Zenith gold)", async () => {
    globalThis.fetch = answer({ Crown: ["swsh12.5-gg70"] }, []);
    const out = await stampGoldRarities(
      [{ id: "swsh12.5-gg70", name: "Arceus VSTAR" }] as never[],
      "en",
    );
    expect(out[0].rarity).toBe("Crown");
  });

  it("does not cache a partial answer, so the next open retries", async () => {
    const asked: string[] = [];
    let fail = true;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      asked.push(String(input));
      if (fail && /Hyper/.test(decodeURIComponent(String(input))))
        return new Response("busy", { status: 404 });
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    await stampGoldRarities([{ id: "part1-001", name: "x" }] as never[], "en");
    fail = false;
    const before = asked.length;
    await stampGoldRarities([{ id: "part1-001", name: "x" }] as never[], "en");
    expect(asked.length).toBe(before + 5);
  });

  it("skips the lookup when every card already has a rarity", async () => {
    let calls = 0;
    globalThis.fetch = (async () => (calls++, new Response("[]"))) as typeof fetch;
    await stampGoldRarities([{ id: "full1-001", name: "x", rarity: "Common" }] as never[], "en");
    expect(calls).toBe(0);
  });
});

import { isAppOnlyCardId, tcgdexGetCard } from "./tcgdex";

describe("app-only card ids never hit TCGdex", () => {
  it("recognises Shadowless and Error prints only", () => {
    expect(isAppOnlyCardId("base1sl-4")).toBe(true);
    expect(isAppOnlyCardId("error-charizard-black-dot")).toBe(true);
    expect(isAppOnlyCardId("bss-4")).toBe(true);
    expect(isAppOnlyCardId("base1-4")).toBe(false);
    expect(isAppOnlyCardId("30th-001")).toBe(false);
  });
  it("answers null without making a request", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    expect(await tcgdexGetCard("base1sl-4", "de")).toBeNull();
    expect(calls).toBe(0);
  });
});
