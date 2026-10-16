/**
 * Real scans for 30th Celebration Classic Collection.
 * TCGdex returns image:null for every card in 30th-c. pokemontcg.io 404s me55c.
 * Scrydex hosts the printed card (gold frame and the 30 stamp are in the scan):
 *   https://images.scrydex.com/pokemon/{id}/medium   tile
 *   https://images.scrydex.com/pokemon/{id}/large    detail
 * Ids are the number printed on the card (me55c-4 = Charizard 4/102), not the
 * TCGdex sequence (30th-c-001). Two prints share 11 and three share 106, so
 * those use Scrydex's letter suffix (11g Genesect, 106m Gardevoir, 106p Palkia).
 */
import { setIdAliases } from "@/lib/set-ids";

const SCRYDEX = "https://images.scrydex.com/pokemon";

/**
 * Unknown Scrydex ids answer HTTP 200 with one of these fixed files, not a card.
 * medium is 367×511; a real medium scan is 367×512. large matches the
 * pokemontcg.io card-back (640×892).
 */
export const SCRYDEX_PLACEHOLDER_BYTES = new Set([45551, 82623, 186316]);

export function isScrydexPlaceholderSize(width: number, height: number): boolean {
  return (
    (width === 245 && height === 341) ||
    (width === 367 && height === 511) ||
    (width === 640 && height === 892)
  );
}

/** TCGdex 30th-c-00N → Scrydex card id. */
export const CLASSIC_SCRYDEX_ID: Record<string, string> = {
  "30th-c-001": "me55c-4",
  "30th-c-002": "me55c-5",
  "30th-c-003": "me55c-11",
  "30th-c-004": "me55c-11g",
  "30th-c-005": "me55c-18",
  "30th-c-006": "me55c-19",
  "30th-c-007": "me55c-25",
  "30th-c-008": "me55c-33",
  "30th-c-009": "me55c-41",
  "30th-c-010": "me55c-43",
  "30th-c-011": "me55c-47",
  "30th-c-012": "me55c-50",
  "30th-c-013": "me55c-57",
  "30th-c-014": "me55c-58",
  "30th-c-015": "me55c-69",
  "30th-c-016": "me55c-85",
  "30th-c-017": "me55c-89",
  "30th-c-018": "me55c-94",
  "30th-c-019": "me55c-99",
  "30th-c-020": "me55c-100",
  "30th-c-021": "me55c-101",
  "30th-c-022": "me55c-106p",
  "30th-c-023": "me55c-106m",
  "30th-c-024": "me55c-106",
  "30th-c-025": "me55c-108",
  "30th-c-026": "me55c-114",
  "30th-c-027": "me55c-123",
  "30th-c-028": "me55c-138",
  "30th-c-029": "me55c-149",
  "30th-c-030": "me55c-203",
};

const BY_SCRYDEX = new Map<string, string>();
for (const [local, scry] of Object.entries(CLASSIC_SCRYDEX_ID)) {
  BY_SCRYDEX.set(scry, scry);
  BY_SCRYDEX.set(local, scry);
  const n = scry.replace(/^me55c-0*/, "me55c-");
  BY_SCRYDEX.set(n, scry);
}

function scrydexIdFor(id?: string): string | null {
  const raw = String(id || "").trim().toLowerCase();
  if (!raw) return null;
  if (BY_SCRYDEX.has(raw)) return BY_SCRYDEX.get(raw)!;
  const padded = raw.replace(/-(\d+)$/, (_, n) => `-${n.padStart(3, "0")}`);
  return BY_SCRYDEX.get(padded) || null;
}

export function scrydexClassicImages(
  id?: string,
): { small: string; large: string; scrydexId: string } | null {
  const scrydexId = scrydexIdFor(id);
  if (!scrydexId) return null;
  return {
    scrydexId,
    small: `${SCRYDEX}/${scrydexId}/medium`,
    large: `${SCRYDEX}/${scrydexId}/large`,
  };
}

const CLASSIC_NAMES = [
  "Charizard",
  "Delcatty",
  "Metagross",
  "Genesect EX",
  "Misty",
  "Dark Tyranitar",
  "Sneasel",
  "Pikachu & Zekrom GX",
  "Greninja BREAK",
  "Uxie",
  "Crobat G",
  "Raikou",
  "Buzzwole GX",
  "Pikachu",
  "Erika's Jigglypuff",
  "Rayquaza EX",
  "Solgaleo GX",
  "Gengar",
  "Darkrai & Cresselia LEGEND",
  "Darkrai & Cresselia LEGEND",
  "N",
  "Palkia",
  "M Gardevoir EX",
  "Shining Celebi",
  "Scizor ex",
  "Mew VMAX",
  "Arceus VSTAR",
  "Zacian V",
  "Lugia",
  "Magikarp",
];

