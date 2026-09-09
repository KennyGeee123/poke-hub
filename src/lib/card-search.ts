/** Shared card search: print-variant keywords + misspelling tolerance. */

export type PrintKind = "shadowless" | "unlimited" | "1st" | "error" | "promo" | null;

export type ParsedQuery = {
  raw: string;
  name: string;
  print: PrintKind;
};

export type SearchableCard = {
  id: string;
  localId?: string;
  setId?: string;
  names?: Record<string, string>;
  variant?: string | null;
  dex?: number[];
  rarity?: string;
};

const SPELL: Record<string, string> = {
  charzard: "charizard",
  charazard: "charizard",
  charzrd: "charizard",
  charizrd: "charizard",
  charizad: "charizard",
  charizardz: "charizard",
  charizard: "charizard",
  picachu: "pikachu",
  pikachuu: "pikachu",
  peekachu: "pikachu",
  pikachoo: "pikachu",
  pikchu: "pikachu",
  pika: "pikachu",
  mewto: "mewtwo",
  mew2: "mewtwo",
  mewtoo: "mewtwo",
  blastois: "blastoise",
  blastose: "blastoise",
  venuasaur: "venusaur",
  venasaur: "venusaur",
  venusaur: "venusaur",
  gyrados: "gyarados",
  gyaradose: "gyarados",
  gyradose: "gyarados",
  alakzam: "alakazam",
  alakazam: "alakazam",
  ninetails: "ninetales",
  ninetales: "ninetales",
  machomp: "machamp",
  dragonight: "dragonite",
  umbrean: "umbreon",
  rayquza: "rayquaza",
  raquaza: "rayquaza",
  recquaza: "rayquaza",
  rayquaza: "rayquaza",
  lugia: "lugia",
  mew: "mew",
  shadowles: "shadowless",
  shadeless: "shadowless",
  shaddowless: "shadowless",
  shadoless: "shadowless",
  "shadow less": "shadowless",
};

