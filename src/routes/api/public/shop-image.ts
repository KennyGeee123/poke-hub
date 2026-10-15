// GET /api/public/shop-image?id=<product id> — proxies the product image so the upstream CDN isn't exposed.
import { createFileRoute } from "@tanstack/react-router";
import { adminDb } from "@/lib/shop/server";

const ALLOWED = /^https:\/\/(tcgplayer-cdn\.tcgplayer\.com|product-images\.tcgplayer\.com|[a-z0-9.-]+\.(myshopify|shopify)\.com|cdn\.shopify\.com|i\.ebayimg\.com)\//;

export const Route = createFileRoute("/api/public/shop-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = (new URL(request.url).searchParams.get("id") ?? "").slice(0, 64);
        const { data } = await adminDb().from("shop_products").select("image_url,hidden").eq("id", id).maybeSingle();
        if (!data?.image_url || data.hidden || !ALLOWED.test(data.image_url)) return new Response("Not found", { status: 404 });
        const big = data.image_url.replace("_200w", "_400w");
        const r = await fetch(big).then((r) => (r.ok ? r : fetch(data.image_url))).catch(() => null);
        if (!r?.ok || !r.body) return new Response("Upstream error", { status: 502 });
        return new Response(r.body, {
          headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
        });
      },
    },
  },
});
