import type { TCGCard } from "./pokemon-api";

export type BattleCard = {
  card: TCGCard;
  hp: number;
  maxHp: number;
  damage: number;
  energies: string[];     // attached energy types
  uid: string;
};

export type Side = "player" | "ai";

export type PlayerState = {
  hand: TCGCard[];
  deck: TCGCard[];
  prizes: TCGCard[];
  discard: TCGCard[];
  active: BattleCard | null;
  bench: BattleCard[];
  attacked: boolean;
};

export type GameState = {
  phase: "setup" | "playerTurn" | "aiTurn" | "gameOver";
  turn: number;
  winner: Side | null;
  player: PlayerState;
  ai: PlayerState;
  log: string[];
};

export const TYPE_COLOR: Record<string, string> = {
  Fire: "#ef4444", Water: "#38bdf8", Grass: "#22c55e", Lightning: "#eab308",
  Psychic: "#a855f7", Fighting: "#f97316", Darkness: "#6366f1", Metal: "#94a3b8",
  Fairy: "#ec4899", Dragon: "#fb923c", Colorless: "#9ca3af",
};
export const tc = (t: string) => TYPE_COLOR[t] || "#9ca3af";

export const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

const parseDmg = (s?: string) => {
  const n = parseInt((s || "").replace(/\D/g, ""));
  return isNaN(n) ? 0 : n;
};

export function makeBattleCard(card: TCGCard): BattleCard {
  const hp = parseInt(card.hp || "") || 80;
  return { card, hp, maxHp: hp, damage: 0, energies: [], uid: `${card.id}-${Math.random().toString(36).slice(2)}` };
}

export function makePlayerState(deck: TCGCard[]): PlayerState {
  const d = shuffle(deck);
  return {
    hand: d.splice(0, 7),
    prizes: d.splice(0, 6),
    deck: d,
    discard: [],
    active: null,
    bench: [],
    attacked: false,
  };
}

export function calcDamage(attCard: TCGCard, defCard: TCGCard, atkIdx = 0): number {
  const atk = attCard.attacks?.[atkIdx];
  if (!atk) return 0;
  let dmg = parseDmg(atk.damage);
  const weak = defCard.weaknesses?.find(w => attCard.types?.includes(w.type));
  if (weak) dmg *= 2;
  const resist = defCard.resistances?.find(r => attCard.types?.includes(r.type));
  if (resist) dmg = Math.max(0, dmg - 30);
  return dmg;
}

export function bestAttackIdx(att: BattleCard, def: BattleCard): number {
  if (!att?.card?.attacks?.length) return 0;
  let best = 0, bestDmg = -1;
  att.card.attacks.forEach((_, i) => {
    const d = calcDamage(att.card, def.card, i);
    if (d > bestDmg) { bestDmg = d; best = i; }
  });
  return best;
}

export function applyAttack(gs: GameState, side: Side, atkIdx: number): GameState {
  const g: GameState = JSON.parse(JSON.stringify(gs));
  const att = g[side], def = side === "player" ? g.ai : g.player;
  if (!att.active || !def.active) return g;
  const dmg = calcDamage(att.active.card, def.active.card, atkIdx);
  const atkName = att.active.card.attacks?.[atkIdx]?.name || "Attack";
  def.active.damage += dmg;
  def.active.hp = Math.max(0, def.active.maxHp - def.active.damage);
  const who = side === "player" ? "▶ YOU" : "🤖 AI";
  g.log.unshift(`${who}: ${att.active.card.name} → ${atkName} → ${dmg} DMG`);
  att.attacked = true;
  if (def.active.hp <= 0) {
    g.log.unshift(`💥 ${def.active.card.name} KO'd!`);
    def.discard.push(def.active.card);
    def.active = null;
    if (att.prizes.length > 0) {
      att.hand.push(att.prizes.pop()!);
      g.log.unshift(`🏆 ${side === "player" ? "You" : "AI"} takes a prize! (${att.prizes.length} left)`);
    }
    if (att.prizes.length === 0) {
      g.phase = "gameOver"; g.winner = side;
      g.log.unshift(`🎉 ${side === "player" ? "YOU WIN!" : "AI WINS!"}`);
    } else if (!def.bench.length) {
      g.phase = "gameOver"; g.winner = side;
      g.log.unshift(`🎉 ${side === "player" ? "YOU WIN!" : "AI WINS!"} — no Pokémon left!`);
    } else {
      def.active = def.bench.shift()!;
      g.log.unshift(`${side === "player" ? "AI promotes" : "You promote"} ${def.active.card.name}!`);
    }
  }
  return g;
}

export function isPlayablePokemon(c: TCGCard): boolean {
  return c.supertype === "Pokémon" && parseInt(c.hp || "") > 0 && !!c.attacks?.length;
}

/* ──────────────── ERAS ──────────────── */
export type Era = {
  id: string;
  name: string;
  years: string;
  series: string[]; // matches TCG API `set.series`
  blurb: string;
};

