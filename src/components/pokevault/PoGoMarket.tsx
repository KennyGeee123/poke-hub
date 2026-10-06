import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/vault";
import { getEbaySold } from "@/lib/ebay";
import {
  POGO_SPECIES,
  buildDemoListings,
  estimatePoGoValueByName,
  fairPoGoTrade,
  findSpecies,
  pogoEbaySoldUrl,
  pogoSpriteUrl,
  valueFromEbayOrEstimate,
  type PoGoListing,
  type PoGoListingKind,
  type PoGoSpecies,
  type PoGoValue,
} from "@/lib/pogo-market";

type Mode = "browse" | "sell" | "trade";

function GradeishBadges({ listing }: { listing: PoGoListing }) {
  return (
    <div className="pogo-badges">
      {listing.shiny && <span className="pogo-badge shiny">✨ Shiny</span>}
      {listing.lucky && <span className="pogo-badge lucky">🍀 Lucky</span>}
      <span className="pogo-badge iv">{listing.ivPct}% IV</span>
      <span className="pogo-badge cp">{listing.cp} CP</span>
    </div>
  );
}

function ValueChip({ value }: { value: PoGoValue | null }) {
  if (!value) return <span className="pogo-value muted">…</span>;
  return (
    <span className={`pogo-value ${value.source === "ebay_sold" ? "live" : "est"}`}>
      {formatPrice(value.usd)}
      <em>{value.source === "ebay_sold" ? "eBay sold median" : "eBay-sold-informed est."}</em>
    </span>
  );
}

function ListingCard({
  listing,
  onSelect,
}: {
  listing: PoGoListing;
  onSelect?: (l: PoGoListing) => void;
}) {
  const kindLabel =
    listing.kind === "sell" ? "FOR SALE" : listing.kind === "buy" ? "WANTED" : "TRADE";
  return (
    <button
      type="button"
      className={`pogo-card kind-${listing.kind}`}
      onClick={() => onSelect?.(listing)}
    >
      <div className="pogo-card-art">
        <img src={pogoSpriteUrl(listing.species.id)} alt="" loading="lazy" decoding="async" />
        <span className={`pogo-kind k-${listing.kind}`}>{kindLabel}</span>
      </div>
      <div className="pogo-card-body">
        <strong>{listing.species.name}</strong>
        <span className="pogo-types">{listing.species.types.join(" · ")}</span>
        <GradeishBadges listing={listing} />
        <div className="pogo-card-price">
          {listing.kind === "trade" ? (
            <span>
              Trade
              {listing.priceUsd !== 0 && (
                <>
                  {" "}
                  · cash {listing.priceUsd > 0 ? "+" : ""}
                  {formatPrice(listing.priceUsd)}
                </>
              )}
            </span>
          ) : (
            <span>{formatPrice(listing.priceUsd)}</span>
          )}
          <em>mkt {formatPrice(listing.marketValueUsd)}</em>
        </div>
        <span className="pogo-trader">@{listing.trader}</span>
      </div>
    </button>
  );
}

function useSpeciesValue(name: string | null) {
  const [value, setValue] = useState<PoGoValue | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!name) {
      setValue(null);
      return;
    }
    let alive = true;
    setBusy(true);
    const base = valueFromEbayOrEstimate(name);
    setValue(base);
    // Best-effort live eBay sold (requires sign-in on the ebay client helper).
    getEbaySold(base.query)
      .then((r) => {
        if (!alive) return;
        setValue(valueFromEbayOrEstimate(name, r));
      })
      .catch(() => {
        /* keep estimate — guest / offline OK */
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [name]);
  return { value, busy };
}

