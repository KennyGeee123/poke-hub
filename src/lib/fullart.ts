// Full Art Studio engine: turns a regular card into a fan-made CURRENT-GEN full art.
// Current gen (Scarlet & Violet Ultra Rare, still the Black Bolt full-art look):
//   1. type-color silk swirl  2. the Pokémon large, melted into that swirl
//   3. silver name plate, stage, HP, type  4. ability + attack + ex rule
//   5. light foil  6. gray card edge
// Official Ultra Rare / Illustration Rare scans are already that look — shown full-bleed.
// Optional AI path: opts.aiArt replaces the silk + subject. Overlay stays ours.
import type { TCGCard } from "./pokemon-api";

export type FullArtStyle = "holo" | "rainbow" | "gold" | "alt";
export type FullArtRim = "none" | "silver" | "gold";
export type FullArtOptions = {
  style: FullArtStyle;
  frame: boolean;
  /** Thin decorative rim (SIR-style). Ignored when frame is off. */
  rim?: FullArtRim;
  /** AI-painted full-bleed art (Nano Banana). When set, it replaces the compositor's extension. */
  aiArt?: HTMLImageElement | null;
};
export const FULLART_W = 1000;
export const FULLART_H = 1400;

/** Layout of a current-generation Ultra Rare full art (silk field + silver name plate). */
export const FULLART_LAYOUT = {
  version: "fa-v3.5-current-gen",
  nameHpBand: [0.04, 0.14],
  subjectBand: [0.14, 0.62],
  subjectPeakY: 0.4,
  habitatBand: [0.62, 0.9],
  footerBand: [0.9, 1],
  minBottomEdgeRatio: 0.63,
  overlay: "current-gen-plate",
} as const;


export const STYLE_LABELS: Record<FullArtStyle, string> = {
  holo: "Textured holo",
  rainbow: "Rainbow",
  gold: "Gold",
  alt: "Alt-art",
};

const TYPE_COLORS: Record<string, string> = {
  Grass: "#4caf50",
  Fire: "#f4511e",
  Water: "#1e88e5",
  Lightning: "#fdd835",
  Psychic: "#ab47bc",
  Fighting: "#a1662f",
  Darkness: "#37474f",
  Metal: "#90a4ae",
  Fairy: "#ec407a",
  Dragon: "#c9a227",
  Colorless: "#e0e0e0",
};

export function proxiedImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/public/card-image?url=${encodeURIComponent(url)}`;
}

/** Best available scan URLs for a card, highest-res first. */
export function cardArtCandidates(card: TCGCard): string[] {
  const out: string[] = [];
  const add = (u?: string) => {
    if (u && !out.includes(u)) out.push(u);
  };
  add(card.images?.large);
  add(card.images?.small);
  const setId = card.set?.id;
  if (setId && card.number) {
    add(`https://images.pokemontcg.io/${setId}/${card.number}_hires.png`);
    add(`https://images.pokemontcg.io/${setId}/${card.number}.png`);
  }
  return out;
}

