// Shared (client + server) admin helpers and validation.
import type { MarkupRule } from "./core";

export const ORDER_STATUSES = ["pending", "paid", "ordered_from_source", "shipped", "delivered", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ADMIN_HEADER = "x-shop-admin";

export function profit(salePrice: number | null, sourcePrice: number | null, qty = 1): number | null {
  if (salePrice == null || sourcePrice == null) return null;
  return Math.round((Number(salePrice) - Number(sourcePrice)) * qty * 100) / 100;
}

export function validateRule(r: Partial<MarkupRule>): string | null {
  const min = Number(r.min_price), max = r.max_price == null || (r.max_price as unknown) === "" ? null : Number(r.max_price);
  const flat = Number(r.flat_usd ?? 0), pct = Number(r.percent ?? 0);
  if (!Number.isFinite(min) || min < 0) return "min_price must be ≥ 0";
  if (max != null && (!Number.isFinite(max) || max <= min)) return "max_price must be greater than min_price";
  if (!Number.isFinite(flat) || flat < 0 || flat > 1000) return "flat_usd must be 0–1000";
  if (!Number.isFinite(pct) || pct < 0 || pct > 500) return "percent must be 0–500";
  if (flat === 0 && pct === 0) return "set a flat or percent markup";
  return null;
}

export function validateOrderPatch(p: Record<string, unknown>): string | null {
  if (p.status != null && !ORDER_STATUSES.includes(p.status as OrderStatus)) return "invalid status";
  if (p.tracking_number != null && String(p.tracking_number).length > 100) return "tracking too long";
  if (p.notes != null && String(p.notes).length > 2000) return "notes too long";
  return null;
}

export function validateProductPatch(p: Record<string, unknown>): string | null {
  if (p.sell_mode != null && p.sell_mode !== "store" && p.sell_mode !== "affiliate") return "invalid sell_mode";
  if (p.affiliate_url != null && p.affiliate_url !== "") {
    try { if (!/^https?:$/.test(new URL(String(p.affiliate_url)).protocol)) return "affiliate_url must be http(s)"; } catch { return "invalid affiliate_url"; }
  }
  if (p.price_override != null && p.price_override !== "") {
    const n = Number(p.price_override);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return "invalid price_override";
  }
  return null;
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
