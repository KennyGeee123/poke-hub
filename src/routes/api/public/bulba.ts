// Server-side Bulbapedia lookup. Bulbapedia's API no longer sends CORS headers
// to browsers, so the card detail panel asks us instead. Always answers 200 so
// a miss never shows up as a console error.
import { createFileRoute } from "@tanstack/react-router";

const API = "https://bulbapedia.bulbagarden.net/w/api.php";

export const Route = createFileRoute("/api/public/bulba")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const title = (new URL(request.url).searchParams.get("title") || "").slice(0, 80);
        if (!/^[\p{L}\p{N} _.'’():é-]+$/u.test(title)) {
          return Response.json({ query: null });
        }
        const params = new URLSearchParams({
          action: "query",
          format: "json",
          prop: "extracts|pageimages",
          exintro: "1",
          explaintext: "1",
          exchars: "600",
          piprop: "original",
          pithumbsize: "400",
          redirects: "1",
          titles: title,
        });
        try {
          const r = await fetch(`${API}?${params}`, {
            headers: { "user-agent": "PokeVault/1.0 (fan-made collection app)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) return Response.json({ query: null });
          const j = await r.json();
          return Response.json(j, {
            headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
          });
        } catch {
          return Response.json({ query: null });
        }
      },
    },
  },
});
