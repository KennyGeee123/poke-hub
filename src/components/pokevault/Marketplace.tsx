import { useMemo, useState } from "react";
import { hdImg } from "@/lib/card-images";
import { useVault, formatPrice } from "@/lib/vault";
import { getMarketPrice, searchCards, type TCGCard } from "@/lib/pokemon-api";

// ---------- Marketplace link builders ----------
// Every link below opens a real, prefilled search/listing page on the target
// marketplace. We can't actually post inventory to these sites from the browser
// (each one requires its own OAuth + seller account), but deep-linking the
// listing/search flow gets the user to the same screen with one click.

type MP = {
  id: string;
  name: string;
  emoji: string;
  // "sell" = open the seller listing flow prefilled with the card name
  sell: (card: TCGCard) => string;
  // "buy"  = open a buyer search prefilled with the card name (+set/number)
  buy: (q: string) => string;
  soldComps?: (q: string) => string;
};

const enc = encodeURIComponent;

const cardQuery = (c: TCGCard) =>
  `${c.name} ${c.set?.name ?? ""} ${c.number ?? ""}`.trim();

const MARKETS: MP[] = [
  {
    id: "ebay",
    name: "eBay",
    emoji: "🟦",
    sell: (c) => `https://www.ebay.com/sl/sell?title=${enc(cardQuery(c) + " Pokemon Card")}`,
    buy:  (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q + " pokemon card")}&_sacat=183454`,
    soldComps: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q + " pokemon")}&LH_Sold=1&LH_Complete=1&_sacat=183454`,
  },
  {
    id: "tcgplayer",
    name: "TCGplayer",
    emoji: "🟠",
    sell: () => `https://store.tcgplayer.com/sell`,
    buy:  (q) => `https://www.tcgplayer.com/search/pokemon/product?q=${enc(q)}&view=grid`,
  },
  {
    id: "cardmarket",
    name: "Cardmarket",
    emoji: "🇪🇺",
    sell: (c) => `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${enc(c.name)}`,
    buy:  (q) => `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${enc(q)}`,
  },
  {
    id: "mercari",
    name: "Mercari",
    emoji: "🟥",
    sell: (c) => `https://www.mercari.com/sell/?title=${enc(cardQuery(c) + " Pokemon Card")}`,
    buy:  (q) => `https://www.mercari.com/search/?keyword=${enc(q + " pokemon card")}&categoryIds=1571`,
  },
  {
    id: "whatnot",
    name: "Whatnot",
    emoji: "🎥",
    sell: () => `https://www.whatnot.com/sellers/apply`,
    buy:  (q) => `https://www.whatnot.com/search/${enc(q + " pokemon")}`,
  },
  {
    id: "pwcc",
    name: "PWCC",
    emoji: "🏆",
    sell: () => `https://www.pwccmarketplace.com/consign`,
    buy:  (q) => `https://www.pwccmarketplace.com/search?q=${enc(q + " pokemon")}`,
  },
  {
    id: "troll",
    name: "Troll & Toad",
    emoji: "🐲",
    sell: () => `https://www.trollandtoad.com/buylist`,
    buy:  (q) => `https://www.trollandtoad.com/search.php?search_results_action=advanced&keywords=${enc(q)}&category=4035`,
  },
  {
    id: "amazon",
    name: "Amazon",
    emoji: "📦",
    sell: () => `https://sellercentral.amazon.com/`,
    buy:  (q) => `https://www.amazon.com/s?k=${enc(q + " pokemon card")}`,
  },
  {
    id: "facebook",
    name: "Facebook MP",
    emoji: "📣",
    sell: (c) => `https://www.facebook.com/marketplace/create/item?title=${enc(cardQuery(c) + " Pokemon Card")}`,
    buy:  (q) => `https://www.facebook.com/marketplace/search/?query=${enc(q + " pokemon card")}`,
  },
  {
    id: "pricecharting",
    name: "PriceCharting",
    emoji: "📊",
    sell: () => `https://www.pricecharting.com/category/pokemon-cards`,
    buy:  (q) => `https://www.pricecharting.com/search-products?type=prices&q=${enc(q + " pokemon")}&category=pokemon-cards`,
    soldComps: (q) => `https://www.pricecharting.com/search-products?type=prices&q=${enc(q + " pokemon")}&category=pokemon-cards`,
  },
  {
    id: "130point",
    name: "130point",
    emoji: "💯",
    sell: () => `https://130point.com/`,
    buy:  (q) => `https://130point.com/sales/?q=${enc(q + " pokemon")}`,
    soldComps: (q) => `https://130point.com/sales/?q=${enc(q + " pokemon")}`,
  },
];

