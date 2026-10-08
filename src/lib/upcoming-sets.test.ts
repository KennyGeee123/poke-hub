import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TCGSet } from "@/lib/pokemon-api";
import { injectSpecialSets, mergeSetLists } from "./special-sets";
import {
  getUpcomingCard,
  getUpcomingSetCards,
  isUpcomingStub,
  upcomingSetBadge,
  upcomingSetIsLive,
  upcomingSets,
  withUpcomingSets,
} from "./upcoming-sets";
import upcoming from "./upcoming-sets.json";

const set = (
  id: string,
  name: string,
  releaseDate: string,
  extra: Partial<TCGSet> = {},
): TCGSet => ({
  id,
  name,
  series: "Mega Evolution",
  printedTotal: 100,
  total: 120,
  releaseDate,
  images: { logo: "", symbol: "" },
  ...extra,
});

const LIVE_LIST = [
  set("me55", "30th Celebration", "2026/09/16"),
  set("me5", "Pitch Black", "2026/07/17"),
  set("me4", "Chaos Rising", "2026/05/22"),
];

describe("upcoming sets: Delta Reign", () => {
  it("ships Delta Reign as an upcoming Mega Evolution set dated Nov 6, 2026", () => {
    const [dr] = upcomingSets();
    expect(dr.id).toBe("me06");
    expect(dr.name).toBe("Delta Reign");
    expect(dr.series).toBe("Mega Evolution");
    expect(dr.releaseDate).toBe("2026/11/06");
    expect(dr.printedTotal).toBe(103);
    expect(isUpcomingStub(dr)).toBe(true);
    const before = upcomingSetBadge(dr, new Date(2026, 9, 7).getTime());
    expect(before?.label).toBe("Upcoming · Nov 6");
    expect(upcomingSetBadge(dr, new Date(2026, 10, 7).getTime())?.label).toMatch(/^Released Nov 6/);
    expect(upcomingSetBadge(LIVE_LIST[0])).toBeNull();
  });

  it("only lists revealed cards, with no prices, and real art files on disk", () => {
    const cards = getUpcomingSetCards("me06")!;
    expect(cards.length).toBe(upcoming.sets[0].cards.length);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    const rayquaza = cards.find((c) => c.number === "084")!;
    expect(rayquaza.name).toBe("Mega Rayquaza ex");
    expect(rayquaza.printedNumber).toBe("084/103");
    expect(cards.find((c) => c.number === "139")?.name).toBe("Aarune");
    for (const c of cards) {
      expect(c.tcgplayer).toBeUndefined();
      expect(c.cardmarket).toBeUndefined();
      expect(c.set.id).toBe("me06");
      if (c.images.small) {
        expect(existsSync(join(process.cwd(), "public", c.images.small))).toBe(true);
        expect(existsSync(join(process.cwd(), "public", c.images.large))).toBe(true);
      }
    }
    // pokemontcg-style id (me6) and unpadded number resolve the same card.
    expect(getUpcomingSetCards("me6")?.length).toBe(cards.length);
    expect(getUpcomingCard("me6-84")?.id).toBe("me06-084");
    expect(getUpcomingCard("me05-084")).toBeUndefined();
  });

  it("slots in with the newest sets (after the pinned specials)", () => {
    const list = injectSpecialSets(LIVE_LIST);
    const ids = list.map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(["base1sl", "error"]);
    expect(ids[2]).toBe("me06");
    expect(ids.filter((id) => id === "me06").length).toBe(1);
    // A cached list that already holds the stub never doubles it.
    expect(injectSpecialSets(list).filter((s) => s.id === "me06").length).toBe(1);
  });

  it("auto-upgrades: a live me06 / me6 / 'Delta Reign' set replaces the stub", () => {
    for (const live of [
      set("me06", "Delta Reign", "2026-11-06", { lang: "en" }),
      set("me6", "Delta Reign", "2026/11/06"),
      set("dr-x", "Mega Evolution—Delta Reign", "2026/11/06"),
    ]) {
      const list = withUpcomingSets([live, ...LIVE_LIST]);
      expect(list.some(isUpcomingStub)).toBe(false);
      expect(list[0]).toBe(live);
    }
    expect(upcomingSetIsLive("me06")).toBe(true);
    // A stale cached stub never merges into (or shadows) the live entry.
    const stale = upcomingSets()[0];
    const merged = mergeSetLists(
      [set("me06", "Delta Reign", "2026/11/06", { total: 140 })],
      [stale],
    );
    expect(merged.length).toBe(1);
    expect(isUpcomingStub(merged[0])).toBe(false);
    expect(merged[0].total).toBe(140);
  });

  it("leaves non-English lists alone", () => {
    const ja = [set("M6", "ストームエメラルダ", "2026-07-31", { lang: "ja" })];
    expect(withUpcomingSets(ja)).toEqual(ja);
  });
});
