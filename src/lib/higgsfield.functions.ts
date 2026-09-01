// Higgsfield image generation server function.
// Wraps https://platform.higgsfield.ai text-to-image endpoint with polling.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(1).max(2000),
  width: z.number().int().min(512).max(1536).default(1024),
  height: z.number().int().min(512).max(1536).default(1024),
  style: z.string().optional(),
});

type JobResp = {
  id: string;
  status: string;
  result?: { url?: string; raw?: { url?: string } };
  results?: Array<{ url?: string; raw?: { url?: string } }>;
};

function pickUrl(j: JobResp): string | undefined {
  return (
    j.result?.url ||
    j.result?.raw?.url ||
    j.results?.[0]?.url ||
    j.results?.[0]?.raw?.url
  );
}

export const generateHiggsfieldImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.HIGGSFIELD_API_KEY;
    const apiSecret = process.env.HIGGSFIELD_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("Higgsfield credentials not configured");
    }
    const headers = {
      "hf-api-key": apiKey,
      "hf-secret": apiSecret,
      "Content-Type": "application/json",
    };

    const submit = await fetch("https://platform.higgsfield.ai/v1/text2image/soul", {
      method: "POST",
      headers,
      body: JSON.stringify({
        params: {
          prompt: data.prompt,
          width_and_height: `${data.width}x${data.height}`,
          quality: "1080p",
          style_ref: data.style ? { id: data.style, strength: 0.7 } : undefined,
        },
      }),
    });
    if (!submit.ok) {
      const text = await submit.text().catch(() => "");
      throw new Error(`Higgsfield error ${submit.status}: ${text.slice(0, 300)}`);
    }
    const job = (await submit.json()) as JobResp;
    let url = pickUrl(job);
    let status = job.status;
    let failed = /failed|error/i.test(status || "");

    // Poll up to ~20s, then hand back a "pending" job the client can keep polling.
    const id = job.id;
    for (let i = 0; i < 20 && !url && !failed && id; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const p = await fetch(`https://platform.higgsfield.ai/v1/job-sets/${id}`, { headers });
      if (!p.ok) continue;
      const pj = (await p.json()) as JobResp;
      status = pj.status || status;
      url = pickUrl(pj);
      failed = /failed|error/i.test(status || "");
    }

    return { id, status: status || "pending", url, pending: !url && !failed, failed };
  });

/** Poll an in-flight Higgsfield job so the UI can show progress instead of hanging. */
export const pollHiggsfieldImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.HIGGSFIELD_API_KEY;
    const apiSecret = process.env.HIGGSFIELD_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("Higgsfield credentials not configured");
    const res = await fetch(`https://platform.higgsfield.ai/v1/job-sets/${data.id}`, {
      headers: { "hf-api-key": apiKey, "hf-secret": apiSecret },
    });
    if (!res.ok) {
      return { id: data.id, status: `error ${res.status}`, url: undefined as string | undefined, pending: false, failed: true };
    }
    const pj = (await res.json()) as JobResp;
    const url = pickUrl(pj);
    const failed = /failed|error/i.test(pj.status || "");
    return { id: data.id, status: pj.status || "pending", url, pending: !url && !failed, failed };
  });
