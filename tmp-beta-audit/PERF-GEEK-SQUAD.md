# PERF-GEEK-SQUAD — top lag fixes (2026-09-22 ET)

Sibling paint lag (`ee26f61`) kept. This pass implements Geek Squad kill order on top of `1ed8bcd`.

## 1. VirtualCardGrid + CardTile
- Restored **real windowing**: only visible + overscan rows mount when `items.length > 36`.
- Small lists still render fully (Search / print queries never hide cards).
- `CardTile` wrapped in `React.memo`.
- Discover / trending `Rail` capped at **18** tiles (shows `n / total` when truncated).
- Lazy images / tile-fast / sold-avg prices / full captions **unchanged**.

## 2. CSS glass / forever anims (`src/styles.css`)
- `.pv-hdr-glass` + `.pv-tabbar-inner`: solid rgba backgrounds; **`backdrop-filter: none`** (kill blur 18/20).
- Lab / panel frosted glass blurs neutralized on main surfaces.
- `.pv-energy-strip` infinite flow **off by default**; only if `.pv-anim-ok` + `prefers-reduced-motion: no-preference`.
- Arena orb: weaker blur, **no infinite pulse** by default; reduced-motion gate appended.

## 3. Code-split routes (`src/routes/index.tsx`)
- Discover + Search stay **eager**.
- Market, Sets, Vault, Wishlist, Battle, GameBoy, Friends, Adventure, Scanner, Pokedex, Sell/Buy, Paywall, CardDetail, SetCards → `React.lazy` + Suspense skeleton.
- `all-pokemon-data` stays behind Adventure (lazy) — off Discover critical path.
- **MusicPlayer**: mount only after first fab tap (`MusicPlayerGate`).
- **InteractiveHoloCard**: idle rAF auto-float **off**; no restart on pointer leave.

## Do not undo (still present)
- Full card face captions (`e3c24fd`)
- Tile-fast images (`a6a179d`)
- Box-set IDB / TCGdex-first (`8299341`)
- sold-avg pricing + tile paint cuts (`ee26f61`)

## Launch lock
- Thaw → rebuild WORKING-STATE / MANIFEST / LAUNCH-FROZEN
- `node launch-lock/verify.mjs` → ok / logical `|0⟩`
