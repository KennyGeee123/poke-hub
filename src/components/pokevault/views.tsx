import { useEffect, useState } from "react";
import { hdImg } from "@/lib/card-images";
import type { TCGCard, TCGSet } from "@/lib/pokemon-api";
import { getMarketPrice, getSets, getTopMarket, getTrending, getDiscoverFast, searchCards, getCardsBySet, getAllCardsBySet, rememberCard } from "@/lib/pokemon-api";
import { formatPrice, useVault } from "@/lib/vault";
import { CardTile, CardSkeleton } from "./CardTile";
import { CollectionInsightsCard } from "./CollectionInsights";
import { CheapestPill } from "./CheapestPill";
import { PriceComparePanel } from "./PriceCompare";
import { PrintLangBar } from "./PrintLangBar";
import { searchChips, searchPlaceholder, usePrintLang } from "@/lib/print-lang";

type OnOpen = (id: string) => void;

/* ─── Discover ─── */
export function DiscoverView({ onOpen, onTab }: { onOpen: OnOpen; onTab: (t: string) => void }) {
  const [trending, setTrending] = useState<TCGCard[] | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [lang] = usePrintLang();

  useEffect(() => {
    let cancelled = false;
    setTrending(null);
    const paint = (cards: TCGCard[]) => {
      if (cancelled) return;
      const sorted = [...cards].sort((a, b) => getMarketPrice(b) - getMarketPrice(a));
      setTrending(sorted);
    };
    getDiscoverFast(lang).then(paint).catch(() => {});
    getTrending(24, 1, lang).then(paint).catch(() => {
      setTrending(prev => prev ?? []);
    });
    return () => { cancelled = true; };
  }, [lang]);

  // Rotate hero every 2 minutes
  useEffect(() => {
    if (!trending || trending.length < 2) return;
    const id = setInterval(() => {
      setHeroIdx(i => (i + 1) % Math.min(trending.length, 20));
    }, 120_000);
    return () => clearInterval(id);
  }, [trending]);

  const hero = trending?.[heroIdx] ?? null;
  const total = trending?.length ?? 0;

  return (
    <div>
      <div className="pad" style={{ paddingBottom: 0 }}><PrintLangBar /></div>
      {hero && (
        <div className="pv-hero pv-hero-premium" key={hero.id}>
          <div className="pv-hero-bg" style={{
            background: `linear-gradient(135deg, rgba(255,215,0,.08), transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,80,0,.18), transparent 60%)`,
          }} />
          <div className="pv-hero-content">
            <span className="pv-hero-badge">🔥 TRENDING #{heroIdx + 1}</span>
            <h1 className="pv-hero-name">{hero.name.toUpperCase()}</h1>
            <div className="pv-hero-sub">{hero.set.name} • {hero.rarity ?? "—"}</div>
            <div className="pv-hero-price">{formatPrice(getMarketPrice(hero))}</div>
            <div className="flex gap-2 flex-wrap">
              <button className="pv-btn pv-btn-out" onClick={() => { rememberCard(hero); onOpen(hero.id); }}>View Card</button>
              <HeroAddBtn card={hero} />
              {total > 1 && (
                <button className="pv-btn pv-btn-out" onClick={() => setHeroIdx(i => (i + 1) % Math.min(total, 20))}>
                  Next →
                </button>
              )}
            </div>
            {total > 1 && (
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 10, letterSpacing: 1 }}>
                AUTO-ROTATES EVERY 2 MIN • {heroIdx + 1} / {Math.min(total, 20)}
              </div>
            )}
          </div>
          <div className="pv-hero-img">
            <img
              src={hero.images.small || hero.images.large}
              srcSet={hero.images.large ? `${hero.images.small} 245w, ${hero.images.large} 600w` : undefined}
              sizes="(max-width: 700px) 40vw, 220px"
              alt={hero.name}
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      )}

      <div className="qa-row" style={{ display: "flex", gap: 8, padding: "14px 16px 4px", flexWrap: "wrap" }}>
        <button className="pv-btn pv-btn-out" onClick={() => onTab("market")}>📈 Market Prices</button>
        <button className="pv-btn pv-btn-out" onClick={() => onTab("sets")}>📦 Browse Sets</button>
        <button className="pv-btn pv-btn-out" onClick={() => onTab("search")}>🔍 Search Cards</button>
        <button className="pv-btn pv-btn-fill" onClick={() => onTab("battle")}>⚔ Battle Mode</button>
      </div>

      <Rail title={`🔥 TRENDING NOW${total ? ` · ${total}` : ""}`} cards={trending} onOpen={onOpen} />
    </div>
  );
}

