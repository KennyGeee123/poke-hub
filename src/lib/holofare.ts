/**
 * HoloFare (demo) — pricing and Fare Lock rules from "HoloFare: The Complete Playbook" v1.1.
 * DEMO ONLY: mock listings, no real purchases, payments, or marketplace requests.
 * Reuses the app's Listing type + listingTotal / matchesConditionFilter (Quick Strike cheapest logic).
 */
import { listingTotal, matchesConditionFilter, type Listing } from "@/lib/card-prices";

export const HF = {
  voidNavy: "#0B0F2A", deepOrbit: "#151B45", cyan: "#19E3FF", magenta: "#FF3DCB",
  gold: "#FFC93C", mint: "#3DFFA2", frost: "#F4F7FF", softLilac: "#A9B2E8", dimLilac: "#7F89C9",
  panelBorder: "#2B3578", inputBorder: "#3A4488", trackBlue: "#232B63", boardNavy: "#0E1336",
} as const;
export const SHIMMER = `linear-gradient(100deg, ${HF.cyan}, ${HF.magenta})`;

export const PILL: Record<string, { bg: string; fg: string }> = {
  Locked: { bg: "#5A1C4B", fg: "#FF3DCB" },
  Purchasing: { bg: "#4D3E10", fg: "#FFC93C" },
  "Hold placed": { bg: "#4D3E10", fg: "#FFC93C" },
  Verified: { bg: "#17503A", fg: "#3DFFA2" },
  Charged: { bg: "#17503A", fg: "#3DFFA2" },
  "In transit": { bg: "#10435A", fg: "#19E3FF" },
  "Steady demand": { bg: "#10435A", fg: "#19E3FF" },
  Delivered: { bg: "#4D3E10", fg: "#FFC93C" },
  "Hot demand": { bg: "#5A1C4B", fg: "#FF3DCB" },
  "Slow mover": { bg: "#10435A", fg: "#19E3FF" },
};

export type Tier = "hot" | "steady" | "slow";
export const TIERS: Record<Tier, { seconds: number; label: string; why: string }> = {
  hot: { seconds: 45, label: "Hot demand", why: "Hot cards get short timers. This one is selling fast." },
  steady: { seconds: 180, label: "Steady demand", why: "Normal cards with regular sales get 3 minutes." },
  slow: { seconds: 600, label: "Slow mover", why: "Slow-moving cards get longer timers. You have 10 minutes." },
};

export const FEE_RATE = 0.075;
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const usd = (n: number) => `$${n.toFixed(2)}`;

export function fare(l: Listing) {
  const card = r2(Number(l.price) || 0);
  const shipping = r2(Number(l.shipping) || 0);
  const fee = r2(card * FEE_RATE);
  const total = r2(card + shipping + fee);
  const cushion = r2(Math.min(card * 0.02, 10));
  return { card, shipping, fee, total, cushion };
}

/** Lowest total wins (Quick Strike rule), filtered by condition chip. */
export function bestMatches(listings: Listing[], cond: "any" | "raw" | "graded") {
  const f = cond === "graded" ? "slab" : cond === "raw" ? "raw" : "all";
  return listings.filter((l) => matchesConditionFilter(l, f)).sort((a, b) => listingTotal(a) - listingTotal(b));
}

const L = (title: string, price: number, shipping: number, condition: string, isSlab = false): Listing => ({
  source: "demo", title, price, priceRaw: usd(price), currency: "USD", url: "", image: null,
  condition, shipping, kind: "listing", isSlab,
});

/** Mock catalog. Sample data for the mockup. */
export const DEMO: { name: string; tier: Tier; viewers: number; listings: Listing[] }[] = [
  { name: "Shiny Charizard", tier: "hot", viewers: 14, listings: [
    L("Shiny Charizard PSA 10", 412, 8.5, "Graded PSA 10", true),
    L("Shiny Charizard PSA 10", 418, 6, "Graded PSA 10", true),
    L("Shiny Charizard Raw NM", 389, 4.99, "Raw NM"),
    L("Shiny Charizard PSA 10", 429, 0, "Graded PSA 10", true),
  ] },
  { name: "Umbreon Alt Art", tier: "steady", viewers: 6, listings: [
    L("Umbreon Alt Art Raw NM", 318, 5, "Raw NM"),
    L("Umbreon Alt Art Raw NM", 322, 4.5, "Raw NM"),
    L("Umbreon Alt Art CGC 9.5", 455, 9, "Graded CGC 9.5", true),
  ] },
  { name: "Gengar Holo", tier: "slow", viewers: 1, listings: [
    L("Gengar Holo Raw LP", 74, 4, "Raw LP"),
    L("Gengar Holo PSA 8", 140, 6, "Graded PSA 8", true),
    L("Gengar Holo Raw NM", 81, 3.5, "Raw NM"),
  ] },
];

export const RECENT = [
  { name: "Shiny Charizard", cond: "Graded", price: 451.4, status: "Verified" },
  { name: "Umbreon Alt Art", cond: "Raw", price: 346.85, status: "In transit" },
  { name: "Gengar Holo", cond: "Raw", price: 83.55, status: "Delivered" },
  { name: "Mew Promo", cond: "Graded", price: 129.0, status: "Purchasing" },
];

export function findDemo(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return DEMO[0];
  return DEMO.find((d) => d.name.toLowerCase().includes(s) || s.includes(d.name.toLowerCase().split(" ")[0])) ?? null;
}

export const DISCLAIMER =
  "Ships direct from a third-party seller. Items are sold as listed by that seller. HoloFare is not responsible for misrepresentation, damage, or any difference between the listing and the item.";
export const FOOTER =
  "HoloFare is not affiliated with, endorsed by, or sponsored by The Pokémon Company, Nintendo or Game Freak. Pokémon and all related names are trademarks of their respective owners. Ships direct from third-party sellers. Items are sold as listed by those sellers.";
export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;
