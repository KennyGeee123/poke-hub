// POST /api/public/shop-order  { productId, quantity, email, name, shipping:{line1,line2,city,state,zip,country} }
// Creates a pending order priced from the DB (never from the client) and snapshots the cheapest source for fulfillment.
// TODO(stripe): when STRIPE_SECRET_KEY is set, create a Checkout Session here and return its url; mark paid via webhook.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/api/public/shop-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const productId = String(b?.productId ?? "");
        const email = String(b?.email ?? "").trim().slice(0, 200);
        const qty = Math.min(20, Math.max(1, Number(b?.quantity ?? 1) || 1));
        const ship = (b?.shipping ?? {}) as Record<string, unknown>;
        if (!productId || !EMAIL.test(email)) return Response.json({ error: "productId and a valid email are required" }, { status: 400 });
        if (!ship.line1 || !ship.city || !ship.zip) return Response.json({ error: "Shipping address is incomplete" }, { status: 400 });
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const { data: p, error } = await sb.from("shop_products").select("id,name,sale_price,cheapest_source_price,cheapest_source,cheapest_source_url,in_stock,sell_mode").eq("id", productId).maybeSingle();
        if (error || !p || p.sale_price == null || !p.in_stock || p.sell_mode !== "store") return Response.json({ error: "Product unavailable" }, { status: 404 });
        const clean = Object.fromEntries(["line1", "line2", "city", "state", "zip", "country"].map((k) => [k, String(ship[k] ?? "").slice(0, 120)]));
        const { data: order, error: oe } = await sb.from("shop_orders").insert({
          product_id: p.id, product_name: p.name, quantity: qty, sale_price: p.sale_price,
          source_price_snapshot: p.cheapest_source_price, source_snapshot: p.cheapest_source, source_url_snapshot: p.cheapest_source_url,
          customer_email: email, customer_name: String(b?.name ?? "").slice(0, 120), shipping_address: clean,
        }).select("id,status,sale_price,quantity").single();
        if (oe) return Response.json({ error: "Could not create order" }, { status: 500 });
        return Response.json({ order, checkoutUrl: null, message: "Order received. You'll get a payment link by email." });
      },
    },
  },
});
