import { describe, expect, test } from "bun:test";
import {
  appendNamedMoves,
  installCardLearnset,
  knownCardMoves,
  learnPrintedMoves,
  partyWithCardMoves,
  scanLearnNote,
  speciesFromCardName,
  teachMachineMove,
} from "./card-moves";

const pikachu = {
  name: "Sparky (Pikachu)",
  species: "Pikachu",
  level: 32,
  maxHp: 120,
  currentHp: 120,
  types: ["Electric"],
  moves: [
    { name: "Thunderbolt", type: "Electric", power: 90, pp: 15, maxPp: 15, description: "x" },
    { name: "Iron Tail", type: "Normal", power: 75, pp: 15, maxPp: 15, description: "x" },
    { name: "Volt Tackle", type: "Electric", power: 120, pp: 5, maxPp: 5, description: "x" },
    { name: "Quick Attack", type: "Normal", power: 40, pp: 30, maxPp: 30, description: "x" },
  ],
};

describe("scanned card moves", () => {
  test("a card's printed attacks are added, and a second card appends", () => {
    const first = learnPrintedMoves(undefined, {
      id: "pikachu-1",
      name: "Pikachu",
      supertype: "Pokémon",
      types: ["Lightning"],
      attacks: [
        { name: "Thunder Shock", cost: ["Lightning"], damage: "30", text: "Flip a coin." },
        { name: "Iron Tail", cost: ["Metal"], damage: "30" },
      ],
    });
    expect(first.species).toBe("Pikachu");
    expect(first.added).toEqual(["Thunder Shock", "Iron Tail"]);
    expect(first.book.pikachu.moves[0]).toMatchObject({
      name: "Thunder Shock",
      type: "Electric",
      power: 30,
      description: "Flip a coin.",
    });
    expect(first.book.pikachu.moves[1].type).toBe("Steel");

    const second = learnPrintedMoves(first.book, {
      id: "pikachu-2",
      name: "Pikachu VMAX",
      supertype: "Pokémon",
      types: ["Lightning"],
      attacks: [
        { name: "Thunder Shock", damage: "20" },
        { name: "Quick Attack", damage: "10+" },
      ],
    });
    expect(second.added).toEqual(["Quick Attack"]);
    expect(second.book.pikachu.moves.map((m) => m.name)).toEqual([
      "Thunder Shock",
      "Iron Tail",
      "Quick Attack",
    ]);
    expect(second.book.pikachu.cardIds).toEqual(["pikachu-1", "pikachu-2"]);
    expect(second.book.pikachu.moves[0].power).toBe(30);

    const third = learnPrintedMoves(second.book, {
      id: "pikachu-3",
      name: "Pikachu",
      supertype: "Pokémon",
      types: ["Lightning"],
      attacks: [{ name: "Nuzzle", damage: "" }, { name: "thunder shock", damage: "40" }],
    });
    expect(third.added).toEqual(["Nuzzle"]);
    expect(third.book.pikachu.moves.map((m) => m.name)).toEqual([
      "Thunder Shock",
      "Iron Tail",
      "Quick Attack",
      "Nuzzle",
    ]);
    expect(third.book.pikachu.moves.find((m) => m.name === "Nuzzle")?.power).toBe(20);
  });

  test("a TCGdex Pokemon row still teaches the printed attacks", () => {
    const learned = learnPrintedMoves(undefined, {
      id: "sv03.5-006",
      name: "Charizard ex",
      supertype: "Pokemon",
      types: ["Fire"],
      attacks: [
        { name: "Brave Wing", damage: "60+" },
        { name: "Explosive Vortex", damage: "330" },
      ],
    });
    expect(learned.species).toBe("Charizard");
    expect(learned.added).toEqual(["Brave Wing", "Explosive Vortex"]);
    expect(learned.book.charizard.moves).toHaveLength(2);
  });

  test("card suffixes map onto the base species and trainers do nothing", () => {
    expect(speciesFromCardName("Charizard ex")).toBe("Charizard");
    expect(speciesFromCardName("Blaine's Charizard ex")).toBe("Charizard");
    expect(speciesFromCardName("M Charizard-EX")).toBe("Charizard");
    expect(speciesFromCardName("Pikachu VMAX")).toBe("Pikachu");
    const zard = learnPrintedMoves(undefined, {
      id: "zard",
      name: "Charizard ex",
      supertype: "Pokémon",
      types: ["Fire"],
      attacks: [{ name: "Burning Darkness", damage: "200" }],
    });
    expect(zard.book.charizard.moves[0].power).toBe(160);
    const again = learnPrintedMoves(zard.book, {
      id: "zard",
      name: "Charizard ex",
      supertype: "Pokémon",
      types: ["Fire"],
      attacks: [{ name: "Burning Darkness", damage: "180" }],
    });
    expect(again.added).toEqual([]);
    expect(again.book.charizard.moves).toHaveLength(1);
    const trainer = learnPrintedMoves(zard.book, {
      id: "bill",
      name: "Bill",
      supertype: "Trainer",
    });
    expect(trainer.species).toBeNull();
    expect(trainer.added).toEqual([]);
    expect(trainer.book.charizard.moves).toHaveLength(1);
  });

  test("the adventure party keeps its moves and scrolls past four", () => {
    const book = learnPrintedMoves(undefined, {
      id: "pikachu-1",
      name: "Pikachu",
      supertype: "Pokémon",
      types: ["Lightning"],
      attacks: [
        { name: "Thunder Shock", damage: "30" },
        { name: "Iron Tail", damage: "30" },
        { name: "Nuzzle", damage: "20" },
      ],
    }).book;
    const party = partyWithCardMoves([pikachu], book);
    expect(party[0].moves.map((m) => m.name)).toEqual([
      "Thunderbolt",
      "Iron Tail",
      "Volt Tackle",
      "Quick Attack",
      "Thunder Shock",
      "Nuzzle",
    ]);
    expect(party[0].moves.filter((m) => m.name === "Thunderbolt")).toHaveLength(1);
    expect(party[0].moves.filter((m) => m.name === "Iron Tail")).toHaveLength(1);
    expect(party[0].moves.length).toBeGreaterThan(4);

    const grown = appendNamedMoves(party[0].moves, [
      { name: "Electro Ball", type: "Electric", power: 50, pp: 15, maxPp: 15, description: "x" },
      { name: "Thunderbolt", type: "Electric", power: 90, pp: 15, maxPp: 15, description: "x" },
    ]);
    expect(grown[0].name).toBe("Thunderbolt");
    expect(grown.map((m) => m.name)).toContain("Electro Ball");
    expect(grown.filter((m) => m.name === "Thunderbolt")).toHaveLength(1);
    expect(grown.length).toBe(party[0].moves.length + 1);
  });

  test("a scanned species that is not on the team joins it", () => {
    const book = learnPrintedMoves(undefined, {
      id: "bulba",
      name: "Bulbasaur",
      supertype: "Pokémon",
      types: ["Grass"],
      attacks: [{ name: "Vine Whip", cost: ["Grass"], damage: "40", text: "Whip." }],
    }).book;
    const party = partyWithCardMoves([pikachu], book);
    expect(party.map((m) => m.species)).toEqual(["Pikachu", "Bulbasaur"]);
    expect(party[1].moves[0].name).toBe("Vine Whip");
    expect(party[1].moves[0].type).toBe("Grass");
  });

  test("the scanner says which moves were added", () => {
    const card = {
      id: "p",
      name: "Pikachu",
      supertype: "Pokémon",
      attacks: [{ name: "Thunder Shock" }],
    };
    expect(scanLearnNote(card, ["Thunder Shock", "Iron Tail"], "Pikachu")).toBe(
      "Thunder Shock, Iron Tail added to Pikachu in the adventure.",
    );
    expect(scanLearnNote(card, [], "Pikachu")).toBe("Pikachu already knows those moves.");
    expect(scanLearnNote({ id: "t", name: "Bill", supertype: "Trainer" }, [], null)).toBe(
      "Added to your vault.",
    );
  });

  test("a scanned card fights with level-up moves, and a TM is a choice", () => {
    const printed = learnPrintedMoves(undefined, {
      id: "sv03.5-006",
      name: "Charizard ex",
      supertype: "Pokémon",
      types: ["Fire"],
      attacks: [{ name: "Brave Wing", damage: "60", text: "Discard an Energy." }],
    }).book;
    const dumped = {
      ...printed.charizard,
      moves: [
        ...printed.charizard.moves,
        {
          name: "Earthquake",
          type: "Ground",
          power: 100,
          pp: 15,
          maxPp: 15,
          description: "TM move.",
        },
        {
          name: "Flamethrower",
          type: "Fire",
          power: 90,
          pp: 20,
          maxPp: 20,
          description: "Inflicts regular damage with no additional effect.",
        },
      ],
    };
    const book = installCardLearnset(
      { charizard: dumped },
      "Charizard",
      [
        {
          name: "Scratch",
          type: "Normal",
          power: 40,
          text: "Scratches.",
          source: "level-up",
          level: 1,
        },
        {
          name: "Flamethrower",
          type: "Fire",
          power: 90,
          text: "Inflicts regular damage with no additional effect.",
          source: "level-up",
          level: 36,
        },
        { name: "Earthquake", type: "Ground", power: 100, source: "machine" },
      ],
    );
    expect(book.charizard.moves.map((move) => move.name)).toEqual(["Brave Wing"]);
    expect(knownCardMoves(book.charizard, 10).map((move) => move.name)).toEqual([
      "Brave Wing",
      "Scratch",
    ]);
    expect(knownCardMoves(book.charizard, 38).map((move) => move.name)).toEqual([
      "Brave Wing",
      "Scratch",
      "Flamethrower",
    ]);
    const party = partyWithCardMoves([pikachu], book);
    const zard = partyWithCardMoves(
      [
        {
          name: "Blaze (Charizard)",
          species: "Charizard",
          level: 38,
          maxHp: 165,
          currentHp: 165,
          types: ["Fire"],
          moves: [
            { name: "Dragon Claw", type: "Dragon", power: 80, pp: 15, maxPp: 15, description: "starter" },
          ],
        },
      ],
      book,
    );
    expect(zard[0].moves.map((move) => move.name)).toEqual(["Brave Wing", "Scratch", "Flamethrower"]);
    expect(party[0].moves[0].name).toBe("Thunderbolt");
    const taught = teachMachineMove(book, "Charizard", {
      name: "Earthquake",
      type: "Ground",
      power: 100,
      pp: 15,
      maxPp: 15,
      description: "TM move.",
    });
    expect(taught.added).toBe(true);
    expect(knownCardMoves(taught.book.charizard, 10).map((move) => move.name)).toContain("Earthquake");
    const early = teachMachineMove(taught.book, "Charizard", {
      name: "Flamethrower",
      type: "Fire",
      power: 90,
      pp: 15,
      maxPp: 15,
      description: "TM move.",
    });
    expect(early.added).toBe(false);
  });
});