const NAMES = new Set([
  "charizard", "pikachu", "mewtwo", "blastoise", "venusaur", "gyarados", "alakazam",
  "ninetales", "machamp", "dragonite", "umbreon", "espeon", "rayquaza", "lugia", "mew",
  "charmander", "charmeleon", "squirtle", "wartortle", "bulbasaur", "ivysaur",
  "nidoking", "nidoqueen", "arcanine", "gengar", "haunter", "gastly", "lapras",
  "snorlax", "eevee", "vaporeon", "jolteon", "flareon", "articuno", "zapdos", "moltres",
  "mew", "mewtwo", "clefairy", "clefable", "jigglypuff", "wigglytuff", "raichu",
  "sandslash", "ninetales", "golduck", "primeape", "poliwrath", "kadabra", "machoke",
  "golem", "rapidash", "slowbro", "magneton", "farfetchd", "dewgong", "muk", "cloyster",
  "onix", "hypno", "kingler", "electrode", "exeggutor", "marowak", "hitmonlee", "hitmonchan",
  "lickitung", "weezing", "rhydon", "chansey", "tangela", "kangaskhan", "seadra", "seaking",
  "starmie", "mr mime", "scyther", "jynx", "electabuzz", "magmar", "pinsir", "tauros",
  "gyarados", "lapras", "ditto", "eevee", "porygon", "omastar", "kabutops", "aerodactyl",
  "snorlax", "dragonair", "dragonite", "mewtwo",
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/['’]/g, "")
    .replace(/[_/,.+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function maxDist(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

export function fuzzyEq(q: string, target: string): boolean {
  if (!q || !target) return false;
  if (target === q || target.includes(q) || q.includes(target) && q.length >= 4) return true;
  return levenshtein(q, target) <= maxDist(Math.min(q.length, target.length));
}

export function detectPrint(q: string): PrintKind {
  const n = normalize(q);
  if (/\b(error|misprint|mis-print|black\s*dot)\b/.test(n)) return "error";
  if (/\b(shadow\s*less|shadd?owless|shadeless|shadoless|shadowles)\b/.test(n) || n.includes("shadowless")) {
    return "shadowless";
  }
  if (/\b(1st\s*ed(ition)?|first\s*ed(ition)?|1ed)\b/.test(n)) return "1st";
  if (/\bunlimi?ted\b/.test(n)) return "unlimited";
  if (/\bpromo(s| card)?\b/.test(n)) return "promo";
  return null;
}

function stripPrint(q: string): string {
  return normalize(q)
    .replace(/\b(shadow\s*less|shadd?owless|shadeless|shadoless|shadowles|shadowless)\b/g, " ")
    .replace(/\b(1st\s*ed(ition)?|first\s*ed(ition)?|1ed)\b/g, " ")
    .replace(/\bunlimi?ted\b/g, " ")
    .replace(/\b(error|misprint|mis-print|black\s*dot)\b/g, " ")
    .replace(/\bpromo(s| card)?\b/g, " ")
    .replace(/\b(holo|holofoil|base\s*set|wotc|unlimited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function correctName(q: string, extra: string[] = []): string {
  const n = normalize(q);
  if (!n) return "";
  if (SPELL[n]) return SPELL[n];
  const parts = n.split(" ").filter(Boolean);
  const mapped = parts.map((p) => SPELL[p] || p);
  const joined = mapped.join(" ");
  if (SPELL[joined]) return SPELL[joined];
  const dict = extra.length ? extra : [...NAMES];
  let best = joined;
  let bestD = 99;
  for (const name of dict) {
    const d = levenshtein(joined, name);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  if (bestD <= maxDist(joined.length) && bestD > 0) return best;
  if (parts.length === 1) {
    for (const name of dict) {
      if (name.startsWith(joined) || joined.startsWith(name)) return name.length >= joined.length ? name : joined;
    }
  }
  return joined;
}

export function parseSearchQuery(q: string, extraNames: string[] = []): ParsedQuery {
  const raw = normalize(q);
  const print = detectPrint(raw);
  const stripped = stripPrint(raw);
  const name = /[a-z]/i.test(stripped) ? correctName(stripped, extraNames) : stripped;
  return { raw, name, print };
}

export function isShadowlessCard(c: SearchableCard, setName?: string): boolean {
  if ((c.variant || "").toLowerCase().includes("shadowless")) return true;
  if ((c.setId || "").toLowerCase().includes("base1sl") || (c.setId || "") === "bss") return true;
  if ((c.id || "").toLowerCase().includes("shadowless")) return true;
  if ((setName || "").toLowerCase().includes("shadowless")) return true;
  return false;
}

export function isErrorCard(c: SearchableCard, setName?: string): boolean {
  const blob = `${c.variant || ""} ${c.setId || ""} ${c.id || ""} ${setName || ""} ${Object.values(c.names || {}).join(" ")}`.toLowerCase();
  return /\b(error|misprint|mis-print|black\s*dot)\b/.test(blob) || (c.setId || "") === "error";
}

export function isPromoCard(c: SearchableCard, setName?: string): boolean {
  const blob = `${c.variant || ""} ${c.setId || ""} ${setName || ""}`.toLowerCase();
  return /\bpromo/.test(blob) || /(-p|svp|smp|wp|basep)$/i.test(c.setId || "");
}

export function cardMatchesPrint(c: SearchableCard, print: PrintKind, setName?: string): boolean {
  if (!print) return true;
  const sl = isShadowlessCard(c, setName);
  if (print === "shadowless" || print === "1st") return sl;
  if (print === "unlimited") return !sl && ((c.setId || "").startsWith("base") || (setName || "").toLowerCase().includes("base"));
  if (print === "error") return isErrorCard(c, setName);
  if (print === "promo") return isPromoCard(c, setName);
  return true;
}

export function cardSearchScore(
  c: SearchableCard,
  parsed: ParsedQuery,
  lang: string,
  setName = "",
  dexAliases?: Record<string, string>,
): number | null {
  if (!cardMatchesPrint(c, parsed.print, setName)) return null;
  const nameQ = parsed.name;
  if (!nameQ) return parsed.print ? 20 : null;

  const clean = (v: string) => normalize(String(v).replace(/\s*\([^)]*\)\s*/g, " "));
  const own: string[] = [];
  for (const v of Object.values(c.names || {})) if (v) own.push(clean(v));
  const extra: string[] = [];
  if (dexAliases) for (const v of Object.values(dexAliases)) if (v) extra.push(clean(v));
  extra.push(normalize(setName), normalize(c.id), normalize(c.localId || ""));

  const scoreLabels = (labels: string[], bump: number) => {
    let best = 99;
    for (const lab of labels) {
      if (!lab) continue;
      if (lab === nameQ) best = Math.min(best, bump);
      else if (lab.startsWith(nameQ)) best = Math.min(best, bump + 1);
      else if (nameQ.startsWith(lab) && lab.length >= 4) best = Math.min(best, bump + 2);
      else if (lab.includes(nameQ) && nameQ.length >= 3) best = Math.min(best, bump + 3);
      else {
        const d = levenshtein(nameQ, lab);
        if (d <= maxDist(Math.min(nameQ.length, lab.length))) best = Math.min(best, bump + 4 + d);
      }
    }
    return best;
  };

  const best = Math.min(scoreLabels(own, 0), scoreLabels(extra, 4));
  if (best >= 99) return null;
  if (parsed.print && (isShadowlessCard(c, setName) || isErrorCard(c, setName) || isPromoCard(c, setName))) {
    return Math.max(0, best - 1);
  }
  return best;
}
