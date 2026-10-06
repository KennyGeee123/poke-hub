// Full Art Studio engine: turns a card scan into a fan-made full-bleed / extended-art design.
// Pure client-side canvas compositor (no paid AI key needed):
//   1. colour-sampled gradient base  2. stretched + blurred art bleed (atmosphere)
//   3. directional edge stretch + painted habitat (NO mirror reflection)  4. large sharp art
//   5. light holo / rainbow / gold texture (edge-biased)  6. thin rim + frosted attack panel.
// Optional AI path: opts.aiArt (Nano Banana, via /api/public/fullart-ai) replaces 1-4.
// Overlay (fa-v3.2): full-bleed, thin rim, light frosted attack rows (high art bleed), name/HP corners.
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

/** Illustration window on a standard (post-2003) card scan, as fractions of the scan. */
export function artBox(img: HTMLImageElement): Box {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  // Inset slightly so the extension never samples the printed art border.
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
 * Stretch an edge band into dest WITHOUT mirroring (avoids muddy reflection bottoms).
 * dir "up" = seam at bottom of dst (extending above art); "down" = seam at top of dst.
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
  // Draw the thin source band stretched to fill dest (same orientation — no flip).
  t.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = "destination-in";
  const g = t.createLinearGradient(0, 0, 0, tmp.height);
  if (dir === "down") {
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(0.35, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.65, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0.85)");
  }
  t.fillStyle = g;
  t.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, dst.x, dst.y);
}

