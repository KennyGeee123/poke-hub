// Pokémon GO marketplace: buy / sell / trade listings for GO creatures (not TCG).
// Values are keyed by species NAME and informed by eBay sold comps when signed-in;
// otherwise a deterministic eBay-sold-informed estimate (same formula every time).

export type PoGoListingKind = "buy" | "sell" | "trade";

export type PoGoSpecies = {
  id: number; // national dex
  name: string;
  types: string[];
  rarity: "common" | "uncommon" | "rare" | "legendary" | "mythical" | "shiny_popular";
};

export type PoGoListing = {
  id: string;
  kind: PoGoListingKind;
  species: PoGoSpecies;
  /** Asking / offer price in USD (buy/sell). For trade, the asked cash sweetener. */
  priceUsd: number;
  /** Name-keyed market value estimate used for fairness. */
  marketValueUsd: number;
  cp: number;
  ivPct: number; // 0–100
  shiny: boolean;
  lucky: boolean;
  trader: string;
  note?: string;
  createdAt: number;
};

export type PoGoValueSource = "ebay_sold" | "ebay_informed_estimate";

export type PoGoValue = {
  name: string;
  usd: number;
  source: PoGoValueSource;
  query: string;
  comps?: { count: number; min: number; max: number; median: number };
  ebaySoldUrl: string;
};

/** Curated beta catalog — enough species for buy/sell/trade demos. */
export const POGO_SPECIES: PoGoSpecies[] = [
  { id: 1, name: "Bulbasaur", types: ["Grass", "Poison"], rarity: "common" },
  { id: 4, name: "Charmander", types: ["Fire"], rarity: "common" },
  { id: 7, name: "Squirtle", types: ["Water"], rarity: "common" },
  { id: 25, name: "Pikachu", types: ["Electric"], rarity: "shiny_popular" },
  { id: 39, name: "Jigglypuff", types: ["Normal", "Fairy"], rarity: "uncommon" },
  { id: 52, name: "Meowth", types: ["Normal"], rarity: "uncommon" },
  { id: 94, name: "Gengar", types: ["Ghost", "Poison"], rarity: "rare" },
  { id: 130, name: "Gyarados", types: ["Water", "Flying"], rarity: "rare" },
  { id: 131, name: "Lapras", types: ["Water", "Ice"], rarity: "rare" },
  { id: 133, name: "Eevee", types: ["Normal"], rarity: "shiny_popular" },
  { id: 143, name: "Snorlax", types: ["Normal"], rarity: "rare" },
  { id: 144, name: "Articuno", types: ["Ice", "Flying"], rarity: "legendary" },
  { id: 145, name: "Zapdos", types: ["Electric", "Flying"], rarity: "legendary" },
  { id: 146, name: "Moltres", types: ["Fire", "Flying"], rarity: "legendary" },
  { id: 149, name: "Dragonite", types: ["Dragon", "Flying"], rarity: "rare" },
  { id: 150, name: "Mewtwo", types: ["Psychic"], rarity: "legendary" },
  { id: 151, name: "Mew", types: ["Psychic"], rarity: "mythical" },
  { id: 248, name: "Tyranitar", types: ["Rock", "Dark"], rarity: "rare" },
  { id: 249, name: "Lugia", types: ["Psychic", "Flying"], rarity: "legendary" },
  { id: 250, name: "Ho-Oh", types: ["Fire", "Flying"], rarity: "legendary" },
  { id: 282, name: "Gardevoir", types: ["Psychic", "Fairy"], rarity: "rare" },
  { id: 373, name: "Salamence", types: ["Dragon", "Flying"], rarity: "rare" },
  { id: 384, name: "Rayquaza", types: ["Dragon", "Flying"], rarity: "legendary" },
  { id: 445, name: "Garchomp", types: ["Dragon", "Ground"], rarity: "rare" },
  { id: 448, name: "Lucario", types: ["Fighting", "Steel"], rarity: "shiny_popular" },
  { id: 483, name: "Dialga", types: ["Steel", "Dragon"], rarity: "legendary" },
  { id: 484, name: "Palkia", types: ["Water", "Dragon"], rarity: "legendary" },
  { id: 487, name: "Giratina", types: ["Ghost", "Dragon"], rarity: "legendary" },
  { id: 493, name: "Arceus", types: ["Normal"], rarity: "mythical" },
  { id: 700, name: "Sylveon", types: ["Fairy"], rarity: "shiny_popular" },
];

const RARITY_BASE: Record<PoGoSpecies["rarity"], number> = {
  common: 4,
  uncommon: 9,
  rare: 28,
  shiny_popular: 45,
  legendary: 95,
  mythical: 160,
};

