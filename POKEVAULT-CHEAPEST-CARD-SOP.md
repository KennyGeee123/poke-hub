# ⚡ POKEVAULT MASTER SPECIFICATION & R&D STANDARD OPERATING PROCEDURE (SOP)
## High-Velocity Multi-Marketplace Arbitrage, Graded Slab Valuation & Real-Time Deal Scouting Engine

---

## 📑 Complete System Index

1. **Executive Summary & Core Directives**
   - 1.1 Objective & System Invariants
   - 1.2 The 5-Layer Architectural Stack
2. **Multi-Marketplace Landed Cost Arbitrage Engine**
   - 2.1 Live Priced Feeds vs Storefront Search Bridges
   - 2.2 Landed Cost Formula ($P_{\text{landed}} = P_{\text{base}} + P_{\text{ship}} \times \text{FX}$)
   - 2.3 Marketplace Fan-Out Coverage (15+ Sources)
3. **Raw vs Graded Slab Valuation & ROI Multiplier Engine**
   - 3.1 Grading Authority Taxonomy (PSA, BGS, CGC, SGC)
   - 3.2 Vintage Era Weighting Curve & Rarity Classification
   - 3.3 Submission Cost Basis & Real-Time Grading ROI Model
   - 3.4 Interactive Graded Cost Dropdowns Across Tiles & Detail HUDs
4. **High-Velocity 5-Second Polling Buffer & Sold Rotation Protocol**
   - 4.1 TimeFlow 5s Ticker & Multi-Tier Prefetch Queue
   - 4.2 Sold Inventory State Machine & Event Invalidation
   - 4.3 Rapid Rotation & Queue Shuffling Engine
5. **Zero-Wall Beta Execution & 1-Click Quick Strike Pipeline**
   - 5.1 Paywall Removal & Open Beta Bypass Architecture
   - 5.2 1-Click Direct Vendor Checkout Handshake
   - 5.3 Skip-Key Non-Collapsing Invariant
6. **Condition Normalization & Regex Token Parsing**
   - 6.1 Condition Hierarchy (NM, LP, MP, HP, DMG)
   - 6.2 Slab Signature Extraction & False-Positive Elimination
7. **Geek Squad NetNavi Council SLAs & Defensive Circuit Breakers**
   - 7.1 Bass 200ms SLA Breaker & Degradation Gate
   - 7.2 Apogee Rate Limiter & INP Preservation
   - 7.3 MerchantNavi 5-Source Valuation Quorum
8. **Operational SOP, Runbook & Quality Assurance Suite**
   - 8.1 Automated Verification Commands (`bun test`)
   - 8.2 Live Debugging & Telemetry Inspection
   - 8.3 API Key Management & Rate-Limit Backoff

---

## 1. Executive Summary & Core Directives

### 1.1 Objective
The PokeVault Arbitrage Engine continuously aggregates, normalizes, and ranks Pokémon card listings across every accessible online market. It identifies the absolute lowest landed cost in real time, computes instant graded slab valuations (PSA 10, PSA 9, BGS, CGC, SGC), tracks sold cards, and drives rapid inventory discovery through a 5-second proactive polling buffer.

### 1.2 System Invariants
1. **Landed Cost Truth**: No card price is displayed in isolation without factoring in domestic/international shipping and dynamic FX conversion rates.
2. **Deterministic Dedup**: Every listing is keyed by `Source::Condition::Variant::PriceInCents::PathHash` so skipping or striking one listing never collapses valid companion variants.
3. **Continuous Rotation**: When a listing is bought, it is recorded in the sold registry and immediately rotated out of view.
4. **Zero Gate Friction in Beta**: The entire Deal Scout Quick Strike workflow is accessible to testers without sign-in barriers.

---

## 2. Multi-Marketplace Landed Cost Arbitrage Engine

### 2.1 Live Priced Feeds vs Storefront Search Bridges
Due to cloud IP bot defenses on residential scrapers, PokeVault deploys a hybrid dual-lane architecture:

```
                  ┌─────────────────────────────────────────┐
                  │       Client / UI Query Request         │
                  └────────────────────┬────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │  Lane 1: Public REST APIs │                 │ Lane 2: Live Search Links │
  ├───────────────────────────┤                 ├───────────────────────────┤
  │ • TCGplayer (pokemontcg)  │                 │ • eBay Buy It Now (BIN)   │
  │ • Cardmarket EU Catalog   │                 │ • Troll and Toad          │
  │ • Target Redsky PLP API   │                 │ • CardKingdom             │
  │ • Live Price Feeds        │                 │ • Mercari / PriceCharting │
  │ • Cached in Mem & Disk    │                 │ • Whatnot / PokemonCenter │
  └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │      Unified Landed Ranking Queue       │
                  └─────────────────────────────────────────┘
```

### 2.2 Landed Cost Mathematical Formulation
The global rank order is governed by:

