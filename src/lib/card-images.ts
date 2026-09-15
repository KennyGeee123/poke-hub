// Card image helpers — promote every TCG card to HD art with TCGdex & SVG fallbacks.
import type { TCGCard } from "@/lib/pokemon-api";

export function generateCardSvgFallback(name: string, number?: string, setName?: string): string {
  const safeName = (name || "Pokémon Card").replace(/[<>&"]/g, "");
  const safeNum = (number || "001").replace(/[<>&"]/g, "");
  const safeSet = (setName || "Vault").replace(/[<>&"]/g, "");
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="100%" height="100%">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>
    </defs>
    <rect width="300" height="420" rx="16" fill="url(#g)" stroke="url(#b)" stroke-width="4"/>
    <circle cx="150" cy="180" r="60" fill="none" stroke="rgba(56,189,248,0.2)" stroke-width="8"/>
    <circle cx="150" cy="180" r="30" fill="rgba(56,189,248,0.1)"/>
    <path d="M 90 180 L 210 180" stroke="rgba(56,189,248,0.4)" stroke-width="4"/>
    <text x="150" y="270" fill="#f8fafc" font-size="16" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">${safeName}</text>
    <text x="150" y="295" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="middle">${safeSet} · #${safeNum}</text>
    <text x="150" y="380" fill="#38bdf8" font-size="10" font-family="monospace" text-anchor="middle">POKEVAULT HD SYNC</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function hdImg(card: Pick<TCGCard, "images">, opts?: { tile?: boolean }): { src: string; srcSet?: string; sizes?: string } {
  const small = card.images?.small ?? "";
  const large = card.images?.large ?? small;
  if (opts?.tile) {
    return {
      src: small || large,
      srcSet: small && large ? `${small} 245w, ${large} 600w` : undefined,
      sizes: "140px",
    };
  }
  return {
    src: large || small,
    srcSet: small && large ? `${small} 245w, ${large} 600w` : undefined,
  };
}

export function hdLarge(card: Pick<TCGCard, "images">): string {
  return card.images?.large || card.images?.small || "";
}

type ImgCard = Pick<TCGCard, "id" | "name" | "number" | "set" | "images">;

/** Ordered list of image URLs to try when the primary scan 404s. */
export function fallbackCardImages(card: ImgCard): string[] {
  const urls: string[] = [];
  const add = (u?: string | null) => {
    if (!u) return;
    const v = u.trim();
    if (!v || urls.includes(v)) return;
    urls.push(v);
  };

  add(card.images?.large);
  add(card.images?.small);

  const large = card.images?.large || "";
  if (/assets\.tcgdex\.net/i.test(large)) {
    const base = large.replace(/\/(high|low)\.(webp|png|jpg)$/i, "");
    add(`${base}/high.webp`);
    add(`${base}/low.webp`);
    add(`${base}/high.png`);
    add(`${base}/low.png`);
  }

  const setId = card.set?.id || (card.id || "").split("-")[0];
  const num = card.number || (card.id || "").split("-").slice(1).join("-");
  if (setId && num) {
    add(`https://images.pokemontcg.io/${setId}/${num}_hires.png`);
    add(`https://images.pokemontcg.io/${setId}/${num}.png`);
  }

  const id = card.id || (setId && num ? `${setId}-${num}` : "");
  if (id && /^[a-z0-9.]+-[a-z0-9]+$/i.test(id) && setId && num) {
    const serie = setId.replace(/[0-9].*$/, "").replace(/\.$/, "") || setId;
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/high.webp`);
    add(`https://assets.tcgdex.net/en/${serie}/${setId}/${num}/low.webp`);
  }

  // Universal SVG Guaranteed Rendering Fallback
  add(generateCardSvgFallback(card.name || "Pokémon Card", card.number, card.set?.name));

  return urls;
}

const HD_CACHE_KEY = "pv-hd-img:";

export async function resolveHDImage(card: Pick<TCGCard, "id" | "name" | "number" | "set" | "images">): Promise<string> {
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem(HD_CACHE_KEY + card.id);
    if (cached) return cached;
  }
  const fallback = hdLarge(card);
  try {
    const setId = card.id?.split("-")[0];
    const num = card.number ?? card.id?.split("-")[1];
    if (setId && num) {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${setId}-${num}`);
      if (r.ok) {
        const j = (await r.json()) as { image?: string };
        if (j.image) {
          const url = `${j.image}/high.webp`;
          try { localStorage.setItem(HD_CACHE_KEY + card.id, url); } catch {}
          return url;
        }
      }
    }
  } catch {}
  return fallback;
}

export function refreshAllImageCaches() {
  if (typeof localStorage === "undefined") return 0;
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(HD_CACHE_KEY) || k.startsWith("pv-tcg-cache:")) {
      localStorage.removeItem(k);
      n++;
    }
  }
  return n;
}
