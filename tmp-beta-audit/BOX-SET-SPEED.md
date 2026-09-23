# Box-set load speed

## Culprits
1. Sets tab cleared UI and waited for full pokemontcg page loop + TCGdex merge before paint.
2. Opening a set often paged pokemontcg serially, then called TCGdex — double wait on cold cache.

## Fixes
- `getSets`: return usable IDB (stale OK) immediately; refresh network in background; parallel page1 + TCGdex when cold.
- `getAllCardsBySet`: paint stale IDB ASAP; prefer one-shot `tcgdexGetSetCards`; only page pokemontcg when TCGdex empty; soft enrich page1 in background.
- SetsView / SetCardsView: avoid blanking the grid on refresh when data already shown.

## Verify
Open Sets → Box sets (should appear from cache fast) → open Mega Evolution / any SV set → cards paint quickly (TCGdex or IDB) before prices fill in.

## Executor audit (held code; Mac already shipped 8299341 + ee26f61)

### Root causes (pre-fix)
1. **Sets catalog** — UI blanked; waited on serial pokemontcg pages then TCGdex merge.
2. **Set cards** — cache miss paged pokemontcg serially, then always merged TCGdex (double wait).
3. **No stale paint** — expired IDB ignored until network finished.
4. **Tile paint tax** (ee26f61) — TCGPlayer `_in_1000x1000`, body drift, foil mix-blend, always-mounted sprites.

### Files / SHAs
- `8299341` — `src/lib/pokemon-api.ts`, `src/components/pokevault/views.tsx`, launch-lock, this note
- `ee26f61` — `src/lib/card-images.ts`, `CardTile.tsx`, `src/styles.css`, `PERF-LAG.md`, launch-lock
- HEAD: `ee26f61` on `origin/main`
- Launch-lock verify: **ok** / logical `|0⟩` (`pokedex-hub-launch-ready-2026-09-22-sets-idb-tile-paint`)

### Images (already good on set grids)
- `CardTile` uses `fallbackCardImages(..., { tile: true })` + `hdImg(..., { tile: true })`
- Tile chain: small/low.webp → pokemontcg `.png` (not `_hires`) → SVG
- ee26f61 also downsizes TCGPlayer to `_in_400x400`

### Remaining lag (not patched — report only)
1. **`VirtualCardGrid` mounts every card** (windowing removed); only `content-visibility: auto` on `.pv-virt-cell`.
2. **Each `CardTile` calls both `useLivePrice` + `usePricePending`** → dual `requestLivePrice` waiters; client flushes **24 ids sequential batches**; server `quoteOne` can waterfall TCGdex aliases → pokemontcg → tcgcsv (heavy for 30th/Classic).
3. **`SetCardsView` never calls `hydrateLivePrices`** — tiles self-queue on mount (OK for progressive prices, but all tiles mount at once → full set enqueued).

### Deploy
- Prefer Mac: `vercel --prod --yes` after push.
- Box `vercel ls` hung / no confirmed prod deploy of `ee26f61` from this agent.
- Live: https://pokedex-hub-lime.vercel.app/

### Verify
1. Sets → Box sets (list from IDB fast)
2. Open Mega Evolution / 30th / Ascended Heroes / SV set → cards paint from TCGdex or IDB before prices fill
3. Network: prefer `/api/public/tcgdex?.../sets/<id>` one-shot; tiles request `low.webp` / non-hires / `_in_400x400`
4. `node launch-lock/verify.mjs` → ok