export function classicScrydexCatalog(): {
  id: string;
  name: string;
  scrydexId: string;
  small: string;
  large: string;
}[] {
  return Object.entries(CLASSIC_SCRYDEX_ID).map(([id, scrydexId], i) => ({
    id,
    name: CLASSIC_NAMES[i] || id,
    scrydexId,
    small: `${SCRYDEX}/${scrydexId}/medium`,
    large: `${SCRYDEX}/${scrydexId}/large`,
  }));
}

function unpadSetId(id: string): string {
  return id.replace(/^([a-z]+)0+(\d+)$/i, (_, prefix, digits) => `${prefix}${Number(digits)}`);
}

/**
 * Pokédex-style set ids Scrydex actually hosts. TCGdex ids (sv08, sm7.5, 30th)
 * are placeholders there; the scan lives at sv8, sm75, me55.
 * Classic Collection is not guessed — those 30 ids collide and use the map above.
 */
export function scrydexSetCandidates(setId?: string): string[] {
  const raw = String(setId || "").trim();
  if (!raw) return [];
  if (/^(30th-c|me55c)$/i.test(raw)) return [];
  if (/^(30th|me55)$/i.test(raw)) return ["me55"];
  const out: string[] = [];
  const push = (id: string) => {
    if (!id || id.includes(".") || id.includes("-")) return;
    if (/^(30th|me55c|30th-c)$/i.test(id)) return;
    const use = unpadSetId(id);
    if (/^([a-z]+)0\d/i.test(use)) return;
    // sv10pt5b / sv10pt5w are synthetic pads. Scrydex hosts Black Bolt at
    // zsv10pt5 and White Flare at rsv10pt5. The pad is a placeholder PNG.
    const black = use.match(/^sv(\d+)pt(\d+)b$/i);
    if (black) {
      push(`zsv${Number(black[1])}pt${black[2]}`);
      return;
    }
    const white = use.match(/^sv(\d+)pt(\d+)w$/i);
    if (white) {
      push(`rsv${Number(white[1])}pt${white[2]}`);
      return;
    }
    if (!out.some((v) => v.toLowerCase() === use.toLowerCase())) out.push(use);
  };
  for (const alias of setIdAliases(raw)) push(alias);
  push(raw);
  // Prefixed pokemontcg ids (zsv10pt5, rsv10pt5) host the real scan.
  out.sort((a, b) => scrydexSetRank(a) - scrydexSetRank(b) || a.localeCompare(b));
  return out.slice(0, 2);
}

function scrydexSetRank(id: string): number {
  if (/^(zsv|rsv|wsv)/i.test(id)) return 0;
  if (/pt\d+[a-z]$/i.test(id)) return 2;
  return 1;
}

function scrydexNumber(num: string): string {
  const raw = num.trim();
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return raw;
}

/**
 * The printed-card scan for any id we can name on Scrydex.
 * Classic Collection uses the explicit map (numbers collide). Everything else
 * uses the first pokemontcg-style set id. Unknown classics return null.
 */
export function scrydexImagesForId(
  id?: string,
  setId?: string,
  num?: string,
): { small: string; large: string; scrydexId: string } | null {
  const classic = scrydexClassicImages(id);
  if (classic) return classic;
  const local = scrydexNumber(String(num || ""));
  if (!local) return null;
  const sets = scrydexSetCandidates(setId);
  if (!sets.length) return null;
  const scrydexId = `${sets[0]}-${local}`;
  return {
    scrydexId,
    small: `${SCRYDEX}/${scrydexId}/medium`,
    large: `${SCRYDEX}/${scrydexId}/large`,
  };
}

/** Direct Scrydex scan URLs. Classic ids return [] — use scrydexClassicImages. */
export function scrydexScanUrls(
  setId?: string,
  num?: string,
  cardId?: string,
  tile = true,
): string[] {
  if (scrydexClassicImages(cardId)) return [];
  const local = scrydexNumber(String(num || ""));
  if (!local) return [];
  const sets = scrydexSetCandidates(setId);
  if (!sets.length) return [];
  const first = tile ? "medium" : "large";
  const second = tile ? "large" : "medium";
  const urls: string[] = [];
  const add = (u: string) => {
    if (!urls.includes(u)) urls.push(u);
  };
  for (const set of sets) add(`${SCRYDEX}/${set}-${local}/${first}`);
  add(`${SCRYDEX}/${sets[0]}-${local}/${second}`);
  return urls;
}
