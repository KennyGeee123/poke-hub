// GET /api/public/shop?kind=sealed|single&q=&page=1&pageSize=24&sort=price_asc|price_desc|newest
// Public catalog: sale prices only (no source prices/urls).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { COMING_SOON, shopUnavailable } from "@/lib/shop/core";

const comingSoon = () => Response.json({ items: [], total: 0, page: 1, pageSize: 24, variants: [], comingSoon: true, message: COMING_SOON }, { headers: { "Cache-Control": "public, max-age=60" } });

export const Route = createFileRoute("/api/public/shop")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
        const u = new URL(request.url);
        const kind = u.searchParams.get("kind");
        const q = (u.searchParams.get("q") ?? "").slice(0, 80).replace(/[%,()]/g, " ").trim();
        const page = Math.max(1, Number(u.searchParams.get("page") ?? 1) || 1);
        const size = Math.min(60, Math.max(1, Number(u.searchParams.get("pageSize") ?? 24) || 24));
        const sort = u.searchParams.get("sort") ?? "price_asc";
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
        let query = sb.from("shop_catalog").select("*", { count: "exact" }).eq("in_stock", true);
        const id = u.searchParams.get("id");
        if (id) query = query.eq("id", id.slice(0, 64));
        if (kind === "sealed" || kind === "single") query = query.eq("kind", kind);
        if (q) query = query.or(`name.ilike.%${q}%,set_name.ilike.%${q}%`);
        query = sort === "newest" ? query.order("updated_at", { ascending: false }) : query.order("sale_price", { ascending: sort !== "price_desc" });
        const { data, count, error } = await query.range((page - 1) * size, page * size - 1);
        if (shopUnavailable(error)) return comingSoon();
        if (error) return Response.json({ error: "Could not load the shop." }, { status: 500 });
        if (id && data?.length) {
          const { data: variants } = await sb.from("shop_catalog_variants").select("id,product_id,finish,grader,grade,sale_price,price_status,updated_at").eq("product_id", data[0].id);
          return Response.json({ items: data, total: count ?? 0, page, pageSize: size, variants: variants ?? [] }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=300" } });
        }
        return Response.json({ items: data ?? [], total: count ?? 0, page, pageSize: size }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=300" } });
        } catch (e) {
          if (shopUnavailable(e as Error)) return comingSoon();
          throw e;
        }
      },
    },
  },
});
