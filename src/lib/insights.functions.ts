// AI-powered collection insights via configurable OpenAI-compatible gateway.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const VaultItem = z.object({
  name: z.string(),
  set: z.string(),
  rarity: z.string().optional(),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  types: z.array(z.string()).optional(),
});

const Input = z.object({
  items: z.array(VaultItem).min(1).max(400),
  totalValue: z.number().nonnegative(),
  totalCards: z.number().int().nonnegative(),
});

const SYSTEM = `You are an expert Pokémon TCG collection analyst. You are given a JSON summary of a user's vault. Produce a concise, energetic analysis in markdown:

## Snapshot
2-3 sentences capturing the personality of the collection (era focus, type lean, value tier).

## Strengths
3 bullets — what's notable, valuable, or well-built.

## Gaps & Opportunities
3 bullets — missing chase cards, underrepresented sets/types, or smart next pickups (name specific cards or sets).

## Smart Next Picks
A markdown table with columns: Card | Set | Why | Est. Price (USD).
List 4-6 concrete suggestions matched to their existing taste/budget.

Keep total length under 350 words. No preamble, no sign-off.`;

export const analyzeCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.AI_GATEWAY_API_KEY;
    const gateway = (process.env.AI_GATEWAY_URL || "").replace(/\/$/, "");
    if (!key || !gateway) throw new Error("AI gateway not configured");

    const userPrompt = `Vault summary (top items by value first):
Total value: $${data.totalValue.toFixed(2)} across ${data.totalCards} cards.

Items:
${JSON.stringify(data.items, null, 0)}`;

    const res = await fetch(gateway + "/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const j: any = await res.json();
    const markdown: string = j?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!markdown) throw new Error("No analysis returned.");
    return { markdown };
  });