// ---------- SELL ----------

export function SellView() {
  const { vault, totalValue } = useVault();
  const entries = Object.values(vault).sort((a, b) => getMarketPrice(b.card) - getMarketPrice(a.card));
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const count = entries.reduce((s, e) => s + e.qty, 0);
    return { count, unique: entries.length };
  }, [entries]);

  if (!entries.length) {
    return (
      <div className="pv-mp-empty">
        <div className="pv-mp-empty-icon">💸</div>
        <div className="pv-mp-empty-title">Your vault is empty</div>
        <div className="pv-mp-empty-sub">Add cards to your vault, then list them on every major marketplace in one click.</div>
      </div>
    );
  }

  return (
    <div className="pv-mp">
      <div className="pv-mp-hero pv-mp-hero-sell">
        <div>
          <div className="pv-mp-kicker">SELL YOUR COLLECTION</div>
          <div className="pv-mp-title">List on every marketplace, instantly</div>
          <div className="pv-mp-sub">Tap a card to open prefilled listing pages on eBay, TCGplayer, Mercari, Whatnot, Cardmarket, PWCC, Facebook Marketplace and more.</div>
        </div>
        <div className="pv-mp-stats">
          <div><b>{summary.count}</b><span>cards</span></div>
          <div><b>{summary.unique}</b><span>unique</span></div>
          <div><b>{formatPrice(totalValue)}</b><span>est. value</span></div>
        </div>
      </div>

      <div className="pv-mp-mkts">
        {MARKETS.filter(m => m.id !== "pricecharting" && m.id !== "130point").map(m => (
          <div key={m.id} className="pv-mp-mkt-chip">{m.emoji} {m.name}</div>
        ))}
      </div>

      <div className="pv-mp-list">
        {entries.map(({ card, qty }) => {
          const price = getMarketPrice(card);
          const total = price * qty;
          const open = openId === card.id;
          return (
            <div key={card.id} className={`pv-mp-row ${open ? "open" : ""}`}>
              <button className="pv-mp-row-hd" onClick={() => setOpenId(open ? null : card.id)}>
                <img {...hdImg(card)} alt={card.name} loading="lazy" />
                <div className="pv-mp-row-meta">
                  <div className="pv-mp-row-name">{card.name}</div>
                  <div className="pv-mp-row-sub">{card.set?.name} · #{card.number} · ×{qty}</div>
                </div>
                <div className="pv-mp-row-price">
                  <div className="pv-mp-row-unit">{formatPrice(price)} ea</div>
                  <div className="pv-mp-row-total">{formatPrice(total)}</div>
                </div>
                <div className="pv-mp-row-caret">{open ? "▲" : "▼"}</div>
              </button>
              {open && (
                <div className="pv-mp-row-body">
                  <div className="pv-mp-row-title">List this card</div>
                  <div className="pv-mp-btns">
                    {MARKETS.map(m => (
                      <a
                        key={m.id}
                        className="pv-mp-btn"
                        href={m.sell(card)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>{m.emoji}</span> {m.name}
                      </a>
                    ))}
                  </div>
                  <div className="pv-mp-row-title" style={{ marginTop: 14 }}>Check sold comps before pricing</div>
                  <div className="pv-mp-btns">
                    {MARKETS.filter(m => m.soldComps).map(m => (
                      <a key={`c-${m.id}`} className="pv-mp-btn pv-mp-btn-ghost" href={m.soldComps!(cardQuery(card))} target="_blank" rel="noreferrer">
                        🧾 {m.name} sold
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- BUY ----------

export function BuyView({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TCGCard[]>([]);
  const [picked, setPicked] = useState<TCGCard | null>(null);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setPicked(null);
    try {
      const safe = term.replace(/"/g, "");
      let r = await searchCards({ q: `name:"${safe}"*`, pageSize: 24, orderBy: "-set.releaseDate" });
      if (!r.data?.length) {
        r = await searchCards({ q: `name:${safe.split(" ")[0]}*`, pageSize: 24, orderBy: "-set.releaseDate" });
      }
      setResults(r.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const query = picked ? cardQuery(picked) : q;

  return (
    <div className="pv-mp">
      <div className="pv-mp-hero pv-mp-hero-buy">
        <div>
          <div className="pv-mp-kicker">FIND THE BEST PRICE</div>
          <div className="pv-mp-title">Buy any card for less</div>
          <div className="pv-mp-sub">Search a card, then jump to live listings across every major marketplace and sold-comp aggregator on the web.</div>
        </div>
      </div>

      <div className="pv-mp-search">
        <input
          className="pv-mp-input"
          placeholder="Search any card — e.g. Charizard, Pikachu Illustrator, Umbreon VMAX…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="pv-mp-go" onClick={search} disabled={loading || !q.trim()}>
          {loading ? "Searching…" : "🔍 Search"}
        </button>
      </div>

      {/* Quick buy: search the raw query on every marketplace without picking a card */}
      {q.trim() && !picked && (
        <>
          <div className="pv-mp-section-title">⚡ Best-price quick search for "<i>{q.trim()}</i>"</div>
          <div className="pv-mp-btns pv-mp-btns-wide">
            {MARKETS.map(m => (
              <a key={m.id} className="pv-mp-btn" href={m.buy(q.trim())} target="_blank" rel="noreferrer">
                <span>{m.emoji}</span> {m.name}
              </a>
            ))}
          </div>
        </>
      )}

      {/* Card picker grid */}
      {results.length > 0 && !picked && (
        <>
          <div className="pv-mp-section-title">🎴 Pick the exact print for more accurate links</div>
          <div className="pv-mp-grid">
            {results.map(c => (
              <button key={c.id} className="pv-mp-card" onClick={() => setPicked(c)}>
                <img {...hdImg(c)} alt={c.name} loading="lazy" />
                <div className="pv-mp-card-name">{c.name}</div>
                <div className="pv-mp-card-sub">{c.set?.name} · #{c.number}</div>
                <div className="pv-mp-card-price">{formatPrice(getMarketPrice(c))}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Picked card buy panel */}
      {picked && (
        <div className="pv-mp-picked">
          <div className="pv-mp-picked-hd">
            <img src={picked.images.large || picked.images.small} alt={picked.name} />
            <div>
              <div className="pv-mp-picked-name">{picked.name}</div>
              <div className="pv-mp-picked-sub">{picked.set?.name} · #{picked.number}</div>
              <div className="pv-mp-picked-price">Market: <b>{formatPrice(getMarketPrice(picked))}</b></div>
              <div className="pv-mp-picked-actions">
                <button className="pv-mp-btn pv-mp-btn-ghost" onClick={() => setPicked(null)}>← Back to results</button>
                <button className="pv-mp-btn pv-mp-btn-ghost" onClick={() => onOpen(picked.id)}>Open card details →</button>
              </div>
            </div>
          </div>

          <div className="pv-mp-section-title">🛒 Buy "{picked.name}" on</div>
          <div className="pv-mp-btns pv-mp-btns-wide">
            {MARKETS.map(m => (
              <a key={m.id} className="pv-mp-btn" href={m.buy(query)} target="_blank" rel="noreferrer">
                <span>{m.emoji}</span> {m.name}
              </a>
            ))}
          </div>

          <div className="pv-mp-section-title" style={{ marginTop: 18 }}>📊 Check sold comps</div>
          <div className="pv-mp-btns pv-mp-btns-wide">
            {MARKETS.filter(m => m.soldComps).map(m => (
              <a key={`b-${m.id}`} className="pv-mp-btn pv-mp-btn-ghost" href={m.soldComps!(query)} target="_blank" rel="noreferrer">
                🧾 {m.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {!q.trim() && !results.length && (
        <div className="pv-mp-empty" style={{ marginTop: 20 }}>
          <div className="pv-mp-empty-icon">🔎</div>
          <div className="pv-mp-empty-title">Start by searching a card</div>
          <div className="pv-mp-empty-sub">We'll pull live listings from eBay, TCGplayer, Cardmarket, Mercari, Whatnot, PWCC, Amazon, Facebook Marketplace, PriceCharting and 130point — sorted so you can spot the best deal fast.</div>
        </div>
      )}
    </div>
  );
}
