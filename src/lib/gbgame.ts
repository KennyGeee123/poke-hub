import { supabase } from "@/integrations/supabase/client";
import type { TCGCard } from "./pokemon-api";
import { animatedSpriteUrl, staticSpriteUrl } from "./sprites";
import { healAllHp } from "./gb-hp";
import { appendNamedMoves, isPokemonSupertype, speciesFromCardName } from "./card-moves";

export type GBMove = {
  name: string;
  damage: number;
  text?: string;
  type?: string;
};

export type GBMon = {
  id: string;
  card_id: string;
  name: string;
  types: string[];
  level: number;
  xp: number;
  max_hp: number;
  attacks: GBMove[];
  sprite_url: string | null;
  image_url: string | null;
  wins: number;
  losses: number;
  slot: number | null;
};

const LS_PARTY = "pv.gb.party.v1";

export function isDittoName(name: string): boolean {
  const slug = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug === "ditto" || slug.startsWith("ditto-");
}

/** Copies the foe's moves, then the turn ends. Power stays 0 so it is not a hit. */
export const TRANSFORM_MOVE: GBMove = {
  name: "Transform",
  damage: 0,
  type: "Normal",
  text: "Ditto copies the other fighter's moves. This turn ends.",
};

export function speciesMoves(name: string, level: number, type = "Colorless"): GBMove[] {
  if (isDittoName(name)) return [{ ...TRANSFORM_MOVE }];
  const lvl = Math.max(2, Math.min(60, level || 5));
  return [
    { name: "Tackle", damage: 8 + lvl, type: type || "Colorless" },
    { name: "Scratch", damage: 10 + lvl, type: "Colorless" },
  ];
}

/** Moves Ditto keeps after Transform. Another Transform is left out so it cannot loop. */
export function attacksAfterTransform(source: GBMove[]): GBMove[] {
  const copied = source
    .filter((m) => m.name.toLowerCase() !== "transform")
    .map((m) => ({ ...m }));
  if (copied.length) return copied;
  return [{ name: "Struggle", damage: 10, type: "Normal", text: "A last-ditch hit." }];
}

const parseDmg = (s?: string) => {
  const n = parseInt((s || "").replace(/\D/g, ""));
  return isNaN(n) ? 0 : n;
};

export function movesFromCard(card: TCGCard): GBMove[] {
  const atks = (card.attacks ?? []).map((a) => ({
    name: a.name,
    damage: parseDmg(a.damage) || 10,
    text: a.text,
    type: card.types?.[0],
  }));
  if (!atks.length) {
    atks.push({ name: "Tackle", damage: 10, text: undefined, type: card.types?.[0] });
  }
  return atks;
}

export function baseHpFromCard(card: TCGCard): number {
  const hp = parseInt(card.hp || "") || 60;
  return Math.max(30, Math.min(200, hp));
}

/** In-memory fighter so grass battles work with no party and no TCG API. */
export function rentalStarter(name = "Pikachu"): GBMon {
  const sprite = animatedSpriteUrl(name);
  return {
    id: "rental-starter",
    card_id: "rental",
    name,
    types: name === "Charmander" ? ["Fire"] : name === "Squirtle" ? ["Water"] : ["Lightning"],
    level: 5,
    xp: 0,
    max_hp: 48,
    attacks: [
      {
        name: name === "Charmander" ? "Ember" : name === "Squirtle" ? "Water Gun" : "Thunder Shock",
        damage: 20,
        type: name === "Charmander" ? "Fire" : name === "Squirtle" ? "Water" : "Lightning",
      },
      { name: "Tackle", damage: 10, type: "Colorless" },
    ],
    sprite_url: sprite,
    image_url: sprite,
    wins: 0,
    losses: 0,
    slot: 0,
  };
}

export function wildFoeMon(name: string, level: number): GBMon {
  const sprite = animatedSpriteUrl(name);
  const lvl = Math.max(2, Math.min(60, level || 5));
  return {
    id: "wild",
    card_id: "wild",
    name,
    types: ["Colorless"],
    level: lvl,
    xp: 0,
    max_hp: Math.round(36 + lvl * 4),
    attacks: speciesMoves(name, lvl),
    sprite_url: sprite,
    image_url: sprite,
    wins: 0,
    losses: 0,
    slot: null,
  };
}

export function makeMonFromCard(card: TCGCard, level = 5): Omit<GBMon, "id"> {
  const baseHp = baseHpFromCard(card);
  return {
    card_id: card.id,
    name: card.name,
    types: card.types ?? ["Colorless"],
    level,
    xp: 0,
    max_hp: Math.round(baseHp * (0.5 + level * 0.05)),
    attacks: movesFromCard(card),
    sprite_url: animatedSpriteUrl(card.name),
    image_url: animatedSpriteUrl(card.name),
    wins: 0,
    losses: 0,
    slot: null,
  };
}

