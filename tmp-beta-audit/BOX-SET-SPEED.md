# Box-set load speed

## Culprits
1. Sets tab cleared UI and waited for full pokemontcg page loop + TCGdex merge before paint.
2. Opening a set often paged pokemontcg serially, then called TCGdex — double wait on cold cache.

## Fixes
- `getSets`: return usable IDB (stale OK) immediately; refresh network in background; parallel page1 + TCGdex when cold.
- `getAllCardsBySet`: paint stale IDB ASAP; prefer one-shot `tcgdexGetSetCards`; only page pokemontcg when TCGdex empty; soft enrich page1 in background.
- SetsView / SetCardsView: avoid blanking the grid on refresh when data already shown.

## Verify
Open Sets → Box sets (should appear from cache fast) → open Mega Evolution / any SV set → cards paint quickly (TCGdex or IDB) before prices fill in.