$$P_{\text{landed}} = (P_{\text{item}} \times \text{FX}_{\text{currency}\rightarrow\text{USD}}) + P_{\text{shipping}}$$

* **Foreign Exchange Table**: EUR ($1.08$), GBP ($1.27$), CAD ($0.73$), AUD ($0.66$), JPY ($0.0064$).
* **Condition Bias Tie-Breaker**: When landed costs are within $\pm 2\%$, higher condition grade takes precedence ($NM > LP > MP > HP > DMG$).

### 2.3 Comprehensive Marketplace Coverage
* **TCGplayer**: Direct catalog lows and verified seller market prices.
* **Cardmarket**: European lowest listings with automated FX conversion to USD.
* **eBay**: Real-time Buy It Now (BIN) links filtered by category 183454 (singles) and 183455 (sealed boxes).
* **PriceCharting**: Historical price comps and graded sales benchmarks.
* **Troll and Toad / CardKingdom**: Direct retail singles inventory.
* **Mercari**: Peer-to-peer authenticated listings.
* **Specialty Sealed Outlets**: Dave & Adam's, Steel City Collectibles, Miniature Market, ChannelFireball, Pokemon Center, Walmart, and Amazon.

---

## 3. Raw vs Graded Slab Valuation & ROI Multiplier Engine

### 3.1 Grading Authority Taxonomy
PokeVault supports real-time valuation models for the top 4 world-recognized grading agencies:
1. **PSA (Professional Sports Authenticator)**: PSA 10 (Gem Mint), PSA 9 (Mint), PSA 8 (NM-MT), PSA 7 (Near Mint).
2. **BGS (Beckett Grading Services)**: BGS 10 Black Label (Pristine Quad 10), BGS 9.5 (Gem Mint).
3. **CGC (Certified Guaranty Company)**: CGC 10 Pristine, CGC 9.5 Gem Mint, CGC 9 Mint.
4. **SGC (Sportscard Guaranty Corporation)**: SGC 10 Tuxedo Gem Mint.

### 3.2 Vintage Era Weighting Curve
Modern high-population cards experience modest grading premiums, whereas vintage pre-2003 Wizards of the Coast (WotC) holofoils command exponential multipliers due to sub-10% gem rates.

$$\text{Era Adjustment Multiplier} = 
\begin{cases}
2.4 & \text{if Release Year} \le 2003 \text{ (WotC Era: Base, Neo, e-Series)} \\
2.0 & \text{if Release Year} \le 2007 \text{ (EX Era / Gold Stars)} \\
1.5 & \text{if Release Year} \le 2012 \text{ (Diamond & Pearl / Platinum / HGSS / BW)} \\
1.2 & \text{if Release Year} \le 2018 \text{ (XY / Sun & Moon)} \\
1.0 & \text{if Release Year} \ge 2019 \text{ (Sword & Shield / Scarlet & Violet)}
\end{cases}$$

Rarity classification adds an extra $1.35\times$ weighting for Secret Rares, Illustration Rares, and 1st Edition printings.

### 3.3 Submission Cost Basis & ROI Model
* **Standard Grading Fee Estimate ($C_{\text{grade}}$)**: $19.99/card (Bulk Tier).
* **Total Cost Basis**: $C_{\text{basis}} = P_{\text{raw}} + C_{\text{grade}}$.
* **Net Projected Profit**: $\Pi = P_{\text{estimated graded}} - C_{\text{basis}}$.
* **Grading ROI %**: $\text{ROI} = (\Pi / C_{\text{basis}}) \times 100\%$.

### 3.4 Dropdowns Across UI Components
* **CardTile (`CardTile.tsx`)**: Every card tile in Discover, Search, Sets, Vault, and Wishlist contains an interactive grade dropdown. Selecting a grade dynamically updates the price tag and displays the grade badge without leaving the grid.
* **CardDetail (`CardDetail.tsx`)**: Displays the Graded Valuation HUD with full breakdown of raw price, submission fee, multiplier, net profit, and 1-click links to eBay active and sold slab comps.

---

## 4. High-Velocity 5-Second Polling Buffer & Sold Rotation Protocol

### 4.1 TimeFlow 5s Ticker
* PokeVault executes a 5-second background interval (`TICK_MS = 5000`) checking candidate listing freshness.
* If the remaining candidate buffer drops below 4 items (`needsRefill`), the engine proactively triggers an asynchronous refresh to guarantee zero latency during rapid buying.

### 4.2 Sold Inventory State Machine
```
[ Live Listing Detected ]
          │
          ▼
[ User Clicks STRIKE ] ───► [ Record key in pv.sold.registry.v1 ]
          │                                  │
          ▼                                  ▼
[ Launch Vendor Checkout ]         [ Dispatch pv-listing-sold Event ]
          │                                  │
          └────────────────┬─────────────────┘
                           ▼
             [ Invalidate Listing Key ]
                           │
                           ▼
             [ Auto-Rotate Next Lowest ]
```

