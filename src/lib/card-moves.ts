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

export type LevelUpMove = { level: number; move: ScannedMove };

/** One species in the adventure, with every card that taught it a move. */
export type ScannedFighter = {
  species: string;
  types: string[];
  cardIds: string[];
  /** Printed attacks, kept even when a level-up schedule is installed. */
  moves: ScannedMove[];
  /** Level-up schedule. Battle choices use the rows at or under the mon's level. */
  levelUps?: LevelUpMove[];
  /** Move names this scanned species can be taught from the TM bag. */
  machines?: string[];
  /** TMs the trainer chose to teach. */
  taught?: ScannedMove[];
};

export type LearnsetRow = {
  name: string;
  type?: string;
  power?: number;
  text?: string;
  source: "level-up" | "egg" | "machine" | "tutor" | "train" | "other";
  level?: number;
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

/** TCGdex sends "Pokemon". The rest of the app uses "Pokémon". Both are a Pokémon card. */
export function isPokemonSupertype(supertype?: string): boolean {
  const folded = (supertype || "").toLowerCase().replace(/é/g, "e");
  return folded === "pokemon";
}

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
  if (!isPokemonSupertype(card.supertype)) return { book: next, added: [], species: null };
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
    ...prev,
    species,
    types: prev.types.length ? prev.types : gameTypes(card.types),
    cardIds,
    moves,
  };
  return { book: next, added, species };
}

const GENERATED_MOVE = /^(?:Breeding|TM|Tutor|Train|Extra) move\.$/;

/**
 * Store the species schedule on a scanned card.
 * Printed attacks stay. Old dumped TM, tutor, and breeding rows come off the battle list.
 */
export function installCardLearnset(
  book: Record<string, ScannedFighter> | undefined,
  species: string,
  learnset: LearnsetRow[],
): Record<string, ScannedFighter> {
  const next: Record<string, ScannedFighter> = { ...(book || {}) };
  const clean = species.trim();
  const key = clean.toLowerCase();
  const prev = next[key] || {
    species: clean,
    types: ["Normal"],
    cardIds: [] as string[],
    moves: [] as ScannedMove[],
  };
  const effect = new Map<string, string>();
  const levelUps: LevelUpMove[] = [];
  const machines: string[] = [];
  for (const row of learnset) {
    const name = row.name?.trim();
    if (!name) continue;
    if (row.text?.trim()) effect.set(name.toLowerCase(), row.text.trim());
    if (row.source === "level-up") {
      levelUps.push({
        level: Math.max(1, row.level || 1),
        move: {
          name,
          type: row.type || "Normal",
          power: row.power || 0,
          pp: 20,
          maxPp: 20,
          description: "Level-up move.",
        },
      });
    } else if (row.source === "machine") machines.push(name);
  }
  levelUps.sort((a, b) => a.level - b.level || a.move.name.localeCompare(b.move.name));
  const printed = prev.moves.filter((move) => {
    const desc = (move.description || "").trim();
    if (GENERATED_MOVE.test(desc) || desc === "Level-up move.") return false;
    const known = effect.get(move.name.toLowerCase());
    return !(known && desc === known);
  });
  next[key] = {
    ...prev,
    species: prev.species || clean,
    moves: printed,
    levelUps,
    machines,
    taught: (prev.taught || []).map((move) => ({ ...move })),
  };
  return next;
}

/** Printed attacks, level-up moves learned by this level, and TMs taught from the bag. */
export function knownCardMoves(fighter: ScannedFighter, level: number): ScannedMove[] {
  if (!fighter.levelUps) return fighter.moves.map((move) => ({ ...move }));
  const ups = fighter.levelUps
    .filter((row) => row.level <= Math.max(1, level))
    .map((row) => ({ ...row.move }));
  return appendNamedMoves(appendNamedMoves(fighter.moves, ups), fighter.taught || []);
}

/** Level-up moves gained while going from oldLevel to newLevel on a scanned card. */
export function scheduledLevelUps(
  fighter: ScannedFighter | undefined,
  oldLevel: number,
  newLevel: number,
): ScannedMove[] {
  if (!fighter?.levelUps) return [];
  return fighter.levelUps
    .filter((row) => row.level > oldLevel && row.level <= newLevel)
    .map((row) => ({ ...row.move }));
}

