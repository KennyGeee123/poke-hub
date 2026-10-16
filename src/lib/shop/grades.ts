// Grade / condition model for single cards (pure; client + server).
export const RAW_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export const GRADERS = ["PSA", "BGS", "CGC", "SGC"] as const;
export type Grader = "RAW" | (typeof GRADERS)[number] | "ANY";

export const CONDITION_LABEL: Record<string, string> = { NM: "Near Mint", LP: "Lightly Played", MP: "Moderately Played", HP: "Heavily Played", DMG: "Damaged" };

export type Variant = {
  id: string; product_id: string; finish: string; grader: Grader; grade: string;
  sale_price: number | null; price_status: "priced" | "on_request"; sample_size?: number | null;
};

export function variantId(productId: string, finish: string, grader: string, grade: string): string {
  return `${productId}|${finish.toLowerCase().replace(/[^a-z0-9]+/g, "-")}|${grader}|${grade}`;
}

export function variantLabel(v: Pick<Variant, "finish" | "grader" | "grade">): string {
  const finish = v.finish && v.finish !== "Normal" ? ` · ${v.finish}` : "";
  if (v.grader === "RAW") return `Raw · ${CONDITION_LABEL[v.grade] ?? v.grade}${finish}`;
  if (v.grader === "ANY") return `Graded ${v.grade} (any grader)${finish}`;
  return `${v.grader} ${v.grade}${finish}`;
}

/** Sort: raw best→worst, then graded by grader, grade desc. */
export function sortVariants<T extends Pick<Variant, "grader" | "grade" | "finish">>(vs: T[]): T[] {
  const rawIdx = (g: string) => RAW_CONDITIONS.indexOf(g as (typeof RAW_CONDITIONS)[number]);
  const gIdx = (g: string) => (g === "RAW" ? -1 : g === "ANY" ? 99 : GRADERS.indexOf(g as (typeof GRADERS)[number]));
  return [...vs].sort((a, b) =>
    gIdx(a.grader) - gIdx(b.grader) ||
    (a.grader === "RAW" ? rawIdx(a.grade) - rawIdx(b.grade) : Number(b.grade) - Number(a.grade)) ||
    a.finish.localeCompare(b.finish));
}

/** Detect "PSA 10", "BGS 9.5", "CGC Pristine 10", "SGC 10" in a listing title. */
export function parseGrade(title: string): { grader: (typeof GRADERS)[number]; grade: string } | null {
  const t = title.toUpperCase().replace(/GEM\s*(MINT|MT)|PRISTINE|BLACK\s*LABEL|MINT/g, " ");
  const m = t.match(/\b(PSA|BGS|BECKETT|CGC|SGC)\s*[- ]?\s*(10|9\.5|[1-9](?:\.5)?)\b/);
  if (!m) return null;
  const grader = (m[1] === "BECKETT" ? "BGS" : m[1]) as (typeof GRADERS)[number];
  return { grader, grade: m[2] };
}

/** Title is the same card (collector number) and the exact grade, and isn't a lot/proxy/raw listing. */
export function titleMatchesGrade(title: string, cardNumber: string | null, grader: string, grade: string): boolean {
  if (/\b(lot|bundle|proxy|custom|reprint|digital|empty slab|choose|pick|you pick|x\d+)\b/i.test(title)) return false;
  const g = parseGrade(title);
  if (!g || g.grader !== grader || g.grade !== grade) return false;
  if (cardNumber) {
    const num = cardNumber.split("/")[0].replace(/^0+/, "");
    if (!new RegExp(`(^|[^0-9])0*${num}(\\s*/|[^0-9]|$)`).test(title)) return false;
  }
  return true;
}

export function median(xs: number[]): number | null {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
}

/** PriceCharting product fields (pennies) → graded variants. Only fields actually present are returned. */
export const PRICECHARTING_FIELDS: [string, Grader, string][] = [
  ["manual-only-price", "PSA", "10"],
  ["bgs-10-price", "BGS", "10"],
  ["condition-17-price", "CGC", "10"],
  ["condition-18-price", "SGC", "10"],
  ["box-only-price", "ANY", "9.5"],
  ["graded-price", "ANY", "9"],
  ["new-price", "ANY", "8"],
  ["cib-price", "ANY", "7"],
];
export function parsePriceCharting(p: Record<string, unknown>): { grader: Grader; grade: string; price: number }[] {
  const out: { grader: Grader; grade: string; price: number }[] = [];
  for (const [field, grader, grade] of PRICECHARTING_FIELDS) {
    const pennies = Number(p[field]);
    if (Number.isFinite(pennies) && pennies > 0) out.push({ grader, grade, price: pennies / 100 });
  }
  return out;
}

/** Minimum sold samples before an eBay-sold median is trusted as a price. */
export const MIN_SOLD_SAMPLES = 3;
