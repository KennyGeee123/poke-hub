import type { TCGCard, TCGSet } from "@/lib/pokemon-api";
import { setIdAliases } from "@/lib/set-ids";
import upcoming from "./upcoming-sets.json";

/**
 * Announced English sets that no catalog (TCGdex / pokemontcg.io) carries yet.
 * Only officially revealed cards ship (number, name, rarity, illustrator, art);
 * prices are never shipped, so tiles stay on the normal "—" / Pending state.
 *
 * Auto-upgrade, in this order:
 *  1. Sets list — the stub is only injected while no live set matches its ids
 *     (`liveIds` + pokemontcg/TCGdex aliases) or its name. When TCGdex English
 *     or pokemontcg.io lists the set, the live entry is what the user sees.
 *  2. Set cards — a set the live list already carries goes through the normal
 *     TCGdex/pokemontcg path (getAllCardsBySet never touches this list). While
 *     still unlisted, the revealed list paints first and TCGdex English is
 *     probed; any live cards win, revealed cards only fill numbers it lacks.
 *  3. Card detail — live lookups run first; this list is the last fallback.
 * Stubs carry `pvUpcoming` and are stripped before merging/caching, so a stale
 * IndexedDB copy can never shadow the live set. After release, delete the
 * entry in upcoming-sets.json and its public/card-art/<id> folder.
 */
type UpcomingCard = {
  number: string;
  name: string;
  rarity: string;
  supertype: string;
  subtypes?: string[];
  types?: string[];
  artist?: string;
  art: boolean;
  /** "ja" when the shipped scan is the Japanese print of the same illustration. */
  artLang?: string;
  artNote?: string;
};

type UpcomingSetDef = {
  id: string;
  liveIds: string[];
  name: string;
  fullName?: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  announcedTotal?: string;
  revealedAsOf?: string;
  logo: string;
  symbol: string;
  sources: string[];
  cards: UpcomingCard[];
};

export type UpcomingSetStub = TCGSet & { pvUpcoming: true };

const DEFS = (upcoming as { sets: UpcomingSetDef[] }).sets;

function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function idsFor(def: UpcomingSetDef): Set<string> {
  const out = new Set<string>();
  for (const id of [def.id, ...def.liveIds]) {
    for (const a of setIdAliases(id)) out.add(a.toLowerCase());
  }
  return out;
}

const ID_INDEX = new Map<string, UpcomingSetDef>();
for (const def of DEFS) for (const id of idsFor(def)) ID_INDEX.set(id, def);

function defFor(setId?: string | null): UpcomingSetDef | undefined {
  const id = (setId || "").trim().toLowerCase();
  return id ? ID_INDEX.get(id) : undefined;
}

