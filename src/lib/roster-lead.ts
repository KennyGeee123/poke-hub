import { speciesFromCardName } from "./card-moves";

/** Species the trainer put out front. Missing means the hometown partner can still lead. */
export const ROSTER_LEAD_KEY = "pv.adventure.rosterLead.v1";

export type RosterSource = "house" | "party" | "card";

export type RosterMon = {
  id: string;
  name: string;
  species: string;
  level: number;
  maxHp: number;
  types: string[];
  source: RosterSource;
};

export function speciesKey(name: string): string {
  return speciesFromCardName(name).toLowerCase();
}

export function promoteToLead<T>(list: T[], index: number): T[] {
  if (index <= 0 || index >= list.length) return list.slice();
  const next = list.slice();
  const [picked] = next.splice(index, 1);
  next.unshift(picked as T);
  return next;
}

/** Slot numbers win. A party that never set a lead keeps its saved order. */
export function partyInLeadOrder<T extends { slot?: number | null }>(party: T[]): T[] {
  if (!party.some((mon) => typeof mon.slot === "number")) return party.slice();
  return party
    .map((mon, index) => ({ mon, index }))
    .sort((a, b) => (a.mon.slot ?? 999) - (b.mon.slot ?? 999) || a.index - b.index)
    .map((row) => row.mon);
}

export function withLeadSlots<T extends { id: string; slot?: number | null }>(
  party: T[],
  id: string,
): T[] {
  const ordered = partyInLeadOrder(party);
  const index = ordered.findIndex((mon) => mon.id === id);
  if (index < 0) return ordered;
  return promoteToLead(ordered, index).map((mon, slot) => ({ ...mon, slot }));
}

export function orderBySpecies<T extends { name: string; species?: string }>(
  list: T[],
  lead: string | null,
): T[] {
  if (!lead) return list.slice();
  const key = speciesKey(lead);
  const index = list.findIndex((item) => {
    const species = speciesKey(item.species || item.name);
    return species === key || item.name.toLowerCase() === lead.toLowerCase();
  });
  return promoteToLead(list, index);
}

/**
 * One row per species. The saved party outranks the house pair.
 * The chosen lead is first. Everyone else stays on the list.
 */
export function mergeRoster(input: {
  house: RosterMon[];
  party: RosterMon[];
  cards: RosterMon[];
  lead: string | null;
}): RosterMon[] {
  const by = new Map<string, RosterMon>();
  const put = (row: RosterMon) => {
    const species = speciesFromCardName(row.species || row.name);
    const key = species.toLowerCase();
    if (!key) return;
    const next = { ...row, species };
    const prev = by.get(key);
    if (!prev) {
      by.set(key, next);
      return;
    }
    // A saved party member is the one they own. A card fills a species that is not already there.
    const partyWins = next.source === "party" && prev.source !== "party";
    const higherSame = next.source === prev.source && next.level > prev.level;
    if (partyWins || higherSame) {
      by.set(key, {
        ...next,
        maxHp: next.level >= prev.level ? next.maxHp : prev.maxHp,
        types: next.types.length ? next.types : prev.types,
      });
    }
  };
  for (const row of input.house) put(row);
  for (const row of input.party) put(row);
  for (const row of input.cards) put(row);
  return orderBySpecies([...by.values()], input.lead);
}

export function readRosterLead(): string | null {
  try {
    const raw = localStorage.getItem(ROSTER_LEAD_KEY);
    const species = raw ? speciesFromCardName(raw) : "";
    return species || null;
  } catch {
    return null;
  }
}

export function writeRosterLead(name: string): string {
  const species = speciesFromCardName(name);
  try {
    localStorage.setItem(ROSTER_LEAD_KEY, species);
  } catch {
    /* private mode */
  }
  return species;
}

export function buddyNickname(species: string, houseName?: string): string {
  if (houseName) {
    const nick = houseName.split("(")[0]?.trim();
    if (nick && nick.toLowerCase() !== species.toLowerCase()) return nick;
  }
  if (species.toLowerCase() === "pikachu") return "Sparky";
  if (species.toLowerCase() === "charizard") return "Blaze";
  return species;
}
