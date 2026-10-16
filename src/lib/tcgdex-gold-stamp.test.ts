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
    expect(asked.length).toBe(2 * 4);
  });

  it("returns the cards untouched when TCGdex is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const cards = [{ id: "30th-147", name: "Pikachu" }] as never[];
    const out = await stampGoldRarities(cards, "en");
    expect(out[0]).toEqual(cards[0]);
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
