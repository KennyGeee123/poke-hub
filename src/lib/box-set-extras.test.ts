import { describe, expect, it } from "bun:test";
import type { TCGCard } from "@/lib/pokemon-api";
import { addBoxSetExtras, boxSetExtraCount } from "./box-set-extras";
import { sortSetCards } from "./set-ids";

const card = (setId: string, n: string, name = `Card ${n}`): TCGCard => ({
  id: `${setId}-${n}`,
  name,
  number: n,
  set: { id: setId, name: "Box", total: 180, printedTotal: 145 },
  images: { small: "", large: "" },
});

describe("box set extras", () => {
  it("adds Guardians Rising 'a' prints TCGdex lacks, once", () => {
    const box = Array.from({ length: 169 }, (_, i) => card("sm2", String(i + 1)));
    const out = addBoxSetExtras("sm2", box);
    expect(boxSetExtraCount("sm2")).toBe(11);
    expect(out.length).toBe(180);
    expect(out.some((c) => c.number === "60a" && c.name === "Tapu Lele-GX")).toBe(true);
    expect(out.find((c) => c.number === "60a")?.set.id).toBe("sm2");
    expect(addBoxSetExtras("sm2", out).length).toBe(180);
  });

  it("matches TCGdex dotted ids (sm3.5) and pokemontcg ids (sm35)", () => {
    expect(boxSetExtraCount("sm3.5")).toBe(3);
    expect(boxSetExtraCount("sm35")).toBe(3);
  });

  it("adds Unseen Forces Unown A-Z ! ? after the numbered list", () => {
    const box = Array.from({ length: 117 }, (_, i) => card("ex10", String(i + 1)));
    const out = sortSetCards(addBoxSetExtras("ex10", box));
    expect(out.length).toBe(145);
    expect(out[0].number).toBe("1");
    expect(out[116].number).toBe("117");
    expect(out.slice(117).every((c) => c.name === "Unown")).toBe(true);
  });

  it("adds 30th Celebration Mew R/G/B but never to Classic Collection", () => {
    expect(boxSetExtraCount("30th")).toBe(3);
    expect(boxSetExtraCount("me55")).toBe(3);
    expect(boxSetExtraCount("30th-c")).toBe(0);
    expect(boxSetExtraCount("me55c")).toBe(0);
  });

  it("leaves sets with nothing missing alone", () => {
    const box = [card("sv03.5", "1")];
    expect(addBoxSetExtras("sv03.5", box)).toBe(box);
  });
});
