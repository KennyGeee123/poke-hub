// AI paint for the Full Art Studio: sends the cropped art box of a card scan to
// Google's Gemini image model ("Nano Banana") with the PokéVault master prompt
// and returns a PNG. The key stays server-side (GEMINI_API_KEY); without it the
// route answers with a clear JSON error and the client keeps its canvas compositor.
import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { isAllowedCardImageUrl } from "@/lib/card-image-hosts";
import {
  AI_ART_STYLES,
  AI_FINISHES,
  FULLART_PROMPT_VERSION,
  buildFullArtPrompt,
  speciesFromCardName,
  type AiArtStyle,
  type AiFinish,
} from "@/lib/fullart-prompt";

const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.1-flash-image"; // Nano Banana 2
const TYPES = new Set([
  "Grass",
  "Fire",
  "Water",
  "Lightning",
  "Psychic",
  "Fighting",
  "Darkness",
  "Metal",
  "Dragon",
  "Fairy",
  "Colorless",
]);
const MAX_BODY = 3_000_000; // bytes of JSON (base64 art ≈ 2.2MB max)
const MAX_ART = 2_200_000; // decoded bytes

// Per-instance stores. Good enough to stop casual abuse and repeat spend; for a
// hard global quota move these to a KV store.
const day = () => new Date().toISOString().slice(0, 10);
const perIp = new Map<string, { d: string; n: number }>();
let globalUse = { d: day(), n: 0 };
const cache = new Map<string, { bytes: Uint8Array<ArrayBuffer>; mime: string; t: number }>();
const CACHE_MAX = 40;
const CACHE_TTL = 7 * 24 * 3600 * 1000;

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);
const dailyLimit = () => Math.max(0, Number(env("FULLART_AI_DAILY_LIMIT") ?? 5) || 0);
const globalCap = () => Math.max(0, Number(env("FULLART_AI_GLOBAL_DAILY_CAP") ?? 200) || 0);
const model = () => {
  const m = env("GEMINI_IMAGE_MODEL") || DEFAULT_MODEL;
  return /^[a-z0-9.-]{3,60}$/.test(m) ? m : DEFAULT_MODEL;
};

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (xf || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
function usedToday(ip: string): number {
  const r = perIp.get(ip);
  return r && r.d === day() ? r.n : 0;
}
function charge(ip: string) {
  const d = day();
  const r = perIp.get(ip);
  perIp.set(ip, { d, n: r && r.d === d ? r.n + 1 : 1 });
  if (globalUse.d !== d) globalUse = { d, n: 0 };
  globalUse.n += 1;
  if (perIp.size > 5000) perIp.clear();
}

/** JSON error. Our own client sends x-pv-soft-fail so failures don't surface as console errors. */
function fail(req: Request, status: number, error: string, message: string, extra = {}) {
  const soft = req.headers.get("x-pv-soft-fail") === "1";
  return Response.json(
    { ok: false, error, message, ...extra },
    {
      status: soft ? 200 : status,
      headers: { "cache-control": "no-store", "x-fullart-status": String(status) },
    },
  );
}

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57)
    return "image/webp";
  return null;
}
function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}
function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(s, "base64"));
}


