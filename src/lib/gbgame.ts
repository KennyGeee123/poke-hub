import { supabase } from "@/integrations/supabase/client";
import type { TCGCard } from "./pokemon-api";
import { animatedSpriteUrl, staticSpriteUrl } from "./sprites";

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
  return atks.slice(0, 4);
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
      { name: name === "Charmander" ? "Ember" : name === "Squirtle" ? "Water Gun" : "Thunder Shock", damage: 20, type: name === "Charmander" ? "Fire" : name === "Squirtle" ? "Water" : "Lightning" },
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
    attacks: [
      { name: "Tackle", damage: 8 + lvl, type: "Colorless" },
      { name: "Scratch", damage: 10 + lvl, type: "Colorless" },
    ],
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

export function levelDamage(move: GBMove, attackerLvl: number, defenderTypes: string[], attackerTypes: string[]): { dmg: number; eff: "normal" | "super" | "weak" } {
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

export function makeMonFromSpecies(name: string, level = 5, types: string[] = ["Colorless"]): Omit<GBMon, "id"> {
  const sprite = animatedSpriteUrl(name);
  const lvl = Math.max(2, Math.min(60, level || 5));
  return {
    card_id: `species:${name.toLowerCase()}`,
    name,
    types: types.length ? types : ["Colorless"],
    level: lvl,
    xp: 0,
    max_hp: Math.round(36 + lvl * 4),
    attacks: [
      { name: "Tackle", damage: 8 + lvl, type: types[0] || "Colorless" },
      { name: "Scratch", damage: 10 + lvl, type: "Colorless" },
    ],
    sprite_url: sprite,
    image_url: sprite,
    wins: 0,
    losses: 0,
    slot: null,
  };
}

export async function addSpeciesToParty(name: string, level = 5, types: string[] = ["Colorless"]): Promise<GBMon> {
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


/** Restore party to full health (Poké Center). Battle HP is ephemeral; this clears fatigue markers and re-persists. */
export async function healParty(): Promise<GBMon[]> {
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
