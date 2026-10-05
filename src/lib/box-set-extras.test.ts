import { describe, expect, it } from "bun:test";
import type { TCGCard } from "@/lib/pokemon-api";
import { addBoxSetExtras, boxSetExtraCount } from "./box-set-extras";
import { sortSetCards } from "./set-ids";

const card = (
  setId: string,
  n: string,
  name = `Card ${n}`,
  images?: TCGCard["images"],
): TCGCard => ({
  id: `${setId}-${n}`,
  name,
  number: n,
  set: { id: setId, name: "Box", total: 180, printedTotal: 145 },
  images: images || { small: "https://example.com/ok.png", large: "https://example.com/ok.png" },
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

  it("adds 30th Celebration Mews AND Classic Magikarp without dropping Pikachu #030", () => {
    // 3 Mews + 30 Classic = 33 shipped extras for the 30th family
    expect(boxSetExtraCount("30th")).toBe(33);
    expect(boxSetExtraCount("me55")).toBe(33);
    expect(boxSetExtraCount("30th-c")).toBe(30);
    expect(boxSetExtraCount("me55c")).toBe(30);

    const box = [
      card("30th", "030", "Pikachu"),
      ...Array.from({ length: 157 }, (_, i) => card("30th", String(i + 1).padStart(3, "0"))),
    ];
    // dedupe the padded 030 we already added
    const uniq = new Map(box.map((c) => [`${c.name}::${c.number}`, c]));
    const seed = [...uniq.values()];
    const out = addBoxSetExtras("30th", seed);
    expect(out.some((c) => c.name === "Pikachu" && /0?30/.test(c.number))).toBe(true);
    const mag = out.find((c) => c.name === "Magikarp");
    expect(mag).toBeTruthy();
    expect(mag!.number).toMatch(/0?30/);
    expect(mag!.images.small).toMatch(/tcgplayer\.com\/product\/716210/);
    expect(out.some((c) => c.number === "R" && c.name === "Mew")).toBe(true);
  });

  it("overlays a real scan onto Classic cards that only have a broken pokemontcg URL", () => {
    const broken = card("30th-c", "030", "Magikarp", {
      small: "https://images.pokemontcg.io/30th-c/030.png",
      large: "https://images.pokemontcg.io/30th-c/030_hires.png",
    });
    const out = addBoxSetExtras("30th-c", [broken]);
    expect(out).toHaveLength(30); // Magikarp kept + 29 other classic cards added
    const mag = out.find((c) => c.name === "Magikarp")!;
    expect(mag.images.small).toMatch(/tcgplayer\.com\/product\/716210/);
  });

  it("leaves sets with nothing missing alone", () => {
    const box = [card("sv03.5", "1")];
    expect(addBoxSetExtras("sv03.5", box)).toBe(box);
  });
});
