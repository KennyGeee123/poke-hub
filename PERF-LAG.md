# Perf lag note (2026-09-22 / tile paint)

Kenneth: app felt slow. Geek Squad owns Mac; this note is **app-side**.

## Box / Sets grids (owned by Mac parent patch — do not fight)

Suspects under `pokemon-api` / `views` (parent patching on Mac):
- `VirtualCardGrid` currently mounts **every** card (windowing removed in f8c8aac)
- `SetCardsView` does not batch `hydrateLivePrices` on set open
- Serial `getAllCardsBySet` pages + always-on TCGdex merge

**HOLD** those files here until parent lands.

## Culprits fixed in this commit (CSS / images only)

1. **TCGPlayer `_in_1000x1000` on tiles** — Discover was fetching ~80KB 1000px JPEGs.
   - `tileImageUrl` → rewrite to `_in_400x400` via `tcgplayerDownsizeForTile`.
2. **Continuous `body::before` drift animation** — full-viewport compositor tax; animation removed.
3. **Holo foil `mix-blend-mode: overlay` + animated gradient on every tile hover** — removed (`::after` disabled).
4. **Heavy multi-layer gold glow shadows on every `.pv-card-img-wrap`** — simplified to single soft shadow.
5. **Sprite overlay always mounted** (lazy still fetched in-viewport) + infinite float/`will-change` —
   - `CardTile` mounts `CardSpriteOverlay` **only on hover**
   - CSS float animation only while hovered

Kept: full-card captions under art (e3c24fd), tile-fast small/low.webp (a6a179d).

## SW / cache

If Kenneth still sees 1000×1000 after deploy: hard-refresh / unregister SW — stale precache may serve old bundle.

## Verify

`node launch-lock/verify.mjs` → ok (logical 0) after thaw/rebuild for this paint pass.
