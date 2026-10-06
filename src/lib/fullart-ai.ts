// Client side of AI paint: crops the card art box, tries Gemini Nano Banana
// (/api/public/fullart-ai) then free Hugging Face outpaint (/api/public/fullart-hf),
// and caches on-device. Canvas compositor is layout-preview only — never claimed as Full Art paint.
// DeepSeek hosted API = text-only. OpenCode image plugins = Gemini/GPT wrappers.
import type { TCGCard } from "./pokemon-api";
import { artBox } from "./fullart";
import { FULLART_PROMPT_VERSION, type AiArtStyle, type AiFinish } from "./fullart-prompt";

const ROUTE = "/api/public/fullart-ai";

export type AiPaintProvider = "gemini" | "huggingface" | "auto";

export type AiPaintStatus = {
  enabled: boolean;
  reason?: string;
  model?: string;
  dailyLimit?: number;
  remaining?: number;
  /** Preferred painter when AI paint is on. */
  provider?: AiPaintProvider;
  /** Honest capability notes for non-painters we researched. */
  notes?: {
    deepseek?: string;
    opencode?: string;
    huggingface?: string;
  };
};

export type AiPaintError =
  | "no_key"
  | "rate_limited"
  | "bad_host"
  | "upstream"
  | "no_image"
  | "offline"
  | "bad_request";

export type AiPaintResult =
  | { ok: true; img: HTMLImageElement; cached: boolean }
  | { ok: false; error: AiPaintError; message: string };

let statusP: Promise<AiPaintStatus> | null = null;

/** Is AI paint switched on for this deployment? (cached for the session) */
export function getAiPaintStatus(force = false): Promise<AiPaintStatus> {
  if (!statusP || force)
    statusP = Promise.all([
      fetch(ROUTE, { headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : { enabled: false, reason: "offline" }))
        .catch(() => ({ enabled: false, reason: "offline" })),
      fetch("/api/public/fullart-hf", { headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([gemini, hf]) => {
      const geminiOn = !!gemini?.enabled;
      const hfOn = !!hf?.enabled;
      return {
        ...gemini,
        enabled: geminiOn || hfOn,
        reason: geminiOn ? gemini?.reason : hfOn ? undefined : gemini?.reason || "offline",
        provider: (geminiOn ? "gemini" : hfOn ? "huggingface" : "auto") as AiPaintProvider,
        model: geminiOn ? gemini?.model : hfOn ? `hf:${hf?.space || "outpaint"}` : gemini?.model,
        notes: {
          deepseek:
            "Hosted DeepSeek API is vision→text only — it cannot paint Full Art pixels.",
          opencode:
            "OpenCode image plugins wrap Gemini / GPT Image — not a separate free Full Art model.",
          huggingface: hfOn
            ? `Free HF Space painter ready (${hf?.space || "outpaint"}).`
            : "HF outpaint route offline.",
          ...(hf?.notes || {}),
        },
      } as AiPaintStatus;
    });
  return statusP;
}

export const AI_PAINT_NOTES: Record<AiPaintError, string> = {
  no_key: "AI paint isn’t switched on yet — showing the on-device compositor instead.",
  rate_limited:
    "You’ve used today’s AI paints — showing the on-device compositor. Try again tomorrow.",
  bad_host: "This card’s image can’t be sent for AI paint — showing the on-device compositor.",
  upstream: "The AI painter is busy right now — showing the on-device compositor.",
  no_image: "The AI painter skipped this card — showing the on-device compositor.",
  offline: "Couldn’t reach the AI painter — showing the on-device compositor.",
  bad_request: "This card can’t be AI-painted — showing the on-device compositor.",
};

/** Crop the illustration window to a PNG data URL (≤1024px wide). */
function cropArt(img: HTMLImageElement): string {
  const b = artBox(img);
  const scale = Math.min(1, 1024 / b.w);
  const c = document.createElement("canvas");
  c.width = Math.max(96, Math.round(b.w * scale));
  c.height = Math.max(64, Math.round(b.h * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

// ---- tiny IndexedDB cache (separate DB from saved full arts) ----
const DB = "pv-fullart-ai";
const STORE = "paint";
function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function cacheGet(k: string): Promise<Blob | null> {
  const db = await idb();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const q = db.transaction(STORE).objectStore(STORE).get(k);
      q.onsuccess = () => res((q.result as Blob) || null);
      q.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function cachePut(k: string, v: Blob) {
  const db = await idb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(v, k);
  } catch {
    /* quota — ignore */
  }
}

function blobToImage(b: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(b);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => {
      URL.revokeObjectURL(u);
      rej(new Error("decode"));
    };
    im.src = u;
  });
}

function mapError(code: string | undefined): AiPaintError {
  switch (code) {
    case "no_key":
    case "rate_limited":
    case "bad_host":
    case "no_image":
    case "bad_request":
      return code;
    case "too_large":
      return "bad_request";
    default:
      return "upstream";
  }
}

/** Paint the card with the Gemini image model. Never throws. */
export async function paintWithAi(
  card: TCGCard,
  img: HTMLImageElement,
  finish: AiFinish,
  style: AiArtStyle,
): Promise<AiPaintResult> {
  const key = `${card.id}|${finish}|${style}|${FULLART_PROMPT_VERSION}`;
  const hit = await cacheGet(key);
  if (hit) {
    try {
      return { ok: true, img: await blobToImage(hit), cached: true };
    } catch {
      /* stale — repaint */
    }
  }
  const sourceUrl = img.dataset.pvSrc || "";
  if (!sourceUrl) return { ok: false, error: "bad_host", message: AI_PAINT_NOTES.bad_host };
  let art: string;
  try {
    art = cropArt(img);
  } catch {
    return { ok: false, error: "bad_request", message: AI_PAINT_NOTES.bad_request };
  }
  const payload = {
    cardId: card.id,
    sourceUrl,
    name: card.name,
    type: card.types?.[0] || "",
    finish,
    style,
    art,
  };

  async function post(route: string): Promise<AiPaintResult> {
    const r = await fetch(route, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pv-soft-fail": "1" },
      body: JSON.stringify(payload),
    });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || ct.includes("json")) {
      const j = await r.json().catch(() => null);
      const error = mapError(j?.error);
      return { ok: false, error, message: AI_PAINT_NOTES[error] };
    }
    const blob = await r.blob();
    const out = await blobToImage(blob);
    void cachePut(key, blob);
    return { ok: true, img: out, cached: false };
  }

  try {
    // 1) Gemini Nano Banana (best when key + quota available)
    const gemini = await post(ROUTE);
    if (gemini.ok) return gemini;
    // 2) Free HF outpaint when Gemini is off / busy / quota
    if (["no_key", "rate_limited", "upstream", "offline"].includes(gemini.error)) {
      const hf = await post("/api/public/fullart-hf");
      if (hf.ok) return hf;
      return gemini.error === "no_key" ? hf : gemini;
    }
    return gemini;
  } catch {
    try {
      return await post("/api/public/fullart-hf");
    } catch {
      return { ok: false, error: "offline", message: AI_PAINT_NOTES.offline };
    }
  }
}