export function xpForNext(level: number): number {
  return level * 50;
}

export function levelDamage(
  move: GBMove,
  attackerLvl: number,
  defenderTypes: string[],
  attackerTypes: string[],
): { dmg: number; eff: "normal" | "super" | "weak" } {
  let dmg = Math.round(move.damage * (0.8 + attackerLvl * 0.04));
  // Use crude type matchup: shared type → weak, fire vs grass etc → super
  let eff: "normal" | "super" | "weak" = "normal";
  if (defenderTypes.some((t) => attackerTypes.includes(t))) {
    dmg = Math.round(dmg * 0.5);
    eff = "weak";
  } else if (TYPE_ADV[attackerTypes[0]]?.includes(defenderTypes[0])) {
    dmg = Math.round(dmg * 2);
    eff = "super";
  }
  return { dmg: Math.max(1, dmg), eff };
}

const TYPE_ADV: Record<string, string[]> = {
  Fire: ["Grass", "Metal"],
  Water: ["Fire", "Fighting"],
  Grass: ["Water"],
  Lightning: ["Water"],
  Psychic: ["Fighting"],
  Fighting: ["Darkness", "Colorless"],
  Darkness: ["Psychic"],
  Metal: ["Fairy", "Psychic"],
  Fairy: ["Darkness", "Dragon"],
  Dragon: ["Dragon"],
};

export function gainXP(mon: GBMon, gained: number): { mon: GBMon; leveled: boolean } {
  let xp = mon.xp + gained;
  let level = mon.level;
  let max_hp = mon.max_hp;
  let leveled = false;
  while (xp >= xpForNext(level)) {
    xp -= xpForNext(level);
    level += 1;
    max_hp += Math.round(5 + Math.random() * 6);
    leveled = true;
  }
  return { mon: { ...mon, xp, level, max_hp }, leveled };
}

