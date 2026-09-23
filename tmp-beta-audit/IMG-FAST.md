# IMG-FAST — tile card image loading (2026-09-22 ET)

## Problem
Grid/list tiles often cascaded into `_hires.png` / `high.webp` (~80–845KB) for ~140px thumbs after a primary 404. Sprite overlays always used `loading="eager"`.

## Changes
1. **`src/lib/card-images.ts`**
   - `fallbackCardImages(card, { tile?: boolean })`
   - **Tile:** small → tcgdex `low.webp`/`low.png` → pokemontcg `.png` (never `_hires`/`high` in chain) → SVG
   - **Detail:** keep high/hires preference
   - Helpers: `tcgdexHighToLow`, `stripHiresForTile`, `tileImageUrl`
   - `hdImg({ tile: true })` prefers `/low.webp` as `src`, optional srcSet with high at 600w, `sizes: "140px"`

2. **`CardTile.tsx`** — `{ tile: true }` fallbacks; `fetchPriority={eager ? "high" : "auto"}`; sprite `lazy` unless eager

3. **`views.tsx` LbImg + vault latest** / **`Marketplace.tsx` list thumbs** — tile-fast + lazy

4. **`__root.tsx`** preconnect: `images.pokemontcg.io`, `assets.tcgdex.net`, `tcgplayer-cdn.tcgplayer.com`

## Launch lock
- Id: `pokedex-hub-launch-ready-2026-09-22-img-fast`
- `node launch-lock/verify.mjs` → ok / logical `|0⟩`
- Vercel deploy: parent-owned (not done here)

## Expected Discover network shapes
- TCGdex cards: `https://assets.tcgdex.net/en/<serie>/<set>/<num>/low.webp` (~20KB)
- PokémonTCG cards: `https://images.pokemontcg.io/<set>/<num>.png` (~160KB) — **not** `*_hires.png`
- Detail/fullscreen still may request `/high.webp` or `*_hires.png`
