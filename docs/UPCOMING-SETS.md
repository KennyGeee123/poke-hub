# Upcoming (pre-release) sets

`src/lib/upcoming-sets.json` lists announced English sets that neither TCGdex nor
pokemontcg.io carries yet. Today: **Mega Evolution—Delta Reign** (`me06`, out Nov 6, 2026).

## What ships
- Only officially revealed cards: number, name, rarity, illustrator (Bulbapedia + pokemon.com).
- Art: resized scans in `public/card-art/<id>/` (`NNN.webp` tile, `NNN_hires.webp` detail).
  Cards with no scan yet use the normal "Art pending" tile.
- **No prices.** Tiles show the usual `—`; the Sets "PSA 10 est." chip stays hidden.
- Sets list badge `Upcoming · Nov 6` (after release, until live data lands: `Released Nov 6 · list pending`).

## Auto-upgrade (no code change needed)
1. **Sets list** — `withUpcomingSets()` (called by `injectSpecialSets`) only adds the stub
   while no live set matches its ids (`liveIds` + aliases, e.g. `me06`/`me6`) or its name.
   Stubs carry `pvUpcoming: true` and are stripped before merging/caching, so a stale
   IndexedDB list can't shadow the live set.
2. **Set cards** — once a live set is seen in the list, `getAllCardsBySet` uses the normal
   TCGdex/pokemontcg path. While unlisted, the revealed list paints first and TCGdex English
   (`/v2/en/sets/<liveId>`) is probed (misses cached 10 min); live cards win, revealed cards
   only fill numbers TCGdex lacks.
3. **Card detail** — live lookups run first; the revealed card is the last fallback.
4. **Prices** — `/api/public/prices` quotes by card id (`me06-084`), so real prices appear as
   soon as the catalog has them.

## Cleanup after release
Delete the set's entry in `upcoming-sets.json` and `public/card-art/<id>/`, and update
`upcoming-sets.test.ts`.

## Adding another upcoming set
Append an entry (id = expected TCGdex id, `liveIds` = TCGdex + pokemontcg ids), drop art in
`public/card-art/<id>/`, never add prices.
