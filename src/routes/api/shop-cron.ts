// GET|POST /api/shop-cron — scheduled refresh. Auth: "Authorization: Bearer <CRON_SECRET>" (Vercel Cron style)
// or "x-shop-admin: <SHOP_ADMIN_SECRET>". Each call refreshes the next batch and stores the offset in shop_state,
// wrapping to 0 when the catalog is done. Schedule every ~10 min to sweep the full catalog continuously.
import { createFileRoute } from "@tanstack/react-router";
import { ADMIN_HEADER, safeEqual } from "@/lib/shop/admin";
import { refreshBatch } from "@/lib/shop/refresh.server";
import { adminDb } from "@/lib/shop/server";

async function run(request: Request): Promise<Response> {
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const okCron = safeEqual(bearer, process.env.CRON_SECRET ?? "");
  const okAdmin = safeEqual(request.headers.get(ADMIN_HEADER) ?? "", process.env.SHOP_ADMIN_SECRET ?? "");
  if (!okCron && !okAdmin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(request.url);
  const limit = Math.min(10, Math.max(1, Number(u.searchParams.get("limit") ?? process.env.SHOP_CRON_BATCH ?? 2) || 2));
  const sb = adminDb();
  const { data: st } = await sb.from("shop_state").select("value").eq("key", "refresh").maybeSingle();
  const offset = Number((st?.value as { offset?: number } | undefined)?.offset ?? 0) || 0;
  const r = await refreshBatch({ offset, limit, kinds: ["sealed", "single"], external: true });
  const next = r.done ? 0 : r.nextOffset;
  await sb.from("shop_state").upsert({ key: "refresh", value: { offset: next, last: { ...r, at: new Date().toISOString() } }, updated_at: new Date().toISOString() });
  return Response.json({ ...r, storedOffset: next });
}

export const Route = createFileRoute("/api/shop-cron")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
