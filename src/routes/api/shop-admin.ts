// POST /api/shop-admin  { action, ...args }   Header: x-shop-admin: <SHOP_ADMIN_SECRET>
// Every action is verified server-side; uses the service-role client (admin-only data like source URLs).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_HEADER, ORDER_STATUSES, profit, profitPct, validatePricing, safeEqual, validateOrderPatch, validateProductPatch, validateRule } from "@/lib/shop/admin";
import { refreshBatch } from "@/lib/shop/refresh.server";
import { ROUNDING_MODES, normalizePricing } from "@/lib/shop/core";
import { notifyOrder, siteUrl } from "@/lib/shop/server";

type Args = Record<string, unknown>;
const bad = (error: string, status = 400) => Response.json({ error }, { status });
const str = (v: unknown, n = 200) => String(v ?? "").slice(0, n);

async function handle(action: string, a: Args, request: Request): Promise<Response> {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  switch (action) {
    case "ping":
      return Response.json({ ok: true });

    case "orders.list": {
      let q = sb.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (a.status && ORDER_STATUSES.includes(a.status as never)) q = q.eq("status", a.status as string);
      const { data, error } = await q;
      if (error) return bad(error.message, 500);
      const ids = [...new Set((data ?? []).map((o) => o.product_id))];
      const { data: prods } = ids.length ? await sb.from("shop_products").select("id,cheapest_source_price").in("id", ids) : { data: [] };
      const cur = new Map((prods ?? []).map((p) => [p.id, p.cheapest_source_price]));
      return Response.json({
        orders: (data ?? []).map((o) => {
          const current = cur.get(o.product_id) ?? null;
          return { ...o, profit: profit(o.sale_price, o.source_price_snapshot, o.quantity), profit_pct: profitPct(o.sale_price, o.source_price_snapshot), current_source_price: current, // Only warn while the item still has to be bought from the source.
            negative_margin: (o.status === "pending" || o.status === "paid") && current != null && Number(current) > Number(o.sale_price) };
        }),
      });
    }
    case "order.get": {
      const { data: order, error } = await sb.from("shop_orders").select("*").eq("id", str(a.id, 64)).maybeSingle();
      if (error || !order) return bad("Order not found", 404);
      const [{ data: product }, { data: listings }] = await Promise.all([
        sb.from("shop_products").select("id,name,cheapest_source,cheapest_source_price,cheapest_source_url,sale_price,price_override,updated_at").eq("id", order.product_id).maybeSingle(),
        sb.from("shop_listings").select("*").eq("product_id", order.product_id).order("source_price"),
      ]);
      return Response.json({
        order: { ...order, profit: profit(order.sale_price, order.source_price_snapshot, order.quantity), profit_pct: profitPct(order.sale_price, order.source_price_snapshot) },
        currentProfitPct: profitPct(order.sale_price, product?.cheapest_source_price ?? null),
        product, listings: listings ?? [],
        currentProfit: profit(order.sale_price, product?.cheapest_source_price ?? null, order.quantity),
      });
    }
    case "order.update": {
      const patch: Args = {};
      for (const k of ["status", "tracking_number", "notes"]) if (a[k] !== undefined) patch[k] = a[k] === "" ? null : str(a[k], 2000);
      const err = validateOrderPatch(patch);
      if (err) return bad(err);
      const { data: before } = await sb.from("shop_orders").select("status").eq("id", str(a.id, 64)).maybeSingle();
      const now = new Date().toISOString();
      if (patch.status === "shipped" && before?.status !== "shipped") patch.shipped_at = now;
      if (patch.status === "paid" && before?.status !== "paid") patch.paid_at = now;
      const { data, error } = await sb.from("shop_orders").update({ ...patch, updated_at: now }).eq("id", str(a.id, 64)).select("*").maybeSingle();
      if (error || !data) return bad(error?.message ?? "Order not found", 400);
      let email: string | null = null;
      if (patch.status === "shipped" && before?.status !== "shipped") email = await notifyOrder("shipped", data, siteUrl(request));
      return Response.json({ order: data, email });
    }

    case "rules.list": {
      const { data, error } = await sb.from("shop_markup_rules").select("*").order("min_price");
      return error ? bad(error.message, 500) : Response.json({ rules: data ?? [] });
    }
    case "rules.save": {
      const r = a.rule as Args;
      const row = {
        min_price: Number(r?.min_price ?? 0),
        max_price: r?.max_price === "" || r?.max_price == null ? null : Number(r.max_price),
        flat_usd: Number(r?.flat_usd ?? 0),
        percent: Number(r?.percent ?? 0),
        min_profit_usd: Number(r?.min_profit_usd ?? 0) || 0,
        fixed_price_usd: r?.fixed_price_usd === "" || r?.fixed_price_usd == null ? null : Number(r.fixed_price_usd),
        active: r?.active !== false,
      };
      const err = validateRule(row);
      if (err) return bad(err);
      const q = r?.id ? sb.from("shop_markup_rules").update(row).eq("id", Number(r.id)) : sb.from("shop_markup_rules").insert(row);
      const { error } = await q;
      return error ? bad(error.message, 500) : Response.json({ ok: true });
    }
    case "rules.delete": {
      const { error } = await sb.from("shop_markup_rules").delete().eq("id", Number(a.id));
      return error ? bad(error.message, 500) : Response.json({ ok: true });
    }
    case "pricing.get": {
      const { data } = await sb.from("shop_state").select("value").eq("key", "pricing").maybeSingle();
      return Response.json({ pricing: normalizePricing(data?.value) });
    }
    case "pricing.save": {
      const p = (a.pricing ?? {}) as Args;
      const err = validatePricing(p);
      if (err) return bad(err);
      if (!ROUNDING_MODES.includes(p.rounding as never)) return bad("rounding must be whole, 99 or none");
      const value = { min_profit_usd: Math.round(Number(p.min_profit_usd) * 100) / 100, rounding: p.rounding };
      const { error } = await sb.from("shop_state").upsert({ key: "pricing", value, updated_at: new Date().toISOString() });
      return error ? bad(error.message, 500) : Response.json({ pricing: value });
    }
    case "prices.recompute": {
      const { data, error } = await sb.rpc("shop_recompute_prices");
      return error ? bad(error.message, 500) : Response.json({ updated: data });
    }

    case "products.list": {
      const page = Math.max(1, Number(a.page ?? 1) || 1), size = 50;
      const q = str(a.q, 80).replace(/[%,()]/g, " ").trim();
      let query = sb.from("shop_products")
        .select("id,kind,product_type,name,set_name,card_number,cheapest_source,cheapest_source_price,cheapest_source_url,sale_price,price_override,sell_mode,affiliate_url,hidden,in_stock,updated_at", { count: "exact" })
        .order("name").range((page - 1) * size, page * size - 1);
      if (q) query = query.or(`name.ilike.%${q}%,set_name.ilike.%${q}%`);
      if (a.kind === "sealed" || a.kind === "single") query = query.eq("kind", a.kind);
      const { data, count, error } = await query;
      return error ? bad(error.message, 500) : Response.json({ products: data ?? [], total: count ?? 0, page, pageSize: size });
    }
    case "product.update": {
      const patch: Args = {};
      for (const k of ["sell_mode", "affiliate_url", "price_override", "hidden"]) if (a[k] !== undefined) patch[k] = a[k] === "" ? null : a[k];
      const err = validateProductPatch(patch);
      if (err) return bad(err);
      if (patch.hidden !== undefined) patch.hidden = patch.hidden === true;
      if (patch.price_override != null) patch.price_override = Number(patch.price_override);
      const { data, error } = await sb.from("shop_products").update(patch).eq("id", str(a.id, 64)).select("id").maybeSingle();
      return error || !data ? bad(error?.message ?? "Product not found") : Response.json({ ok: true });
    }

    case "refresh": {
      const kinds = (Array.isArray(a.kinds) ? a.kinds : ["sealed", "single"]).filter((k): k is "sealed" | "single" => k === "sealed" || k === "single");
      const r = await refreshBatch({
        offset: Math.max(0, Number(a.offset ?? 0) || 0),
        limit: Math.min(10, Math.max(1, Number(a.limit ?? 3) || 3)),
        kinds, external: a.external !== false,
      });
      return Response.json(r);
    }
  }
  return bad("Unknown action");
}

export const Route = createFileRoute("/api/shop-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SHOP_ADMIN_SECRET ?? "";
        if (!safeEqual(request.headers.get(ADMIN_HEADER) ?? "", secret)) return bad("Unauthorized", 401);
        const body = (await request.json().catch(() => null)) as Args | null;
        if (!body?.action) return bad("Missing action");
        try {
          return await handle(String(body.action), body, request);
        } catch (e) {
          return bad(String((e as Error).message ?? e).slice(0, 300), 500);
        }
      },
    },
  },
});
