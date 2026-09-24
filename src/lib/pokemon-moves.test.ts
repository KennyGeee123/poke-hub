import { describe, expect, it } from "bun:test";
import {
  getFullMoveRepertoireForCard,
  getCustomMoveSet,
  saveCustomMoveSet,
  type PokemonMove,
} from "./pokemon-moves";
import type { TCGCard } from "./pokemon-api";

const mockCharizard: TCGCard = {
  id: "base1-4",
  name: "Charizard",
  supertype: "Pokémon",
  subtypes: ["Stage 2"],
  level: "76",
  hp: "120",
  types: ["Fire"],
  attacks: [
    {
      name: "Fire Spin",
      cost: ["Fire", "Fire", "Fire", "Fire"],
      convertedEnergyCost: 4,
      damage: "100",
      text: "Discard 2 Energy cards attached to Charizard in order to use this attack.",
    },
  ],
  set: {
    id: "base1",
    name: "Base Set",
    series: "Base",
    printedTotal: 102,
    total: 102,
    legalities: { unlimited: "Legal" },
    ptcgoCode: "BS",
    releaseDate: "1999/01/09",
    updatedAt: "2020/08/14 09:35:00",
    images: { symbol: "", logo: "" },
  },
  number: "4",
  artist: "Mitsuhiro Arita",
  rarity: "Rare Holo",
  images: { small: "", large: "" },
};

describe("Pokemon Moves & Egg/Breedable Moves Customizer Engine", () => {
  it("compiles a comprehensive repertoire containing egg, level-up, tm, and card signature moves", () => {
    const repertoire = getFullMoveRepertoireForCard(mockCharizard);
    expect(repertoire.length).toBeGreaterThan(15);

    const hasEggMoves = repertoire.some((m) => m.category === "egg" && m.isBreedable);
    expect(hasEggMoves).toBe(true);

    const hasSignature = repertoire.some(
      (m) => m.name === "Fire Spin" && m.category === "signature",
    );
    expect(hasSignature).toBe(true);

    const dragonDance = repertoire.find((m) => m.name === "Dragon Dance");
    expect(dragonDance).toBeDefined();
    expect(dragonDance?.isBreedable).toBe(true);
  });

  it("initializes a 4-slot moveset containing native attacks and breedable egg moves", () => {
    const moveset = getCustomMoveSet(mockCharizard.id, mockCharizard);
    expect(moveset.length).toBe(4);
    expect(moveset[0].name).toBe("Fire Spin");
  });

  it("allows swapping move slots and persisting custom configurations", () => {
    const repertoire = getFullMoveRepertoireForCard(mockCharizard);
    const bellyDrum = repertoire.find((m) => m.name === "Belly Drum")!;
    const custom4 = [bellyDrum, repertoire[0], repertoire[1], repertoire[2]];

    saveCustomMoveSet("test-card-save", custom4);
    const loaded = getCustomMoveSet("test-card-save", mockCharizard);
    expect(loaded[0].name).toBe("Belly Drum");
  });
});
