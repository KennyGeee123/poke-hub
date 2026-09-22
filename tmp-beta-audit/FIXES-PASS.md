# FIXES-PASS — 2026-09-22 (30th prices + Settings/Export)

## Summary
1. **30th Celebration / Classic pricing** — TCGdex returns `pricing: { cardmarket: null, tcgplayer: null }` for `30th` / `30th-c`. pokemontcg.io card endpoints often 500/502 for `me55` / `me55c`. Implemented server-side fallback in `src/routes/api/public/prices.ts`:
   - Still prefer Cardmarket avg7/avg30 → TCGPlayer on TCGdex when present
   - Then **tcgcsv.com** TCGPlayer group mirror (`24722` = ME: 30th Celebration, `24837` = Classic Collection) with required `User-Agent`
   - Main set matched by card number; Classic matched by **name only** (localIds ≠ original numbers)
   - Also tries pokemontcg.io with ID aliases (`30th` ↔ `me55`, `30th-c` ↔ `me55c`, padded/unpadded locals)
   - If still no quote for these sets: returns `{ pending: true, source: "pending-new-set" }`
2. **Pending UI** — Card tiles show a **Pending** chip (title: “Prices pending — new set”) instead of a silent em dash; set detail shows a gold banner for 30th / Classic.
3. **Settings API-key clutter** — Key field collapsed under **Advanced · pokemontcg.io API key** (`<details>`), password input, dark shell styling. HD Art remains a primary action.
4. **Export JSON contrast** — `.pv-app-shell .pv-tool-btn` now uses dark surface + cream text (primary/gold variants unchanged). Cream-on-white under the color lock was unreadable.

## Files changed
- `src/routes/api/public/prices.ts`
- `src/lib/live-prices.ts`
- `src/components/pokevault/CardTile.tsx`
- `src/components/pokevault/views.tsx`
- `src/routes/index.tsx`
- `src/styles.css`
- `launch-lock/WORKING-STATE.json` + `MANIFEST.sha256` + `LAUNCH-FROZEN` (thaw → rebuild → `node launch-lock/verify.mjs` = ok)
- `tmp-beta-audit/FIXES-PASS.md` (this file)

## How to verify
1. `node launch-lock/verify.mjs` → `ok: true`
2. After deploy: `GET /api/public/prices?ids=30th-001,30th-015,30th-c-001,30th-c-004`
   - Expect `tcgcsv-market` quotes (e.g. Exeggcute ~$0.21, Classic Charizard ~$179, Genesect EX ~$6)
3. UI: Sets → **30th Celebration** — tiles show dollar amounts (or Pending only if tcgcsv fails); banner may still show for honesty on cold cache.
4. Gear → Settings: no cream API-key strip; Advanced expands the key row.
5. Vault → **Export JSON** readable on dark shell (not white-on-cream).

## Remaining blockers
- **Deploy**: parent should run `vercel --prod --yes` on Mac (not done here).
- pokemontcg.io still flaky/500 for me55 cards — aliases ready when upstream recovers.
- tcgcsv requires identifying User-Agent; rate-limit / ToS if abused (we cache groups 30 min in-process).
- Box path used: `/workspace/pokevault-polish/poke-hub` (Mac path `/Users/kennysmac/...` not mounted on this agent).
