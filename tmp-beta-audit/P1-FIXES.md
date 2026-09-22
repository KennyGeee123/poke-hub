# P1 beta fixes — 2026-09-22

Commit target: `origin/main` (parent deploys Vercel). HEAD before: `991e161`.

## 1) Classic Collection / Market tiles showed `—` despite live prices

### Root cause
- Classic tiles / Market often request **pokemontcg** ids (`me55c-4` = Charizard).
- TCGdex only has **`30th-c-00N`** sequential ids (`30th-c-001` = Charizard, `30th-c-004` = Genesect).
- `/api/public/prices` `quoteTcgcsv` for classic previously **name-only**, and `quoteOne` only learned the name from a successful TCGdex fetch on the *requested* id.
- `me55c-4` → TCGdex 404 → no name → pending → UI dash.
- Note: number-crossing `me55c-4` → `30th-c-004` is **wrong** (Genesect). Do not alias Classic by number across set codes.

### Fix
**`src/routes/api/public/prices.ts`**
- `me55c`: match tcgcsv by **original print number** first (4 → Charizard $179), then name.
- `30th-c`: still **name-only** (sequential localIds ≠ TCGPlayer numbers).
- Try TCGdex on safe candidates (Celebration `me55`↔`30th` aliases; Classic same-set pad only).
- If name still missing: fetch pokemontcg meta for name + embedded prices, then tcgcsv.
- Response stamps **safe** id aliases so pad variants share the quote.

**`src/lib/live-prices.ts`**
- Query: `ids.map(encodeURIComponent).join(",")` (encode each id, keep literal commas).
- Cache/emit quotes under `priceIdAliases(id)` so pad/set variants hydrate tiles.
- Resolve batch responses via aliases if exact key missing.

### Verify
```bash
curl -sS 'https://<deploy>/api/public/prices?ids=me55c-4,30th-c-001'
# expect both ~179 tcgcsv-market (me55c-4 by number; 30th-c-001 by TCGdex name→csv)
```
UI: Classic Charizard tile + Market list → ~$179 after hard refresh (not Pending/—).

---

## 2) Adventure Carto “API KEY REQUIRED” watermark

### Cause
- App tile layer already defaults to **Esri** unless `VITE_CARTO_API_KEY` / `VITE_MAP_TILE_KEY` is set.
- Legacy persisted `world.mapStyle === "carto_dark"` in `localStorage` (`pv_adventure_world_state_v1`) from older builds.

### Fix
**`src/lib/adventure-engine.ts`**
- On hydrate: migrate `carto_dark` → `osm_streets` and rewrite storage so Living World no longer prefers Carto without a key.

`public/adventure.html` is the pixel overworld (no Carto tiles). Living World map = `AdventureWorldMap.tsx` (Esri default unchanged).

### Verify
Hard refresh Adventure → Living World map. Basemap attribution Esri; no repeated carto.com / API KEY watermark. If still stale: unregister service worker + clear site data once.

---

## 3) Quick Battle empty arena (SETUP / empty hand)

### Cause
- Guest vault empty + `fetchRandomDeck` failure/empty fell back to `fromVault` (`[]`), or deck lacked enough playable Pokémon (`supertype`+`hp`+`attacks`) so SETUP had nothing usable.

### Fix
**`src/components/pokevault/Battle.tsx`**
- `guestStarterDeck()`: always-playable offline basics + energy.
- `ensureDeckWithBasics()` seeds guest deck when vault/API short.
- Deal loop reshuffles until hand has a playable Pokémon.

### Verify
Guest, empty vault → Battle → Quick Battle → SETUP with cards in hand; tap a Pokémon to set Active.

---

## 4) P2 — hide pokemontcg API key for guests

**`src/routes/index.tsx`**: Advanced API-key block only when signed in; guests see “Sign in to manage Advanced API settings.” (already collapsed under Settings, not a permanent header field).

---

## Launch lock
- Thawed hashed files, rebuilt `launch-lock/WORKING-STATE.json`.
- Id: `pokedex-hub-launch-ready-2026-09-22-p1-beta-fixes`
- `node launch-lock/verify.mjs` → logical `|0⟩` / ok.

## Remaining risks
- pokemontcg.io intermittent 500s: `me55c-*` still prices via tcgcsv **number**; `30th-c-*` needs TCGdex name (usually available).
- Some `me55c-N` with no TCGPlayer number in group 24837 stay pending (e.g. odd promos).
- Adventure watermark can linger until SW/localStorage cleared on very sticky clients.
- Guest starter deck is illustrative Base-era stubs, not a legal constructed deck.
- Vercel deploy is parent-owned (not done here).
