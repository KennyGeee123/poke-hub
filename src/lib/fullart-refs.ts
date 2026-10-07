// Locked references for Full Art Studio. The renderer reads these before it paints.
// Artist locks are the house looks of the current full-art line and the styles
// beside it. Generation locks are the banner plates of each TCG era.

import type { TCGCard } from "./pokemon-api";

export const FULLART_REF_VERSION = "fa-refs-1";

export type FullArtGeneration = "auto" | "sv" | "swsh" | "sm" | "xy" | "bw" | "classic";
export type LockedGeneration = Exclude<FullArtGeneration, "auto">;

export type ArtistStyleId = "faithful" | "storybook" | "chibi" | "neon";

export type MetalStops = readonly (readonly [number, string])[];

export type GenerationRef = {
  id: LockedGeneration;
  label: string;
  /** Short label for the tab button. */
  tab: string;
  /** What this plate is copied from. */
  lockedFrom: string;
  plate: "swoosh" | "bar";
  metal: MetalStops;
  edge: "silver" | "gold" | "steel";
};

export type ArtistRef = {
  id: ArtistStyleId;
  label: string;
  hint: string;
  /** Illustrators this treatment is locked to. */
  lockedFrom: string;
  /** Extra canvas filter applied on top of the type silk. */
  filter: string;
  subjectScale: number;
  /** Radial mask radius as a fraction of the subject bitmap width. */
  mask: number;
  /** Vertical placement of the subject, fraction of card height. */
  dy: number;
  grain: number;
  neon: boolean;
};

const SILVER: MetalStops = [
  [0, "#fcfcfd"],
  [0.35, "#d5d9e1"],
  [0.55, "#f7f8fa"],
  [0.82, "#b7bdc6"],
  [1, "#8e949e"],
];

const COOL: MetalStops = [
  [0, "#f4f7fb"],
  [0.4, "#c5d0dc"],
  [0.62, "#eef3f8"],
  [1, "#7f8b9a"],
];

const GOLD: MetalStops = [
  [0, "#fff6d2"],
  [0.38, "#e2b53a"],
  [0.58, "#fff1b8"],
  [1, "#8a5a12"],
];

const STEEL: MetalStops = [
  [0, "#e7eef6"],
  [0.4, "#9eb0c4"],
  [0.6, "#d5dee8"],
  [1, "#5c6b7c"],
];

/** Banner plate for each era. Auto resolves from the card's set before paint. */
export const GENERATION_REFS: Record<LockedGeneration, GenerationRef> = {
  sv: {
    id: "sv",
    label: "Scarlet & Violet",
    tab: "SV",
    lockedFrom: "Black Bolt Ultra Rare silk plate, N-DESIGN / PLANETA name swoosh",
    plate: "swoosh",
    metal: SILVER,
    edge: "silver",
  },
  swsh: {
    id: "swsh",
    label: "Sword & Shield",
    tab: "SWSH",
    lockedFrom: "V / VMAX full-art bar: cool silver strip, straight ends",
    plate: "bar",
    metal: COOL,
    edge: "silver",
  },
  sm: {
    id: "sm",
    label: "Sun & Moon",
    tab: "SM",
    lockedFrom: "GX full-art bar: bright silver with a dark lower lip",
    plate: "bar",
    metal: SILVER,
    edge: "silver",
  },
  xy: {
    id: "xy",
    label: "XY",
    tab: "XY",
    lockedFrom: "XY EX full-art plate: warm gold swoosh",
    plate: "swoosh",
    metal: GOLD,
    edge: "gold",
  },
  bw: {
    id: "bw",
    label: "Black & White",
    tab: "BW",
    lockedFrom: "BW full-art EX plate: steel-blue bar",
    plate: "bar",
    metal: STEEL,
    edge: "steel",
  },
  classic: {
    id: "classic",
    label: "Classic",
    tab: "Classic",
    lockedFrom: "Pre-full-art eras: a gold plate, no fake modern rule",
    plate: "swoosh",
    metal: GOLD,
    edge: "gold",
  },
};

export const GENERATION_TABS: FullArtGeneration[] = [
  "auto",
  "sv",
  "swsh",
  "sm",
  "xy",
  "bw",
  "classic",
];

