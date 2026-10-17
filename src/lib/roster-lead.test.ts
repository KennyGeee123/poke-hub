import { describe, expect, it } from "bun:test";
import {
  mergeRoster,
  orderBySpecies,
  partyInLeadOrder,
  promoteToLead,
  speciesKey,
  withLeadSlots,
  type RosterMon,
} from "./roster-lead";

function row(partial: Partial<RosterMon> & Pick<RosterMon, "name" | "species" | "source">): RosterMon {
  return {
    id: partial.id ?? partial.species,
    level: partial.level ?? 10,
    maxHp: partial.maxHp ?? 40,
    types: partial.types ?? ["Normal"],
    ...partial,
  };
}

describe("roster lead", () => {
  it("moves the chosen Pokémon to the front and leaves the others in order", () => {
    expect(promoteToLead(["Sparky", "Blaze", "Eevee"], 1)).toEqual(["Blaze", "Sparky", "Eevee"]);
    expect(promoteToLead(["Sparky", "Blaze"], 0)).toEqual(["Sparky", "Blaze"]);
    expect(promoteToLead(["Sparky"], 4)).toEqual(["Sparky"]);
  });

  it("keeps array order until a lead slot is saved", () => {
    const party = [
      { id: "a", slot: null },
      { id: "b", slot: null },
    ];
    expect(partyInLeadOrder(party).map((mon) => mon.id)).toEqual(["a", "b"]);
    expect(withLeadSlots(party, "b").map((mon) => mon.slot)).toEqual([0, 1]);
    expect(withLeadSlots(party, "b").map((mon) => mon.id)).toEqual(["b", "a"]);
  });

  it("reads a later slot order without scrambling an untouched party", () => {
    const party = [
      { id: "old-first", slot: 1 },
      { id: "main", slot: 0 },
    ];
    expect(partyInLeadOrder(party).map((mon) => mon.id)).toEqual(["main", "old-first"]);
  });

  it("strips a card suffix so Charizard ex matches Blaze", () => {
    expect(speciesKey("Charizard ex")).toBe("charizard");
    const ordered = orderBySpecies(
      [
        { name: "Sparky (Pikachu)", species: "Pikachu" },
        { name: "Blaze (Charizard)", species: "Charizard" },
      ],
      "Charizard ex",
    );
    expect(ordered[0]?.species).toBe("Charizard");
  });

  it("lists the whole roster once, with the saved party ahead of the house pair", () => {
    const roster = mergeRoster({
      lead: "Eevee",
      house: [
        row({ id: "sparky", name: "Sparky (Pikachu)", species: "Pikachu", level: 32, source: "house" }),
        row({ id: "blaze", name: "Blaze (Charizard)", species: "Charizard", level: 38, source: "house" }),
      ],
      party: [
        row({
          id: "zard",
          name: "Charizard ex",
          species: "Charizard",
          level: 50,
          maxHp: 180,
          source: "party",
        }),
        row({ id: "eevee", name: "Eevee", species: "Eevee", level: 12, source: "party" }),
      ],
      cards: [
        row({ id: "card-eevee", name: "Eevee", species: "Eevee", level: 50, source: "card" }),
        row({ id: "card-mew", name: "Mew", species: "Mew", level: 50, source: "card" }),
      ],
    });
    expect(roster.map((mon) => mon.species)).toEqual(["Eevee", "Pikachu", "Charizard", "Mew"]);
    expect(roster.find((mon) => mon.species === "Charizard")).toMatchObject({
      name: "Charizard ex",
      level: 50,
      source: "party",
    });
    expect(roster.find((mon) => mon.species === "Eevee")?.source).toBe("party");
  });
});