/** Dates are stored as YYYY/MM/DD (pokemontcg style); parse as a local calendar day. */
function releaseTime(date: string): number {
  const m = (date || "").match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : NaN;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(date: string): string {
  const t = releaseTime(date);
  if (Number.isNaN(t)) return date;
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Ids whose live catalog entry has been seen in a sets list this session. */
const liveSeen = new Set<string>();

function stubFor(def: UpcomingSetDef): UpcomingSetStub {
  return {
    id: def.id,
    name: def.name,
    series: def.series,
    printedTotal: def.printedTotal,
    total: def.cards.length,
    releaseDate: def.releaseDate,
    lang: "en",
    images: { logo: def.logo, symbol: def.symbol },
    pvUpcoming: true,
  };
}

export function isUpcomingStub(s: unknown): s is UpcomingSetStub {
  return !!s && typeof s === "object" && (s as { pvUpcoming?: unknown }).pvUpcoming === true;
}

/** Stub sets for every announced set (no live check). */
export function upcomingSets(): UpcomingSetStub[] {
  return DEFS.map(stubFor);
}

function liveMatches(def: UpcomingSetDef, s: TCGSet): boolean {
  if (!s?.id || isUpcomingStub(s)) return false;
  const ids = idsFor(def);
  if (setIdAliases(s.id).some((a) => ids.has(a.toLowerCase()))) return true;
  const want = normName(def.name);
  const got = normName(s.name);
  return (
    !!got && (got === want || got.endsWith(` ${want}`) || got === normName(def.fullName || ""))
  );
}

/** True once a real catalog set for this upcoming id has been seen. */
export function upcomingSetIsLive(setId: string): boolean {
  const def = defFor(setId);
  return !!def && liveSeen.has(def.id);
}

function isPinnedSpecial(s: TCGSet): boolean {
  const id = (s.id || "").toLowerCase();
  return id === "base1sl" || id === "error";
}

/**
 * Strip stale stubs, then add each announced set the live list still lacks,
 * slotted by release date among the newest sets (pinned special sets stay first).
 * Non-English lists are returned unchanged.
 */
export function withUpcomingSets(sets: TCGSet[]): TCGSet[] {
  const out = sets.filter((s) => !isUpcomingStub(s));
  if (out.some((s) => s.lang && s.lang !== "en")) return out;
  for (const def of DEFS) {
    if (out.some((s) => liveMatches(def, s))) {
      liveSeen.add(def.id);
      continue;
    }
    const stub = stubFor(def);
    const when = releaseTime(def.releaseDate);
    let at = out.findIndex((s) => {
      if (isPinnedSpecial(s)) return false;
      const t = releaseTime(s.releaseDate);
      return !Number.isNaN(t) && t <= when;
    });
    if (at < 0) {
      // No dated set to slot before: go right after the pinned specials.
      at = out.findIndex((s) => !isPinnedSpecial(s));
      if (at < 0) at = out.length;
    }
    out.splice(at, 0, stub);
  }
  return out;
}

/** "Upcoming · Nov 6" before release, "Released Nov 6 · list pending" after (until live data lands). */
export function upcomingSetBadge(set: Pick<TCGSet, "id"> | null | undefined, now = Date.now()) {
  const def = defFor(set?.id);
  if (!def || !isUpcomingStub(set)) return null;
  const day = shortDate(def.releaseDate);
  const released = now >= releaseTime(def.releaseDate);
  return {
    label: released ? `Released ${day} · list pending` : `Upcoming · ${day}`,
    revealed: def.cards.length,
    withArt: def.cards.filter((c) => c.art).length,
    japaneseArt: def.cards.filter((c) => c.art && c.artLang === "ja").length,
    announcedTotal: def.announcedTotal || "",
    revealedAsOf: def.revealedAsOf || "",
    released,
  };
}

function cardsFor(def: UpcomingSetDef): TCGCard[] {
  const set = stubFor(def);
  return def.cards.map((c) => {
    const base = `/card-art/${def.id}/${c.number}`;
    return {
      id: `${def.id}-${c.number}`,
      name: c.name,
      lang: "en",
      supertype: c.supertype,
      subtypes: c.subtypes,
      types: c.types,
      rarity: c.rarity,
      number: c.number,
      printedNumber: `${c.number}/${def.printedTotal}`,
      artist: c.artist,
      set: {
        id: set.id,
        name: set.name,
        series: set.series,
        printedTotal: set.printedTotal,
        total: set.total,
        releaseDate: set.releaseDate,
        images: set.images,
      },
      images: c.art
        ? { small: `${base}.webp`, large: `${base}_hires.webp` }
        : { small: "", large: "" },
    } satisfies TCGCard;
  });
}

const cardCache = new Map<string, TCGCard[]>();

/** Revealed cards for an upcoming set id (any alias), or null for every other set. */
export function getUpcomingSetCards(setId: string): TCGCard[] | null {
  const def = defFor(setId);
  if (!def) return null;
  let list = cardCache.get(def.id);
  if (!list) {
    list = cardsFor(def);
    cardCache.set(def.id, list);
  }
  return list;
}

/** The revealed card for an id like me06-084 / me6-84, if any. */
export function getUpcomingCard(id: string): TCGCard | undefined {
  const m = (id || "").trim().match(/^(.+)-(\d+[a-z]?)$/i);
  if (!m) return undefined;
  const list = getUpcomingSetCards(m[1]);
  if (!list) return undefined;
  const want = m[2].replace(/^0+(?=\d)/, "").toLowerCase();
  return list.find((c) => (c.number || "").replace(/^0+(?=\d)/, "").toLowerCase() === want);
}

/** The TCGdex English id to probe for a published version of this upcoming set. */
export function upcomingLiveTcgdexId(setId: string): string | null {
  const def = defFor(setId);
  return def ? def.liveIds[0] || def.id : null;
}