export const ERAS: Era[] = [
  { id: "all",      name: "All Eras",       years: "1999 – Now", series: [],
    blurb: "Pull from every era — chaos mode." },
  { id: "classic",  name: "Classic WOTC",   years: "1999 – 2003", series: ["Base","Gym","Neo","Legendary Collection","E-Card"],
    blurb: "Base, Jungle, Fossil, Team Rocket, Neo, Gym — the originals." },
  { id: "ex",       name: "EX Era",         years: "2003 – 2007", series: ["EX"],
    blurb: "Ruby & Sapphire through Power Keepers. Pokémon-ex dominate." },
  { id: "dp",       name: "Diamond & Pearl",years: "2007 – 2011", series: ["Diamond & Pearl","Platinum","HeartGold & SoulSilver","Call of Legends"],
    blurb: "LV.X, SP cards, Legend pieces." },
  { id: "bw",       name: "Black & White",  years: "2011 – 2013", series: ["Black & White"],
    blurb: "EX returns, Plasma storyline, ACE SPECs." },
  { id: "xy",       name: "XY",             years: "2014 – 2016", series: ["XY"],
    blurb: "Mega Evolution, Fairy type, BREAK cards." },
  { id: "sm",       name: "Sun & Moon",     years: "2017 – 2019", series: ["Sun & Moon"],
    blurb: "GX Pokémon, Tag Team, Prism Stars." },
  { id: "swsh",     name: "Sword & Shield", years: "2020 – 2022", series: ["Sword & Shield"],
    blurb: "VMAX, VSTAR, Radiant, Galar region." },
  { id: "sv",       name: "Scarlet & Violet",years: "2023 – Now", series: ["Scarlet & Violet"],
    blurb: "ex Pokémon return, Tera types, Paldea." },
];

export function eraSeriesQuery(era: Era): string {
  if (!era.series.length) return "";
  return "(" + era.series.map(s => `set.series:"${s}"`).join(" OR ") + ")";
}

/* ──────────────── TRAINER & ENERGY ──────────────── */
export function isPlayableInHand(c: TCGCard): boolean {
  return c.supertype === "Pokémon" || c.supertype === "Trainer" || c.supertype === "Energy";
}

export function isBasicEnergy(c: TCGCard): boolean {
  return c.supertype === "Energy" && (c.subtypes?.includes("Basic") ?? true);
}

export function energyTypeOf(c: TCGCard): string {
  // "Fire Energy" → "Fire"
  const n = (c.name || "").replace(/\s*Energy\s*$/i, "").trim();
  return n || "Colorless";
}

export type TrainerEffect =
  | { kind: "potion"; heal: number }
  | { kind: "draw"; count: number }
  | { kind: "switch" }
  | { kind: "energy"; type: string }
  | { kind: "none" };

export function classifyTrainer(c: TCGCard): TrainerEffect {
  if (c.supertype === "Energy") return { kind: "energy", type: energyTypeOf(c) };
  const name = (c.name || "").toLowerCase();
  const text = ((c.attacks ?? []).map(a => a.text).join(" ") + " " + (c.abilities ?? []).map(a => a.text).join(" ")).toLowerCase();
  if (/potion|heal/.test(name) || /remove .* damage/.test(text)) {
    if (/super potion/.test(name)) return { kind: "potion", heal: 60 };
    if (/max potion/.test(name)) return { kind: "potion", heal: 999 };
    return { kind: "potion", heal: 30 };
  }
  if (/professor|research|draw|hau|cynthia|marnie|iono|sonia|bianca|colress|sycamore|juniper/.test(name)) {
    return { kind: "draw", count: 3 };
  }
  if (/switch|escape rope/.test(name)) return { kind: "switch" };
  return { kind: "draw", count: 1 };
}

/* ──────────────── EFFECT APPLIERS ──────────────── */
export function applyEnergy(gs: GameState, side: Side, handIdx: number): GameState {
  const g: GameState = JSON.parse(JSON.stringify(gs));
  const p = g[side];
  const card = p.hand[handIdx];
  if (!card || card.supertype !== "Energy" || !p.active) return gs;
  p.hand.splice(handIdx, 1);
  p.active.energies.push(energyTypeOf(card));
  p.discard.push(card);
  g.log.unshift(`${side === "player" ? "▶ You" : "🤖 AI"} attached ${card.name} to ${p.active.card.name}.`);
  return g;
}

export function applyTrainer(gs: GameState, side: Side, handIdx: number): GameState {
  const g: GameState = JSON.parse(JSON.stringify(gs));
  const p = g[side];
  const card = p.hand[handIdx];
  if (!card || card.supertype !== "Trainer") return gs;
  const eff = classifyTrainer(card);
  p.hand.splice(handIdx, 1);
  p.discard.push(card);
  const who = side === "player" ? "▶ You" : "🤖 AI";
  if (eff.kind === "potion" && p.active) {
    const heal = Math.min(eff.heal, p.active.damage);
    p.active.damage -= heal;
    p.active.hp = Math.max(0, p.active.maxHp - p.active.damage);
    g.log.unshift(`${who} used ${card.name} → healed ${heal} HP.`);
  } else if (eff.kind === "draw") {
    let drew = 0;
    for (let i = 0; i < eff.count; i++) {
      if (p.deck.length === 0) break;
      p.hand.push(p.deck.shift()!); drew++;
    }
    g.log.unshift(`${who} played ${card.name} → drew ${drew}.`);
  } else if (eff.kind === "switch" && p.bench.length && p.active) {
    const swap = p.bench.shift()!;
    p.bench.push(p.active);
    p.active = swap;
    g.log.unshift(`${who} switched to ${p.active.card.name}.`);
  } else {
    g.log.unshift(`${who} played ${card.name}.`);
  }
  return g;
}

/** Clamped HP percentage; never NaN, never divides by zero. */
export function hpPct(cur: number, max: number): number {
  const c = Number.isFinite(cur) ? cur : 0;
  const m = Number.isFinite(max) && max > 0 ? max : 1;
  return Math.max(0, Math.min(100, (c / m) * 100));
}