function HeroAddBtn({ card }: { card: TCGCard }) {
  const { addToVault, inVault } = useVault();
  const v = inVault(card.id);
  return (
    <button className={`pv-btn pv-btn-fill ${v ? "yes" : ""}`} onClick={() => addToVault(card)}>
      {v ? "✓ IN VAULT" : "+ Add to Vault"}
    </button>
  );
}

function Rail({ title, cards, onOpen }: { title: string; cards: TCGCard[] | null; onOpen: OnOpen }) {
  return (
    <div style={{ borderBottom: "1px solid var(--brd)" }}>
      <div className="pv-rail-hdr">
        <div className="pv-rail-title">{title}</div>
        {cards && <div className="pv-rail-cnt">{cards.length}</div>}
      </div>
      <div className="pv-rail-scroll hide-scroll pv-stagger">
        {cards
          ? cards.map((c, i) => (
              <div key={c.id} className="pv-stagger-item" style={{ ["--i" as any]: i }}>
                <CardTile card={c} onClick={() => onOpen(c.id)} />
              </div>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="pv-stagger-item" style={{ ["--i" as any]: i }}>
                <CardSkeleton />
              </div>
            ))}
      </div>
    </div>
  );
}

/* ─── Market ─── */
export function MarketView({ onOpen }: { onOpen: OnOpen }) {
  const [cards, setCards] = useState<TCGCard[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);
  const { addToVault, inVault } = useVault();
  const [lang] = usePrintLang();

  const load = () => {
    setErr(null);
    setCards(null);
    getTopMarket(lang)
      .then((c) => {
        setCards(c);
        if (!c.length) setErr("The card API is busy. Showing nothing — retry in a moment.");
      })
      .catch((e: any) => {
        setCards([]);
        setErr(e?.message || "Could not load market data.");
      });
  };
  useEffect(() => { load(); }, [lang]);

  const filtered = (cards ?? []).filter(c => {
    if (filter === "all") return true;
    const r = (c.rarity ?? "").toLowerCase();
    if (filter === "ultra") return r.includes("ultra");
    if (filter === "holo") return r.includes("holo");
    if (filter === "ex") return /\b(ex|gx|v|vmax|vstar)\b/i.test(c.subtypes?.join(" ") ?? "") || /\b(ex|gx|v)\b/i.test(c.name);
    if (filter === "special") return r.includes("special") || r.includes("rainbow") || r.includes("secret") || r.includes("hyper");
    return true;
  });

  return (
    <div className="pad">
      <PrintLangBar />
      <div className="pv-section-title">📈 MARKET LEADERBOARD</div>
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          ["all", "All Cards"], ["ultra", "Ultra Rare"], ["holo", "Holofoil"],
          ["ex", "EX / GX / V"], ["special", "Special Art"],
        ].map(([k, l]) => (
          <button key={k} className={`pv-pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {!cards && !err && <div className="pv-empty">Loading market data…</div>}
      {err && (!cards || cards.length === 0) && (
        <div className="pv-empty">
          <div className="pv-empty-title">MARKET DIDN’T LOAD</div>
          <div>{err}</div>
          <button className="pv-btn pv-btn-fill" style={{ marginTop: 12 }} onClick={load}>Retry</button>
        </div>
      )}
      {filtered.map((c, i) => (
        <div key={c.id} className="pv-lb-row" onClick={() => onOpen(c.id)}>
          <div className="pv-lb-rank">{i + 1}</div>
          <img className="pv-lb-img" {...hdImg(c)} alt={c.name} loading="lazy" />
          <div className="pv-lb-info">
            <div className="pv-lb-name">{c.name}{c.lang && c.lang !== "en" ? ` · ${c.lang}` : ""}</div>
            <div className="pv-lb-rar">{c.set.name} • {c.rarity ?? "—"}</div>
          </div>
          <div className="pv-lb-price">{formatPrice(getMarketPrice(c))}</div>
          <button
            className={`pv-btn pv-btn-fill ${inVault(c.id) ? "yes" : ""}`}
            style={{ padding: "6px 10px", fontSize: 10 }}
            onClick={(e) => { e.stopPropagation(); addToVault(c); }}
          >
            {inVault(c.id) ? "✓" : "+ Add"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── Sets ─── */
export function SetsView({ onPickSet }: { onPickSet: (s: TCGSet) => void }) {
  const [sets, setSets] = useState<TCGSet[] | null>(null);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [lang] = usePrintLang();

  const load = () => {
    setErr(null);
    setSets(null);
    getSets(lang).then(setSets).catch((e: any) => {
      setSets([]);
      setErr(e?.message || "Could not load sets.");
    });
  };
  useEffect(() => { load(); }, [lang]);

  const filtered = (sets ?? []).filter(s =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.series?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="pad">
      <PrintLangBar />
      <input
        className="pv-input mb-4"
        placeholder="Filter sets by name or series…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      {!sets && !err && <div className="pv-empty">Loading every set…</div>}
      {err && (
        <div className="pv-empty">
          <div className="pv-empty-title">SETS DIDN’T LOAD</div>
          <div>{err}</div>
          <button className="pv-btn pv-btn-fill" style={{ marginTop: 12 }} onClick={load}>Retry</button>
        </div>
      )}
      {sets && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
          {filtered.length} of {sets.length} sets
        </div>
      )}
      <div className="pv-sets-grid">
        {filtered.map(s => (
          <div key={s.id} className="pv-set-el" onClick={() => onPickSet(s)}>
            {s.images?.logo
              ? <img className="pv-set-logo" src={s.images.logo} alt={s.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <div className="pv-set-logo" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ fontSize: 10, color: "var(--t3)" }}>{s.series} • {s.releaseDate}</div>
              <div style={{ fontSize: 10, color: "var(--t3)" }}>{s.total} cards</div>
            </div>
            {s.images?.symbol && <img className="pv-set-sym" src={s.images.symbol} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Set Detail ─── */
export function SetCardsView({ set, onBack, onOpen }: { set: TCGSet; onBack: () => void; onOpen: OnOpen }) {
  const [cards, setCards] = useState<TCGCard[] | null>(null);
  const [showBox, setShowBox] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const load = () => {
    setErr(null);
    setCards(null);
    setTotal(0);
    getAllCardsBySet(set.id, (page, tot) => {
      setCards(page);
      setTotal(tot);
    }, set.name, set.lang || "en")
      .then(r => { setCards(r.data); setTotal(r.totalCount); })
      .catch((e: any) => {
        setCards([]);
        setErr(e?.message || "Could not load this set. Try again.");
      });
  };
  useEffect(() => { load(); }, [set.id]);
  return (
    <div className="pad">
      <button className="pv-back" onClick={onBack}>← All sets</button>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {set.images?.logo && <img src={set.images.logo} alt={set.name} style={{ height: 44 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 24, letterSpacing: 2 }}>{set.name.toUpperCase()}</div>
          <div style={{ color: "var(--t3)", fontSize: 11 }}>{set.series} • {cards ? `${cards.length}${total && cards.length < total ? ` / ${total}` : total ? ` / ${total}` : ""}` : set.total} cards • {set.releaseDate}</div>
        </div>
        <button
          className="pv-btn pv-btn-fill"
          onClick={() => setShowBox(s => !s)}
          style={{ whiteSpace: "nowrap" }}
        >
          {showBox ? "✕ Hide Box" : "🎁 Find Sealed Booster Box"}
        </button>
      </div>
      {showBox && (
        <div style={{ marginBottom: 16 }}>
          <PriceComparePanel query={`${set.name} booster box sealed pokemon`} />
        </div>
      )}
      {err && (
        <div className="pv-empty">
          <div className="pv-empty-title">SET DIDN’T LOAD</div>
          <div>{err}</div>
          <button className="pv-btn pv-btn-fill" style={{ marginTop: 12 }} onClick={load}>Retry</button>
        </div>
      )}
      {!err && cards && cards.length === 0 && (
        <div className="pv-empty">No cards in this set yet.</div>
      )}
      <div className="pv-card-grid">
        {!cards && !err && Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
        {cards?.map(c => <CardTile key={c.id} card={c} onClick={() => onOpen(c.id)} />)}
      </div>
    </div>
  );
}

/* ─── Search ─── */
export function SearchView({ onOpen }: { onOpen: OnOpen }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [cards, setCards] = useState<TCGCard[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lang] = usePrintLang();

  const runSearch = async (query: string, p = 1) => {
    if (!query.trim()) return;
    setLoading(true);
    setActive(query);
    setErr(null);
    const raw = query.trim();
    const queries = lang !== "en" || /[:*]/.test(raw) ? [raw] : [`name:"${raw}*"`, `name:${raw}*`, `name:${raw}`];
    try {
      let lastErr: unknown = null;
      let res: { data: TCGCard[]; totalCount: number } | null = null;
      for (const tcgQuery of queries) {
        try {
          const r = await searchCards({ q: tcgQuery, page: p, pageSize: 50, orderBy: "-set.releaseDate", lang });
          res = r;
          if (r.data.length) break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!res) throw lastErr ?? new Error("Search failed");
      setCards(p === 1 ? res.data : [...(cards ?? []), ...res.data]);
      setTotal(res.totalCount);
      setPage(p);
    } catch (e: any) {
      setCards([]);
      setErr(e?.message || "Search failed. The card API is busy — retry in a moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) runSearch(active, 1);
    else setCards(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run current query when print language changes
  }, [lang]);

  return (
    <div className="pad">
      <PrintLangBar />
      <form onSubmit={e => { e.preventDefault(); runSearch(q, 1); }}>
        <input
          className="pv-input mb-3"
          placeholder={searchPlaceholder(lang)}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </form>
      <div className="flex gap-2 flex-wrap mb-4">
        {searchChips(lang).map(n => (
          <button key={n} className="pv-pill" onClick={() => { setQ(n); runSearch(n, 1); }}>{n}</button>
        ))}
      </div>
      {!cards && !loading && <div className="pv-empty"><div className="pv-empty-icon">🔍</div><div className="pv-empty-title">SEARCH POKÉMON CARDS</div><div>Try a Pokémon name above</div></div>}
      {loading && page === 1 && (
        <div className="pv-card-grid">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}
      {cards && cards.length > 0 && (
        <>
          <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 10 }}>{total.toLocaleString("en-US")} results for "{active}"</div>
          <div className="pv-card-grid">
            {cards.map(c => <CardTile key={c.id} card={c} onClick={() => onOpen(c.id)} />)}
          </div>
          {cards.length < total && (
            <button
              onClick={() => runSearch(active, page + 1)}
              disabled={loading}
              style={{ display: "block", width: "100%", marginTop: 16, padding: 12, background: "rgba(255,255,255,.06)", border: "1px solid var(--brd)", borderRadius: 8, color: "var(--t2)", cursor: "pointer", fontWeight: 600 }}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
      {cards && cards.length === 0 && (
        <div className="pv-empty">
          <div className="pv-empty-title">{err ? "SEARCH FAILED" : "NO CARDS FOUND"}</div>
          <div>{err ?? `Nothing matched "${active}".`}</div>
          {err && <button className="pv-btn pv-btn-fill" style={{ marginTop: 12 }} onClick={() => runSearch(active, 1)}>Retry</button>}
        </div>
      )}
    </div>
  );
}

/* ─── Vault (Comic-Vault style home) ─── */
export function VaultView({ onOpen }: { onOpen: OnOpen }) {
  const { vault, wish, totalValue, totalCards, uniqueCards, removeFromVault } = useVault();
  const entries = Object.values(vault);
  const sorted = entries.slice().sort((a, b) => b.addedAt - a.addedAt);
  const topByValue = entries.slice().sort((a, b) => getMarketPrice(b.card) - getMarketPrice(a.card));

  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <div>
      <div className="pv-greet">
        <div className="pv-greet-hi">MY VAULT</div>
        <div className="pv-greet-sub">{greeting}, Trainer.</div>
      </div>

      <div className="pad" style={{ paddingTop: 4 }}>
        <div className="pv-stat-grid">
          <div className="pv-stat-card gold">
            <span className="pv-stat-ico">💰</span>
            <div className="pv-stat-lbl">Vault Value</div>
            <div className="pv-stat-val">{formatPrice(totalValue)}</div>
            <div className="pv-stat-sub">Live market estimate</div>
          </div>
          <div className="pv-stat-card orange">
            <span className="pv-stat-ico">🎴</span>
            <div className="pv-stat-lbl">Total Cards</div>
            <div className="pv-stat-val">{totalCards}</div>
            <div className="pv-stat-sub">Across your collection</div>
          </div>
          <div className="pv-stat-card cyan">
            <span className="pv-stat-ico">✨</span>
            <div className="pv-stat-lbl">Unique Cards</div>
            <div className="pv-stat-val">{uniqueCards}</div>
            <div className="pv-stat-sub">Distinct printings</div>
          </div>
          <div className="pv-stat-card pink">
            <span className="pv-stat-ico">⭐</span>
            <div className="pv-stat-lbl">Wishlist</div>
            <div className="pv-stat-val">{Object.keys(wish).length}</div>
            <div className="pv-stat-sub">Tracked targets</div>
          </div>
        </div>
      </div>

      <div className="pv-toolbar">
        <button className="pv-tool-btn primary" onClick={() => alert("Import flow coming soon — paste a TCGPlayer/CSV export.")}>
          ⤓ Import Collection
        </button>
        <button className="pv-tool-btn gold" onClick={() => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "search" }))}>
          + Add Card
        </button>
        <button className="pv-tool-btn" onClick={() => exportJSON(entries)}>⤒ Export JSON</button>
      </div>

      {entries.length === 0 ? (
        <div className="pad">
          <div className="pv-empty">
            <div className="pv-empty-icon">🔒</div>
            <div className="pv-empty-title">VAULT EMPTY</div>
            <div>Add cards from Discover, Market, Scan, or Search.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
              <button className="pv-btn pv-btn-fill" onClick={() => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "search" }))}>Search cards</button>
              <button className="pv-btn pv-btn-out" onClick={() => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "discover" }))}>Discover</button>
              <button className="pv-btn pv-btn-out" onClick={() => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "scan" }))}>Scan a card</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pad">
          <CollectionInsightsCard />
          <div className="pv-section-title" style={{ marginTop: 22 }}>LATEST ADDITIONS</div>
          <div className="pv-latest">
            {sorted.slice(0, 8).map(e => (
              <div key={e.card.id} className="pv-latest-row" onClick={() => onOpen(e.card.id)}>
                <img className="pv-latest-img" {...hdImg(e.card)} alt={e.card.name} loading="lazy" />
                <div className="pv-latest-meta">
                  <div className="pv-latest-name">{e.card.name}</div>
                  <div className="pv-latest-sub">{e.card.set.name} • #{e.card.number}</div>
                  {e.card.rarity && (
                    <span className="pv-latest-rar" style={{ background: "rgba(255,255,255,.05)", color: "var(--t2)", border: "1px solid var(--brd)" }}>
                      {e.card.rarity}
                    </span>
                  )}
                </div>
                <div className="pv-latest-price">
                  <div className="pv-latest-price-v">{formatPrice(getMarketPrice(e.card) * e.qty)}</div>
                  <div className="pv-latest-price-q">×{e.qty} @ {formatPrice(getMarketPrice(e.card))}</div>
                  <CheapestPill
                    query={`${e.card.name} ${e.card.set.name} ${e.card.number}`}
                    marketPrice={getMarketPrice(e.card)}
                    cardId={e.card.id}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pv-section-title" style={{ marginTop: 22 }}>TOP HOLDINGS</div>
          <div className="pv-card-grid">
            {topByValue.map(e => (
              <CardTile
                key={e.card.id}
                card={e.card}
                qty={e.qty}
                onClick={() => onOpen(e.card.id)}
                onRemove={() => removeFromVault(e.card.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function exportJSON(entries: { card: TCGCard; qty: number; addedAt: number }[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pokevault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Wishlist ─── */
export function WishlistView({ onOpen }: { onOpen: OnOpen }) {
  const { wish, toggleWish } = useVault();
  const cards = Object.values(wish);
  if (cards.length === 0) {
    return (
      <div className="pad">
        <div className="pv-empty">
          <div className="pv-empty-icon">⭐</div>
          <div className="pv-empty-title">WISHLIST EMPTY</div>
          <div>Tap ☆ on any card to wishlist it</div>
        </div>
      </div>
    );
  }
  return (
    <div className="pad">
      <div className="pv-section-title">{cards.length} WISHED</div>
      <div className="pv-card-grid">
        {cards.map(c => (
          <CardTile key={c.id} card={c} onClick={() => onOpen(c.id)} onRemove={() => toggleWish(c)} />
        ))}
      </div>
    </div>
  );
}
