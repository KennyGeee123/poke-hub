// Proxies pokemontcg.io v2 so the browser hits our origin (Vercel cache + optional server key)
// instead of burning the keyless 30/min public quota from every client.
import { createFileRoute } from "@tanstack/react-router";
import { parseCardId } from "@/lib/card-identity";
import { shippedPrint } from "@/lib/box-set-extras";

const UPSTREAM = "https://api.pokemontcg.io/v2";

export const Route = createFileRoute("/api/public/tcg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";
        if (!path.startsWith("/") || path.includes("://") || path.includes("..")) {
          return Response.json({ error: "Invalid path" }, { status: 400 });
        }
        const key =
          process.env.POKEMONTCG_API_KEY ||
          process.env.VITE_POKEMONTCG_API_KEY ||
          request.headers.get("x-api-key") ||
          "";
        const headers: Record<string, string> = { Accept: "application/json" };
        if (key) headers["X-Api-Key"] = key;

        let lastStatus = 502;
        let body = '{"error":{"message":"Card API unavailable"}}';
        for (let i = 0; i < 3; i++) {
          try {
            const r = await fetch(`${UPSTREAM}${path}`, {
              headers,
              signal: AbortSignal.timeout(8000),
            });
            lastStatus = r.status;
            body = await r.text();
            if (r.status < 500 && r.status !== 429) {
              return new Response(body, {
                status: r.status,
                headers: {
                  "content-type": r.headers.get("content-type") || "application/json",
                  "cache-control": r.ok
                    ? "public, s-maxage=120, stale-while-revalidate=600"
                    : "no-store",
                },
              });
            }
          } catch {
            lastStatus = 502;
          }
          await new Promise((res) => setTimeout(res, 300 * (i + 1)));
        }
        // Last resort: TCGdex for a single card so the client never sees a blank 500 page.
        const m = path.match(/^\/cards\/([^/?]+)$/);
        if (m) {
          try {
            const dx = await fetch(`https://api.tcgdex.net/v2/en/cards/${m[1]}`, {
              signal: AbortSignal.timeout(8000),
            });
            if (dx.ok) {
              const raw: any = await dx.json();
              const parsed = parseCardId(String(raw?.id || m[1]), raw?.set?.id);
              const setId = String(raw?.set?.id || parsed.setId || "");
              const num = String(raw?.localId ?? parsed.localId ?? "");
              const img = typeof raw?.image === "string" ? raw.image : "";
              // image:null (30th Classic Collection): this card's shipped scan,
              // never a pokemontcg URL guessed from the number.
              const shipped = img ? null : shippedPrint(String(raw?.id || m[1]), raw?.name);
              const tcgdexOnly = setId.includes(".") || setId.includes("-");
              const data = {
                id: String(raw?.id || m[1]),
                name: String(raw?.name || m[1]),
                hp: raw?.hp != null ? String(raw.hp) : undefined,
                types: raw?.types,
                rarity: raw?.rarity,
                number: num,
                artist: raw?.illustrator,
                set: { id: setId, name: String(raw?.set?.name || setId) },
                printedNumber: shipped?.printedNumber,
                images: shipped
                  ? shipped.images
                  : {
                      small: img
                        ? `${img}/low.webp`
                        : tcgdexOnly
                          ? ""
                          : `https://images.pokemontcg.io/${setId}/${num}.png`,
                      large: img
                        ? `${img}/high.webp`
                        : tcgdexOnly
                          ? ""
                          : `https://images.pokemontcg.io/${setId}/${num}_hires.png`,
                    },
              };
              return Response.json(
                { data },
                { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=600" } },
              );
            }
          } catch {}
        }
        // The app's own client asks for a "soft" failure: 200 + a marker it
        // understands, so a flaky upstream never shows as a console error while
        // the client falls back to TCGdex / cache.
        if (request.headers.get("x-pv-soft-fail") === "1") {
          return Response.json(
            { __upstreamStatus: lastStatus, error: { message: "Card API unavailable" } },
            { headers: { "cache-control": "no-store", "x-upstream-status": String(lastStatus) } },
          );
        }
        return new Response(body, {
          status: lastStatus,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
