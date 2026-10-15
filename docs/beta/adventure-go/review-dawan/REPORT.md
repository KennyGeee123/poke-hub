# Review: map rendering, map items, encounter sizing, perf/a11y (branch review/map-encounter-perf → feat/adventure-go-style)

These are sections 1, 4, 6 and 8 of PR #10. I didn't change the avatar, joystick, HUD/menus or catch-mechanics code.
Before = feat/adventure-go-style @ caf05ab (port 5190). After = this branch (port 5297). Headless Chromium, demo state, no Supabase.
Script: `shots.mjs <label> <port> [video]`. Video: `walkthrough.mp4`.

## Measured
| | before | after |
|---|---|---|
| Adventure-state localStorage writes during ~4 s of walking | 48 (~30/s; pairs are dev StrictMode) | 3–5 (throttled) |
| Map marker reachable by Tab + Enter opens encounter | no (div markers) | yes ("Wild Bulbasaur, CP 1122") |
| Elements still animating under prefers-reduced-motion | 5 | 0 |

## Changes
1. **Map rendering/camera**: under reduced motion, the camera-follow glide is skipped (it cuts instead). The horizon fade is taller and softer.
2. **Map items (`src/lib/adventure-map-layout.ts` + 3 tests)**:
   - Spawns, PokéStops, gyms and caches stand upright on the tilted map. They pivot at their base and are lifted 2 px, so no part of them sinks behind the ground and becomes untappable.
   - Hidden-spawn tall grass stays flat on the ground, like foliage.
   - Overlap fix: markers that would land on top of each other are nudged apart (72 px minimum). The layout is deterministic, so markers don't jitter.
3. **Encounter layout**: the scene height, Pokémon size and CP number now scale with the screen (`clamp()` plus a short-screen media query). Checked at 430×900, 360×640 and 740×360. The modal is now announced as a dialog. The ring, throw and ball logic are untouched.
4. **Performance/accessibility**:
   - The map still moves at the joystick's ~30 Hz, but the engine update (a full state clone plus spawn checks) is coalesced to 8 Hz.
   - The engine call to `updatePlayerLocation` now takes `{ persist: false }`, which skips the save. The Adventure screen saves at most every 2 s while walking, and once 0.8 s after you stop. Every other caller keeps the default save. 1 test.
   - Map markers can be reached and opened by keyboard (role=button, tabIndex, Enter/Space, aria-label). They get a visible yellow focus ring, and so do map and encounter buttons.
   - Under reduced motion, the decorative pulse/bounce/ping/spin animations on the map and encounter are turned off.

## For other reviewers
- **Avatar (Drive Mane):** to make markers stand upright, the map's item layer needs `transform-style: preserve-3d`. That also switches on the avatar's existing upright rotation, which wasn't actually taking effect before. Please check how the avatar looks with it on.
- **HUD (Comic Gen):** at 740×360 the bottom tab bar covers the bottom of the encounter, and you have to scroll.

## Tests
- bun test: 214 pass, 0 fail.
- tsc is clean and vite build passes.
- No page errors.