export async function loadCardImage(card: TCGCard): Promise<HTMLImageElement> {
  let lastErr: unknown = null;
  for (const src of cardArtCandidates(card)) {
    try {
      const r = await fetch(proxiedImageUrl(src), { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`Image ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image decode failed"));
        img.src = url;
      });
      img.dataset.pvSrc = src; // original CDN URL (AI paint validates the host)
      return img;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Couldn’t load this card’s art.");
}

export type Box = { x: number; y: number; w: number; h: number };

/** Illustration window on a card scan, as fractions of the scan.
 *  Pre-cropped art windows (wider than a card, aspect > ~1.15) use nearly the full image. */
export function artBox(img: HTMLImageElement): Box {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (W / Math.max(1, H) > 1.15) {
    // Already an illustration crop (e.g. sources/art-*.png) — keep a tiny inset only.
    return { x: W * 0.01, y: H * 0.01, w: W * 0.98, h: H * 0.98 };
  }
  // Standard (post-2003) portrait card scan — inset past the printed art border.
  return { x: W * 0.095, y: H * 0.12, w: W * 0.81, h: H * 0.36 };
}

function avgColor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number, number] {
  const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h)).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n++;
  }
  return [r / n, g / n, b / n];
}

const rgb = (c: [number, number, number], a = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Draw `img` region into dest with a vertical alpha feather at top/bottom. */
function drawFeathered(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: Box,
  dst: Box,
  feather: number,
) {
  const tmp = document.createElement("canvas");
  tmp.width = Math.round(dst.w);
  tmp.height = Math.round(dst.h);
  const t = tmp.getContext("2d")!;
  t.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = "destination-in";
  const g = t.createLinearGradient(0, 0, 0, tmp.height);
  const f = Math.min(0.45, feather / tmp.height);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(f, "rgba(0,0,0,1)");
  g.addColorStop(1 - f, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  t.fillStyle = g;
  t.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, dst.x, dst.y);
}

/**
 * Stretch an edge band into dest WITHOUT mirroring (seam fade only).
 * Prefer fillBottomLayers for large bottom fills — this is for short seams.
 */
function stretchEdge(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: Box,
  dst: Box,
  dir: "up" | "down",
) {
  if (dst.h < 4 || dst.w < 4) return;
  const tmp = document.createElement("canvas");
  tmp.width = Math.round(dst.w);
  tmp.height = Math.round(dst.h);
  const t = tmp.getContext("2d")!;
  t.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = "destination-in";
  const g = t.createLinearGradient(0, 0, 0, tmp.height);
  if (dir === "down") {
    g.addColorStop(0, "rgba(0,0,0,0.8)");
    g.addColorStop(0.4, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.6, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0.8)");
  }
  t.fillStyle = g;
  t.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, dst.x, dst.y);
}

/**
 * Layered bottom CONTINUATION (fa-v3.4): sample the LOWER art window (grass /
 * plants / ground at the bottom edge of the illustration) and extend that same
 * habitat downward. Near bands stay sharp so foliage reads as finished art,
 * not a muddy smear or mirrored reflection.
 */
function fillBottomLayers(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  box: Box,
  ax: number,
  aw: number,
  botY: number,
  botSpace: number,
) {
  if (botSpace < 8) return;
  // Anchor strip: bottom ~28% of the art box — where grass/plants usually live.
  const anchorY = box.y + box.h * 0.72;
  const anchorH = Math.max(6, box.h * 0.26);
  // 1) Strong near-field continuation: repeat the bottom plant strip downward
  //    with light perspective scale (wider / slightly softer as it goes).
  const nearBands = 7;
  for (let i = 0; i < nearBands; i++) {
    const t = i / (nearBands - 1);
    const dstY = botY + botSpace * (t * 0.55);
    const dstH = botSpace * (0.28 - t * 0.03);
    const grow = 1 + t * 0.12;
    ctx.save();
    ctx.filter = `blur(${0.5 + t * 4}px) saturate(${1.35 - t * 0.15})`;
    ctx.globalAlpha = 0.92 * (1 - t * 0.35);
    ctx.drawImage(
      img,
      box.x,
      anchorY,
      box.w,
      anchorH,
      ax - aw * (grow - 1) * 0.5 - aw * 0.02,
      dstY,
      aw * grow + aw * 0.04,
      Math.max(10, dstH),
    );
    ctx.restore();
  }
  // 2) Deeper atmospheric bands from mid-lower art (keeps colour continuity).
  const deepBands = 6;
  for (let i = 0; i < deepBands; i++) {
    const t = i / (deepBands - 1);
    const srcY = box.y + box.h * (0.48 + t * 0.42);
    const srcH = Math.max(4, box.h * (0.16 - t * 0.05));
    const dstY = botY + botSpace * (0.35 + t * 0.58);
    const dstH = botSpace * (0.32 - t * 0.1);
    const jx = (i % 2 === 0 ? -1 : 1) * aw * 0.03 * t;
    ctx.save();
    ctx.filter = `blur(${3 + t * 12}px) saturate(${1.2 - t * 0.2})`;
    ctx.globalAlpha = 0.55 * (1 - t * 0.4);
    ctx.drawImage(
      img,
      box.x,
      srcY,
      box.w,
      srcH,
      ax + jx - aw * 0.05,
      dstY,
      aw * 1.1,
      Math.max(8, dstH),
    );
    ctx.restore();
  }
}

/**
 * Top + side CONTINUATION (fa-v3.4): finish canopy / sky / edge foliage from the
 * art window outward so the card is one continuous habitat, not a vignette.
 */
function fillEdgeContinuation(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  box: Box,
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  W: number,
  H: number,
) {
  const topSpace = Math.max(0, ay);
  // Top canopy / sky from the upper art strip
  if (topSpace > 4) {
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const srcH = Math.max(3, box.h * (0.1 - t * 0.015));
      const dstH = topSpace * (0.55 - t * 0.05) + 24;
      ctx.save();
      ctx.filter = `blur(${1 + t * 8}px) saturate(1.2)`;
      ctx.globalAlpha = 0.88 * (1 - t * 0.25);
      ctx.drawImage(
        img,
        box.x,
        box.y + box.h * (0.02 + t * 0.04),
        box.w,
        srcH,
        ax - aw * 0.03,
        Math.max(0, topSpace - dstH + t * 12),
        aw * 1.06,
        dstH,
      );
      ctx.restore();
    }
  }
  // Left / right plant walls from the art edges
  const sideW = Math.max(ax + 20, 40);
  for (const side of ["left", "right"] as const) {
    const srcX = side === "left" ? box.x : box.x + box.w * 0.9;
    const dstX = side === "left" ? 0 : W - sideW;
    ctx.save();
    ctx.filter = "blur(6px) saturate(1.25)";
    ctx.globalAlpha = 0.75;
    ctx.drawImage(img, srcX, box.y, Math.max(3, box.w * 0.1), box.h, dstX, ay - 20, sideW, ah + 40);
    ctx.restore();
    // Extra lower-side foliage into the habitat band
    ctx.save();
    ctx.filter = "blur(4px) saturate(1.3)";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(
      img,
      srcX,
      box.y + box.h * 0.55,
      Math.max(3, box.w * 0.12),
      box.h * 0.4,
      dstX,
      Math.min(ay + ah * 0.55, H * 0.55),
      sideW + 10,
      Math.max(80, H - (ay + ah * 0.55)),
    );
    ctx.restore();
  }
}

/** Scenic habitat under the subject — soft terrain / sky bands from sampled colours. */
function paintHabitat(
  ctx: CanvasRenderingContext2D,
  topC: [number, number, number],
  midC: [number, number, number],
  botC: [number, number, number],
  leftC: [number, number, number],
  rightC: [number, number, number],
  typeColor: string,
  seed: number,
  y0: number,
  W: number,
  H: number,
) {
  const rnd = seeded(seed ^ 0x9e3779b9);
  const h = H - y0;
  if (h < 8) return;
  ctx.save();

  // Deep scenic wash (darker toward footer, like canyon/forest floor)
  const wash = ctx.createLinearGradient(0, y0, 0, H);
  wash.addColorStop(0, rgb(botC, 0));
  wash.addColorStop(0.2, rgb(botC, 0.18));
  wash.addColorStop(0.55, rgb(midC.map((v) => v * 0.55) as [number, number, number], 0.42));
  wash.addColorStop(1, rgb(botC.map((v) => v * 0.22) as [number, number, number], 0.72));
  ctx.fillStyle = wash;
  ctx.fillRect(0, y0, W, h);

  // Soft "terrain" ridges — silhouettes from left/right edge colours (SIR scenic feel)
  for (let i = 0; i < 4; i++) {
    const baseY = y0 + h * (0.35 + i * 0.14);
    const amp = 28 + rnd() * 50;
    const c = i % 2 === 0 ? leftC : rightC;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, baseY);
    for (let x = 0; x <= W; x += 40) {
      const y = baseY + Math.sin(x * 0.01 + i + rnd() * 0.5) * amp * (0.4 + rnd() * 0.6);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = rgb(
      c.map((v) => Math.max(0, v * (0.35 + i * 0.08))) as [number, number, number],
      0.22 - i * 0.03,
    );
    ctx.fill();
  }

  // Ambient light pools
  for (let i = 0; i < 4; i++) {
    const cx = W * (0.15 + rnd() * 0.7);
    const cy = y0 + h * (0.2 + rnd() * 0.55);
    const r = 100 + rnd() * 220;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = i % 2 === 0 ? midC : topC;
    g.addColorStop(0, rgb(c, 0.2));
    g.addColorStop(0.55, rgb(c, 0.06));
    g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Type-tinted atmosphere veil
  ctx.globalCompositeOperation = "screen";
  const mist2 = ctx.createRadialGradient(W * 0.5, y0 + h * 0.3, 20, W * 0.5, y0 + h * 0.5, h * 0.7);
  mist2.addColorStop(0, typeColor);
  mist2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = mist2;
  ctx.fillRect(0, y0, W, h);

  // Fine dust / energy motes
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = y0 + rnd() * h;
    const r = 0.5 + rnd() * 2;
    ctx.globalAlpha = 0.08 + rnd() * 0.18;
    ctx.fillStyle = rgb(botC.map((v) => Math.min(255, v + 70)) as [number, number, number]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function strokeFillText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  strokeW = 5,
) {
  ctx.save();
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTexture(ctx: CanvasRenderingContext2D, style: FullArtStyle, seed: number, k = 1) {
  const W = FULLART_W;
  const H = FULLART_H;
  const rnd = seeded(seed);
  ctx.save();
  if (style === "rainbow") {
    ctx.globalCompositeOperation = "soft-light";
    const g = ctx.createLinearGradient(0, 0, W, H);
    ["#ff4d6d", "#ffb703", "#fff275", "#52e5a3", "#4cc9f0", "#7b61ff", "#ff4d6d"].forEach(
      (c, i, a) => g.addColorStop(i / (a.length - 1), c),
    );
    ctx.globalAlpha = k * 0.75;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = k * 0.18;
    for (let x = -H; x < W; x += 22) {
      ctx.strokeStyle = x % 44 === 0 ? "#fff" : "#000";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
  } else if (style === "gold") {
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = k * 0.55;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fff1b8");
    g.addColorStop(0.45, "#e2b53a");
    g.addColorStop(1, "#8a5a0b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = k * 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (style === "alt") {
    // Etched line texture for an "illustration rare" feel.
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = k * 0.16;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    for (let r = 40; r < 1700; r += 14) {
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.34, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Edge-biased cosmos sparkles — keep the creature's face readable (less center glitter).
  const count = style === "holo" ? 280 : style === "gold" ? 200 : 110;
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < count; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    // Prefer periphery: skip many centre hits
    const nx = Math.min(x / W, 1 - x / W);
    const ny = Math.min(y / H, 1 - y / H);
    const edge = Math.min(nx, ny);
    if (edge > 0.18 && rnd() > 0.28) continue;
    const r = rnd() < 0.07 ? 2.5 + rnd() * 3.2 : 0.5 + rnd() * 1.5;
    const hue = style === "gold" ? 45 : Math.floor(rnd() * 360);
    ctx.globalAlpha = k * (0.18 + rnd() * 0.4) * (edge < 0.12 ? 1 : 0.55);
    ctx.fillStyle = `hsl(${hue} 100% ${style === "gold" ? 80 : 75}%)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (style === "holo") {
    ctx.globalCompositeOperation = "color-dodge";
    ctx.globalAlpha = k * 0.14;
    const g = ctx.createLinearGradient(0, H * 0.1, W, H * 0.9);
    g.addColorStop(0, "rgba(56,189,248,0)");
    g.addColorStop(0.35, "rgba(56,189,248,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.9)");
    g.addColorStop(0.65, "rgba(236,72,153,0.9)");
    g.addColorStop(1, "rgba(236,72,153,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function rimStroke(ctx: CanvasRenderingContext2D, rim: FullArtRim): string | CanvasGradient {
  const W = FULLART_W;
  const H = FULLART_H;
  if (rim === "gold") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fff1b8");
    g.addColorStop(0.45, "#e2b53a");
    g.addColorStop(1, "#9a6a12");
    return g;
  }
  if (rim === "silver") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f5f7fa");
    g.addColorStop(0.35, "#c5c9d1");
    g.addColorStop(0.7, "#8b929e");
    g.addColorStop(1, "#e8ebf0");
    return g;
  }
  return "transparent";
}

function frameStroke(ctx: CanvasRenderingContext2D, style: FullArtStyle): string | CanvasGradient {
  if (style === "rainbow") {
    const g = ctx.createLinearGradient(0, 0, FULLART_W, FULLART_H);
    ["#ff4d6d", "#ffb703", "#52e5a3", "#4cc9f0", "#7b61ff"].forEach((c, i, a) =>
      g.addColorStop(i / (a.length - 1), c),
    );
    return g;
  }
  if (style === "gold") return rimStroke(ctx, "gold");
  if (style === "holo" || style === "alt") return rimStroke(ctx, "silver");
  return rimStroke(ctx, "silver");
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return [200, 200, 200];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixC(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}

/** Ultra Rare / Illustration Rare scans are already current-gen full arts. */
export function isOfficialFullBleed(card: TCGCard): boolean {
  const r = `${card.rarity || ""}`.toLowerCase();
  return /ultra rare|illustration rare|special illustration|hyper rare|black white|art rare/.test(r);
}

function stageLabel(card: TCGCard): string {
  const s = (card.subtypes || []).join(" ");
  if (/stage\s*2/i.test(s)) return "STAGE 2";
  if (/stage\s*1/i.test(s)) return "STAGE 1";
  if (/basic/i.test(s)) return "BASIC";
  if (card.evolvesFrom) return "STAGE";
  return "BASIC";
}

function cardIsEx(card: TCGCard): boolean {
  return /\bex\b/i.test(card.name) || (card.subtypes || []).some((s) => /^ex$/i.test(s));
}

function displayName(card: TCGCard): string {
  return card.name.replace(/\s+ex$/i, "").trim() || card.name;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines - 1) {
        i++;
        break;
      }
    } else cur = next;
  }
  if (cur && lines.length < maxLines) {
    const rest = [cur, ...words.slice(i)].join(" ");
    let last = rest;
    const truncated = words.slice(i).length > (cur ? 0 : 1) && i < words.length;
    if (truncated || ctx.measureText(last).width > maxW) {
      while (ctx.measureText(`${last}…`).width > maxW && last.length > 4) last = last.slice(0, -1).trim();
      if (!last.endsWith("…")) last += "…";
    }
    lines.push(last);
  }
  return lines.slice(0, maxLines);
}

function paintCardEdge(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, FULLART_W, FULLART_H);
  g.addColorStop(0, "#dedee2");
  g.addColorStop(0.5, "#b7b8be");
  g.addColorStop(1, "#ececf0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FULLART_W, FULLART_H);
}

function clipCardFace(ctx: CanvasRenderingContext2D) {
  roundRect(ctx, 18, 18, FULLART_W - 36, FULLART_H - 36, 30);
  ctx.clip();
}

/** Real silk pixels measured off a current-gen Ultra Rare (hue ≈ 150°). */
let stylePlate: HTMLImageElement | null = null;

export function setFullArtStylePlate(img: HTMLImageElement | null) {
  stylePlate = img;
}

/** Navis inject this plate: every background pixel is a real full-art silk pixel. */
export function loadFullArtStylePlate(src = "/fullart-silk-style.png"): Promise<void> {
  if (stylePlate) return Promise.resolve();
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      stylePlate = im;
      resolve();
    };
    im.onerror = () => resolve();
    im.src = src;
  });
}

