import { afterEach, describe, expect, it } from "bun:test";
import { formatCardNumber, isSameCard, parseCardId, sameCardName } from "./card-identity";
import { shippedPrint } from "./box-set-extras";
import extras from "./box-set-extras.json";
import { resolveHDImage } from "./card-images";
import { mapTcgdexCard } from "./tcgdex";
import { stubCardFromId } from "./tcg-fallback";
import { priceIdAliases } from "./live-prices";

/** TCGdex /v2/en/sets/30th-c, checked 2026-10-06 (localId 001..030). */
const CLASSIC_NAMES = [
  "Charizard",
  "Delcatty",
  "Metagross",
  "Genesect EX",
  "Misty",
  "Dark Tyranitar",
  "Sneasel",
  "Pikachu & Zekrom GX",
  "Greninja BREAK",
  "Uxie",
  "Crobat G",
  "Raikou",
  "Buzzwole GX",
  "Pikachu",
  "Erika's Jigglypuff",
  "Rayquaza EX",
  "Solgaleo GX",
  "Gengar",
  "Darkrai & Cresselia LEGEND",
  "Darkrai & Cresselia LEGEND",
  "N",
  "Palkia",
  "M Gardevoir EX",
  "Shining Celebi",
  "Scizor ex",
  "Mew VMAX",
  "Arceus VSTAR",
  "Zacian V",
  "Lugia",
  "Magikarp",
];
const CLASSIC_SET = {
  id: "30th-c",
  name: "30th Classic Collection",
  cardCount: { official: 0, total: 30 },
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("parseCardId", () => {
  it("keeps hyphenated TCGdex set ids whole (set = before the LAST hyphen)", () => {
    expect(parseCardId("30th-c-001")).toEqual({ setId: "30th-c", localId: "001" });
    expect(parseCardId("tk-ex-latia-1")).toEqual({ setId: "tk-ex-latia", localId: "1" });
    expect(parseCardId("P-A-007")).toEqual({ setId: "P-A", localId: "007" });
    expect(parseCardId("30th-001")).toEqual({ setId: "30th", localId: "001" });
    expect(parseCardId("swsh45sv-SV001")).toEqual({ setId: "swsh45sv", localId: "SV001" });
    expect(parseCardId("sv10.5b-003")).toEqual({ setId: "sv10.5b", localId: "003" });
  });
  it("ignores a canonical box hint that would split a Classic id wrongly", () => {
    expect(parseCardId("30th-c-001", "30th")).toEqual({ setId: "30th-c", localId: "001" });
    expect(parseCardId("30th-c-001", "30th-c")).toEqual({ setId: "30th-c", localId: "001" });
  });
});

describe("card identity", () => {
  const charizard = { id: "30th-c-001", name: "Charizard", number: "001", set: { id: "30th-c" } };
  it("Classic Charizard is not Celebration #001 Exeggcute", () => {
    expect(
      isSameCard(charizard, {
        id: "30th-001",
        localId: "001",
        name: "Exeggcute",
        set: { id: "30th" },
      }),
    ).toBe(false);
    expect(
      isSameCard(charizard, {
        id: "30th-c-001",
        localId: "001",
        name: "Charizard",
        set: { id: "30th-c" },
      }),
    ).toBe(true);
    // Same set + number but another name is still another card.
    expect(isSameCard(charizard, { id: "30th-c-001", localId: "1", name: "Delcatty" })).toBe(false);
  });
  it("compares names accent- and punctuation-blind", () => {
    expect(sameCardName("Poké Pad", "Poke Pad")).toBe(true);
    expect(sameCardName("M Gardevoir-EX", "M Gardevoir EX")).toBe(true);
    expect(sameCardName("Pikachu", "Pikachu & Zekrom GX")).toBe(false);
  });
  it("never renders N/0", () => {
    expect(
      formatCardNumber({ number: "001", set: { id: "30th-c", printedTotal: 0, total: 30 } }),
    ).toBe("001/030");
    expect(
      formatCardNumber({ number: "001", set: { id: "30th", printedTotal: 128, total: 161 } }),
    ).toBe("001/128");
    expect(
      formatCardNumber({
        number: "007",
        set: { id: "P-A", name: "Promos-A", printedTotal: 0, total: 100 },
      }),
    ).toBe("007");
    expect(formatCardNumber({ number: "4", set: { id: "base1", printedTotal: 0, total: 0 } })).toBe(
      "4",
    );
  });
});

describe("30th Classic Collection data", () => {
  const classic = (extras as any).sets.find((s: any) => s.keys.includes("30th-c")).cards as any[];
  it("every shipped print matches TCGdex id, number and name, with its own scan", () => {
    expect(classic.length).toBe(30);
    const pids = new Set<number>();
    classic.forEach((c, i) => {
      const num = String(i + 1).padStart(3, "0");
      expect(c.id).toBe(`30th-c-${num}`);
      expect(c.number).toBe(num);
      expect(c.name).toBe(CLASSIC_NAMES[i]);
      expect(c.images.small).toContain(`/product/${c.tcgplayerProductId}_`);
      expect(c.images.large).toContain(`/product/${c.tcgplayerProductId}_`);
      expect(c.printedNumber).toMatch(/^\d+\/\d+$/);
      pids.add(c.tcgplayerProductId);
    });
    expect(pids.size).toBe(30); // no two cards share a price key
  });

  it("maps every TCGdex Classic card (image:null) to its own scan and a real total", () => {
    CLASSIC_NAMES.forEach((name, i) => {
      const localId = String(i + 1).padStart(3, "0");
      const card = mapTcgdexCard(
        { id: `30th-c-${localId}`, localId, name, image: null },
        CLASSIC_SET,
      );
      const own = classic[i];
      expect(card.set.id).toBe("30th-c");
      expect(card.number).toBe(localId);
      expect(card.images.large).toBe(own.images.large);
      expect(card.images.large).not.toMatch(/\/30th\/\d+/);
      expect(formatCardNumber(card)).toBe(`${localId}/030`);
      expect(card.printedNumber).toBe(own.printedNumber);
    });
    expect(shippedPrint("30th-c-001", "Exeggcute")).toBeNull();
  });

  it("resolveHDImage asks TCGdex for 30th-c-001 and never paints Exeggcute", async () => {
    const asked: string[] = [];
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      asked.push(url);
      if (url.includes("/cards/30th-001")) {
        return Response.json({
          id: "30th-001",
          localId: "001",
          name: "Exeggcute",
          image: "https://assets.tcgdex.net/en/me/30th/001",
          set: { id: "30th" },
        });
      }
      return Response.json({
        id: "30th-c-001",
        localId: "001",
        name: "Charizard",
        image: null,
        set: { id: "30th-c" },
      });
    }) as any;
    const card = mapTcgdexCard(
      { id: "30th-c-001", localId: "001", name: "Charizard", image: null },
      CLASSIC_SET,
    );
    const url = await resolveHDImage(card);
    expect(asked.some((u) => u.includes("30th-c-001"))).toBe(true);
    expect(asked.some((u) => /cards\/30th-001/.test(u))).toBe(false);
    expect(url).toBe(classic[0].images.large);
  });

  it("rejects a TCGdex answer that is a different card", async () => {
    globalThis.fetch = (async () =>
      Response.json({
        id: "30th-001",
        localId: "001",
        name: "Exeggcute",
        image: "https://assets.tcgdex.net/en/me/30th/001",
        set: { id: "30th" },
      })) as any;
    const card = mapTcgdexCard(
      { id: "30th-c-001", localId: "001", name: "Charizard", image: null },
      CLASSIC_SET,
    );
    expect(await resolveHDImage(card)).toBe(classic[0].images.large);
  });

  it("stub cards parse 30th-c ids and use the shipped scan", () => {
    const stub = stubCardFromId("30th-c-001");
    expect(stub.set.id).toBe("30th-c");
    expect(stub.number).toBe("001");
    expect(stub.images.large).toBe(classic[0].images.large);
  });
});

describe("price keys", () => {
  it("pad aliases keep letter suffixes, so 'a' prints never share the base print's price", () => {
    expect(priceIdAliases("sm10-182a")).not.toContain("sm10-182");
    expect(priceIdAliases("sm10-182a")).toContain("sm10-182a");
    expect(priceIdAliases("sm10-182")).not.toContain("sm10-182a");
    expect(priceIdAliases("30th-001")).toEqual(
      expect.arrayContaining(["30th-001", "30th-1", "me55-001", "me55-1"]),
    );
  });
  it("Classic ids only alias their own zero-padding", () => {
    expect(priceIdAliases("30th-c-001").sort()).toEqual(["30th-c-001", "30th-c-1"]);
    expect(priceIdAliases("30th-c-001")).not.toContain("30th-001");
  });
});