/* ---------- Persistence (guest localStorage · signed-in supabase) ---------- */

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function newGuestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `gb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readLocalParty(): GBMon[] {
  try {
    const raw = localStorage.getItem(LS_PARTY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Replace one species' attacks with the scanned card's current choices. */
export async function replaceSpeciesMovesOnParty(species: string, moves: GBMove[]): Promise<void> {
  const key = species.trim().toLowerCase();
  if (!key) return;
  const party = await fetchParty();
  const next: GBMon[] = [];
  const dirty: GBMon[] = [];
  for (const mon of party) {
    const names = [speciesFromCardName(mon.name).toLowerCase(), mon.name.toLowerCase()];
    if (!names.includes(key)) {
      next.push(mon);
      continue;
    }
    const attacks = moves.map((move) => ({ ...move }));
    const same =
      attacks.length === mon.attacks.length &&
      attacks.every((move, i) => move.name.toLowerCase() === mon.attacks[i]?.name.toLowerCase());
    if (same) {
      next.push(mon);
      continue;
    }
    const updated = { ...mon, attacks };
    next.push(updated);
    dirty.push(updated);
  }
  if (!dirty.length) return;
  const uid = await currentUserId();
  if (!uid) {
    writeLocalParty(next);
    return;
  }
  for (const mon of dirty) await saveMonStats(mon);
}

/** Append a species' moves onto the matching party member. Earlier moves stay. */
export async function appendSpeciesMovesToParty(species: string, extra: GBMove[]): Promise<void> {
  const key = species.trim().toLowerCase();
  if (!key || !extra.length) return;
  const party = await fetchParty();
  const next: GBMon[] = [];
  const dirty: GBMon[] = [];
  for (const mon of party) {
    const names = [speciesFromCardName(mon.name).toLowerCase(), mon.name.toLowerCase()];
    if (!names.includes(key)) {
      next.push(mon);
      continue;
    }
    const attacks = appendNamedMoves(mon.attacks, extra);
    if (attacks.length === mon.attacks.length) {
      next.push(mon);
      continue;
    }
    const updated = { ...mon, attacks };
    next.push(updated);
    dirty.push(updated);
  }
  if (!dirty.length) return;
  const uid = await currentUserId();
  if (!uid) {
    writeLocalParty(next);
    return;
  }
  for (const mon of dirty) await saveMonStats(mon);
}

function writeLocalParty(party: GBMon[]): void {
  try {
    localStorage.setItem(LS_PARTY, JSON.stringify(party));
  } catch {
    /* quota / private mode */
  }
}

function rowToMon(r: any): GBMon {
  return {
    id: r.id,
    card_id: r.card_id,
    name: r.name,
    types: r.types ?? [],
    level: r.level,
    xp: r.xp,
    max_hp: r.max_hp,
    attacks: r.attacks ?? [],
    sprite_url: r.sprite_url,
    image_url: r.image_url,
    wins: r.wins,
    losses: r.losses,
    slot: r.slot,
  };
}

export async function fetchParty(): Promise<GBMon[]> {
  const uid = await currentUserId();
  if (!uid) return readLocalParty();
  const { data, error } = await supabase
    .from("gb_party")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToMon);
}

export function makeMonFromSpecies(
  name: string,
  level = 5,
  types: string[] = ["Colorless"],
): Omit<GBMon, "id"> {
  const sprite = animatedSpriteUrl(name);
  const lvl = Math.max(2, Math.min(60, level || 5));
  return {
    card_id: `species:${name.toLowerCase()}`,
    name,
    types: types.length ? types : ["Colorless"],
    level: lvl,
    xp: 0,
    max_hp: Math.round(36 + lvl * 4),
    attacks: speciesMoves(name, lvl, types[0] || "Colorless"),
    sprite_url: sprite,
    image_url: sprite,
    wins: 0,
    losses: 0,
    slot: null,
  };
}

export async function addSpeciesToParty(
  name: string,
  level = 5,
  types: string[] = ["Colorless"],
): Promise<GBMon> {
  const m = makeMonFromSpecies(name, level, types);
  const uid = await currentUserId();
  if (!uid) {
    const mon: GBMon = { ...m, id: newGuestId() };
    writeLocalParty([...readLocalParty(), mon]);
    return mon;
  }
  const { data, error } = await supabase
    .from("gb_party")
    .insert({ ...m, user_id: uid })
    .select()
    .single();
  if (error) throw error;
  return { ...m, id: data.id } as GBMon;
}

/**
 * A scanned card joins that species. Printed attacks are appended.
 * A second Pikachu card does not open a second party slot.
 */
export async function mergeCardMoves(
  card: TCGCard,
  level = 50,
  extra: GBMove[] = [],
): Promise<GBMon | null> {
  if (!isPokemonSupertype(card.supertype)) return null;
  const species = speciesFromCardName(card.name);
  const party = await fetchParty();
  const printed = (card.attacks ?? []).length ? movesFromCard(card) : [];
  const incoming = appendNamedMoves(printed, extra);
  const existing = party.find(
    (m) =>
      m.card_id === card.id ||
      speciesFromCardName(m.name).toLowerCase() === species.toLowerCase(),
  );
  if (!existing) {
    const mon = await addToParty(card, level);
    const attacks = appendNamedMoves(mon.attacks, extra);
    if (attacks.length === mon.attacks.length) return mon;
    const next = { ...mon, attacks };
    await saveMonStats(next);
    return next;
  }
  const attacks = appendNamedMoves(existing.attacks, incoming);
  if (attacks.length === existing.attacks.length) return existing;
  const next = { ...existing, attacks };
  await saveMonStats(next);
  return next;
}

export async function addToParty(card: TCGCard, level = 5): Promise<GBMon> {
  const m = makeMonFromCard(card, level);
  const uid = await currentUserId();
  if (!uid) {
    const mon: GBMon = { ...m, id: newGuestId() };
    writeLocalParty([...readLocalParty(), mon]);
    return mon;
  }
  const { data, error } = await supabase
    .from("gb_party")
    .insert({ ...m, user_id: uid })
    .select()
    .single();
  if (error) throw error;
  return { ...m, id: data.id } as GBMon;
}

export async function saveMonStats(mon: GBMon): Promise<void> {
  const uid = await currentUserId();
  if (!uid) {
    writeLocalParty(readLocalParty().map((x) => (x.id === mon.id ? { ...x, ...mon } : x)));
    return;
  }
  const { error } = await supabase
    .from("gb_party")
    .update({
      level: mon.level,
      xp: mon.xp,
      max_hp: mon.max_hp,
      wins: mon.wins,
      losses: mon.losses,
      attacks: mon.attacks as any,
    })
    .eq("id", mon.id);
  if (error) throw error;
}

/** Restore party to full health (Poké Center / white-out). Clears carried-over battle HP. */
export async function healParty(): Promise<GBMon[]> {
  healAllHp();
  const party = await fetchParty();
  const healed = party.map((m) => ({ ...m }));
  const uid = await currentUserId();
  if (!uid) {
    writeLocalParty(healed);
    return healed;
  }
  for (const m of healed) {
    try {
      await saveMonStats(m);
    } catch (e) {
      console.error(e);
    }
  }
  return healed;
}

export async function releaseMon(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) {
    writeLocalParty(readLocalParty().filter((x) => x.id !== id));
    return;
  }
  await supabase.from("gb_party").delete().eq("id", id);
}

export function spriteFor(name: string): string {
  return staticSpriteUrl(name);
}
