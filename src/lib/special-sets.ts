import type { TCGCard, TCGSet } from "@/lib/pokemon-api";
import { parseSearchQuery } from "@/lib/card-search";
import shadowlessCatalog from "./shadowless-catalog.json";
import errorCatalog from "./error-catalog.json";

const BASE_LOGO = "https://images.pokemontcg.io/base1/logo.png";
const BASE_SYMBOL = "https://images.pokemontcg.io/base1/symbol.png";

export const SHADOWLESS_SET_ID = "base1sl";
export const ERROR_SET_ID = "error";

type ShadowlessRow = {
  productId: number;
  name: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
  url: string;
  market: number;
};

type ErrorRow = {
  id: string;
  name: string;
  parentSetId: string;
  number: string;
  errorType: string;
  rarity: string;
};

function setStub(
  id: string,
  name: string,
  series: string,
  total: number,
  releaseDate: string,
): TCGSet {
  return {
    id,
    name,
    series,
    printedTotal: total,
    total,
    releaseDate,
    lang: "en",
    images: { symbol: BASE_SYMBOL, logo: BASE_LOGO },
  };
}

function ptcgImg(setId: string, number: string): { small: string; large: string } {
  return {
    small: `https://images.pokemontcg.io/${setId}/${number}.png`,
    large: `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
  };
}

function shadowlessCards(): TCGCard[] {
  const rows = (shadowlessCatalog.cards as ShadowlessRow[]).slice();
  if (!rows.some((r) => r.number === "8")) {
    const img = ptcgImg("base1", "8");
    rows.splice(7, 0, {
      productId: 0,
      name: "Machamp",
      number: "8",
      rarity: "Holo Rare",
      imageSmall: img.small,
      imageLarge: img.large,
      url: "",
      market: 0,
    });
  }
  return rows.map((r) => {
    const parent = ptcgImg("base1", r.number);
    const extra = /\(/i.test(r.name);
    return {
      id: extra ? `${SHADOWLESS_SET_ID}-${r.number}rc` : `${SHADOWLESS_SET_ID}-${r.number}`,
      name: r.name,
      rarity: r.rarity?.toLowerCase().includes("shadowless") ? r.rarity : `Shadowless ${r.rarity || "Rare"}`.trim(),
      number: r.number,
      set: {
        id: SHADOWLESS_SET_ID,
        name: "Base Set (Shadowless)",
        series: "Base",
        printedTotal: 102,
        total: 102,
        releaseDate: "1999/01/09",
        images: { symbol: BASE_SYMBOL, logo: BASE_LOGO },
      },
      images: {
        small: r.imageSmall || parent.small,
        large: r.imageLarge || r.imageSmall || parent.large,
      },
      tcgplayer: r.market > 0 || r.url
        ? {
            url: r.url || undefined,
            prices: {
              [r.rarity.toLowerCase().includes("holo") ? "holofoil" : "normal"]: {
                market: r.market > 0 ? r.market : undefined,
              },
            },
          }
        : undefined,
    } satisfies TCGCard;
  });
}

function errorCards(): TCGCard[] {
  return (errorCatalog.cards as ErrorRow[]).map((r) => {
    const img = ptcgImg(r.parentSetId, r.number);
    return {
      id: r.id,
      name: r.name,
      rarity: `Error / Misprint · ${r.rarity}`,
      number: r.number,
      flavorText: r.errorType,
      set: {
        id: ERROR_SET_ID,
        name: "Error / Misprint Cards",
        series: "Special",
        printedTotal: errorCatalog.cards.length,
        total: errorCatalog.cards.length,
        releaseDate: "1999/01/09",
        images: { symbol: BASE_SYMBOL, logo: BASE_LOGO },
      },
      images: img,
    } satisfies TCGCard;
  });
}

let _sl: TCGCard[] | null = null;
let _err: TCGCard[] | null = null;

export function getShadowlessCards(): TCGCard[] {
  return (_sl ??= shadowlessCards());
}

export function getErrorCards(): TCGCard[] {
  return (_err ??= errorCards());
}

export function specialSets(): TCGSet[] {
  return [
    setStub(SHADOWLESS_SET_ID, "Base Set (Shadowless)", "Base", getShadowlessCards().length, "1999/01/09"),
    setStub(ERROR_SET_ID, "Error / Misprint Cards", "Special", getErrorCards().length, "1999/01/09"),
  ];
}

export function isSpecialSetId(id?: string | null): boolean {
  const v = (id || "").toLowerCase();
  return v === SHADOWLESS_SET_ID || v === ERROR_SET_ID || v === "bss";
}

export function getSpecialSetCards(setId: string): TCGCard[] | null {
  const id = (setId || "").toLowerCase();
  if (id === SHADOWLESS_SET_ID || id === "bss") return getShadowlessCards();
  if (id === ERROR_SET_ID) return getErrorCards();
  return null;
}

export function getSpecialCard(id: string): TCGCard | undefined {
  const key = (id || "").toLowerCase();
  return (
    getShadowlessCards().find((c) => c.id.toLowerCase() === key) ||
    getErrorCards().find((c) => c.id.toLowerCase() === key)
  );
}

function hay(c: TCGCard): string {
  return `${c.name} ${c.set.name} ${c.rarity} ${c.flavorText || ""} ${c.id}`.toLowerCase();
}

export function searchSpecialCards(query: string): TCGCard[] {
  const parsed = parseSearchQuery(query);
  const all =
    parsed.print === "shadowless"
      ? getShadowlessCards()
      : parsed.print === "error"
        ? getErrorCards()
        : [...getShadowlessCards(), ...getErrorCards()];
  const name = (parsed.name || "").toLowerCase();
  if (!name && (parsed.print === "shadowless" || parsed.print === "error")) return all;
  if (!name) {
    const raw = (parsed.raw || query).toLowerCase();
    if (!raw) return [];
    return all.filter((c) => hay(c).includes(raw));
  }
  return all.filter((c) => {
    const h = hay(c);
    return h.includes(name) || c.name.toLowerCase().startsWith(name);
  });
}

function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[:']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mergeSetLists(primary: TCGSet[], extra: TCGSet[]): TCGSet[] {
  const out = [...primary];
  const ids = new Set(out.map((s) => s.id.toLowerCase()));
  const names = new Set(out.map((s) => normName(s.name)));
  for (const s of extra) {
    if (!s?.id) continue;
    const id = s.id.toLowerCase();
    const name = normName(s.name);
    if (ids.has(id) || (name && names.has(name))) continue;
    out.push(s);
    ids.add(id);
    if (name) names.add(name);
  }
  return out;
}

export function injectSpecialSets(sets: TCGSet[]): TCGSet[] {
  return mergeSetLists(specialSets(), sets);
}

export function parentSetIdForSpecial(setId: string, number?: string): string | null {
  const id = (setId || "").toLowerCase();
  if (id === SHADOWLESS_SET_ID || id === "bss") return "base1";
  if (id === ERROR_SET_ID) {
    const hit = getErrorCards().find((c) => c.number === number);
    const fromId = hit?.id || "";
    if (fromId.includes("jungle")) return "base2";
    if (fromId.includes("fossil")) return "base3";
    if (fromId.includes("rocket")) return "base5";
    if (fromId.includes("movie") || fromId.includes("aoki")) return "basep";
    if (fromId.includes("col-") || fromId.includes("phanphy")) return "col1";
    return "base1";
  }
  return null;
}
