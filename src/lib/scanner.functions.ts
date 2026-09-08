import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are a Pokémon TCG card identifier. Given a photo of a single Pokémon trading card (and optionally OCR text extracted from it), return:
- name: the Pokémon / card name exactly as printed (e.g. "Charizard ex", "Pikachu V", "Professor's Research")
- hp: HP number if visible, else null
- setNumber: collector number like "4/102" if visible, else null
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
        requests: [{
          image: { content: rawBase64(dataUrl) },
          features: [
            { type: "TEXT_DETECTION", maxResults: 1 },
            { type: "LOGO_DETECTION", maxResults: 3 },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const text: string = j?.responses?.[0]?.fullTextAnnotation?.text
      ?? j?.responses?.[0]?.textAnnotations?.[0]?.description
      ?? "";
    return { text: String(text || "").slice(0, 4000), raw: j?.responses?.[0] };
  } catch {
    return null;
  }
}

export const identifyCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ imageDataUrl: z.string().min(32).max(8_000_000) }))
  .handler(async ({ data }) => {
    const key = process.env.AI_GATEWAY_API_KEY;
    const gateway = (process.env.AI_GATEWAY_URL || "").replace(/\/$/, "");
    if (!key || !gateway) return { ok: false as const, error: "AI gateway not configured" };

    // Google Vision OCR is optional — the scan still works without the key.
    const visionConfigured = !!process.env.GOOGLE_VISION_API_KEY;
    const ocr = visionConfigured ? await googleVisionOcr(data.imageDataUrl) : null;
    const ocrText = ocr?.text ?? "";


    try {
      const userContent: any[] = [
        { type: "text", text: `Identify this Pokémon card. Return JSON only.${ocrText ? `\n\nOCR text extracted from the card (use as strong hint, may contain noise):\n"""${ocrText}"""` : ""}` },
        { type: "image_url", image_url: { url: data.imageDataUrl } },
      ];

      const res = await fetch(gateway + "/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false as const, error: `Gateway ${res.status}: ${txt.slice(0, 200)}`, ocrText };
      }

      const j: any = await res.json();
      const raw: string = j?.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { ok: false as const, error: "No JSON returned", raw, ocrText };
      const parsed = JSON.parse(match[0]);
      return { ok: true as const, card: parsed, ocrText, ocrUsed: !!ocr };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "Identification failed", ocrText };
    }
  });
