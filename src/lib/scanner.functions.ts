import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  claimGuestScan,
  refundGuestScan,
  guestIdentity,
  guestScanStatus,
  optionalSupabaseAuth,
} from "@/lib/optional-auth";
import { getRequest } from "@tanstack/react-start/server";

/** Accepts ".../openai/v1", ".../openai/v1/", ".../openai" or a full ".../chat/completions" URL. */
export function chatCompletionsUrl(base: string | undefined): string {
  const b = String(base || "").trim().replace(/\/+$/, "");
  if (!b) return "";
  if (/\/chat\/completions$/.test(b)) return b;
  return (/\/v1$/.test(b) ? b : b + "/v1") + "/chat/completions";
}

const SYSTEM = `You are a Pokémon TCG card identifier. Given a photo of a single Pokémon trading card (and optionally OCR text extracted from it), return:
- name: the Pokémon / card name exactly as printed (e.g. "Charizard ex", "Pikachu V", "Professor's Research")
- hp: HP number if visible, else null
- setNumber: collector number exactly as printed in the bottom corner, e.g. "4/102" or "199/165" (secret rares can exceed the set total), else null
- setName: printed set name / symbol hint if visible, else null
- supertype: one of "Pokémon" | "Trainer" | "Energy"
- confidence: 0-1 self-rated confidence
Respond ONLY with compact JSON of shape {"name":string,"hp":string|null,"setNumber":string|null,"setName":string|null,"supertype":string,"confidence":number}. No prose.`;

// Strip "data:image/jpeg;base64," prefix → raw base64
function rawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function googleVisionOcr(dataUrl: string): Promise<{ text: string; raw?: any } | null> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: rawBase64(dataUrl) },
            features: [
              { type: "TEXT_DETECTION", maxResults: 1 },
              { type: "LOGO_DETECTION", maxResults: 3 },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const text: string =
      j?.responses?.[0]?.fullTextAnnotation?.text ??
      j?.responses?.[0]?.textAnnotations?.[0]?.description ??
      "";
    return { text: String(text || "").slice(0, 4000), raw: j?.responses?.[0] };
  } catch {
    return null;
  }
}

export const identifyCard = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator(z.object({ imageDataUrl: z.string().min(32).max(8_000_000) }))
  .handler(async ({ data, context }) => {
    const key = process.env.AI_GATEWAY_API_KEY;
    const gateway = chatCompletionsUrl(process.env.AI_GATEWAY_URL);
    if (!key || !gateway) return { ok: false as const, error: "AI gateway not configured" };

    // Guests: server-side quota (2 per device lifetime, 4 per IP per day) BEFORE the paid call.
    let guest: { used: number; limit: number } | null = null;
    let guestKey: { device: string; ip: string } | null = null;
    // Give the scan back when OUR side failed (gateway down/404/timeout), not when the photo was unreadable.
    const refund = async () => {
      if (!guestKey || !guest) return null;
      const r = await refundGuestScan(guestKey.device, guestKey.ip);
      return r ? { used: r.used, limit: guest.limit } : guest;
    };
    if (!context.userId) {
      const { device, ip } = guestIdentity(context.request);
      guestKey = { device, ip };
      const q = await claimGuestScan(device, ip);
      if (!q.ok) {
        if (q.reason === "store") return { ok: false as const, error: "Scan quota unavailable. Try again." };
        // Any denial (device or network cap) means 0 left for this guest right now.
        return {
          ok: false as const,
          error: q.reason === "ip" ? "GUEST_LIMIT_IP" : "GUEST_LIMIT",
          guest: { used: q.limit, limit: q.limit },
        };
      }
      guest = { used: q.used, limit: q.limit };
    }

    // Google Vision OCR is optional — the scan still works without the key.
    const visionConfigured = !!process.env.GOOGLE_VISION_API_KEY;
    const ocr = visionConfigured ? await googleVisionOcr(data.imageDataUrl) : null;
    const ocrText = ocr?.text ?? "";

    try {
      const userContent: any[] = [
        {
          type: "text",
          text: `Identify this Pokémon card. Return JSON only.${ocrText ? `\n\nOCR text extracted from the card (use as strong hint, may contain noise):\n"""${ocrText}"""` : ""}`,
        },
        { type: "image_url", image_url: { url: data.imageDataUrl } },
      ];

      type Provider = { name: string; url: string; key: string; model: string };
      const providers: Provider[] = [
        { name: "primary", url: gateway, key, model: process.env.AI_SCAN_MODEL || "qwen/qwen3.8-27b" },
      ];
      const fbUrl = chatCompletionsUrl(process.env.AI_FALLBACK_URL);
      const fbKey = process.env.AI_FALLBACK_API_KEY;
      if (fbUrl && fbKey) {
        providers.push({ name: "fallback", url: fbUrl, key: fbKey, model: process.env.AI_FALLBACK_MODEL || "gemini-2.5-flash" });
      }
      const callProvider = (p: Provider) =>
        fetch(p.url, {
          signal: AbortSignal.timeout(20_000),
          method: "POST",
          headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: p.model,
            // Groq reasoning models: keep <think> text out of the JSON reply.
            ...(p.url.includes("groq.com") ? { reasoning_format: "hidden" } : {}),
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: userContent },
            ],
          }),
        });

      let res: Response | null = null;
      let lastStatus = 0;
      let provider = "";
      for (const [i, p] of providers.entries()) {
        const hasNext = i < providers.length - 1;
        try {
          let r = await callProvider(p);
          // Short per-minute waits are worth one retry only when there is no backup to try.
          if (!hasNext && r.status === 429) {
            const body = await r.clone().text().catch(() => "");
            const hinted = Number(body.match(/try again in ([\d.]+)s/i)?.[1]);
            const wait = Number(r.headers.get("retry-after")) || (Number.isFinite(hinted) ? hinted : 99);
            if (wait <= 8) {
              await new Promise((ok) => setTimeout(ok, wait * 1000 + 300));
              r = await callProvider(p);
            }
          }
          if (r.ok) {
            res = r;
            provider = p.name;
            break;
          }
          lastStatus = r.status;
          const txt = await r.text().catch(() => "");
          console.error(`[identifyCard] ${p.name} ${r.status}`, txt.slice(0, 300));
        } catch (e: any) {
          lastStatus = 504;
          console.error(`[identifyCard] ${p.name} error`, e?.name || e?.message);
        }
      }
      if (!res) {
        // Every provider failed on our side: give the guest scan back.
        return {
          ok: false as const,
          error: lastStatus === 429 ? "SCAN_BUSY" : "SCAN_SERVICE_DOWN",
          ocrText,
          guest: await refund(),
        };
      }

      const j: any = await res.json();
      const raw: string = j?.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { ok: false as const, error: "SCAN_UNREADABLE", raw, ocrText, guest };
      const parsed = JSON.parse(match[0]);
      return { ok: true as const, card: parsed, ocrText, ocrUsed: !!ocr, guest, provider };
    } catch (e: any) {
      const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
      return {
        ok: false as const,
        error: timedOut ? "SCAN_SERVICE_DOWN" : e?.message || "Identification failed",
        ocrText,
        guest: timedOut ? await refund() : guest,
      };
    }
  });

export const getGuestScanStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { device } = guestIdentity(getRequest());
  return guestScanStatus(device);
});