export function PoGoMarketView() {
  const [mode, setMode] = useState<Mode>("browse");
  const [filter, setFilter] = useState<PoGoListingKind | "all">("all");
  const [q, setQ] = useState("");
  const [listings] = useState(() => buildDemoListings());
  const [selected, setSelected] = useState<PoGoListing | null>(null);

  // Sell form
  const [sellSpecies, setSellSpecies] = useState<PoGoSpecies>(POGO_SPECIES[3]);
  const [sellCp, setSellCp] = useState(2500);
  const [sellIv, setSellIv] = useState(91);
  const [sellShiny, setSellShiny] = useState(false);
  const sellVal = useSpeciesValue(sellSpecies.name);

  // Trade form
  const [mine, setMine] = useState<PoGoSpecies>(POGO_SPECIES[9]);
  const [theirs, setTheirs] = useState<PoGoSpecies>(POGO_SPECIES[15]);
  const mineVal = useSpeciesValue(mine.name);
  const theirsVal = useSpeciesValue(theirs.name);
  const verdict = useMemo(() => {
    const a = mineVal.value?.usd ?? estimatePoGoValueByName(mine.name);
    const b = theirsVal.value?.usd ?? estimatePoGoValueByName(theirs.name);
    return fairPoGoTrade(a, b);
  }, [mine, theirs, mineVal.value, theirsVal.value]);

  const filtered = useMemo(() => {
    let rows = listings;
    if (filter !== "all") rows = rows.filter((l) => l.kind === filter);
    const n = q.trim().toLowerCase();
    if (n) rows = rows.filter((l) => l.species.name.toLowerCase().includes(n));
    return rows;
  }, [listings, filter, q]);

  return (
    <div className="pad pogo-page">
      <header className="pogo-head">
        <div className="pogo-kicker">POKÉMON GO MARKET</div>
        <h1 className="pogo-title">Buy · Sell · Trade GO creatures</h1>
        <p className="pogo-sub">
          Values are keyed by the Pokémon&apos;s <strong>name</strong>, informed by eBay sold comps
          when you&apos;re signed in — otherwise a stable eBay-sold-informed estimate. Listings
          below are beta demos (not live transfers).
        </p>
      </header>

      <div className="pogo-modes" role="tablist" aria-label="GO market mode">
        {(
          [
            ["browse", "Browse"],
            ["sell", "List for sale"],
            ["trade", "Fair trade"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            className={`pv-pill ${mode === k ? "on" : ""}`}
            onClick={() => setMode(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === "browse" && (
        <>
          <div className="pogo-filters">
            <input
              className="pv-input"
              placeholder="Filter by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Filter listings"
            />
            <div className="pogo-filter-kinds" role="radiogroup" aria-label="Listing type">
              {(["all", "sell", "buy", "trade"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={filter === k}
                  className={`pv-pill ${filter === k ? "on" : ""}`}
                  onClick={() => setFilter(k)}
                >
                  {k === "all"
                    ? "All"
                    : k === "sell"
                      ? "For sale"
                      : k === "buy"
                        ? "Wanted"
                        : "Trade"}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="pogo-empty">No listings match. Try another name.</p>
          ) : (
            <div className="pogo-grid">
              {filtered.map((l) => (
                <ListingCard key={l.id} listing={l} onSelect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {mode === "sell" && (
        <section className="pogo-panel" aria-label="List a GO creature">
          <div className="pogo-sec">1 · Pick species</div>
          <div className="pogo-species-grid">
            {findSpecies("")
              .slice(0, 18)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pogo-species ${sellSpecies.id === s.id ? "on" : ""}`}
                  onClick={() => setSellSpecies(s)}
                >
                  <img src={pogoSpriteUrl(s.id)} alt="" />
                  <span>{s.name}</span>
                </button>
              ))}
          </div>
          <div className="pogo-sec">2 · Stats</div>
          <div className="pogo-form-row">
            <label>
              CP
              <input
                className="pv-input"
                type="number"
                min={10}
                max={5000}
                value={sellCp}
                onChange={(e) => setSellCp(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              IV %
              <input
                className="pv-input"
                type="number"
                min={0}
                max={100}
                value={sellIv}
                onChange={(e) => setSellIv(Number(e.target.value) || 0)}
              />
            </label>
            <button
              type="button"
              className={`pv-fa-toggle ${sellShiny ? "on" : ""}`}
              aria-pressed={sellShiny}
              onClick={() => setSellShiny((v) => !v)}
            >
              <span className="flex-1 text-left">
                <strong>Shiny</strong>
                <em>Boosts ask vs name value</em>
              </span>
              <span className="pv-lw-switch" aria-hidden />
            </button>
          </div>
          <div className="pogo-sec">3 · Name-keyed value</div>
          <div className="pogo-value-box">
            <img src={pogoSpriteUrl(sellSpecies.id)} alt="" className="pogo-value-sprite" />
            <div>
              <strong>{sellSpecies.name}</strong>
              <ValueChip value={sellVal.value} />
              <p>
                Suggested ask{" "}
                <b>
                  {formatPrice(
                    (sellVal.value?.usd ?? estimatePoGoValueByName(sellSpecies.name)) *
                      (sellShiny ? 1.55 : 1) *
                      (sellIv >= 98 ? 1.25 : sellIv >= 90 ? 1.1 : 1),
                  )}
                </b>{" "}
                (name value × shiny/IV).
              </p>
              <a
                className="pogo-ebay"
                href={pogoEbaySoldUrl(sellSpecies.name)}
                target="_blank"
                rel="noreferrer"
              >
                Open eBay sold comps for “{sellSpecies.name}” →
              </a>
            </div>
          </div>
          <button type="button" className="pv-btn pv-btn-fill pogo-cta" disabled>
            Post listing (beta demo — coming soon)
          </button>
        </section>
      )}

      {mode === "trade" && (
        <section className="pogo-panel" aria-label="Fair GO trade">
          <p className="pogo-sub">
            Same idea as Fair Trade for cards — both sides valued by species name.
          </p>
          <div className="pogo-trade-grid">
            <div>
              <div className="pogo-sec">Your creature</div>
              <select
                className="pv-input"
                value={mine.id}
                onChange={(e) =>
                  setMine(POGO_SPECIES.find((s) => s.id === Number(e.target.value)) || mine)
                }
              >
                {POGO_SPECIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="pogo-trade-side">
                <img src={pogoSpriteUrl(mine.id)} alt="" />
                <ValueChip value={mineVal.value} />
              </div>
            </div>
            <div className="pogo-trade-vs" aria-hidden>
              ↔
            </div>
            <div>
              <div className="pogo-sec">Their creature</div>
              <select
                className="pv-input"
                value={theirs.id}
                onChange={(e) =>
                  setTheirs(POGO_SPECIES.find((s) => s.id === Number(e.target.value)) || theirs)
                }
              >
                {POGO_SPECIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="pogo-trade-side">
                <img src={pogoSpriteUrl(theirs.id)} alt="" />
                <ValueChip value={theirsVal.value} />
              </div>
            </div>
          </div>
          <div className={`pogo-verdict v-${verdict.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="pogo-verdict-kicker">GO FAIR TRADE</div>
            <div className="pogo-verdict-label">{verdict.label}</div>
            <p>{verdict.line}</p>
          </div>
        </section>
      )}

      {selected && (
        <div
          className="pogo-modal"
          role="dialog"
          aria-modal="true"
          aria-label={selected.species.name}
        >
          <div className="pv-settings-scrim" onClick={() => setSelected(null)} aria-hidden />
          <div className="pogo-modal-card">
            <img src={pogoSpriteUrl(selected.species.id)} alt="" />
            <strong>{selected.species.name}</strong>
            <GradeishBadges listing={selected} />
            <p>{selected.note}</p>
            <p>
              Ask {formatPrice(selected.priceUsd)} · name market{" "}
              {formatPrice(selected.marketValueUsd)}
            </p>
            <a
              className="pogo-ebay"
              href={pogoEbaySoldUrl(selected.species.name)}
              target="_blank"
              rel="noreferrer"
            >
              eBay sold comps →
            </a>
            <button type="button" className="pv-btn" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