function hashName(name: string): number {
  let h = 2166136261;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic USD estimate keyed only by species name (+ rarity table). */
export function estimatePoGoValueByName(name: string, rarity?: PoGoSpecies["rarity"]): number {
  const sp = POGO_SPECIES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  const r = rarity || sp?.rarity || "uncommon";
  const base = RARITY_BASE[r];
  const h = hashName(name);
  // ±18% wobble from the name so each species has a stable unique number.
  const wobble = 0.82 + ((h % 360) / 360) * 0.36;
  const usd = Math.round(base * wobble * 100) / 100;
  return Math.max(1.5, usd);
}

export function pogoSpriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

export function pogoEbaySoldQuery(name: string): string {
  return `Pokemon GO ${name}`.trim();
}

export function pogoEbaySoldUrl(name: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(pogoEbaySoldQuery(name))}&LH_Sold=1&LH_Complete=1`;
}

/** Build a value object from live eBay summary or fall back to the name estimate. */
export function valueFromEbayOrEstimate(
  name: string,
  ebay?: { summary: { count: number; min: number; max: number; median: number } | null } | null,
): PoGoValue {
  const query = pogoEbaySoldQuery(name);
  if (ebay?.summary && ebay.summary.count >= 3 && ebay.summary.median > 0) {
    // Cap wild account-bundle outliers: GO creature comps are usually under $500.
    const median = Math.min(ebay.summary.median, 500);
    return {
      name,
      usd: Math.round(median * 100) / 100,
      source: "ebay_sold",
      query,
      comps: ebay.summary,
      ebaySoldUrl: pogoEbaySoldUrl(name),
    };
  }
  return {
    name,
    usd: estimatePoGoValueByName(name),
    source: "ebay_informed_estimate",
    query,
    ebaySoldUrl: pogoEbaySoldUrl(name),
  };
}

function seeded(n: number) {
  let s = n >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Beta demo listings — prices derived from name-keyed market value. */
export function buildDemoListings(): PoGoListing[] {
  const trainers = ["AshKetchum", "MistyWater", "BrockRock", "LeafGreen", "RedChamp", "BlueRival"];
  const out: PoGoListing[] = [];
  let i = 0;
  for (const sp of POGO_SPECIES) {
    const rnd = seeded(hashName(sp.name) ^ 0x9e3779b9);
    const market = estimatePoGoValueByName(sp.name, sp.rarity);
    const kinds: PoGoListingKind[] = ["sell", "buy", "trade"];
    const kind = kinds[i % 3];
    const shiny = rnd() > 0.72;
    const lucky = rnd() > 0.8;
    const ivPct = Math.round(70 + rnd() * 30);
    const cp = Math.round(800 + rnd() * 3200);
    let price = market;
    if (shiny) price *= 1.55;
    if (lucky) price *= 1.12;
    if (ivPct >= 98) price *= 1.25;
    else if (ivPct >= 90) price *= 1.1;
    // Sellers ask a bit over market; buyers bid a bit under; trades use cash sweetener.
    if (kind === "sell") price *= 0.95 + rnd() * 0.2;
    else if (kind === "buy") price *= 0.75 + rnd() * 0.2;
    else price = Math.round(price * (rnd() * 0.3 - 0.05) * 100) / 100; // sweetener
    out.push({
      id: `pogo-${sp.id}-${kind}`,
      kind,
      species: sp,
      priceUsd: Math.max(0, Math.round(price * 100) / 100),
      marketValueUsd: market,
      cp,
      ivPct,
      shiny,
      lucky,
      trader: trainers[i % trainers.length],
      note:
        kind === "trade"
          ? `Looking to trade my ${sp.name} — open to fair swaps`
          : kind === "sell"
            ? `${ivPct}% IV · ${cp} CP`
            : `Want ${sp.name} around this offer`,
      createdAt: Date.now() - i * 3600_000,
    });
    i++;
  }
  return out;
}

export function fairPoGoTrade(
  yoursValue: number,
  theirsValue: number,
): { label: "FAIR" | "YOU WIN" | "YOU LOSE"; delta: number; line: string } {
  const delta = Math.round((theirsValue - yoursValue) * 100) / 100;
  const pct = yoursValue > 0 ? Math.abs(delta) / yoursValue : 1;
  if (pct <= 0.08)
    return { label: "FAIR", delta, line: "Within ~8% — a fair GO swap by name value." };
  if (delta > 0)
    return {
      label: "YOU WIN",
      delta,
      line: `Their side is worth about $${Math.abs(delta).toFixed(2)} more.`,
    };
  return {
    label: "YOU LOSE",
    delta,
    line: `Your side is worth about $${Math.abs(delta).toFixed(2)} more — ask for cash or a better swap.`,
  };
}

export function findSpecies(q: string): PoGoSpecies[] {
  const n = q.trim().toLowerCase();
  if (!n) return POGO_SPECIES;
  return POGO_SPECIES.filter(
    (s) => s.name.toLowerCase().includes(n) || s.types.some((t) => t.toLowerCase().includes(n)),
  );
}

/** Typical eBay asking sits above sold median; used when live asking scrape isn't available. */
export function estimateEbayAsking(soldUsd: number): number {
  return Math.round(soldUsd * 1.18 * 100) / 100;
}

export type PoGoEbayPanel = {
  soldUsd: number;
  askingUsd: number;
  source: PoGoValueSource;
  soldUrl: string;
  askingUrl: string;
};

export function ebayPanelFromValue(v: PoGoValue): PoGoEbayPanel {
  return {
    soldUsd: v.usd,
    askingUsd: estimateEbayAsking(v.usd),
    source: v.source,
    soldUrl: v.ebaySoldUrl,
    askingUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(v.query)}&_sacat=0`,
  };
}

const LS_KEY = "pv-pogo-listings-v1";

export function loadUserListings(): PoGoListing[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveUserListing(listing: PoGoListing): void {
  const cur = loadUserListings().filter((l) => l.id !== listing.id);
  cur.unshift(listing);
  localStorage.setItem(LS_KEY, JSON.stringify(cur.slice(0, 40)));
}

export function removeUserListing(id: string): void {
  localStorage.setItem(LS_KEY, JSON.stringify(loadUserListings().filter((l) => l.id !== id)));
}
