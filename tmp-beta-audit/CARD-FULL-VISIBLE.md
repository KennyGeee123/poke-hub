# CARD-FULL-VISIBLE — tile art unobstructed (2026-09-22 ET)

## Request
Kenneth (PokéVault): remove all things covering the cards so the full card is visible, and make prices look nice.

## Overlays removed / relocated
1. **`pv-card-ovl` bottom gradient scrim** — name, set, price, and grade select used to sit *on* the card face with a dark gradient. Removed from the image stack (`display: none`); content moved to **`pv-card-caption` below the art**.
2. **Scan / Trade buttons** — were absolute on the image (top-right). Now in the caption; collapsed until hover/focus.
3. **Grade + level badges** — were absolute on the image (top-left). Now caption chips; collapsed until hover/focus.
4. **GOLD badge** — was absolute bottom-left on art. Now a small **`pv-gold-chip`** in the price row (not on art).
5. **`object-fit: cover` → `contain`** on `.pv-card-img` so edges aren’t cropped by the aspect box.

## Kept (non-covering / useful)
- Tiny corner chips still on art when relevant: lang, SL, ERR, qty ×N, remove × (corners only).
- Hover foil shimmer (`::after`) and sprite pop — ephemeral, not resting chrome.
- Marketplace grid already had name/price under the image; LbImg list rows already side-by-side.

## Price polish
- Hierarchy under each tile: **name → set · #number → price chip → sold avg|market label**.
- `formatPrice` unchanged (`$1,234.56`).
- Pending stays a tidy `Pending` chip via `.pv-price-pending`.
- Live quote → label **sold avg**; catalog-only → **market**.

## Files
- `src/components/pokevault/CardTile.tsx`
- `src/styles.css`
- `launch-lock/*`, `LAUNCH-FROZEN`
- `tmp-beta-audit/CARD-FULL-VISIBLE.md`

## Verify
- `bun run build` OK
- `node launch-lock/verify.mjs` → ok / logical `|0⟩`
- Tile-fast path (`fallbackCardImages` / `hdImg` with `{ tile: true }`) unchanged

## Deploy
Push `origin/main`. Vercel auto-deploy if wired; otherwise Mac `vercel --prod --yes`.
