// Free Full Art painter via Hugging Face Spaces (outpaint).
// Used when Gemini Nano Banana is off / quota-blocked.
// Primary space: fffiloni/diffusers-image-outpaint — continues habitat past the frame.
// DeepSeek hosted API is vision→text ONLY (not wired as a painter).
// OpenCode image plugins wrap Gemini / GPT Image — not a separate free model.
import { createFileRoute } from "@tanstack/react-router";
import { isAllowedCardImageUrl } from "@/lib/card-image-hosts";
import { FULLART_PROMPT_VERSION, buildFullArtPrompt, speciesFromCardName } from "@/lib/fullart-prompt";

const SPACE = "fffiloni/diffusers-image-outpaint";
const SPACE_HOST = "https://fffiloni-diffusers-image-outpaint.hf.space";
const MAX_BODY = 3_000_000;

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);

function fail(req: Request, status: number, error: string, message: string) {
  const soft = req.headers.get("x-pv-soft-fail") === "1";
  return Response.json(
    { ok: false, error, message, provider: "huggingface", space: SPACE },
    {
      status: soft ? 200 : status,
      headers: { "cache-control": "no-store", "x-fullart-status": String(status) },
    },
  );
}

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(s, "base64"));
}

/** Prefer the cropped illustration (no yellow frame). Fall back to the card URL. */
async function artFile(
  sourceUrl: string,
  art: string,
  token?: string,
): Promise<{ path: string; url: string; orig_name: string }> {
  const fallback = { path: sourceUrl, url: sourceUrl, orig_name: "card.png" };
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(art);
  if (!m) return fallback;
  try {
    const mime = m[1] === "jpeg" ? "image/jpeg" : m[1] === "webp" ? "image/webp" : "image/png";
    const form = new FormData();
    form.append("files", new Blob([b64ToBytes(m[2])], { type: mime }), "art.png");
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`${SPACE_HOST}/gradio_api/upload`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const path = Array.isArray(j) ? String(j[0] ?? "") : "";
    if (!path) return fallback;
    return { path, url: `${SPACE_HOST}/gradio_api/file=${path}`, orig_name: "art.png" };
  } catch {
    return fallback;
  }
}

async function gradioOutpaint(
  file: { path: string; url: string; orig_name: string },
  prompt: string,
  token?: string,
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  // Gradio 4 queue: submit → poll
  const submit = await fetch(`${SPACE_HOST}/gradio_api/call/infer`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: [
        { path: file.path, meta: { _type: "gradio.FileData" }, url: file.url, orig_name: file.orig_name },
        768, // width
        1024, // height
        12, // overlap_percentage
        12, // num_inference_steps
        "50%", // resize_option
        50, // custom_resize_percentage
        prompt,
        true,
        true,
        true,
        true,
        "Middle",
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submit.ok) {
    const t = await submit.text().catch(() => "");
    throw new Error(`submit_${submit.status}:${t.slice(0, 180)}`);
  }
  const { event_id } = (await submit.json()) as { event_id?: string };
  if (!event_id) throw new Error("no_event_id");

  const deadline = Date.now() + 110_000;
  while (Date.now() < deadline) {
    const poll = await fetch(`${SPACE_HOST}/gradio_api/call/infer/${event_id}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await poll.text();
    // SSE-ish: look for data: lines with file urls
    if (text.includes("error") && text.includes("ZeroGPU")) {
      throw new Error("zerogpu_quota");
    }
    const m = text.match(/https:\/\/[^"'\s]+\/gradio_api\/file=[^"'\s]+/g);
    if (m?.length) {
      // Prefer the last / larger result
      const url = m[m.length - 1]!.replace(/\\u002F/g, "/");
      const img = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!img.ok) throw new Error(`fetch_result_${img.status}`);
      const buf = new Uint8Array(await img.arrayBuffer());
      return buf;
    }
    if (text.includes('"msg": "complete"') || text.includes("process_completed")) {
      // completed without url? fail
      throw new Error(`complete_no_url:${text.slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("timeout");
}

export const Route = createFileRoute("/api/public/fullart-hf")({
  server: {
    handlers: {
      GET: async () => {
        const token = env("HF_TOKEN") || env("HUGGINGFACE_HUB_TOKEN");
        return Response.json(
          {
            ok: true,
            enabled: true,
            provider: "huggingface",
            space: SPACE,
            promptVersion: FULLART_PROMPT_VERSION,
            auth: token ? "token" : "anonymous",
            notes: {
              deepseek: "Hosted DeepSeek API is vision→text only — cannot paint Full Art pixels.",
              opencode:
                "OpenCode image plugins (opencode-gemini-image extend) wrap Gemini image models — same family as Nano Banana, not a separate free painter.",
            },
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const token = env("HF_TOKEN") || env("HUGGINGFACE_HUB_TOKEN");
        let body: any;
        try {
          const raw = await request.text();
          if (raw.length > MAX_BODY) return fail(request, 413, "too_large", "Artwork is too large.");
          body = JSON.parse(raw);
        } catch {
          return fail(request, 400, "bad_request", "Invalid JSON.");
        }
        const sourceUrl = String(body?.sourceUrl ?? "");
        const name = String(body?.name ?? "Pokemon").trim().slice(0, 60);
        const type = String(body?.type ?? "") || undefined;
        if (!isAllowedCardImageUrl(sourceUrl))
          return fail(request, 400, "bad_host", "Card image must come from a known card CDN.");

        const finish = (["holo", "rainbow", "gold", "alt"] as const).includes(body?.finish)
          ? body.finish
          : "holo";
        const style = (["faithful", "storybook", "chibi", "neon"] as const).includes(body?.style)
          ? body.style
          : "faithful";
        const prompt =
          buildFullArtPrompt({
            species: speciesFromCardName(name),
            type,
            finish,
            style,
          }) +
          " Paint a current-generation Ultra Rare full art: the creature large on a flowing silk swirl in its type colour. No text, no card frame, no forest.";

        const art = String(body?.art ?? "");
        const file = await artFile(sourceUrl, art, token || undefined);
        try {
          const bytes = await gradioOutpaint(file, prompt, token || undefined);
          const mime =
            bytes[0] === 0x89 && bytes[1] === 0x50
              ? "image/png"
              : bytes[0] === 0xff && bytes[1] === 0xd8
                ? "image/jpeg"
                : "image/webp";
          return new Response(bytes, {
            headers: {
              "content-type": mime,
              "cache-control": "private, max-age=3600",
              "x-fullart-provider": "huggingface",
              "x-fullart-space": SPACE,
              "x-fullart-prompt": FULLART_PROMPT_VERSION,
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("zerogpu"))
            return fail(
              request,
              429,
              "rate_limited",
              "Hugging Face ZeroGPU quota is empty — try again later or set HF_TOKEN.",
            );
          console.warn("[fullart-hf]", msg.slice(0, 200));
          return fail(
            request,
            502,
            "upstream_error",
            "Hugging Face outpaint couldn’t finish this card right now.",
          );
        }
      },
    },
  },
});
