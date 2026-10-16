// POST /api/stripe-webhook — Stripe sends checkout.session.completed here (set STRIPE_WEBHOOK_SECRET).
import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeSignature } from "@/lib/shop/checkout";
import { adminDb, notifyOrder, siteUrl } from "@/lib/shop/server";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "");
        if (!ok) return Response.json({ error: "Bad signature" }, { status: 400 });
        const evt = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string; metadata?: { order_id?: string } } } };
        if (evt.type === "checkout.session.completed" || evt.type === "checkout.session.async_payment_succeeded") {
          const s = evt.data.object;
          if (s.payment_status && s.payment_status !== "paid") return Response.json({ received: true });
          const sb = adminDb();
          const q = sb.from("shop_orders").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("status", "pending");
          const { data, error } = await (s.metadata?.order_id ? q.eq("id", s.metadata.order_id) : q.eq("stripe_session_id", s.id)).select("*");
          // Non-2xx makes Stripe retry, so a transient DB failure never loses a payment.
          if (error) { console.error("[stripe-webhook]", error.message); return Response.json({ error: "DB update failed" }, { status: 500 }); }
          for (const o of data ?? []) {
            // Rotate the shop: claim the seller we'll buy from so the next buyer sees the next-cheapest box (or sold out).
            // A rotation failure must not make Stripe retry an already-recorded payment, so it is only logged.
            const { error: re } = await sb.rpc("shop_rotate_after_sale", { p_order_id: o.id });
            if (re) console.error("[stripe-webhook] rotate", re.message);
            await notifyOrder("paid", o, siteUrl(request));
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
