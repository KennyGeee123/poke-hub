# PokéVault — Full App Upgrade Plan

You picked all four focus areas. Rather than touch everything shallowly, I'll do **4 focused passes**, each shippable on its own. I'll run them in order and you can stop me after any pass.

---

## Pass 1 — Bug sweep & error fixes
- Audit every tab (Vault, Scanner, Adventure, Game Boy, Marketplace, Friends, Pokédex) by driving the live preview with Playwright; capture console + network errors per tab.
- Fix the unknown `RESET_BLANK_CHECK` warning (preview iframe message handler).
- Patch known fragility:
  - `getMarketPrice` fallback when TCGplayer has no USD (silent NaN risk).
  - eBay sold-listings route timeout/error swallowing.
  - Higgsfield 25s polling — surface "still rendering" state instead of hanging.
  - Scanner OCR null-handling when Vision key missing.
  - Battle/Game Boy: clamp HP, guard divide-by-zero in pulse threshold.

## Pass 2 — Performance & polish
- Add `loading="lazy"` + `decoding="async"` to every card image; intersection-observer prefetch for next page in Vault grid.
- Memoize heavy lists (Vault, Marketplace) with `React.memo` + stable keys.
- Cache TCG API set lists (`getSets`) for 24h (currently 6h, sets rarely change).
- Preload LCP image per route via `head().links`.
- Mobile breakpoints audit — bottom nav touch targets, Game Boy frame scaling under 380px.
- Replace synchronous `localStorage` reads on hot paths with a tiny in-memory mirror.

## Pass 3 — Design system overhaul
One cohesive identity instead of per-tab styles. Proposed direction (locked unless you say otherwise):
- **Palette**: deep midnight navy `#0B1020` base, electric Poké-yellow `#FFCB05` primary, holo-foil gradient accents (cyan→magenta).
- **Type**: "Press Start 2P" for display moments (GameBoy, badges), `Space Grotesk` for UI, `Inter` body.
- **Tokens**: rebuild `src/styles.css` `@theme` with semantic colors, gradients (`--gradient-holo`, `--gradient-card`), elevation shadows (`--shadow-card-hover`).
- Unify CardTile, Buttons, Tabs, Dialogs to use new tokens. No hardcoded hex left in components.
- Subtle holographic shimmer on rare/secret cards using CSS conic-gradient + mask.

## Pass 4 — New AI-powered features
Three additions, all using Lovable AI Gateway (no new secrets needed):
1. **Collection Insights** (Vault tab): one-click "Analyze my collection" → Gemini summarizes value distribution, top sets, suggested next pickups, missing chase cards.
2. **AI Deck Builder** (new sub-tab in Pokédex): user picks a strategy ("fast aggro fire", "stall mill"), AI proposes 60-card decklist from cards they own + recommended additions with prices.
3. **Card Chat** (CardDetail): streaming chat about the open card — lore, competitive use, price trends, comparable alts. Uses the existing AI Elements composer pattern, one conversation per card (localStorage), `google/gemini-3-flash-preview`.

---

## Order & checkpoints
1. Pass 1 → I report bugs found + fixed.
2. Pass 2 → I report perf deltas qualitatively (no synthetic benchmarks).
3. Pass 3 → I show the redesigned shell first (one screen) before applying everywhere.
4. Pass 4 → Each AI feature shipped behind its own tab/button so nothing breaks existing flows.

Reply **"go"** to start Pass 1, or tell me to reorder/skip passes, or pick just one pass to run now.
