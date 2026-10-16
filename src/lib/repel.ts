/** Step Repels. The Game Boy page and the living-world walk share one counter. */

export type RepelItemId = "repel" | "super_repel" | "max_repel";

export const REPEL_KEY = "pv.adventure.repelSteps";

export interface RepelDef {
  id: RepelItemId;
  name: string;
  steps: number;
  priceCoins: number;
  description: string;
}

export const REPEL_ITEMS: Record<RepelItemId, RepelDef> = {
  repel: {
    id: "repel",
    name: "Repel",
    steps: 100,
    priceCoins: 350,
    description: "Keeps weak wild Pokémon away for 100 steps.",
  },
  super_repel: {
    id: "super_repel",
    name: "Super Repel",
    steps: 200,
    priceCoins: 500,
    description: "Keeps weak wild Pokémon away for 200 steps.",
  },
  max_repel: {
    id: "max_repel",
    name: "Max Repel",
    steps: 250,
    priceCoins: 700,
    description: "Keeps weak wild Pokémon away for 250 steps.",
  },
};

export function defaultRepelCounts(): Record<RepelItemId, number> {
  return { repel: 3, super_repel: 2, max_repel: 1 };
}

export function readRepelSteps(): number | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(REPEL_KEY);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  } catch {
    return null;
  }
}

export function writeRepelSteps(n: number): void {
  if (typeof window === "undefined") return;
  const steps = Math.max(0, Math.floor(n));
  try {
    window.localStorage.setItem(REPEL_KEY, String(steps));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("pv-repel", { detail: steps }));
}

/** One grass step. Returns true when a Repel is still keeping wild battles away. */
export function tickRepelStep(): boolean {
  const n = readRepelSteps() ?? 0;
  if (n <= 0) return false;
  writeRepelSteps(n - 1);
  return true;
}
