import type { TCGCard } from "./pokemon-api";

/** A move printed on a scanned card, stored the way the HD battle reads it. */
export type ScannedMove = {
  name: string;
  type: string;
  power: number;
  pp: number;
  maxPp: number;
  description: string;
};

/** One species in the adventure, with every card that taught it a move. */
export type ScannedFighter = {
  species: string;
  types: string[];
  cardIds: string[];
  moves: ScannedMove[];
};

export type PrintedCard = {
  id: string;
  name: string;
  supertype?: string;
  types?: string[];
  attacks?: TCGCard["attacks"];
};

const GAME_TYPE: Record<string, string> = {
  Lightning: "Electric",
  Metal: "Steel",
  Colorless: "Normal",
  Darkness: "Dark",
};

const CARD_SUFFIX =
  /(?:\s+|-)(?:V-UNION|VMAX|VSTAR|GX|EX|V|BREAK|LV\.X|Prime|LEGEND|δ|☆|Star)$/i;

/** "Charizard ex" and "Pikachu VMAX" both belong to the base species. */
export function speciesFromCardName(name: string): string {
  let s = name.trim().replace(/^[\p{L}.\-' ]+['’]s\s+/u, "");
  s = s.replace(/^(?:Radiant|Mega|M)\s+/i, "");
  let prev = "";
  while (s && s !== prev) {
    prev = s;
    s = s.replace(CARD_SUFFIX, "").trim();
  }
  return s.replace(/\s+/g, " ").trim() || name.trim();
}

export function gameType(raw?: string): string {
  if (!raw) return "Normal";
  return GAME_TYPE[raw] || raw;
}

function gameTypes(types?: string[]): string[] {
  const out = (types ?? []).map((t) => gameType(t)).filter(Boolean);
  return out.length ? [...new Set(out)] : ["Normal"];
}

function printedPower(damage?: string): number {
  const n = parseInt((damage || "").replace(/\D/g, ""), 10);
  if (!n) return 20;
  return Math.max(10, Math.min(160, n));
}

function moveFromAttack(
  atk: NonNullable<TCGCard["attacks"]>[number],
  card: PrintedCard,
): ScannedMove {
  const energy = atk.cost?.find((c) => c && c !== "Free") || card.types?.[0];
  return {
    name: atk.name.trim(),
    type: gameType(energy),
    power: printedPower(atk.damage),
    pp: 15,
    maxPp: 15,
    description: atk.text?.trim() || "Printed on the scanned card.",
  };
}

/**
 * Add this card's printed attacks onto that species.
 * A second card appends new names. It never drops a move already learned.
 */
export function learnPrintedMoves(
  book: Record<string, ScannedFighter> | undefined,
  card: PrintedCard,
): { book: Record<string, ScannedFighter>; added: string[]; species: string | null } {
  const next: Record<string, ScannedFighter> = { ...(book || {}) };
  if (card.supertype !== "Pokémon") return { book: next, added: [], species: null };
  const species = speciesFromCardName(card.name);
  const key = species.toLowerCase();
  const prev = next[key] || {
    species,
    types: gameTypes(card.types),
    cardIds: [] as string[],
    moves: [] as ScannedMove[],
  };
  const cardIds = prev.cardIds.includes(card.id) ? prev.cardIds : [...prev.cardIds, card.id];
  const moves = prev.moves.map((m) => ({ ...m }));
  const added: string[] = [];
  for (const atk of card.attacks ?? []) {
    const name = atk.name?.trim();
    if (!name) continue;
    if (moves.some((m) => m.name.toLowerCase() === name.toLowerCase())) continue;
    moves.push(moveFromAttack({ ...atk, name }, card));
    added.push(name);
  }
  next[key] = {
    species,
    types: prev.types.length ? prev.types : gameTypes(card.types),
    cardIds,
    moves,
  };
  return { book: next, added, species };
}

/** Append names the fighter does not already know. Earlier moves stay in place. */
export function appendNamedMoves<T extends { name: string }>(current: T[], incoming: T[]): T[] {
  const moves = current.map((m) => ({ ...m }));
  for (const mv of incoming) {
    const name = mv.name?.trim();
    if (!name) continue;
    if (moves.some((m) => m.name.toLowerCase() === name.toLowerCase())) continue;
    moves.push({ ...mv, name });
  }
  return moves;
}

type PartyMon = {
  name: string;
  species: string;
  level: number;
  maxHp: number;
  currentHp: number;
  types: string[];
  moves: ScannedMove[];
  spriteUrl?: string;
};

/**
 * Put scanned moves on the matching species, then bring other scanned species
 * along until the party is full. Moves are not capped at four.
 */
export function partyWithCardMoves<T extends PartyMon>(
  party: T[],
  book?: Record<string, ScannedFighter> | null,
): T[] {
  const fighters = Object.values(book || {});
  if (!fighters.length) return party;
  const next = party.map((mon) => {
    const hit = fighters.find((f) => f.species.toLowerCase() === mon.species.toLowerCase());
    if (!hit) return mon;
    return { ...mon, moves: appendNamedMoves(mon.moves, hit.moves) };
  });
  const have = new Set(next.map((m) => m.species.toLowerCase()));
  for (const fighter of fighters) {
    if (next.length >= 6) break;
    if (have.has(fighter.species.toLowerCase())) continue;
    if (!fighter.moves.length) continue;
    const level = 20;
    const hp = Math.round(level * 4.2 + 25);
    next.push({
      name: fighter.species,
      species: fighter.species,
      level,
      maxHp: hp,
      currentHp: hp,
      types: fighter.types.length ? [...fighter.types] : ["Normal"],
      moves: fighter.moves.map((m) => ({ ...m })),
    } as T);
    have.add(fighter.species.toLowerCase());
  }
  return next;
}

export function scanLearnNote(card: PrintedCard, added: string[], species: string | null): string {
  if (card.supertype !== "Pokémon" || !species) return "Added to your vault.";
  if (added.length) return `${added.join(", ")} added to ${species} in the adventure.`;
  const printed = (card.attacks ?? []).some((a) => a.name?.trim());
  if (!printed) return `${species} joined the adventure.`;
  return `${species} already knows those moves.`;
}
