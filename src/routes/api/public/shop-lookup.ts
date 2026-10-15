// POST /api/public/shop-lookup { code, email } → customer-safe order status (no source data).
import { createFileRoute } from "@tanstack/react-router";
import { adminDb } from "@/lib/shop/server";
import { COMING_SOON, shopUnavailable } from "@/lib/shop/core";

export const Route = createFileRoute("/api/public/shop-lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const code = String(b?.code ?? "").replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase();
        const email = String(b?.email ?? "").trim().toLowerCase().slice(0, 200);
        if (code.length !== 8 || !email) return Response.json({ error: "Enter your 8-character order number and email" }, { status: 400 });
        let res;
        try { res = await adminDb().from("shop_orders")
          .select("order_code,product_id,product_name,variant_label,quantity,sale_price,status,tracking_number,created_at,paid_at,shipped_at,customer_email")
          .eq("order_code", code); } catch (e) { res = { data: null, error: e as Error }; }
        if (shopUnavailable(res.error)) return Response.json({ error: COMING_SOON, comingSoon: true }, { status: 503 });
        const { data } = res;
        const o = (data ?? []).find((r) => String(r.customer_email).toLowerCase() === email);
        if (!o) return Response.json({ error: "No order found for that number and email" }, { status: 404 });
        const { customer_email: _omit, ...pub } = o;
        return Response.json({ order: { ...pub, total: Number(o.sale_price) * o.quantity } });
      },
    },
  },
});
