// POST /api/public/shop-order  { productId, quantity, email, name, shipping:{line1,line2,city,state,zip,country} }
// Prices from the DB (never the client) and snapshots the cheapest source for fulfillment.
// With STRIPE_SECRET_KEY: returns a Stripe Checkout URL (webhook marks paid). Without: order stays "pending".
import { createFileRoute } from "@tanstack/react-router";
import { EMAIL_RE, orderCode, validateShipping } from "@/lib/shop/checkout";
import { adminDb, createCheckout, notifyOrder, siteUrl } from "@/lib/shop/server";
import { variantLabel } from "@/lib/shop/grades";

export const Route = createFileRoute("/api/public/shop-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const productId = String(b?.productId ?? "");
        const email = String(b?.email ?? "").trim().slice(0, 200);
        const qty = Math.min(20, Math.max(1, Math.floor(Number(b?.quantity ?? 1)) || 1));
        const ship = (b?.shipping ?? {}) as Record<string, unknown>;
        const clean = Object.fromEntries(["line1", "line2", "city", "state", "zip", "country"].map((k) => [k, String(ship[k] ?? "").trim().slice(0, 120)]));
        if (!productId || !EMAIL_RE.test(email)) return Response.json({ error: "productId and a valid email are required" }, { status: 400 });
        const shipErr = validateShipping(clean);
        if (shipErr) return Response.json({ error: shipErr }, { status: 400 });
        const sb = adminDb();
        const { data: p, error } = await sb.from("shop_products").select("id,name,sale_price,cheapest_source_price,cheapest_source,cheapest_source_url,in_stock,sell_mode,hidden,price_override").eq("id", productId).maybeSingle();
        let price = p?.price_override ?? p?.sale_price;
        if (error || !p || price == null || !p.in_stock || p.sell_mode !== "store" || p.hidden) return Response.json({ error: "Product unavailable" }, { status: 404 });
        // Chosen grade/condition: price and source come from that variant (never from the client).
        let snap = { price: p.cheapest_source_price, source: p.cheapest_source, url: p.cheapest_source_url };
        let variant: { id: string; label: string } | null = null;
        const variantId = b?.variantId ? String(b.variantId).slice(0, 200) : "";
        if (variantId) {
          const { data: v } = await sb.from("shop_variants").select("id,product_id,finish,grader,grade,source,source_price,source_url,sale_price,price_status,hidden").eq("id", variantId).maybeSingle();
          if (!v || v.product_id !== p.id || v.hidden) return Response.json({ error: "That grade isn't available" }, { status: 404 });
          if (v.price_status !== "priced" || v.sale_price == null) return Response.json({ error: "That grade is price on request — contact us for a quote" }, { status: 409 });
          price = v.sale_price;
          snap = { price: v.source_price, source: v.source, url: v.source_url };
          variant = { id: v.id, label: variantLabel(v) };
        }
        const { data: order, error: oe } = await sb.from("shop_orders").insert({
          product_id: p.id, product_name: p.name, quantity: qty, sale_price: price,
          source_price_snapshot: snap.price, source_snapshot: snap.source, source_url_snapshot: snap.url,
          variant_id: variant?.id ?? null, variant_label: variant?.label ?? null,
          customer_email: email, customer_name: String(b?.name ?? "").slice(0, 120), shipping_address: clean,
        }).select("id,status,sale_price,quantity,product_name,customer_email,variant_label").single();
        if (oe || !order) return Response.json({ error: "Could not create order" }, { status: 500 });
        const site = siteUrl(request);
        const pub = { id: order.id, code: orderCode(order.id), status: order.status, sale_price: order.sale_price, quantity: order.quantity };
        try {
          const session = await createCheckout(order, site);
          if (session) {
            await sb.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
            return Response.json({ order: pub, checkoutUrl: session.url });
          }
        } catch (e) {
          console.error("[shop-order] stripe", e);
          return Response.json({ order: pub, checkoutUrl: null, message: "Order saved, but payment could not start. We'll email you a payment link." });
        }
        await notifyOrder("received", order, site);
        return Response.json({ order: pub, checkoutUrl: null, message: "Order received. You'll get a payment link by email." });
      },
    },
  },
});
