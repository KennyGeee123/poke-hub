// Server-only shop utilities: admin DB client, email (Resend), Stripe checkout.
import { createClient } from "@supabase/supabase-js";
import { type OrderEmailInput, orderCode, orderEmail } from "./checkout";

export function adminDb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export function siteUrl(request?: Request): string {
  return (process.env.SHOP_SITE_URL ?? (request ? new URL(request.url).origin : "")).replace(/\/$/, "");
}

/** Send via Resend when RESEND_API_KEY is set; otherwise a logged no-op. Never throws. */
export async function sendEmail(to: string | undefined | null, subject: string, text: string): Promise<"sent" | "skipped" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return "skipped";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.SHOP_EMAIL_FROM ?? "Shop <onboarding@resend.dev>", to: [to], subject, text }),
    });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

type OrderRow = { id: string; product_name: string; variant_label?: string | null; quantity: number; sale_price: number; tracking_number?: string | null; customer_email: string };
export function emailInput(o: OrderRow, site: string): OrderEmailInput {
  return { code: orderCode(o.id), productName: o.variant_label ? `${o.product_name} (${o.variant_label})` : o.product_name, quantity: o.quantity, total: Number(o.sale_price) * o.quantity, tracking: o.tracking_number, siteUrl: site };
}
export async function notifyOrder(kind: "received" | "paid" | "shipped", o: OrderRow, site: string) {
  const e = orderEmail(kind, emailInput(o, site));
  const customer = await sendEmail(o.customer_email, e.subject, e.text);
  if (kind === "received" || kind === "paid") {
    const a = orderEmail("admin_new", emailInput(o, site));
    await sendEmail(process.env.SHOP_ADMIN_EMAIL, `${a.subject}${kind === "paid" ? " (paid)" : ""}`, a.text);
  }
  return customer;
}

/** Create a Stripe Checkout Session (no SDK). Returns null when STRIPE_SECRET_KEY is absent. */
export async function createCheckout(o: OrderRow, site: string): Promise<{ id: string; url: string } | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const code = orderCode(o.id);
  const form = new URLSearchParams({
    mode: "payment",
    customer_email: o.customer_email,
    client_reference_id: o.id,
    "metadata[order_id]": o.id,
    success_url: `${site}/shop/confirmation?order=${o.id}&paid=1`,
    cancel_url: `${site}/shop/order?code=${code}`,
    "line_items[0][quantity]": String(o.quantity),
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(Number(o.sale_price) * 100)),
    "line_items[0][price_data][product_data][name]": o.variant_label ? `${o.product_name} (${o.variant_label})` : o.product_name,
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const j = (await r.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;
  if (!r.ok || !j?.id || !j.url) throw new Error(`Stripe: ${j?.error?.message ?? r.status}`);
  return { id: j.id, url: j.url };
}
