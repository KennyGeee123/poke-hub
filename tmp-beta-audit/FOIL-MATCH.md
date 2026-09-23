# Foil / tilt overlay ↔ real card finish

Live tilt view (`InteractiveHoloCard` in CardDetail) picks an overlay from **card data**, not a generic sparkle.

Resolver: `src/lib/foil-style.ts` → `resolveFoilStyle(card)`  
Wired: `CardDetail` + `HoloInspectorModal` (`allowStyleChange={false}` so Cosmic cannot be forced onto non-cosmos cards).

## Styles

| Style | Looks like | When |
|---|---|---|
| `texture_sheen` | Soft rainbow + fine diagonal grain — **no stars, no circle-dot sheet** | **30th / Classic Celebration** (`30th`, `30th-c`, `me55`, `me55c`); modern illustration / SIR / SAR / full art; V / ex / GX texture foils |
| `prism_rainbow` | Linear rainbow stripe | Classic WOTC Rare Holo (Base, Jungle, Fossil, Gym, …); default unknown holos |
| `cosmos_holo` | Galaxy wash + star/circle field | **Only** Neo / e-Card / EX-era cosmos sets, or rarity text containing “cosmos” |
| `reverse_holo` | Vertical silver/gold sheen | Reverse Holofoil rarity or TCGPlayer reverse price key |
| `secret_gold` | Gold / prism luster | Secret / hyper / rainbow / gold star / crown / amazing |
| `shattered` | Angular cracked-ice shards | VMAX / VSTAR |
| `specular` | Clean light glare only | Non-holo commons / cards with no foil finish |

## Hard rules

1. Celebration Pikachus (and peers in `30th` / `me55` families) → `texture_sheen` or `specular` / `reverse_holo` — **never** `cosmos_holo`.
2. Cosmos starfield is opt-in by set era / explicit rarity — never the default.
3. Geek Squad: no idle `requestAnimationFrame`; tilt updates only while the pointer is on the card.
4. Tile grids stay foil-free (`styles.css` `.pv-card-img-wrap::after` disabled) — overlays are tilt-view only.

## Verify

- Open a 30th Celebration Pikachu → 3D Holo Tilt → badge **TEXTURE FOIL**, no starfield/circles.
- Open Base Set Charizard (Rare Holo) → **RAINBOW STRIPE** linear prism.
- Open a Neo Rare Holo (if available) → may show **COSMOS HOLO**.