/** A scanned card, when this name belongs to a species that was actually scanned. */
export function scannedSpecies(
  book: Record<string, ScannedFighter> | undefined,
  name: string,
): ScannedFighter | undefined {
  const fighter = book?.[speciesFromCardName(name).toLowerCase()];
  if (!fighter?.cardIds?.length) return undefined;
  return fighter;
}

/** Teach one TM move onto a scanned species that can learn it. */
export function teachMachineMove(
  book: Record<string, ScannedFighter> | undefined,
  species: string,
  move: ScannedMove,
): { book: Record<string, ScannedFighter>; added: boolean; reason: string } {
  const next: Record<string, ScannedFighter> = { ...(book || {}) };
  const key = species.trim().toLowerCase();
  const fighter = next[key];
  const name = move.name?.trim() || "";
  if (!fighter?.cardIds?.length || !name) {
    return { book: next, added: false, reason: `Scan a ${species} card before teaching a TM.` };
  }
  const allowed = (fighter.machines || []).some((entry) => entry.toLowerCase() === name.toLowerCase());
  if (!allowed) return { book: next, added: false, reason: `${fighter.species} cannot learn ${name}.` };
  const already = [...fighter.moves, ...(fighter.taught || []), ...(fighter.levelUps || []).map((row) => row.move)].some(
    (entry) => entry.name.toLowerCase() === name.toLowerCase(),
  );
  if (already) return { book: next, added: false, reason: `${fighter.species} already learns ${name}.` };
  next[key] = {
    ...fighter,
    taught: [
      ...(fighter.taught || []),
      { ...move, name, description: "TM move.", pp: move.pp || 15, maxPp: move.maxPp || 15 },
    ],
  };
  return { book: next, added: true, reason: `${fighter.species} learned ${name}.` };
}

/**
 * Add level-up and breeding moves onto a scanned species.
 * Names already printed on a card stay put. Nothing is cut to four.
 */
export function learnExtraMoves(
  book: Record<string, ScannedFighter> | undefined,
  species: string,
  moves: ScannedMove[],
): { book: Record<string, ScannedFighter>; added: string[]; species: string } {
  const next: Record<string, ScannedFighter> = { ...(book || {}) };
  const clean = species.trim();
  const key = clean.toLowerCase();
  const prev = next[key] || {
    species: clean,
    types: ["Normal"],
    cardIds: [] as string[],
    moves: [] as ScannedMove[],
  };
  const kept = prev.moves.map((m) => ({ ...m }));
  const added: string[] = [];
  for (const mv of moves) {
    const name = mv.name?.trim();
    if (!name) continue;
    const hit = kept.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (hit) {
      if (mv.description?.startsWith("Breeding") && !hit.description?.startsWith("Breeding")) {
        hit.description = "Breeding move.";
        hit.pp = mv.pp;
        hit.maxPp = mv.maxPp;
      }
      continue;
    }
    kept.push({ ...mv, name });
    added.push(name);
  }
  next[key] = { ...prev, species: prev.species || clean, moves: kept };
  return { book: next, added, species: prev.species || clean };
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
    if (hit.cardIds.length && hit.levelUps) return { ...mon, moves: knownCardMoves(hit, mon.level) };
    return { ...mon, moves: appendNamedMoves(mon.moves, hit.moves) };
  });
  const have = new Set(next.map((m) => m.species.toLowerCase()));
  for (const fighter of fighters) {
    if (next.length >= 6) break;
    if (have.has(fighter.species.toLowerCase())) continue;
    if (!fighter.moves.length) continue;
    const level = 20;
    const hp = Math.round(level * 4.2 + 25);
    const moves =
      fighter.cardIds.length && fighter.levelUps
        ? knownCardMoves(fighter, level)
        : fighter.moves.map((m) => ({ ...m }));
    next.push({
      name: fighter.species,
      species: fighter.species,
      level,
      maxHp: hp,
      currentHp: hp,
      types: fighter.types.length ? [...fighter.types] : ["Normal"],
      moves,
    } as T);
    have.add(fighter.species.toLowerCase());
  }
  return next;
}

export function scanLearnNote(card: PrintedCard, added: string[], species: string | null): string {
  if (!isPokemonSupertype(card.supertype) || !species) return "Added to your vault.";
  if (added.length > 6) {
    return `${added.length} moves added to ${species} in the adventure, from its level-up set.`;
  }
  if (added.length) return `${added.join(", ")} added to ${species} in the adventure.`;
  const printed = (card.attacks ?? []).some((a) => a.name?.trim());
  if (!printed) return `${species} joined the adventure.`;
  return `${species} already knows those moves.`;
}