async function callGeminiImage(
  key: string,
  modelName: string,
  prompt: string,
  mime: string,
  b64: string,
): Promise<{ data: string; mime: string } | null> {
  // Prefer Interactions API (Nano Banana path), then generateContent.
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: modelName,
        input: [
          { type: "text", text: prompt },
          { type: "image", mime_type: mime, data: b64 },
        ],
        response_format: {
          type: "image",
          mime_type: "image/png",
          aspect_ratio: "3:4",
          image_size: "1K",
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (r.ok) {
      const img = extractImage(await r.json());
      if (img) return img;
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime, data: b64 } },
              ],
            },
          ],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!r.ok) return null;
    const j: any = await r.json();
    for (const c of Array.isArray(j?.candidates) ? j.candidates : []) {
      for (const part of Array.isArray(c?.content?.parts) ? c.content.parts : []) {
        const inline = part?.inlineData || part?.inline_data;
        if (inline?.data)
          return { data: inline.data, mime: inline.mimeType || inline.mime_type || "image/png" };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Pull the final image block out of an Interactions API response. */
function extractImage(j: any): { data: string; mime: string } | null {
  let found: { data: string; mime: string } | null = null;
  for (const step of Array.isArray(j?.steps) ? j.steps : []) {
    if (step?.type !== "model_output") continue;
    for (const c of Array.isArray(step.content) ? step.content : []) {
      if (c?.type === "image" && typeof c.data === "string")
        found = { data: c.data, mime: c.mime_type || "image/png" };
    }
  }
  if (!found && typeof j?.output_image?.data === "string")
    found = { data: j.output_image.data, mime: j.output_image.mime_type || "image/png" };
  return found;
}

export const Route = createFileRoute("/api/public/fullart-ai")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const enabled = !!env("GEMINI_API_KEY");
        const ip = clientIp(request);
        return Response.json(
          {
            ok: true,
            enabled,
            reason: enabled ? undefined : "no_key",
            model: enabled ? model() : undefined,
            promptVersion: FULLART_PROMPT_VERSION,
            dailyLimit: dailyLimit(),
            remaining: Math.max(0, dailyLimit() - usedToday(ip)),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const key = env("GEMINI_API_KEY");
        if (!key)
          return fail(
            request,
            503,
            "no_key",
            "AI paint isn't switched on for this site yet (GEMINI_API_KEY is not configured).",
          );

        const len = Number(request.headers.get("content-length") || 0);
        if (len > MAX_BODY) return fail(request, 413, "too_large", "Artwork is too large.");
        let body: any;
        try {
          const raw = await request.text();
          if (raw.length > MAX_BODY)
            return fail(request, 413, "too_large", "Artwork is too large.");
          body = JSON.parse(raw);
        } catch {
          return fail(request, 400, "bad_request", "Invalid JSON.");
        }

        const cardId = String(body?.cardId ?? "");
        const sourceUrl = String(body?.sourceUrl ?? "");
        const name = String(body?.name ?? "").trim();
        const type = String(body?.type ?? "");
        const finish = String(body?.finish ?? "") as AiFinish;
        const style = String(body?.style ?? "faithful") as AiArtStyle;
        const art = String(body?.art ?? "");
        if (!/^[A-Za-z0-9._-]{1,48}$/.test(cardId))
          return fail(request, 400, "bad_request", "Invalid card id.");
        if (!isAllowedCardImageUrl(sourceUrl))
          return fail(request, 400, "bad_host", "Card image must come from a known card CDN.");
        if (!name || name.length > 60 || !/^[\p{L}\p{N} .,'’&:!?()♀♂-]+$/u.test(name))
          return fail(request, 400, "bad_request", "Invalid card name.");
        if (type && !TYPES.has(type)) return fail(request, 400, "bad_request", "Invalid type.");
        if (!(AI_FINISHES as readonly string[]).includes(finish))
          return fail(request, 400, "bad_request", "Invalid finish.");
        if (!(AI_ART_STYLES as readonly string[]).includes(style))
          return fail(request, 400, "bad_request", "Invalid art style.");
        const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(art);
        if (!m) return fail(request, 400, "bad_request", "Artwork must be a base64 image.");
        const bytes = b64ToBytes(m[2]);
        const mime = sniff(bytes);
        if (!mime || bytes.length > MAX_ART)
          return fail(
            request,
            400,
            "bad_request",
            "Artwork must be a PNG, JPEG or WebP under 2MB.",
          );
        if (mime === "image/png") {
          const sz = pngSize(bytes);
          if (!sz || sz.w < 96 || sz.h < 64 || sz.w > 2048 || sz.h > 2048)
            return fail(request, 400, "bad_request", "Artwork size out of range.");
        }

        // Key includes a digest of the reference so one caller can't poison another's card.
        const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
        const ck = `${cardId}|${finish}|${style}|${FULLART_PROMPT_VERSION}|${model()}|${digest}`;
        const hit = cache.get(ck);
        if (hit && Date.now() - hit.t < CACHE_TTL) {
          return new Response(hit.bytes, {
            headers: {
              "content-type": hit.mime,
              "cache-control": "private, max-age=604800",
              "x-fullart-cache": "hit",
              "x-fullart-prompt": FULLART_PROMPT_VERSION,
            },
          });
        }

        const ip = clientIp(request);
        const limit = dailyLimit();
        if (usedToday(ip) >= limit)
          return fail(
            request,
            429,
            "rate_limited",
            `Daily AI paint limit reached (${limit}/day).`,
            {
              limit,
            },
          );
        if (globalUse.d === day() && globalUse.n >= globalCap())
          return fail(request, 429, "rate_limited", "AI paint is busy today. Try again tomorrow.");
        charge(ip);

        const prompt = buildFullArtPrompt({
          species: speciesFromCardName(name),
          type: type || undefined,
          finish,
          style,
        });
        let img: { data: string; mime: string } | null = null;
        try {
          img = await callGeminiImage(key, model(), prompt, mime, m[2]);
        } catch {
          return fail(request, 504, "upstream_timeout", "The image model took too long.");
        }
        if (!img)
          return fail(
            request,
            502,
            "no_image",
            "The image model returned no picture (quota, decline, or upstream error).",
          );
        const out = b64ToBytes(img.data);
        cache.set(ck, { bytes: out, mime: img.mime, t: Date.now() });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
        return new Response(out, {
          headers: {
            "content-type": img.mime,
            "cache-control": "private, max-age=604800",
            "x-fullart-cache": "miss",
            "x-fullart-prompt": FULLART_PROMPT_VERSION,
          },
        });
      },
    },
  },
});