/** Soft habitat continuation under the subject — painted colour fields, not a mirrored smear. */
function paintHabitat(
  ctx: CanvasRenderingContext2D,
  topC: [number, number, number],
  midC: [number, number, number],
  botC: [number, number, number],
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
  // Soft colour wash — keep it quiet so frosted text stays readable and art isn't muddy
  const wash = ctx.createLinearGradient(0, y0, 0, H);
  wash.addColorStop(0, rgb(botC, 0));
  wash.addColorStop(0.35, rgb(botC.map((v) => v * 0.9) as [number, number, number], 0.22));
  wash.addColorStop(0.75, rgb(midC.map((v) => v * 0.5) as [number, number, number], 0.38));
  wash.addColorStop(1, rgb(botC.map((v) => v * 0.3) as [number, number, number], 0.55));
  ctx.fillStyle = wash;
  ctx.fillRect(0, y0, W, h);

  // Soft radial blooms (subtle depth, not UI ovals)
  for (let i = 0; i < 3; i++) {
    const cx = W * (0.2 + rnd() * 0.6);
    const cy = y0 + h * (0.35 + rnd() * 0.5);
    const r = 120 + rnd() * 200;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = i % 2 === 0 ? botC : midC;
    g.addColorStop(0, rgb(c, 0.16));
    g.addColorStop(0.6, rgb(c, 0.05));
    g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Sparse type-tinted dust (no big ellipses — those read as UI)
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = y0 + rnd() * h;
    const r = 1 + rnd() * 3.5;
    ctx.globalAlpha = 0.1 + rnd() * 0.18;
    ctx.fillStyle = typeColor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine atmospheric motes
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = y0 + rnd() * h;
    const r = 0.5 + rnd() * 1.8;
    ctx.globalAlpha = 0.1 + rnd() * 0.2;
    ctx.fillStyle = rgb(botC.map((v) => Math.min(255, v + 50)) as [number, number, number]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
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
  ctx.fillStyle = "#fff";
  let nameSize = 58;
  ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  const maxName = W - 48 - 280;
  while (ctx.measureText(card.name).width > maxName && nameSize > 32) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  }
  ctx.fillText(card.name, 48, top + (stage ? 52 : 42));
  if (card.hp) {
    ctx.textAlign = "right";
    const hpX = W - 48 - (card.types?.length ? 56 : 0);
    ctx.font = '800 56px "Bebas Neue", Barlow, Impact, sans-serif';
    const numW = ctx.measureText(card.hp).width;
    ctx.fillText(card.hp, hpX, top + (stage ? 52 : 42));
    ctx.font = "800 24px Barlow, system-ui, sans-serif";
    ctx.fillText("HP", hpX - numW - 8, top + (stage ? 52 : 42));
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

  // Bottom zone (fa-v3.2): light frosted attack panel — high art bleed, premium SIR feel
  // (not dark app chips, not a heavy opaque glass slab clone of the screenshot).
  const attacks = (card.attacks || []).slice(0, 2);
  const abilities = (card.abilities || []).slice(0, 1);
  const rowH = 64;
  const rowGap = 2;
  const rows = attacks.length + abilities.length;
  const padY = 14;
  const padX = 32;
  const footerH = 44;
  const stackH = rows ? rows * rowH + Math.max(0, rows - 1) * rowGap : 0;
  const panelH = rows ? stackH + padY * 2 : 0;
  const panelBottom = H - 22 - footerH;
  const panelTop = rows ? panelBottom - panelH : panelBottom;
  const panelX = 28;
  const panelW = W - 56;

  // Soft legibility fade only — art stays the hero
  const fadeTop = Math.min(panelTop - 100, H * 0.52);
  const fade = ctx.createLinearGradient(0, fadeTop, 0, H);
  fade.addColorStop(0, "rgba(4,6,12,0)");
  fade.addColorStop(0.45, "rgba(4,6,12,0.12)");
  fade.addColorStop(0.8, "rgba(4,6,12,0.28)");
  fade.addColorStop(1, "rgba(4,6,12,0.4)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, W, H - fadeTop);

  if (rows) {
    // Frosted panel: dual-pass translucent fill so art shows through clearly
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, panelX, panelTop, panelW, panelH, 20);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Dark veil for text contrast (still see-through)
    roundRect(ctx, panelX, panelTop, panelW, panelH, 20);
    ctx.fillStyle = "rgba(6,8,14,0.2)";
    ctx.fill();
    // Hairline rim
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.stroke();
    // Soft top specular
    const spec = ctx.createLinearGradient(panelX, panelTop, panelX, panelTop + 28);
    spec.addColorStop(0, "rgba(255,255,255,0.18)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(ctx, panelX + 1, panelTop + 1, panelW - 2, 26, 18);
    ctx.fillStyle = spec;
    ctx.fill();
    ctx.restore();

    let y = panelTop + padY;
    const contentX = panelX + padX;
    const contentW = panelW - padX * 2;

    const drawRow = (fn: (cy: number) => void, isLast: boolean) => {
      fn(y + rowH / 2 + 6);
      if (!isLast) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.moveTo(contentX, y + rowH + rowGap / 2);
        ctx.lineTo(contentX + contentW, y + rowH + rowGap / 2);
        ctx.stroke();
      }
      y += rowH + rowGap;
    };

    let left = abilities.length + attacks.length;
    for (const ab of abilities) {
      left--;
      drawRow((cy) => {
        ctx.fillStyle = "#7dd3fc";
        ctx.font = "800 14px Barlow, system-ui, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.75)";
        ctx.shadowBlur = 5;
        ctx.fillText("ABILITY", contentX, cy - 12);
        ctx.fillStyle = "#fff";
        ctx.font = "800 30px Barlow, system-ui, sans-serif";
        let abName = ab.name;
        while (ctx.measureText(abName).width > contentW && abName.length > 4)
          abName = abName.slice(0, -2) + "…";
        ctx.fillText(abName, contentX, cy + 18);
        ctx.shadowBlur = 0;
      }, left === 0);
    }
    for (const a of attacks) {
      left--;
      drawRow((cy) => {
        let x = contentX;
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 4;
        for (const c of (a.cost || []).slice(0, 5)) {
          ctx.beginPath();
          ctx.arc(x + 14, cy - 2, 14, 0, Math.PI * 2);
          ctx.fillStyle = TYPE_COLORS[c] || "#ddd";
          ctx.fill();
          ctx.lineWidth = 1.75;
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.stroke();
          x += 32;
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "800 30px Barlow, system-ui, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 5;
        const nameX = x + 10;
        const dmgW = a.damage ? 110 : 0;
        let label = a.name;
        while (ctx.measureText(label).width > contentW - (nameX - contentX) - dmgW && label.length > 4)
          label = label.slice(0, -2) + "…";
        ctx.fillText(label, nameX, cy + 8);
        if (a.damage) {
          ctx.textAlign = "right";
          ctx.fillStyle = "#ffe08a";
          ctx.font = '800 44px "Bebas Neue", Barlow, Impact, sans-serif';
          ctx.fillText(a.damage, panelX + panelW - padX, cy + 12);
          ctx.textAlign = "left";
        }
        ctx.shadowBlur = 0;
      }, left === 0);
    }
  }

  // Footer — floating set · # + FAN-MADE (no heavy slab)
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "700 15px Barlow, system-ui, sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 6;
  const leftMeta = [card.set?.name, card.number ? `#${card.number}` : ""].filter(Boolean).join(" · ");
  ctx.fillText(leftMeta, 40, H - 28);
  ctx.textAlign = "right";
  ctx.fillStyle = "#f6d57a";
  ctx.font = "800 14px Barlow, system-ui, sans-serif";
  ctx.fillText("FAN-MADE CUSTOM · NOT OFFICIAL", W - 40, H - 28);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
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

  // Sample edge colours from the illustration (corners + mid for richer habitat).
  const probe = document.createElement("canvas");
  probe.width = 200;
  probe.height = Math.round((200 * box.h) / box.w);
  const pc = probe.getContext("2d", { willReadFrequently: true })!;
  pc.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, probe.width, probe.height);
  const topC = avgColor(pc, 0, 0, probe.width, 8);
  const midC = avgColor(pc, 0, probe.height * 0.4, probe.width, probe.height * 0.2);
  const botC = avgColor(pc, 0, probe.height - 8, probe.width, 8);
  const typeKey = card.types?.[0] || "Colorless";
  const typeHex = TYPE_COLORS[typeKey] || "#e0e0e0";

  // 1. colour-sampled gradient base
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, rgb(topC));
  base.addColorStop(0.4, rgb(midC));
  base.addColorStop(0.72, rgb(botC));
  base.addColorStop(1, rgb(botC.map((v) => v * 0.45) as [number, number, number]));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // 2. stretched + blurred art bleed (atmosphere — keep it soft, not muddy)
  ctx.save();
  ctx.filter = "blur(32px) saturate(1.35)";
  ctx.globalAlpha = 0.72;
  const coverScale = Math.max(W / box.w, H / box.h) * 1.12;
  const cw = box.w * coverScale;
  const ch = box.h * coverScale;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, (W - cw) / 2, (H - ch) / 2 - H * 0.04, cw, ch);
  ctx.restore();

  // Subject: large full-art hero — fills ~70% of height and overlaps the attack panel.
  const targetH = H * 0.7;
  const scale = Math.max((W / box.w) * 1.22, targetH / box.h);
  const aw = box.w * scale;
  const ah = box.h * scale;
  const ax = (W - aw) / 2;
  const ay = Math.max(44, Math.round(H * 0.045));

  const topSpace = ay;
  const botY = ay + ah;
  const botSpace = H - botY;

  // 3a. Directional edge stretch (NO mirror) — cheap outpaint into empty margins
  ctx.save();
  ctx.filter = "blur(18px) saturate(1.2)";
  ctx.globalAlpha = 0.95;
  // Top: stretch top edge row upward
  ctx.drawImage(
    img,
    box.x,
    box.y,
    box.w,
    Math.max(3, box.h * 0.04),
    ax,
    0,
    aw,
    topSpace + 48,
  );
  // Bottom: stretch bottom edge row downward (same orientation — not flipped)
  ctx.drawImage(
    img,
    box.x,
    box.y + box.h * 0.94,
    box.w,
    Math.max(3, box.h * 0.06),
    ax,
    botY - 24,
    aw,
    botSpace + 48,
  );
  // Sides: stretch left/right columns
  ctx.drawImage(
    img,
    box.x,
    box.y,
    Math.max(3, box.w * 0.04),
    box.h,
    0,
    ay,
    Math.max(ax + 40, 60),
    ah,
  );
  ctx.drawImage(
    img,
    box.x + box.w * 0.96,
    box.y,
    Math.max(3, box.w * 0.04),
    box.h,
    W - Math.max(W - (ax + aw) + 40, 60),
    ay,
    Math.max(W - (ax + aw) + 40, 60),
    ah,
  );
  ctx.restore();

  // 3b. Short feathered edge bands (still no flip) to hide the seam
  ctx.save();
  ctx.filter = "blur(7px)";
  ctx.globalAlpha = 0.75;
  const mTop = Math.min(topSpace + 24, ah * 0.22);
  stretchEdge(
    ctx,
    img,
    { x: box.x, y: box.y, w: box.w, h: Math.max(4, box.h * 0.12) },
    { x: ax, y: ay - mTop, w: aw, h: mTop },
    "up",
  );
  const mBot = Math.min(Math.max(botSpace * 0.28, 48), ah * 0.18);
  stretchEdge(
    ctx,
    img,
    { x: box.x, y: box.y + box.h * 0.82, w: box.w, h: Math.max(4, box.h * 0.18) },
    { x: ax, y: botY, w: aw, h: mBot },
    "down",
  );
  ctx.restore();

  // 3c. Painted habitat under the subject (replaces muddy mirrored reflection)
  paintHabitat(ctx, topC, midC, botC, typeHex, hash(card.id + "hab"), botY - 20, W, H);

  // Soft vignette (lighter than before — keep scene open)
  const vg = ctx.createRadialGradient(W / 2, H * 0.38, W * 0.28, W / 2, H * 0.48, H * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 4. sharp art with lighter feather so the creature isn't crushed into a soft blob
  drawFeathered(ctx, img, box, { x: ax, y: ay, w: aw, h: ah }, 22);

  // Soft contact shadow under subject so it sits in the scene
  ctx.save();
  const shY = Math.min(botY - 8, H * 0.72);
  const sh = ctx.createRadialGradient(W / 2, shY, 10, W / 2, shY, aw * 0.42);
  sh.addColorStop(0, "rgba(0,0,0,0.28)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = sh;
  ctx.fillRect(0, shY - 40, W, 120);
  ctx.restore();

  // 5. texture (edge-biased)
  drawTexture(ctx, opts.style, hash(card.id + opts.style));

  // 6. frame + text
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
