import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth";
import { FREE_SUBMISSION_LIMIT } from "./owner";

/**
 * Subscription state.
 * - Owner email = automatic Elite (full access, no limits).
 * - Everyone else = free "Trainer" with FREE_SUBMISSION_LIMIT submissions.
 * - Local upgrades (Pro/Elite) still supported for testing until billing wires in.
 */
export type Tier = "free" | "scout" | "pro" | "elite";

const SUB_KEY = "pv.sub.tier.v1";
const SCAN_KEY = "pv.sub.scans.v1";
const FREE_SCAN_LIMIT = FREE_SUBMISSION_LIMIT;

function readTier(): Tier {
  if (typeof localStorage === "undefined") return "free";
  const t = localStorage.getItem(SUB_KEY);
  return t === "scout" || t === "pro" || t === "elite" ? t : "free";
}

function readScans(): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(SCAN_KEY) ?? "0") || 0;
}

function emit() {
  window.dispatchEvent(new CustomEvent("pv-sub-change"));
}

export function usePremium() {
  const { isOwner } = useAuth();
  const [tier, setTierState] = useState<Tier>("free");
  const [scansUsed, setScansUsed] = useState(0);

  useEffect(() => {
    setTierState(readTier());
    setScansUsed(readScans());
    const h = () => {
      setTierState(readTier());
      setScansUsed(readScans());
    };
    window.addEventListener("pv-sub-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pv-sub-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const setTier = useCallback((t: Tier) => {
    localStorage.setItem(SUB_KEY, t);
    emit();
  }, []);

  const incScan = useCallback(() => {
    if (isOwner) return 0;
    const next = readScans() + 1;
    localStorage.setItem(SCAN_KEY, String(next));
    emit();
    return next;
  }, [isOwner]);

  // Owner always elite. Otherwise local tier.
  const effectiveTier: Tier = isOwner ? "elite" : tier;
  const isPro = effectiveTier === "pro" || effectiveTier === "elite";
  const isElite = effectiveTier === "elite";
  const isScout = effectiveTier === "scout" || isPro;
  const hasCheapLoop = isScout;
  const scansLeft = isPro ? Infinity : Math.max(0, FREE_SCAN_LIMIT - scansUsed);
  const scanLocked = !isPro && scansLeft <= 0;

  return {
    tier: effectiveTier,
    setTier,
    isPro,
    isElite,
    isScout,
    hasCheapLoop,
    isOwner,
    scansUsed,
    scansLeft,
    scanLocked,
    incScan,
    FREE_SCAN_LIMIT,
  };
}

/* Tier catalog — single source of truth for pricing UI */
export const TIERS = [
  {
    id: "free" as Tier,
    name: "Trainer",
    price: 0,
    period: "forever",
    badge: null,
    features: [
      "Browse cards, sets & market",
      "Vault up to 50 cards",
      `${FREE_SUBMISSION_LIMIT} free submissions (test mode)`,
      "Battle simulator",
      "Wishlist",
      "See cheapest listed price (Strike locked)",
    ],
    cta: "Current plan",
  },
  {
    id: "scout" as Tier,
    name: "Deal Scout",
    price: 4.99,
    period: "/mo",
    badge: "Cheap Card Loop",
    features: [
      "Cheapest live listing on every card",
      "Strike → next cheapest auto-loads",
      "TCGPlayer + Cardmarket landed lows (real eBay BIN only)",
      "Requires member sign-in",
      "Included in Pro & Elite",
    ],
    cta: "Start Scout",
  },
  {
    id: "pro" as Tier,
    name: "Pro Trainer",
    price: 9.99,
    period: "/mo",
    badge: "Most Popular",
    features: [
      "Unlimited vault",
      "Unlimited card submissions",
      "Marketplace Buy & Sell tools",
      "Deal Scout cheap-card loop included",
      "Best-price finder across 11 sites",
      "Priority TCG price refresh",
      "Battle leaderboards",
    ],
    cta: "Start Pro",
  },
  {
    id: "elite" as Tier,
    name: "Elite Champion",
    price: 19.99,
    period: "/mo",
    badge: "Elite",
    features: [
      "Everything in Pro",
      "Advanced market analytics & trends",
      "eBay sold-comps deep history",
      "AI grade-prediction (beta)",
      "Early access to new features",
      "Direct support",
    ],
    cta: "Go Elite",
  },
];