/** Hue shift from the measured grass silk (150°) onto this card’s type. */
function silkFilter(type: string | undefined): string {
  switch (type) {
    case "Fire":
      return "hue-rotate(-134deg) saturate(1.35)";
    case "Water":
      return "hue-rotate(58deg) saturate(1.25)";
    case "Lightning":
      return "hue-rotate(-100deg) saturate(1.45)";
    case "Psychic":
      return "hue-rotate(140deg) saturate(1.2)";
    case "Fighting":
      return "hue-rotate(-122deg) saturate(0.75)";
    case "Darkness":
      return "hue-rotate(90deg) saturate(0.45) brightness(0.7)";
    case "Metal":
      return "hue-rotate(40deg) saturate(0.25) brightness(1.15)";
    case "Dragon":
      return "hue-rotate(-105deg) saturate(1.1)";
    case "Fairy":
      return "hue-rotate(176deg) saturate(1.15)";
    case "Colorless":
      return "grayscale(0.85) brightness(1.2)";
    default:
      return "saturate(1.15)";
  }
}

/** Flowing type-colour silk. Prefers the Navi pixel plate; falls back to paint. */
function paintSilk(
  ctx: CanvasRenderingContext2D,
  typeName: string,
  seed: number,
  W: number,
  H: number,
  finish: FullArtStyle = "holo",
) {
  if (stylePlate) {
    ctx.save();
    ctx.filter =
      finish === "gold"
        ? "hue-rotate(-108deg) saturate(1.3)"
        : finish === "rainbow"
          ? "hue-rotate(40deg) saturate(1.6)"
          : silkFilter(typeName);
    const s = Math.max(W / stylePlate.naturalWidth, H / stylePlate.naturalHeight);
    const dw = stylePlate.naturalWidth * s;
    const dh = stylePlate.naturalHeight * s;
    ctx.drawImage(stylePlate, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    return;
  }
  const typeHex = TYPE_COLORS[typeName] || "#d0d0d0";
  const rnd = seeded(seed);
  const base = hexRgb(typeHex);
  const light = mixC(base, [255, 255, 255], 0.66);
  const mid = mixC(base, [255, 255, 255], 0.3);
  const deep = mixC(base, [10, 16, 22], 0.42);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, rgb(light));
  g.addColorStop(0.45, rgb(mid));
  g.addColorStop(1, rgb(mixC(mid, light, 0.22)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.translate(W * (0.15 + rnd() * 0.7), H * (0.06 + rnd() * 0.88));
    ctx.rotate((rnd() - 0.5) * 1.05);
    const rw = W * (0.8 + rnd() * 0.85);
    const rh = 42 + rnd() * 150;
    const col = rnd() > 0.5 ? light : deep;
    const grd = ctx.createLinearGradient(-rw / 2, 0, rw / 2, 0);
    grd.addColorStop(0, rgb(col, 0));
    grd.addColorStop(0.48, rgb(col, 0.28 + rnd() * 0.22));
    grd.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  for (let x = -H; x < W + 20; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H * 0.26, H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMaskedSubject(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  box: Box,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(2, Math.round(dw));
  tmp.height = Math.max(2, Math.round(dh));
  const t = tmp.getContext("2d")!;
  t.imageSmoothingQuality = "high";
  t.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = "destination-in";
  // Elliptical falloff that hits zero inside the bitmap, so the crop never
  // reads as a rectangle on the silk.
  t.save();
  t.translate(tmp.width * 0.5, tmp.height * 0.46);
  t.scale(1, tmp.height / Math.max(1, tmp.width));
  const rad = tmp.width * 0.38;
  const g = t.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.5, "rgba(0,0,0,1)");
  g.addColorStop(0.72, "rgba(0,0,0,0.55)");
  g.addColorStop(0.88, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  t.fillStyle = g;
  t.fillRect(-tmp.width * 2, -tmp.height * 2, tmp.width * 4, tmp.height * 4);
  t.restore();
  ctx.drawImage(tmp, dx, dy);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const W = FULLART_W;
  const H = FULLART_H;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function fanTag(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = "800 16px Barlow, system-ui, sans-serif";
  ctx.textAlign = "right";
  strokeFillText(ctx, "FAN-MADE CUSTOM · NOT OFFICIAL", FULLART_W - 36, FULLART_H - 28, "#f6d57a", 3);
  ctx.restore();
}

function silkHex(card: TCGCard, style: FullArtStyle): string {
  if (style === "gold") return "#e2b53a";
  if (style === "rainbow") return "#c9b6ff";
  return TYPE_COLORS[card.types?.[0] || "Colorless"] || "#d0d0d0";
}

function drawFrame(ctx: CanvasRenderingContext2D, card: TCGCard, opts: FullArtOptions) {
  const W = FULLART_W;
  const H = FULLART_H;
  const rim: FullArtRim = opts.rim ?? (opts.style === "gold" ? "gold" : "silver");
  ctx.save();

  if (rim !== "none") {
    ctx.lineWidth = 8;
    ctx.strokeStyle = rimStroke(ctx, rim === "gold" ? "gold" : "silver");
    roundRect(ctx, 28, 28, W - 56, H - 56, 24);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    roundRect(ctx, 36, 36, W - 72, H - 72, 20);
    ctx.stroke();
  }

  const plateY = 64;
  const plateH = 96;
  const plate = ctx.createLinearGradient(0, plateY, W, plateY + plateH);
  plate.addColorStop(0, "#fbfbfc");
  plate.addColorStop(0.45, "#d7dae1");
  plate.addColorStop(1, "#f4f5f7");
  ctx.fillStyle = plate;
  roundRect(ctx, 52, plateY, W - 150, plateH, 20);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  roundRect(ctx, 52, plateY, W - 150, plateH, 20);
  ctx.stroke();

  const stage = stageLabel(card);
  ctx.font = "800 18px Barlow, system-ui, sans-serif";
  const badgeW = ctx.measureText(stage).width + 26;
  const badge = ctx.createLinearGradient(0, 42, 0, 80);
  badge.addColorStop(0, "#ffffff");
  badge.addColorStop(1, "#c5c9d1");
  ctx.fillStyle = badge;
  roundRect(ctx, 68, 42, badgeW, 34, 8);
  ctx.fill();
  ctx.strokeStyle = "#8e949e";
  ctx.stroke();
  ctx.fillStyle = "#1c1c1c";
  ctx.fillText(stage, 81, 65);

  const name = displayName(card);
  const ex = cardIsEx(card);
  let nameSize = 52;
  ctx.fillStyle = "#141414";
  ctx.font = `800 ${nameSize}px Barlow, system-ui, sans-serif`;
  const maxName = W - 280;
  while (ctx.measureText(name).width > maxName && nameSize > 30) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px Barlow, system-ui, sans-serif`;
  }
  ctx.fillText(name, 72, plateY + 70);
  if (ex) {
    const nx = 78 + ctx.measureText(name).width;
    ctx.font = `italic 800 ${Math.round(nameSize * 0.7)}px Barlow, system-ui, sans-serif`;
    ctx.fillText("ex", nx, plateY + 68);
  }

  const t0 = card.types?.[0];
  if (t0) {
    ctx.beginPath();
    ctx.arc(W - 78, plateY + 48, 28, 0, Math.PI * 2);
    ctx.fillStyle = TYPE_COLORS[t0] || "#ccc";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "800 26px Barlow, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t0[0], W - 78, plateY + 57);
    ctx.textAlign = "left";
  }
  if (card.hp) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#141414";
    ctx.font = "800 52px Barlow, system-ui, sans-serif";
    const hpRight = W - 124;
    ctx.fillText(card.hp, hpRight, plateY + 72);
    const numW = ctx.measureText(card.hp).width;
    ctx.font = "800 18px Barlow, system-ui, sans-serif";
    ctx.fillStyle = "#333";
    ctx.fillText("HP", hpRight - numW - 6, plateY + 62);
    ctx.textAlign = "left";
  }

  const attacks = (card.attacks || []).slice(0, 2);
  const ability = (card.abilities || [])[0];
  let y = H * 0.62;
  if (ability) {
    ctx.font = "800 18px Barlow, system-ui, sans-serif";
    const pill = "Ability";
    const pw = ctx.measureText(pill).width + 24;
    ctx.fillStyle = "#e10600";
    roundRect(ctx, 56, y, pw, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(pill, 68, y + 22);
    ctx.fillStyle = "#c40000";
    ctx.font = "800 28px Barlow, system-ui, sans-serif";
    let abName = ability.name;
    while (ctx.measureText(abName).width > W - 160 - pw && abName.length > 4)
      abName = abName.slice(0, -2) + "…";
    ctx.fillText(abName, 56 + pw + 12, y + 24);
    y += 46;
    if (ability.text) {
      ctx.font = "600 20px Barlow, system-ui, sans-serif";
      ctx.fillStyle = "#1b1b1b";
      for (const line of wrapLines(ctx, ability.text, W - 120, 2)) {
        ctx.fillText(line, 56, y + 16);
        y += 26;
      }
      y += 6;
    }
  }
  for (const a of attacks) {
    let x = 56;
    const cy = y + 22;
    for (const c of (a.cost || []).slice(0, 5)) {
      ctx.beginPath();
      ctx.arc(x + 14, cy - 4, 14, 0, Math.PI * 2);
      ctx.fillStyle = TYPE_COLORS[c] || "#eee";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.stroke();
      x += 32;
    }
    ctx.font = "800 30px Barlow, system-ui, sans-serif";
    ctx.fillStyle = "#141414";
    const nameX = x + 8;
    const dmgReserve = a.damage ? 120 : 0;
    let label = a.name;
    while (ctx.measureText(label).width > W - 64 - nameX - dmgReserve && label.length > 4)
      label = label.slice(0, -2) + "…";
    ctx.fillText(label, nameX, cy + 8);
    if (a.damage) {
      ctx.textAlign = "right";
      ctx.font = "800 44px Barlow, system-ui, sans-serif";
      ctx.fillText(a.damage, W - 56, cy + 10);
      ctx.textAlign = "left";
    }
    y += 40;
    if (a.text) {
      ctx.font = "600 18px Barlow, system-ui, sans-serif";
      ctx.fillStyle = "#222";
      const line = wrapLines(ctx, a.text, W - 120, 1)[0];
      if (line) ctx.fillText(line, 56, y + 8);
      y += 28;
    }
    y += 10;
  }

  const footY = H - 148;
  ctx.font = "700 16px Barlow, system-ui, sans-serif";
  ctx.fillStyle = "#2a2a2a";
  let fx = 56;
  const weak = card.weaknesses?.[0];
  if (weak) {
    ctx.fillText("weakness", fx, footY);
    fx += ctx.measureText("weakness").width + 10;
    ctx.beginPath();
    ctx.arc(fx + 11, footY - 6, 11, 0, Math.PI * 2);
    ctx.fillStyle = TYPE_COLORS[weak.type] || "#ddd";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();
    fx += 28;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillText(weak.value || "×2", fx, footY);
    fx += 70;
  }
  const retreatN = card.retreatCost?.length || 0;
  if (retreatN) {
    ctx.fillText("retreat", fx, footY);
    fx += ctx.measureText("retreat").width + 10;
    for (let i = 0; i < Math.min(retreatN, 4); i++) {
      ctx.beginPath();
      ctx.arc(fx + 11, footY - 6, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#f2f2f2";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.stroke();
      fx += 26;
    }
  }

  const barY = H - 112;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  roundRect(ctx, 48, barY, W - 96, 64, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, 48, barY, W - 96, 64, 14);
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "700 16px Barlow, system-ui, sans-serif";
  const rule = cardIsEx(card)
    ? "Pokémon ex rule   When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards."
    : [card.set?.name, card.number ? `#${card.number}` : ""].filter(Boolean).join("  ·  ");
  let ruleText = rule;
  while (ctx.measureText(ruleText).width > W - 160 && ruleText.length > 8)
    ruleText = ruleText.slice(0, -2) + "…";
  ctx.fillText(ruleText, 64, barY + 38);
  ctx.textAlign = "right";
  ctx.font = "800 13px Barlow, system-ui, sans-serif";
  ctx.fillStyle = "#8a6412";
  ctx.fillText("FAN-MADE · NOT OFFICIAL", W - 64, barY + 22);
  ctx.textAlign = "left";
  ctx.restore();
}

/** Render a full-art design for `card` onto `canvas` (1000×1400). */
export function renderFullArt(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  card: TCGCard,
  opts: FullArtOptions,
) {
  const W = FULLART_W;
  const H = FULLART_H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);

  if (!opts.aiArt && isOfficialFullBleed(card)) {
    drawCover(ctx, img);
    fanTag(ctx);
    return;
  }

  paintCardEdge(ctx);
  ctx.save();
  clipCardFace(ctx);
  if (opts.aiArt) renderAiArt(ctx, opts.aiArt);
  else {
    paintSilk(
      ctx,
      card.types?.[0] || "Colorless",
      hash(card.id + "silk" + opts.style),
      W,
      H,
      opts.style,
    );
    const box = artBox(img);
    const dw = W * 1.28;
    const dh = dw * (box.h / Math.max(1, box.w));
    drawMaskedSubject(ctx, img, box, (W - dw) / 2, H * 0.08, dw, dh);
  }
  ctx.restore();
  drawTexture(ctx, opts.style, hash(card.id + opts.style), opts.aiArt ? 0.35 : 0.45);
  drawOverlay(ctx, card, opts);
}

/** Cover-fit the AI art (3:4 from the model) into the 5:7 canvas, then shade for text legibility. */
function renderAiArt(ctx: CanvasRenderingContext2D, art: HTMLImageElement) {
  const W = FULLART_W;
  const H = FULLART_H;
  const s = Math.max(W / art.naturalWidth, H / art.naturalHeight);
  const dw = art.naturalWidth * s;
  const dh = art.naturalHeight * s;
  ctx.drawImage(art, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(0.16, "rgba(0,0,0,0)");
  g.addColorStop(0.62, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(255,255,255,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawOverlay(ctx: CanvasRenderingContext2D, card: TCGCard, opts: FullArtOptions) {
  const W = FULLART_W;
  const H = FULLART_H;
  if (opts.frame) drawFrame(ctx, card, opts);
  else {
    ctx.save();
    ctx.font = "700 20px Barlow, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText("Fan-made custom · not official", W - 28, H - 26);
    ctx.restore();
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Export failed"))), "image/png"),
  );
}

export function makeThumb(canvas: HTMLCanvasElement, w = 250): string {
  const t = document.createElement("canvas");
  t.width = w;
  t.height = Math.round((w * canvas.height) / canvas.width);
  t.getContext("2d")!.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL("image/webp", 0.82);
}

/* ─── "My Full Arts" gallery (IndexedDB; Supabase best-effort) ─── */
export type FullArtRecord = {
  id: string;
  cardId: string;
  cardName: string;
  setName?: string;
  style: FullArtStyle;
  frame: boolean;
  createdAt: number;
  thumb: string;
  blob: Blob;
  cloud?: boolean;
};

const DB = "pv-fullarts";
const STORE = "arts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }),
  );
}

export const FULLARTS_EVENT = "pv-fullarts-changed";

export async function listFullArts(): Promise<FullArtRecord[]> {
  try {
    const all = await tx<FullArtRecord[]>(
      "readonly",
      (s) => s.getAll() as IDBRequest<FullArtRecord[]>,
    );
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteFullArt(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event(FULLARTS_EVENT));
}

/** Try to mirror into Supabase Storage for signed-in users; never throws. */
async function tryCloudSave(rec: FullArtRecord): Promise<boolean> {
  try {
    const hasSession = Object.keys(localStorage).some((k) => /^sb-.*-auth-token/.test(k));
    if (!hasSession) return false;
    const { checkAuthService } = await import("./auth-status");
    if (!(await checkAuthService())) return false;
    const { loadSupabase } = await import("@/integrations/supabase/lazy");
    const supabase = await loadSupabase();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return false;
    const { error } = await supabase.storage
      .from("fullarts")
      .upload(`${uid}/${rec.id}.png`, rec.blob, { contentType: "image/png", upsert: true });
    return !error;
  } catch {
    return false;
  }
}

export async function saveFullArt(
  card: TCGCard,
  canvas: HTMLCanvasElement,
  opts: FullArtOptions,
): Promise<FullArtRecord> {
  const blob = await canvasToBlob(canvas);
  const rec: FullArtRecord = {
    id: `${card.id}-${opts.style}-${Date.now().toString(36)}`,
    cardId: card.id,
    cardName: card.name,
    setName: card.set?.name,
    style: opts.style,
    frame: opts.frame,
    createdAt: Date.now(),
    thumb: makeThumb(canvas),
    blob,
  };
  await tx("readwrite", (s) => s.put(rec));
  window.dispatchEvent(new Event(FULLARTS_EVENT));
  void tryCloudSave(rec).then(async (ok) => {
    if (!ok) return;
    rec.cloud = true;
    try {
      await tx("readwrite", (s) => s.put(rec));
      window.dispatchEvent(new Event(FULLARTS_EVENT));
    } catch {
      /* ignore */
    }
  });
  return rec;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function fullArtFilename(name: string, style: FullArtStyle) {
  return `pokevault-fullart-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${style}.png`;
}
