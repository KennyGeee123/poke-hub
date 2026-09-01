import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SOURCE_BASE = "https://play.pokemonshowdown.com/audio";
const TRACKS = new Set([
  "dpp-trainer", "dpp-rival", "hgss-johto-trainer", "hgss-kanto-trainer",
  "bw-trainer", "bw-rival", "bw-subway-trainer", "bw2-rival",
  "bw2-kanto-gym-leader", "bw2-homika-dogars", "xy-trainer", "xy-rival",
  "oras-trainer", "oras-rival", "sm-trainer", "sm-rival",
  "colosseum-miror-b", "xd-miror-b", "spl-elite4",
]);

const RadioQuery = z.object({
  track: z.string().regex(/^[a-z0-9-]+$/).refine((track) => TRACKS.has(track), "Unknown track"),
  format: z.enum(["mp3", "ogg"]).default("mp3"),
});

export const Route = createFileRoute("/api/public/poke-radio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = RadioQuery.safeParse({
          track: url.searchParams.get("track") ?? "",
          format: url.searchParams.get("format") ?? "mp3",
        });

        if (!parsed.success) {
          return Response.json({ error: "Invalid radio track" }, { status: 400 });
        }

        const { track, format } = parsed.data;
        const range = request.headers.get("Range");
        const upstream = await fetch(`${SOURCE_BASE}/${track}.${format}`, {
          headers: {
            Accept: format === "ogg" ? "audio/ogg" : "audio/mpeg",
            ...(range ? { Range: range } : {}),
          },
        });

        if (!upstream.ok) {
          return Response.json({ error: `Radio source failed: ${upstream.status}` }, { status: 502 });
        }

        const headers = new Headers({
          "Content-Type": format === "ogg" ? "audio/ogg" : "audio/mpeg",
          "Cache-Control": "public, max-age=604800, immutable",
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": "bytes",
        });
        ["Content-Length", "Content-Range"].forEach((name) => {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        });

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
