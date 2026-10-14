// POST /api/shop-refresh?offset=0&limit=3&kinds=sealed,single&external=1
// Header: x-shop-admin: <SHOP_ADMIN_SECRET>. Call repeatedly with nextOffset (cron) to page through the catalog.
import { createFileRoute } from "@tanstack/react-router";
import { refreshBatch } from "@/lib/shop/refresh.server";
import { ADMIN_HEADER, safeEqual } from "@/lib/shop/admin";

export const Route = createFileRoute("/api/shop-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!safeEqual(request.headers.get(ADMIN_HEADER) ?? "", process.env.SHOP_ADMIN_SECRET ?? "")) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const u = new URL(request.url);
        const kinds = (u.searchParams.get("kinds") ?? "sealed,single").split(",").filter((k): k is "sealed" | "single" => k === "sealed" || k === "single");
        try {
          const r = await refreshBatch({
            offset: Math.max(0, Number(u.searchParams.get("offset") ?? 0) || 0),
            limit: Math.min(10, Math.max(1, Number(u.searchParams.get("limit") ?? 3) || 3)),
            kinds,
            external: u.searchParams.get("external") !== "0",
          });
          return Response.json(r);
        } catch (e) {
          return Response.json({ error: String((e as Error).message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
