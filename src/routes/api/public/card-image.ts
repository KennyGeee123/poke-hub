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
        try {
          const r = await fetch(target.toString(), { signal: AbortSignal.timeout(10000) });
          const type = r.headers.get("content-type") || "";
          if (!r.ok || !type.startsWith("image/")) {
            return Response.json({ error: "Image unavailable" }, { status: 502 });
          }
          return new Response(r.body, {
            status: 200,
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
              "access-control-allow-origin": "*",
            },
          });
        } catch {
          return Response.json({ error: "Image unavailable" }, { status: 502 });
        }
      },
    },
  },
});
