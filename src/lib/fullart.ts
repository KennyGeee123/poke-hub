// Full Art Studio engine: turns a card scan into a fan-made full-bleed / extended-art design.
// Pure client-side canvas compositor (no paid AI key needed):
//   1. colour-sampled gradient base  2. stretched + blurred art bleed
//   3. edge-row smear + short mirrored band with feathered seams  4. sharp art on top
//   5. holo / rainbow / gold texture  6. optional frame + card text overlay.
// Optional AI path: opts.aiArt (Nano Banana, via /api/public/fullart-ai) replaces 1-4.
import type { TCGCard } from "./pokemon-api";

export type FullArtStyle = "holo" | "rainbow" | "gold" | "alt";
export type FullArtOptions = {
  style: FullArtStyle;
  frame: boolean;
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

/** Mirror a band of `img` into dest, fading to transparent away from the seam. */
function fadeStrip(
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
  t.save();
  t.translate(0, tmp.height);
  t.scale(1, -1);
  t.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, tmp.width, tmp.height);
  t.restore();
  t.globalCompositeOperation = "destination-in";
  const g = t.createLinearGradient(0, 0, 0, tmp.height);
  const near = dir === "down" ? 0 : 1;
  g.addColorStop(near, "rgba(0,0,0,0.95)");
  g.addColorStop(0.5, "rgba(0,0,0,0.45)");
  g.addColorStop(1 - near, "rgba(0,0,0,0)");
  t.fillStyle = g;
  t.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, dst.x, dst.y);
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
  // Sparkle / cosmos dots (all styles, strongest on holo + gold)
  const count = style === "holo" ? 900 : style === "gold" ? 520 : 260;
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < count; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = rnd() < 0.08 ? 3 + rnd() * 4 : 0.6 + rnd() * 1.8;
    const hue = style === "gold" ? 45 : Math.floor(rnd() * 360);
    ctx.globalAlpha = k * (0.25 + rnd() * 0.55);
    ctx.fillStyle = `hsl(${hue} 100% ${style === "gold" ? 80 : 75}%)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (style === "holo") {
    ctx.globalCompositeOperation = "color-dodge";
    ctx.globalAlpha = k * 0.22;
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

function frameStroke(ctx: CanvasRenderingContext2D, style: FullArtStyle): string | CanvasGradient {
  const W = FULLART_W;
  const H = FULLART_H;
  if (style === "rainbow") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    ["#ff4d6d", "#ffb703", "#52e5a3", "#4cc9f0", "#7b61ff"].forEach((c, i, a) =>
      g.addColorStop(i / (a.length - 1), c),
    );
    return g;
  }
  if (style === "gold" || style === "holo") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fff1b8");
    g.addColorStop(0.5, "#e2b53a");
    g.addColorStop(1, "#9a6a12");
    return g;
  }
  return "#0b0c10";
}

function drawFrame(ctx: CanvasRenderingContext2D, card: TCGCard, style: FullArtStyle) {
  const W = FULLART_W;
  const H = FULLART_H;
  const inset = style === "alt" ? 26 : 20;
  ctx.save();
  // Outer border
  ctx.lineWidth = style === "alt" ? 30 : 22;
  ctx.strokeStyle = frameStroke(ctx, style);
  roundRect(ctx, inset / 2, inset / 2, W - inset, H - inset, 38);
  ctx.stroke();
  if (style === "alt") {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#38bdf8";
    roundRect(ctx, inset + 8, inset + 8, W - (inset + 8) * 2, H - (inset + 8) * 2, 28);
    ctx.stroke();
  }

  // Name + HP band (glass)
  const top = 48;
  const band = ctx.createLinearGradient(0, top, 0, top + 110);
  band.addColorStop(0, "rgba(8,10,16,0.72)");
  band.addColorStop(1, "rgba(8,10,16,0)");
  ctx.fillStyle = band;
  ctx.fillRect(inset, top - 10, W - inset * 2, 130);
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  const stage = card.subtypes?.find((s) => /basic|stage/i.test(s)) || card.supertype || "";
  ctx.font = "700 26px Barlow, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  if (stage) ctx.fillText(stage.toUpperCase(), 64, top + 24);
  ctx.fillStyle = "#fff";
  let nameSize = 66;
  ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  const maxName = W - 64 - 300;
  while (ctx.measureText(card.name).width > maxName && nameSize > 36) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px "Bebas Neue", Barlow, Impact, sans-serif`;
  }
  ctx.fillText(card.name, 64, top + 84);
  if (card.hp) {
    ctx.textAlign = "right";
    const hpX = W - 64 - (card.types?.length ? 62 : 0);
    ctx.font = '800 64px "Bebas Neue", Barlow, Impact, sans-serif';
    const numW = ctx.measureText(card.hp).width;
    ctx.fillText(card.hp, hpX, top + 84);
    ctx.font = "800 28px Barlow, system-ui, sans-serif";
    ctx.fillText("HP", hpX - numW - 8, top + 84);
    ctx.textAlign = "left";
  }
  ctx.shadowBlur = 0;
  const t0 = card.types?.[0];
  if (t0) {
    ctx.beginPath();
    ctx.arc(W - 88, top + 62, 26, 0, Math.PI * 2);
    ctx.fillStyle = TYPE_COLORS[t0] || "#ccc";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "800 26px Barlow, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t0[0], W - 88, top + 71);
    ctx.textAlign = "left";
  }

  // Attacks panel (glass) at the bottom
  const attacks = (card.attacks || []).slice(0, 2);
  const abilities = (card.abilities || []).slice(0, attacks.length ? 0 : 1);
  const rows = attacks.length + abilities.length;
  const panelH = rows ? 70 + rows * 96 : 0;
  const panelY = H - 118 - panelH;
  if (rows) {
    ctx.fillStyle = "rgba(8,10,16,0.55)";
    roundRect(ctx, 44, panelY, W - 88, panelH, 26);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();
    let y = panelY + 64;
    for (const ab of abilities) {
      ctx.fillStyle = "#f87171";
      ctx.font = "800 24px Barlow, system-ui, sans-serif";
      ctx.fillText("ABILITY", 76, y);
      ctx.fillStyle = "#fff";
      ctx.font = "800 38px Barlow, system-ui, sans-serif";
      ctx.fillText(ab.name, 76 + 120, y + 2);
      y += 96;
    }
    for (const a of attacks) {
      let x = 76;
      for (const c of (a.cost || []).slice(0, 5)) {
        ctx.beginPath();
        ctx.arc(x + 17, y - 12, 17, 0, Math.PI * 2);
        ctx.fillStyle = TYPE_COLORS[c] || "#ddd";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
        x += 40;
      }
      ctx.fillStyle = "#fff";
      ctx.font = "800 40px Barlow, system-ui, sans-serif";
      const nameX = x + 12;
      const dmgW = a.damage ? 120 : 0;
      let label = a.name;
      while (ctx.measureText(label).width > W - 76 - nameX - dmgW && label.length > 4)
        label = label.slice(0, -2) + "…";
      ctx.fillText(label, nameX, y);
      if (a.damage) {
        ctx.textAlign = "right";
        ctx.font = '800 58px "Bebas Neue", Barlow, Impact, sans-serif';
        ctx.fillText(a.damage, W - 76, y + 4);
        ctx.textAlign = "left";
      }
      y += 96;
    }
  }

  // Footer: set · number · illustrator + fan-made label
  ctx.fillStyle = "rgba(8,10,16,0.6)";
  roundRect(ctx, 44, H - 100, W - 88, 56, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 22px Barlow, system-ui, sans-serif";
  const left = [card.set?.name, card.number ? `#${card.number}` : ""].filter(Boolean).join(" · ");
  ctx.fillText(left, 70, H - 64);
  ctx.textAlign = "right";
  ctx.fillStyle = "#f6d57a";
  ctx.fillText("FAN-MADE CUSTOM · NOT OFFICIAL", W - 70, H - 64);
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

  // Sample edge colours from the illustration.
  const probe = document.createElement("canvas");
  probe.width = 200;
  probe.height = Math.round((200 * box.h) / box.w);
  const pc = probe.getContext("2d", { willReadFrequently: true })!;
  pc.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, probe.width, probe.height);
  const topC = avgColor(pc, 0, 0, probe.width, 8);
  const midC = avgColor(pc, 0, probe.height * 0.4, probe.width, probe.height * 0.2);
  const botC = avgColor(pc, 0, probe.height - 8, probe.width, 8);

  // 1. colour-sampled gradient base
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, rgb(topC));
  base.addColorStop(0.45, rgb(midC));
  base.addColorStop(1, rgb(botC.map((v) => v * 0.55) as [number, number, number]));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // 2. stretched + blurred art bleed covering the whole card
  ctx.save();
  ctx.filter = "blur(38px) saturate(1.25)";
  ctx.globalAlpha = 0.85;
  const coverScale = Math.max(W / box.w, H / box.h) * 1.08;
  const cw = box.w * coverScale;
  const ch = box.h * coverScale;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, (W - cw) / 2, (H - ch) / 2, cw, ch);
  ctx.restore();

  // Place the sharp art full-width, slightly zoomed, in the upper-middle of the card.
  const scale = (W / box.w) * 1.04;
  const aw = box.w * scale;
  const ah = box.h * scale;
  const ax = (W - aw) / 2;
  const ay = 150;

  // 3. edge extension: (a) smear the outermost pixel rows outward like a
  // cheap outpaint, then (b) lay a short, blurred mirror of the edge band over
  // the seam so the scenery reads as continuing. Kept short on purpose so it
  // never looks like a reflection.
  const topSpace = ay;
  const botY = ay + ah;
  const botSpace = H - botY;
  ctx.save();
  ctx.filter = "blur(22px) saturate(1.15)";
  ctx.globalAlpha = 0.9;
  ctx.drawImage(img, box.x, box.y, box.w, Math.max(4, box.h * 0.02), ax, 0, aw, topSpace + 40);
  ctx.drawImage(
    img,
    box.x,
    box.y + box.h * 0.97,
    box.w,
    Math.max(4, box.h * 0.03),
    ax,
    botY - 40,
    aw,
    botSpace + 40,
  );
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(9px)";
  ctx.globalAlpha = 0.7;
  const mTop = Math.min(topSpace + 30, ah * 0.3);
  fadeStrip(
    ctx,
    img,
    { x: box.x, y: box.y, w: box.w, h: box.h * 0.18 },
    { x: ax, y: ay - mTop, w: aw, h: mTop },
    "up",
  );
  const mBot = Math.min(botSpace, ah * 0.42);
  fadeStrip(
    ctx,
    img,
    { x: box.x, y: box.y + box.h * 0.78, w: box.w, h: box.h * 0.22 },
    { x: ax, y: botY, w: aw, h: mBot },
    "down",
  );
  ctx.restore();

  // Ground shade so card text stays legible over the extension.
  const gs = ctx.createLinearGradient(0, botY, 0, H);
  gs.addColorStop(0, "rgba(0,0,0,0)");
  gs.addColorStop(0.35, `rgba(${botC.map((v) => Math.round(v * 0.35)).join(",")},0.35)`);
  gs.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = gs;
  ctx.fillRect(0, botY, W, botSpace);

  // Soft vignette to settle the extension
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.3, W / 2, H * 0.5, H * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 4. sharp art with feathered seams
  drawFeathered(ctx, img, box, { x: ax, y: ay, w: aw, h: ah }, 70);

  // 5. texture
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
  g.addColorStop(0, "rgba(0,0,0,0.28)");
  g.addColorStop(0.14, "rgba(0,0,0,0)");
  g.addColorStop(0.62, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawOverlay(ctx: CanvasRenderingContext2D, card: TCGCard, opts: FullArtOptions) {
  const W = FULLART_W;
  const H = FULLART_H;
  if (opts.frame) drawFrame(ctx, card, opts.style);
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
