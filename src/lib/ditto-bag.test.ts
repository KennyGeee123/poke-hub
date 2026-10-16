import { describe, expect, it } from "bun:test";
import { isDittoName, makeMonFromSpecies, wildFoeMon } from "./gbgame";
import { movesAtLevel, orderSpeciesLearnset, packSpeciesMoves, type SpeciesMove } from "./pokeapi-moves";
import { learnExtraMoves, partyWithCardMoves, type ScannedMove } from "./card-moves";
import {
  CAPTURE_ITEMS,
  ballItemIds,
  getDefaultAdventureState,
  mergeBag,
  teachBagTm,
  useRepel,
} from "./adventure-engine";
import { TM_DISCS } from "./tm-catalog";
import { BALLS } from "./ball-catalog";

const move = (
  name: string,
  power: number,
  description: string,
): ScannedMove => ({
  name,
  type: "Normal",
  power,
  pp: 10,
  maxPp: 10,
  description,
});

describe("Ditto Transform", () => {
  it("sends Ditto out with Transform and nothing else", () => {
    expect(isDittoName("Ditto")).toBe(true);
    expect(isDittoName("Pikachu")).toBe(false);
    const wild = wildFoeMon("Ditto", 12);
    expect(wild.attacks.map((atk) => atk.name)).toEqual(["Transform"]);
    expect(wild.attacks[0].damage).toBe(0);
    expect(makeMonFromSpecies("Ditto", 8).attacks.map((atk) => atk.name)).toEqual(["Transform"]);
    expect(wildFoeMon("Pidgey", 4).attacks[0].name).toBe("Tackle");
  });

  it("does not let a damage sort replace Transform", async () => {
    const moves = await movesAtLevel("Ditto", 20, [{ name: "Tackle", damage: 40 }]);
    expect(moves.map((atk) => atk.name)).toEqual(["Transform"]);
    expect(moves[0].damage).toBe(0);
  });
});

describe("full move sets", () => {
  it("keeps breeding, level-up, TM, and tutor moves with no cap", () => {
    const rows = [
      { url: "u-egg", methods: [{ name: "egg" }, { name: "level-up", level: 1 }] },
      { url: "u-level", methods: [{ name: "level-up", level: 36 }] },
      { url: "u-tm", methods: [{ name: "machine" }] },
      { url: "u-tutor", methods: [{ name: "tutor" }] },
      { url: "u-light", methods: [{ name: "light-ball-egg" }] },
      { url: "u-train", methods: [{ name: "train" }] },
      ...Array.from({ length: 90 }, (_, i) => ({
        url: `u-extra-${i}`,
        methods: [{ name: "machine" }],
      })),
    ];
    const ordered = orderSpeciesLearnset(rows);
    expect(ordered.length).toBe(96);
    expect(ordered.filter((row) => row.source === "egg").map((row) => row.url).sort()).toEqual([
      "u-egg",
      "u-light",
    ]);
    expect(ordered.filter((row) => row.source === "machine").length).toBe(91);
    expect(ordered.some((row) => row.source === "tutor")).toBe(true);
    expect(ordered.some((row) => row.source === "train" && row.url === "u-train")).toBe(true);
    const packed = packSpeciesMoves([
      { name: "Belly Drum", damage: 0, type: "Colorless", source: "egg" },
      { name: "Earthquake", damage: 100, type: "Fighting", source: "machine" },
      { name: "Heat Wave", damage: 95, type: "Fire", source: "tutor" },
    ] as SpeciesMove[]);
    expect(packed.map((m) => m.description)).toEqual(["Breeding move.", "TM move.", "Tutor move."]);
  });
});

describe("balls and repels", () => {
  it("paints every ball", () => {
    const ids = ballItemIds();
    expect(ids.length).toBe(Object.keys(BALLS).length);
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const colors = CAPTURE_ITEMS[id].colors;
      expect(colors?.top).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors?.bottom).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors?.band).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors?.button).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(CAPTURE_ITEMS.poke_ball.colors?.top.toLowerCase()).toBe("#ef2d2d");
    expect(CAPTURE_ITEMS.ultra_ball.colors?.bottom.toLowerCase()).toBe("#f5c518");
    expect(CAPTURE_ITEMS.master_ball.colors?.button.toLowerCase()).toBe("#e85d9a");
  });

  it("keeps saved ball counts and fills balls the old bag did not have", () => {
    const bag = mergeBag({
      coins: 10,
      captureItems: { poke_ball: 3 },
    } as never);
    expect(bag.captureItems.poke_ball).toBe(3);
    expect(bag.captureItems.dusk_ball).toBeGreaterThan(0);
    expect(bag.captureItems.beast_ball).toBeGreaterThan(0);
    expect(bag.repels.max_repel).toBeGreaterThan(0);
    expect(Object.keys(bag.tms)).toHaveLength(TM_DISCS.length);
    expect(TM_DISCS).toHaveLength(229);
    expect(bag.tms.tm149).toBe(1);
    expect(TM_DISCS.find((disc) => disc.id === "tm149")?.move).toBe("Earthquake");
    const kept = mergeBag({ ...bag, tms: { ...bag.tms, tm149: 0 } });
    expect(kept.tms.tm149).toBe(0);
    expect(kept.tms.tm001 ?? kept.tms.tm01).toBe(1);
  });

  it("will not teach a TM until a card that can learn it is scanned", () => {
    const missed = teachBagTm("Charizard", "tm149");
    expect(missed.success).toBe(false);
    expect(missed.state.inventory.tms.tm149).toBe(1);
  });

  it("replaces the step counter when a Repel is used", () => {
    const state = getDefaultAdventureState();
    const max = useRepel(state, "max_repel");
    expect(max.success).toBe(true);
    expect(max.state.inventory.repelSteps).toBe(250);
    expect(max.state.inventory.repels.max_repel).toBe(state.inventory.repels.max_repel - 1);
    const again = useRepel(max.state, "repel");
    expect(again.state.inventory.repelSteps).toBe(100);
  });
});

describe("scanned breeding moves", () => {
  it("loads every breeding move onto the adventure species", () => {
    const learned = learnExtraMoves(undefined, "Pikachu", [
      move("Volt Tackle", 120, "Breeding move."),
      move("Fake Out", 40, "Breeding move."),
      move("Encore", 0, "Breeding move."),
      move("Disarming Voice", 40, "Breeding move."),
      move("Thunder Shock", 40, "Level-up move."),
    ]);
    expect(learned.added).toHaveLength(5);
    const party = partyWithCardMoves(
      [
        {
          name: "Sparky",
          species: "Pikachu",
          level: 10,
          maxHp: 40,
          currentHp: 40,
          types: ["Electric"],
          moves: [move("Tackle", 40, "Full body charge.")],
        },
      ],
      learned.book,
    );
    expect(party[0].moves.map((atk) => atk.name)).toEqual([
      "Tackle",
      "Volt Tackle",
      "Fake Out",
      "Encore",
      "Disarming Voice",
      "Thunder Shock",
    ]);
    expect(party[0].moves.length).toBeGreaterThan(4);
  });
});
