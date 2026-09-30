// Client side of "AI paint (Nano Banana)": crops the card's art box, asks our
// server route (/api/public/fullart-ai) to paint a full-bleed version with the
// Gemini image model, and caches the result on-device. Every failure resolves to
// a friendly reason so the Studio can fall back to the canvas compositor.
import type { TCGCard } from "./pokemon-api";
import { artBox } from "./fullart";
import { FULLART_PROMPT_VERSION, type AiArtStyle, type AiFinish } from "./fullart-prompt";

const ROUTE = "/api/public/fullart-ai";

export type AiPaintStatus = {
  enabled: boolean;
  reason?: string;
  model?: string;
  dailyLimit?: number;
  remaining?: number;
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
    statusP = fetch(ROUTE, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { enabled: false, reason: "offline" }))
      .then((j) => ({ ...j, enabled: !!j?.enabled }) as AiPaintStatus)
      .catch(() => ({ enabled: false, reason: "offline" }));
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
  try {
    const r = await fetch(ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pv-soft-fail": "1" },
      body: JSON.stringify({
        cardId: card.id,
        sourceUrl,
        name: card.name,
        type: card.types?.[0] || "",
        finish,
        style,
        art,
      }),
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
  } catch {
    return { ok: false, error: "offline", message: AI_PAINT_NOTES.offline };
  }
}
