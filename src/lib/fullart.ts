// Full Art Studio engine: turns a card scan into a fan-made full-bleed / extended-art design.
// Pure client-side canvas compositor (no paid AI key needed):
//   1. colour-sampled gradient base  2. stretched + blurred art bleed (atmosphere)
//   3. CONTINUATION of source habitat from art edges (NO mirror, NO new biome)  4. large sharp art
//   5. light holo / rainbow / gold texture (edge-biased)  6. thin rim + floating stroked text.
// Optional AI path: opts.aiArt (Nano Banana, via /api/public/fullart-ai) replaces 1-4.
// Overlay (fa-v3.4): full-bleed, thin rim, floating stroked attack text (NO chips/panels), name/HP corners.
// Extension DEFAULT: finish/continue the source art's own plants/grass/sky to every edge.
// SIR-COHERENCE: subject peakY≈0.54, painted bottoms (edge≥0.63×mid), floating stroke overlay.
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

/** Layout bands from SIR-COHERENCE; fa-v3.4 defaults to habitat CONTINUATION from source edges. */
export const FULLART_LAYOUT = {
  version: "fa-v3.4-continuation",
  nameHpBand: [0, 0.1],
  subjectBand: [0.1, 0.65],
  /** Real SIR detail peak ~0.54 of height — keep hero centred mid-card, not crushed at top. */
  subjectPeakY: 0.54,
  habitatBand: [0.65, 0.92],
  footerBand: [0.92, 1],
  /** Bottom habitat must keep ≥ this fraction of mid-band edge energy (painted, not mud). */
  minBottomEdgeRatio: 0.63,
  overlay: "floating-stroke", // no chips / glass panels
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

function drawFrame(ctx: CanvasRenderingContext2D, card: TCGCard, opts: FullArtOptions) {
  const W = FULLART_W;
  const H = FULLART_H;
  const style = opts.style;
  const rim: FullArtRim =
    opts.rim ?? (style === "gold" ? "gold" : style === "alt" ? "silver" : "silver");
  ctx.save();

  // Thin SIR rim (full-bleed art goes to the card edge; only a slim decorative line).
  if (rim !== "none") {
    const inset = 8;
    ctx.lineWidth = 6;
    ctx.strokeStyle = rimStroke(ctx, rim);
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, 28);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, inset + 5, inset + 5, W - (inset + 5) * 2, H - (inset + 5) * 2, 24);
    ctx.stroke();
  }

  // Name (top-left) + HP (top-right) — soft drop shadow, no solid band (art shows through).
  const top = 54;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.textBaseline = "alphabetic";
  const stage = card.subtypes?.find((s) => /basic|stage/i.test(s)) || "";
  if (stage) {
    ctx.font = "800 20px Barlow, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(stage.toUpperCase(), 48, top);
  }
  let nameSize = 58;
  ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  const maxName = W - 48 - 280;
  while (ctx.measureText(card.name).width > maxName && nameSize > 32) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  }
  const nameY = top + (stage ? 52 : 42);
  strokeFillText(ctx, card.name, 48, nameY, "#fff", 6);
  if (card.hp) {
    ctx.textAlign = "right";
    const hpX = W - 48 - (card.types?.length ? 56 : 0);
    ctx.font = '800 56px "Bebas Neue", Barlow, Impact, sans-serif';
    const numW = ctx.measureText(card.hp).width;
    strokeFillText(ctx, card.hp, hpX, nameY, "#fff", 6);
    ctx.font = "800 24px Barlow, system-ui, sans-serif";
    strokeFillText(ctx, "HP", hpX - numW - 8, nameY, "#fff", 4);
    ctx.textAlign = "left";
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const t0 = card.types?.[0];
  if (t0) {
    ctx.beginPath();
    ctx.arc(W - 72, top + (stage ? 34 : 24), 22, 0, Math.PI * 2);
    ctx.fillStyle = TYPE_COLORS[t0] || "#ccc";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "800 22px Barlow, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t0[0], W - 72, top + (stage ? 41 : 31));
    ctx.textAlign = "left";
  }

  // Bottom zone (fa-v3.3): floating stroked attack text — NO chips / panels / glass slabs.
  // Matches SIR refs (Mega Gengar / Armarouge): text sits on art with shadow+stroke only.
  const attacks = (card.attacks || []).slice(0, 2);
  const abilities = (card.abilities || []).slice(0, 1);
  const rowH = 58;
  const rowGap = 8;
  const rows = attacks.length + abilities.length;
  const footerH = 36;
  const stackH = rows ? rows * rowH + Math.max(0, rows - 1) * rowGap : 0;
  const stackBottom = H - 24 - footerH;
  const stackTop = rows ? stackBottom - stackH : stackBottom;
  const contentX = 48;
  const contentW = W - 96;

  // Very light legibility veil — art remains the hero (SIR scenic bottoms)
  const fadeTop = Math.min(stackTop - 80, H * 0.58);
  const fade = ctx.createLinearGradient(0, fadeTop, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.5, "rgba(0,0,0,0.05)");
  fade.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, W, H - fadeTop);

  if (rows) {
    let y = stackTop;
    let left = abilities.length + attacks.length;
    for (const ab of abilities) {
      left--;
      const cy = y + rowH / 2 + 4;
      ctx.font = "800 13px Barlow, system-ui, sans-serif";
      strokeFillText(ctx, "ABILITY", contentX, cy - 14, "#7dd3fc", 4);
      ctx.font = "800 28px Barlow, system-ui, sans-serif";
      let abName = ab.name;
      while (ctx.measureText(abName).width > contentW && abName.length > 4)
        abName = abName.slice(0, -2) + "…";
      strokeFillText(ctx, abName, contentX, cy + 16, "#fff", 5);
      y += rowH + rowGap;
    }
    for (const a of attacks) {
      left--;
      const cy = y + rowH / 2 + 4;
      let x = contentX;
      for (const c of (a.cost || []).slice(0, 5)) {
        ctx.beginPath();
        ctx.arc(x + 13, cy - 2, 13, 0, Math.PI * 2);
        ctx.fillStyle = TYPE_COLORS[c] || "#ddd";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
        x += 30;
      }
      ctx.font = "800 28px Barlow, system-ui, sans-serif";
      const nameX = x + 8;
      const dmgW = a.damage ? 110 : 0;
      let label = a.name;
      while (ctx.measureText(label).width > contentW - (nameX - contentX) - dmgW && label.length > 4)
        label = label.slice(0, -2) + "…";
      strokeFillText(ctx, label, nameX, cy + 8, "#fff", 5);
      if (a.damage) {
        ctx.textAlign = "right";
        ctx.font = '800 42px "Bebas Neue", Barlow, Impact, sans-serif';
        strokeFillText(ctx, a.damage, W - 48, cy + 12, "#ffe08a", 5);
        ctx.textAlign = "left";
      }
      y += rowH + rowGap;
    }
  }

  // Footer floating meta
  ctx.font = "700 14px Barlow, system-ui, sans-serif";
  const leftMeta = [card.set?.name, card.number ? `#${card.number}` : ""].filter(Boolean).join(" · ");
  strokeFillText(ctx, leftMeta, 40, H - 26, "rgba(255,255,255,0.9)", 3);
  ctx.textAlign = "right";
  ctx.font = "800 13px Barlow, system-ui, sans-serif";
  strokeFillText(ctx, "FAN-MADE CUSTOM · NOT OFFICIAL", W - 40, H - 26, "#f6d57a", 3);
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
  if (opts.aiArt) {
    renderAiArt(ctx, opts.aiArt);
    // The model already paints the finish; add a lighter foil pass on top.
    drawTexture(ctx, opts.style, hash(card.id + opts.style), 0.45);
    drawOverlay(ctx, card, opts);
    return;
  }
  const box = artBox(img);

  // Sample edge / corner colours for scenic habitat (SIR canyon/forest feel).
  const probe = document.createElement("canvas");
  probe.width = 240;
  probe.height = Math.round((240 * box.h) / box.w);
  const pc = probe.getContext("2d", { willReadFrequently: true })!;
  pc.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, probe.width, probe.height);
  const topC = avgColor(pc, 0, 0, probe.width, 10);
  const midC = avgColor(pc, 0, probe.height * 0.4, probe.width, probe.height * 0.2);
  const botC = avgColor(pc, 0, probe.height - 10, probe.width, 10);
  const leftC = avgColor(pc, 0, probe.height * 0.35, 12, probe.height * 0.35);
  const rightC = avgColor(pc, probe.width - 12, probe.height * 0.35, 12, probe.height * 0.35);
  const typeKey = card.types?.[0] || "Colorless";
  const typeHex = TYPE_COLORS[typeKey] || "#e0e0e0";

  // 1. colour-sampled gradient base
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, rgb(topC));
  base.addColorStop(0.35, rgb(midC));
  base.addColorStop(0.7, rgb(botC));
  base.addColorStop(1, rgb(botC.map((v) => v * 0.4) as [number, number, number]));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // 2. soft atmospheric bleed of the whole art (low alpha — avoid muddy wash)
  ctx.save();
  ctx.filter = "blur(28px) saturate(1.4)";
  ctx.globalAlpha = 0.55;
  const coverScale = Math.max(W / box.w, H / box.h) * 1.15;
  const cw = box.w * coverScale;
  const ch = box.h * coverScale;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, (W - cw) / 2, (H - ch) / 2 - H * 0.06, cw, ch);
  ctx.restore();

  // Subject (SIR-COHERENCE): place art so its visual centre sits near mid-card (peakY≈0.54).
  // Face lives in the upper third of the art box → bias that third toward ~42% of card height.
  const targetH = H * 0.7;
  const scale = Math.max((W / box.w) * 1.22, targetH / box.h);
  const aw = box.w * scale;
  const ah = box.h * scale;
  const ax = (W - aw) / 2;
  const faceY = H * 0.42; // where the face / densest art should land
  let ay = Math.round(faceY - ah * 0.32);
  // Keep name band readable and leave room for floating attack text.
  ay = Math.max(Math.round(H * 0.06), Math.min(ay, Math.round(H * 0.18)));

  const topSpace = ay;
  const botY = ay + ah;
  const botSpace = Math.max(0, H - botY);

  // 3a. Edge CONTINUATION — finish canopy / side foliage from the source art
  fillEdgeContinuation(ctx, img, box, ax, ay, aw, ah, W, H);

  // 3b. Bottom habitat CONTINUATION from the art window's grass/plant strip
  fillBottomLayers(ctx, img, box, ax, aw, Math.min(botY, H * 0.55), H - Math.min(botY, H * 0.55));

  // 3c. Soft scenic wash (colour-matched; must not invent a new biome)
  paintHabitat(
    ctx,
    topC,
    midC,
    botC,
    leftC,
    rightC,
    typeHex,
    hash(card.id + "hab"),
    Math.min(botY - 40, H * 0.52),
    W,
    H,
  );

  // Soft vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.36, W * 0.25, W / 2, H * 0.46, H * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 4. Sharp hero art — light feather only at top; bottom stays crisp into habitat
  drawFeathered(ctx, img, box, { x: ax, y: ay, w: aw, h: ah }, 18);

  // Contact shadow so the subject sits in the scene
  ctx.save();
  const shY = Math.min(ay + ah * 0.92, H * 0.78);
  const sh = ctx.createRadialGradient(W / 2, shY, 8, W / 2, shY, aw * 0.4);
  sh.addColorStop(0, "rgba(0,0,0,0.32)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = sh;
  ctx.fillRect(0, shY - 50, W, 140);
  ctx.restore();

  // Soft rim light suggestion around subject (premium pop)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.12;
  const rim = ctx.createRadialGradient(W / 2, ay + ah * 0.45, ah * 0.15, W / 2, ay + ah * 0.45, ah * 0.55);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(0.7, typeHex);
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, ay, W, ah);
  ctx.restore();

  // 5. Edge-biased foil (keep face clean)
  drawTexture(ctx, opts.style, hash(card.id + opts.style), 0.65);

  // 6. Overlay
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
  g.addColorStop(0, "rgba(0,0,0,0.22)");
  g.addColorStop(0.12, "rgba(0,0,0,0)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.18)");
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