export const GENERATION_TAB_LABEL: Record<FullArtGeneration, string> = {
  auto: "Auto",
  sv: "SV",
  swsh: "SWSH",
  sm: "SM",
  xy: "XY",
  bw: "BW",
  classic: "Classic",
};

/**
 * Artist treatments. Faithful is the measured silk (hue 150).
 * The others are locked grades of that same plate, not a new scene.
 */
export const ARTIST_REFS: Record<ArtistStyleId, ArtistRef> = {
  faithful: {
    id: "faithful",
    label: "Faithful",
    hint: "N-DESIGN / PLANETA line",
    lockedFrom: "Measured Serperior Ultra Rare silk, hue 150, crisp cel",
    filter: "contrast(1.06)",
    subjectScale: 1.28,
    mask: 0.36,
    dy: 0.08,
    grain: 0.05,
    neon: false,
  },
  storybook: {
    id: "storybook",
    label: "Illustration",
    hint: "sui / kantaro gouache",
    lockedFrom: "Illustration Rare painters: softer edges, lower saturation",
    filter: "saturate(0.82) contrast(0.96)",
    subjectScale: 1.2,
    mask: 0.44,
    dy: 0.09,
    grain: 0.14,
    neon: false,
  },
  chibi: {
    id: "chibi",
    label: "Chibi",
    hint: "Rounder, bigger face",
    lockedFrom: "Chibi full-art grade: larger head, tighter round mask",
    filter: "saturate(1.12) contrast(1.04)",
    subjectScale: 1.48,
    mask: 0.3,
    dy: 0.02,
    grain: 0.03,
    neon: false,
  },
  neon: {
    id: "neon",
    label: "Neon",
    hint: "Magenta and cyan rim",
    lockedFrom: "Neon rim light on the same silk, creature colours kept",
    filter: "saturate(1.28) contrast(1.08)",
    subjectScale: 1.28,
    mask: 0.36,
    dy: 0.08,
    grain: 0.04,
    neon: true,
  },
};

export function resolveFullArtGeneration(
  card: TCGCard,
  pick: FullArtGeneration | undefined,
): LockedGeneration {
  if (pick && pick !== "auto") return pick;
  const s = `${card.set?.series || ""} ${card.set?.id || ""} ${card.set?.name || ""}`.toLowerCase();
  if (/scarlet|violet|(^|[^a-z])sv\d?/.test(s)) return "sv";
  if (/sword|shield|swsh/.test(s)) return "swsh";
  if (/sun\s*&?\s*moon|(^|[^a-z])sm\d?/.test(s)) return "sm";
  if (/(^|[^a-z])xy([^a-z]|$)/.test(s)) return "xy";
  if (/black\s*&?\s*white|(^|[^a-z])bw\d?/.test(s)) return "bw";
  return "classic";
}

export type CardRule = { cap: string; body: string };

/** The rule banner follows the card's real mechanic, not a fake label. */
export function cardRule(card: TCGCard): CardRule | null {
  const n = card.name;
  if (/\bVMAX\b/.test(n)) {
    return {
      cap: "VMAX rule",
      body: "When your Pokémon VMAX is Knocked Out, your opponent takes 3 Prize cards.",
    };
  }
  if (/\bVSTAR\b/.test(n)) {
    return {
      cap: "VSTAR rule",
      body: "When your Pokémon VSTAR is Knocked Out, your opponent takes 2 Prize cards.",
    };
  }
  if (/\bV\b/.test(n)) {
    return {
      cap: "V rule",
      body: "When your Pokémon V is Knocked Out, your opponent takes 2 Prize cards.",
    };
  }
  if (/\bGX\b/.test(n)) {
    return {
      cap: "Pokémon-GX rule",
      body: "When your Pokémon-GX is Knocked Out, your opponent takes 2 Prize cards.",
    };
  }
  if (/\bex\b/i.test(n) || (card.subtypes || []).some((s) => /^ex$/i.test(s))) {
    return {
      cap: "Pokémon ex rule",
      body: "When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards.",
    };
  }
  return null;
}