### 4.3 Rapid Rotation & Queue Shuffling
* **Auto-Next**: When a card is struck or skipped, the next lowest landed cost listing immediately slides into the primary view.
* **Candidate Shuffle**: The **🔀 Shuffle** button enables collectors to randomize candidate cards across different vendors and grades for deal discovery.

---

## 5. Zero-Wall Beta Execution & 1-Click Quick Strike Pipeline

### 5.1 Paywall Removal
* In Beta mode, `unlocked = true` is enforced across `QuickStrike.tsx` and `CheapestPill.tsx`.
* Guest users and testers have unrestricted access to 1-click Buy Now, Skip, and Next Lowest rotations without requiring an active subscription or login session.

### 5.2 Skip-Key Non-Collapsing Invariant
* Because TCGplayer groups multiple printings (1st Edition, Holo, Reverse Holo) under single product IDs, skipping a listing must never wipe the entire parent product.
* The listing key includes variant, condition, and price cents:
  $$\text{Key} = \text{Source} + \text{"::"} + \text{Condition} + \text{"::"} + \text{Variant} + \text{"::"} + \text{Cents} + \text{"::"} + \text{Path}$$

---

## 6. Condition Normalization & Regex Token Parsing

### 6.1 Condition Hierarchy Matrix
| Tier Code | Label | Matching Tokens / Regex |
|---|---|---|
| `raw` | Raw / Ungraded | Excludes PSA, BGS, CGC, SGC, Graded, Slab keywords |
| `slab` | Graded Slabs | `/(psa|bgs|cgc|sgc|beckett|graded|gem mint 10)/i` |
| `psa10` | PSA 10 Gem Mint | `/(psa 10|gem mint 10)/i` |
| `psa9` | PSA 9 Mint | `/(psa 9|mint 9)/i` |
| `psa8` | PSA 8 NM-MT | `/(psa 8|nm mt 8)/i` |
| `nm` | Near Mint | `/(near mint|nm|normal|holofoil|mint)/i` (unplayed) |
| `lp` | Lightly Played | `/(lightly played|lp)/i` |
| `mp` | Moderately Played | `/(moderately played|mp)/i` |
| `hp` | Heavily Played | `/(heavily played|hp)/i` |
| `dmg` | Damaged | `/(damaged|dmg)/i` |

---

## 7. Geek Squad NetNavi Council SLAs & Defensive Circuit Breakers

### 7.1 Bass 200ms SLA Breaker
* Any downstream catalog fetch must resolve within $180\text{ms}$ budget ($80\text{ms}$ API fetch + $60\text{ms}$ DOM hydration + $40\text{ms}$ IPC).
* Hard cutoff at $200\text{ms}$ gracefully drops to cached catalog seeds to maintain 60 FPS UI interactions.

### 7.2 Apogee Rate Limiter & INP Preservation
* High-velocity 5s polling is restricted to $1\text{ req/sec}$ per active tab, pausing entirely when `document.visibilityState === hidden`.

### 7.3 MerchantNavi 5-Source Valuation Quorum
* Aggregates fair market value by comparing TCGPlayer, Cardmarket, PriceCharting, eBay Sold Comps, and Troll&Toad before flagging underpriced deals.

---

## 8. Operational SOP, Runbook & Quality Assurance Suite

### 8.1 Automated Verification Commands
Execute the full unit test suite via Bun:
```bash
export PATH="/Users/kennysmac/.bun/bin:/Users/kennysmac/.nvm/versions/node/v22.22.3/bin:$PATH"
cd /Users/kennysmac/Projects/lovable-apps/tcg-vault-master
bun test
```
**Test Coverage**:
* `src/lib/card-grades.test.ts`: Validates grading tiers, vintage era multipliers, submission cost basis, and slab search URLs.
* `src/lib/card-prices.test.ts`: Validates 5s ticker loop, queue refills, condition filters, slab detection, and sold registry invalidation.

### 8.2 Live Development Server
Start the local Vite dev server:
```bash
export PATH="/Users/kennysmac/.bun/bin:/Users/kennysmac/.nvm/versions/node/v22.22.3/bin:$PATH"
bun run dev
```

### 8.3 Telemetry & Troubleshooting Runbook
1. **Issue: No live listings found**:
   - Cause: Card query is too specific or out-of-print variant.
   - Action: Drop condition filter to "Any Condition (Cheapest)" or use catalog seed low.
2. **Issue: Stale pricing on rapid card rotation**:
   - Cause: Cached TTL hit.
   - Action: Pass `fresh: true` to bypass 20s memory cache.
3. **Issue: Sold items reappearing in queue**:
   - Cause: LocalStorage cleared or new listing published with differing cents.
   - Action: Ensure `markListingSold` registers the exact listing identity.

---
*Authored by Geek Squad Quantum Ops & The PokeVault Engineering Council.*
