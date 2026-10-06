import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/vault";
import { getEbaySold } from "@/lib/ebay";
import {
  POGO_SPECIES,
  buildDemoListings,
  ebayPanelFromValue,
  estimatePoGoValueByName,
  fairPoGoTrade,
  loadUserListings,
  pogoEbaySoldUrl,
  pogoSpriteUrl,
  removeUserListing,
  saveUserListing,
  valueFromEbayOrEstimate,
  type PoGoEbayPanel,
  type PoGoListing,
  type PoGoListingKind,
  type PoGoSpecies,
  type PoGoValue,
} from "@/lib/pogo-market";

type Mode = "browse" | "sell" | "trade";

const valueCache = new Map<string, PoGoValue>();

function useNameEbay(name: string | null) {
  const [value, setValue] = useState<PoGoValue | null>(() =>
    name ? valueCache.get(name.toLowerCase()) || valueFromEbayOrEstimate(name) : null,
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!name) {
      setValue(null);
      return;
    }
    const key = name.toLowerCase();
    const base = valueCache.get(key) || valueFromEbayOrEstimate(name);
    setValue(base);
    let alive = true;
    setBusy(true);
    getEbaySold(base.query)
      .then((r) => {
        if (!alive) return;
        const next = valueFromEbayOrEstimate(name, r);
        valueCache.set(key, next);
        setValue(next);
      })
      .catch(() => {
        valueCache.set(key, base);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [name]);
  return { value, busy, panel: value ? ebayPanelFromValue(value) : null };
}

function EbayBadges({ panel, busy }: { panel: PoGoEbayPanel | null; busy?: boolean }) {
  if (!panel) {
    return (
      <div className="pogo-ebay-panel">
        <span className="pogo-ebay-chip muted">{busy ? "eBay…" : "eBay —"}</span>
      </div>
    );
  }
  const live = panel.source === "ebay_sold";
  return (
    <div
      className="pogo-ebay-panel"
      title={live ? "Live eBay sold comps" : "eBay-sold-informed estimate"}
    >
      <a
        className={`pogo-ebay-chip sold ${live ? "live" : "est"}`}
        href={panel.soldUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <span>eBay sold {live ? "avg" : "est."}</span>
        <strong>{formatPrice(panel.soldUsd)}</strong>
      </a>
      <a
        className="pogo-ebay-chip ask"
        href={panel.askingUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <span>eBay asking</span>
        <strong>{formatPrice(panel.askingUsd)}</strong>
      </a>
    </div>
  );
}

function ConditionRow({ listing }: { listing: PoGoListing }) {
  return (
    <div className="pogo-badges">
      {listing.shiny && <span className="pogo-badge shiny">✨ Shiny</span>}
      {listing.lucky && <span className="pogo-badge lucky">🍀 Lucky</span>}
      <span className="pogo-badge iv">{listing.ivPct}% IV</span>
      <span className="pogo-badge cp">{listing.cp} CP</span>
    </div>
  );
}

function ListingCard({
  listing,
  onOpen,
}: {
  listing: PoGoListing;
  onOpen: (l: PoGoListing) => void;
}) {
  const { panel, busy } = useNameEbay(listing.species.name);
  const kindLabel =
    listing.kind === "sell" ? "FOR SALE" : listing.kind === "buy" ? "WANTED" : "TRADE";
  return (
    <article className={`pogo-card kind-${listing.kind}`}>
      <button type="button" className="pogo-card-hit" onClick={() => onOpen(listing)}>
        <div className="pogo-card-art">
          <img src={pogoSpriteUrl(listing.species.id)} alt="" loading="lazy" decoding="async" />
          <span className={`pogo-kind k-${listing.kind}`}>{kindLabel}</span>
        </div>
        <div className="pogo-card-body">
          <strong>{listing.species.name}</strong>
          <span className="pogo-types">{listing.species.types.join(" · ")}</span>
          <ConditionRow listing={listing} />
          <div className="pogo-card-price">
            <span className="pogo-our-price">
              {listing.kind === "trade" ? (
                <>
                  Trade
                  {listing.priceUsd !== 0 && (
                    <>
                      {" "}
                      · cash {listing.priceUsd > 0 ? "+" : ""}
                      {formatPrice(listing.priceUsd)}
                    </>
                  )}
                </>
              ) : (
                <>
                  <em>Our price</em> {formatPrice(listing.priceUsd)}
                </>
              )}
            </span>
            <span className="pogo-trader">@{listing.trader}</span>
          </div>
        </div>
      </button>
      <EbayBadges panel={panel} busy={busy} />
    </article>
  );
}

export function PoGoMarketView() {
  const [mode, setMode] = useState<Mode>("browse");
  const [filter, setFilter] = useState<PoGoListingKind | "all">("all");
  const [q, setQ] = useState("");
  const [demo] = useState(() => buildDemoListings());
  const [mine, setMineListings] = useState<PoGoListing[]>(() => loadUserListings());
  const [selected, setSelected] = useState<PoGoListing | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const listings = useMemo(() => [...mine, ...demo], [mine, demo]);

  // Sell form
  const [sellSpecies, setSellSpecies] = useState<PoGoSpecies>(POGO_SPECIES[3]);
  const [sellCp, setSellCp] = useState(2500);
  const [sellIv, setSellIv] = useState(91);
  const [sellShiny, setSellShiny] = useState(false);
  const [sellAsk, setSellAsk] = useState("");
  const sellEbay = useNameEbay(sellSpecies.name);

  useEffect(() => {
    const base = sellEbay.value?.usd ?? estimatePoGoValueByName(sellSpecies.name);
    const ask = base * (sellShiny ? 1.55 : 1) * (sellIv >= 98 ? 1.25 : sellIv >= 90 ? 1.1 : 1);
    setSellAsk(String(Math.round(ask * 100) / 100));
  }, [sellSpecies, sellShiny, sellIv, sellEbay.value]);

  // Trade
  const [mySp, setMySp] = useState<PoGoSpecies>(POGO_SPECIES[9]);
  const [theirSp, setTheirSp] = useState<PoGoSpecies>(POGO_SPECIES[15]);
  const myEbay = useNameEbay(mySp.name);
  const theirEbay = useNameEbay(theirSp.name);
  const verdict = useMemo(() => {
    const a = myEbay.value?.usd ?? estimatePoGoValueByName(mySp.name);
    const b = theirEbay.value?.usd ?? estimatePoGoValueByName(theirSp.name);
    return fairPoGoTrade(a, b);
  }, [mySp, theirSp, myEbay.value, theirEbay.value]);

  const filtered = useMemo(() => {
    let rows = listings;
    if (filter !== "all") rows = rows.filter((l) => l.kind === filter);
    const n = q.trim().toLowerCase();
    if (n)
      rows = rows.filter(
        (l) =>
          l.species.name.toLowerCase().includes(n) ||
          l.trader.toLowerCase().includes(n) ||
          l.species.types.some((t) => t.toLowerCase().includes(n)),
      );
    return rows;
  }, [listings, filter, q]);

  const postListing = () => {
    const ask = Number(sellAsk) || 0;
    const market = sellEbay.value?.usd ?? estimatePoGoValueByName(sellSpecies.name);
    const listing: PoGoListing = {
      id: `user-${sellSpecies.id}-${Date.now()}`,
      kind: "sell",
      species: sellSpecies,
      priceUsd: ask,
      marketValueUsd: market,
      cp: sellCp,
      ivPct: sellIv,
      shiny: sellShiny,
      lucky: false,
      trader: "You",
      note: `${sellIv}% IV · ${sellCp} CP · posted in PokéVault`,
      createdAt: Date.now(),
    };
    saveUserListing(listing);
    setMineListings(loadUserListings());
    flash(`Listed ${sellSpecies.name} for ${formatPrice(ask)}`);
    setMode("browse");
    setFilter("sell");
  };

  const buyListing = (l: PoGoListing) => {
    flash(`Demo buy: ${l.species.name} for ${formatPrice(l.priceUsd)} (no charge)`);
    setSelected(null);
  };

  const offerTrade = (l: PoGoListing) => {
    flash(`Trade offer sent to @${l.trader} for ${l.species.name} (demo)`);
    setSelected(null);
  };

  const selEbay = useNameEbay(selected?.species.name ?? null);

  return (
    <div className="pad pogo-page">
      <header className="pogo-head">
        <div className="pogo-kicker">POKÉMON GO MARKETPLACE</div>
        <h1 className="pogo-title">Buy · Sell · Trade inside PokéVault</h1>
        <p className="pogo-sub">
          An eBay-style market for <strong>Pokémon GO</strong> creatures (not TCG cards). Each
          listing shows <em>our price</em> next to <em>eBay sold</em> and <em>eBay asking</em>{" "}
          comps, keyed by the Pokémon&apos;s name. Demo listings + your posts stay on this device.
        </p>
      </header>

      {toast && (
        <div className="pogo-toast" role="status">
          {toast}
        </div>
      )}

      <div className="pogo-modes" role="tablist" aria-label="GO market mode">
        {(
          [
            ["browse", "Browse"],
            ["sell", "Sell"],
            ["trade", "Trade"],
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
              placeholder="Search name, type, or seller…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search listings"
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
          <div className="pogo-count">
            {filtered.length} listing{filtered.length === 1 ? "" : "s"}
            {mine.length ? ` · ${mine.length} yours` : ""}
          </div>
          {filtered.length === 0 ? (
            <p className="pogo-empty">
              No listings match. Try another search or post one under Sell.
            </p>
          ) : (
            <div className="pogo-grid">
              {filtered.map((l) => (
                <ListingCard key={l.id} listing={l} onOpen={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {mode === "sell" && (
        <section className="pogo-panel" aria-label="Sell a GO creature">
          <div className="pogo-sec">1 · Species</div>
          <div className="pogo-species-grid">
            {POGO_SPECIES.map((s) => (
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
          <div className="pogo-sec">2 · Condition</div>
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
                <em>Raises suggested ask</em>
              </span>
              <span className="pv-lw-switch" aria-hidden />
            </button>
          </div>
          <div className="pogo-sec">3 · Price vs eBay</div>
          <div className="pogo-value-box">
            <img src={pogoSpriteUrl(sellSpecies.id)} alt="" className="pogo-value-sprite" />
            <div className="pogo-value-copy">
              <strong>{sellSpecies.name}</strong>
              <EbayBadges panel={sellEbay.panel} busy={sellEbay.busy} />
              <label className="pogo-ask-label">
                Your listing price (USD)
                <input
                  className="pv-input"
                  type="number"
                  min={0}
                  step={0.01}
                  value={sellAsk}
                  onChange={(e) => setSellAsk(e.target.value)}
                />
              </label>
              <a
                className="pogo-ebay"
                href={pogoEbaySoldUrl(sellSpecies.name)}
                target="_blank"
                rel="noreferrer"
              >
                Open eBay sold comps →
              </a>
            </div>
          </div>
          <button type="button" className="pv-btn pv-btn-fill pogo-cta" onClick={postListing}>
            Post listing on PokéVault
          </button>
        </section>
      )}

      {mode === "trade" && (
        <section className="pogo-panel" aria-label="Fair GO trade">
          <p className="pogo-sub">
            Compare two species by name value — same idea as Fair Trade for cards.
          </p>
          <div className="pogo-trade-grid">
            <div>
              <div className="pogo-sec">You offer</div>
              <select
                className="pv-input"
                value={mySp.id}
                onChange={(e) =>
                  setMySp(POGO_SPECIES.find((s) => s.id === Number(e.target.value)) || mySp)
                }
              >
                {POGO_SPECIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="pogo-trade-side">
                <img src={pogoSpriteUrl(mySp.id)} alt="" />
                <EbayBadges panel={myEbay.panel} busy={myEbay.busy} />
              </div>
            </div>
            <div className="pogo-trade-vs" aria-hidden>
              ↔
            </div>
            <div>
              <div className="pogo-sec">You want</div>
              <select
                className="pv-input"
                value={theirSp.id}
                onChange={(e) =>
                  setTheirSp(POGO_SPECIES.find((s) => s.id === Number(e.target.value)) || theirSp)
                }
              >
                {POGO_SPECIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="pogo-trade-side">
                <img src={pogoSpriteUrl(theirSp.id)} alt="" />
                <EbayBadges panel={theirEbay.panel} busy={theirEbay.busy} />
              </div>
            </div>
          </div>
          <div className={`pogo-verdict v-${verdict.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="pogo-verdict-kicker">GO FAIR TRADE</div>
            <div className="pogo-verdict-label">{verdict.label}</div>
            <p>{verdict.line}</p>
            <button
              type="button"
              className="pv-btn pv-btn-fill"
              onClick={() => flash(`Demo trade offer: ${mySp.name} ↔ ${theirSp.name}`)}
            >
              Send trade offer (demo)
            </button>
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
            <ConditionRow listing={selected} />
            <p className="pogo-modal-note">{selected.note}</p>
            <div className="pogo-modal-prices">
              <div>
                <em>Our listing</em>
                <b>{formatPrice(selected.priceUsd)}</b>
              </div>
              <EbayBadges panel={selEbay.panel} busy={selEbay.busy} />
            </div>
            <span className="pogo-trader">Seller @{selected.trader}</span>
            <div className="pogo-modal-actions">
              {selected.kind === "sell" && (
                <button
                  type="button"
                  className="pv-btn pv-btn-fill"
                  onClick={() => buyListing(selected)}
                >
                  Buy now (demo)
                </button>
              )}
              <button type="button" className="pv-btn" onClick={() => offerTrade(selected)}>
                Make trade offer
              </button>
              {selected.trader === "You" && (
                <button
                  type="button"
                  className="pv-btn"
                  onClick={() => {
                    removeUserListing(selected.id);
                    setMineListings(loadUserListings());
                    setSelected(null);
                    flash("Listing removed");
                  }}
                >
                  Remove my listing
                </button>
              )}
              <button type="button" className="pv-btn" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
