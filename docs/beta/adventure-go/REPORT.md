# Adventure: GO-style makeover + joystick rewrite (branch feat/adventure-go-style)

Test run: local dev server (vite, no Supabase env, demo state), headless Chromium 430×900 @2x.
Script: `shots.mjs` (`node shots.mjs <label> [video]`). Video: `walkthrough.mp4` (~35 s: map → catch → throw → close → keyboard + drag joystick walk).

## Research summary (Pokémon GO reference, text sources: Niantic Help Center "Map View", "Catching Wild Pokémon", GO wiki)
- Map: avatar pinned at centre, tilted 3D camera, pastel stylised map, white interaction ring + pink PokéStop/Gym ring, Poké Ball main-menu button bottom-centre, trainer profile bubble bottom-left, Nearby tracker bottom-right.
- Encounter: park/sky backdrop (AR optional), Pokémon centred on the ground, name + CP label above it, shrinking target ring coloured by difficulty (green/orange/red), ball bottom-centre, flick to throw, spin first for curveball, Nice/Great/Excellent by ring size.
All art here is original CSS/gradients; no Niantic assets.

## Before → after
| View | Before | After |
|---|---|---|
| Map | before-map.png | after-map.png, after-walking.png |
| Encounter | before-encounter.png | after-encounter.png |
| Throw | before-throw.png | after-throw-flight.png, after-throw.png |

## Changes
- `src/lib/adventure-motion.ts` (new, pure + 11 unit tests): radial deadzone (12%) with response curve, keyboard diagonal normalisation, accel (0.22 s to full) / decel (0.16 s) velocity integration, frame-rate-independent; exponential camera follow; tilt-camera projection + inverse (for tap-to-walk); throw rating from ring size; curveball spin detection.
- `AdventureJoystick.tsx`: rAF + delta-time loop with eased velocity (no more snap start/stop); moves batched at 30 Hz (was 15); Pointer Events with pointer capture + pointercancel (touch/mouse/pen); stick springs back smoothly; keyboard via `e.code` only, keys cleared on blur/tab-hide (no stuck walking); stable speed handler (previously re-subscribed key listeners every render); frosted GO-style stick.
- `AdventureWorldMap.tsx`: camera follow easing (world layers offset by each move's pixel delta, eased to 0 each frame → continuous glide between 30 Hz updates; teleports cut); 34° tilted camera with sky fog; pastel basemap filter; billboarded avatar + walk bob; white/pink interaction rings; map taps un-projected through the tilt so they land where they look. Existing GBA collision/step logic (`applyGbaStep`) untouched.
- `AdventureEncounterModal.tsx`: GO-like scene (sky, hills, ground disc), big CP + name label, difficulty-coloured shrinking ring, bottom-centre ball (tap / flick up / spin→curveball, Enter/Space), straight & curve flight animations, shake, Nice/Great/Excellent pop. Throw quality now comes from ring timing (was hard-coded "great") — **balance change**: big-ring throws are "nice" and catch slightly less. Old ball/berry pickers + Throw button kept.
- `src/styles.css`: `.pv-go*` skin block, reduced-motion fallbacks.

## Results
- bun test: 210 pass / 0 fail. tsc clean. vite build OK. No page errors in runs.

## Known gaps / ideas
- HUD not yet restyled (profile bubble, ball menu, nearby tracker still old dark chips).
- Map markers tilt with the ground (not billboarded); two wild markers can overlap labels.
- Curveball is cosmetic (engine has no curve bonus param); no AR camera mode.
- Satellite tiles + pastel filter is an approximation; a vector pastel style would look more like GO.
- Not tested on real touch device (Playwright mouse + keyboard only).

## Sections for fleet review
1. Map rendering & camera (tilt, pastel filter, sky, camera-follow easing) — AdventureWorldMap.tsx (viewport/tile layers), styles `.pv-go-viewport`.
2. Avatar & animation (billboarding, walk bob, facing, buddy) — AdventureWorldMap.tsx avatar block.
3. Joystick / input (motion model, pointer/touch/keyboard, speed modes) — adventure-motion.ts, AdventureJoystick.tsx.
4. Map entities (wild spawns, PokéStops, gyms, caches, marker billboarding/overlap) — AdventureWorldMap.tsx entity blocks.
5. HUD & menus (profile bubble, ball menu, nearby tracker, panels) — AdventureHUD.tsx, AdventureNearbyDrawer.tsx.
6. Encounter scene (layout, backdrop, CP label, responsiveness) — AdventureEncounterModal.tsx, `.pv-go-enc*`.
7. Catch mechanics (ring timing, throw rating, curveball, balance) — AdventureEncounterModal.tsx, adventure-engine.ts attemptCapture.
8. Performance & a11y (30 Hz state saves, rAF loops, reduced motion, keyboard focus).
