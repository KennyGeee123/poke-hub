// Same-origin image proxy for card art so the Full Art Studio can read pixels
// from a <canvas> without CORS taint. Allow-listed card CDNs only.
import { createFileRoute } from "@tanstack/react-router";
import { CARD_IMAGE_HOSTS as ALLOWED } from "@/lib/card-image-hosts";

export const Route = createFileRoute("/api/public/card-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url") || "";
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return Response.json({ error: "Invalid url" }, { status: 400 });
        }
        if (target.protocol !== "https:" || !ALLOWED.has(target.hostname)) {
          return Response.json({ error: "Host not allowed" }, { status: 400 });
        }
        // Card CDNs (TCGdex especially) answer bursts with 503s. Retry busy
        // answers server-side so the tile gets real art instead of a black box.
        // pokemontcg.io serves a card-back PNG with HTTP 404 — r.ok rejects it.
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await new Promise((res) => setTimeout(res, 250 * 3 ** (attempt - 1)));
          try {
            const r = await fetch(target.toString(), {
              signal: AbortSignal.timeout(8000),
              headers: { accept: "image/avif,image/webp,image/png,image/*;q=0.8" },
            });
            const type = r.headers.get("content-type") || "";
            if (r.ok && type.startsWith("image/")) {
              return new Response(r.body, {
                status: 200,
                headers: {
                  "content-type": type,
                  "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
                  "access-control-allow-origin": "*",
                },
              });
            }
            if (r.status < 500 && r.status !== 429) break; // 404 etc: not transient
          } catch {
            /* timeout / network — retry */
          }
        }
        return Response.json(
          { error: "Image unavailable" },
          { status: 502, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
