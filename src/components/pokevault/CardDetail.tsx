import { useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getCard, getMarketPrice, getRarityColor, stubCardFromId } from "@/lib/pokemon-api";
import { getPrintLang, printLangMeta } from "@/lib/print-lang";
import { formatPrice } from "@/lib/vault";
import { CardActions } from "./CardTile";
import { getPokedex, type Pokedex } from "@/lib/pokeapi";
import { getAltArtworks, type AltArt } from "@/lib/tcgdex";
import { getEbaySold, type EbayResponse } from "@/lib/ebay";
import { fetchBulbapedia, type BulbaInfo } from "@/lib/bulbapedia";
import { PriceComparePanel } from "./PriceCompare";
import { QuickStrike } from "./QuickStrike";
import { fallbackCardImages, resolveHDImage } from "@/lib/card-images";

export function CardDetail({ cardId, onBack, onToast }: { cardId: string; onBack: () => void; onToast: (m: string) => void }) {
  const [card, setCard] = useState<TCGCard | null>(() => stubCardFromId(cardId));
  const [loaded, setLoaded] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const failedImgs = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stub = stubCardFromId(cardId);
    setCard(stub);
    setLoaded(false);
    setDegraded(false);
    setImgSrc(stub.images?.large || stub.images?.small || "");
    failedImgs.current = new Set();
    let live = true;
    getCard(cardId, getPrintLang())
      .then((c) => {
        if (!live || !c) return;
        setCard(c);
        setDegraded(c.name === stub.name && c.name === cardId.replace(/-/g, " "));
      })
      .catch(() => {
        if (live) setDegraded(true);
      });
    return () => {
      live = false;
    };
  }, [cardId]);

  useEffect(() => {
    if (!card) return;
    failedImgs.current = new Set();
    setLoaded(false);
    const list = fallbackCardImages(card);
    setImgSrc(list[0] || card.images?.large || card.images?.small || "");
    resolveHDImage(card).then((url) => {
      if (url && url !== (card.images?.large || "") && !failedImgs.current.has(url)) {
        setImgSrc(url);
      }
    }).catch(() => {});
  }, [card]);

  if (!card) return <div className="pv-empty">Loading…</div>;

  const market = getMarketPrice(card);
  const tcgPrices = card.tcgplayer?.prices ?? {};
  const cmPrices = card.cardmarket?.prices;

  return (
    <div className="pad">
      <button className="pv-back" onClick={onBack}>← Back</button>
      {degraded && (
        <div style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 10px", padding: "8px 10px", background: "rgba(255,215,0,.08)", border: "1px solid var(--gold-brd)", borderRadius: 8 }}>
          Showing scan from image CDN while the catalog API recovers. Prices may be delayed.
        </div>
      )}
      <div className="pv-detail-layout">
        <div className="pv-detail-left">
          <div className="pv-detail-img-wrap">
            <div className="pv-card-skel" style={{ opacity: loaded ? 0 : 1 }} />
            <img
              className={`pv-detail-img ${loaded ? "loaded" : ""}`}
              src={imgSrc || card.images.large}
              alt={card.name}
              onLoad={() => setLoaded(true)}
              onError={() => {
                failedImgs.current.add(imgSrc);
                setLoaded(true);
                const next = fallbackCardImages(card).find((u) => u && !failedImgs.current.has(u));
                if (next) setImgSrc(next);
              }}
            />
          </div>
          <CardActions card={card} onAfterAction={onToast} />
          <QuickStrike card={card} />
          {market > 0 && (
            <div style={{
              marginTop: 10, padding: "8px 12px", background: "rgba(255,215,0,.05)",
              border: "1px solid var(--gold-brd)", borderRadius: 10, textAlign: "center"
            }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--t3)", fontWeight: 700 }}>FAIR MARKET</div>
              <div style={{ fontFamily: "Bebas Neue", fontSize: 22, color: "var(--gold)", letterSpacing: 1 }}>{formatPrice(market)}</div>
            </div>
          )}
          <div className="flex flex-col gap-1 mt-3">
            {card.tcgplayer?.url && (
              <a href={card.tcgplayer.url} target="_blank" rel="noreferrer" className="text-center text-xs" style={{ color: "#60a5fa", padding: 6 }}>
                View on TCGPlayer ↗
              </a>
            )}
            {card.cardmarket?.url && (
              <a href={card.cardmarket.url} target="_blank" rel="noreferrer" className="text-center text-xs" style={{ color: "#60a5fa", padding: 6 }}>
                View on Cardmarket ↗
              </a>
            )}
          </div>
        </div>

        <div className="pv-detail-right">
          <div className="pv-detail-name">{card.name.toUpperCase()}</div>
          <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 10 }}>
            {card.lang && card.lang !== "en" ? `${printLangMeta(card.lang).name} print • ` : ""}
            {card.set.name} • #{card.number}/{card.set.printedTotal} {card.artist && `• Illus. ${card.artist}`}
          </div>
          {card.rarity && (
            <span className="pv-rar-badge" style={{ color: getRarityColor(card.rarity), borderColor: getRarityColor(card.rarity) + "55", background: getRarityColor(card.rarity) + "18" }}>
              {card.rarity}
            </span>
          )}
          {card.types && (
            <div className="flex gap-1 mb-3 flex-wrap">
              {card.types.map(t => (
                <span key={t} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.06)" }}>{t}</span>
              ))}
            </div>
          )}
          {card.hp && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--t2)" }}>
              HP <span style={{ color: "#ff6b6b", fontWeight: 900, fontSize: 18, marginLeft: 4 }}>{card.hp}</span>
            </div>
          )}
          {card.evolvesFrom && (
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>Evolves from {card.evolvesFrom}</div>
          )}

          {card.abilities?.map((a, i) => (
            <div key={i} style={{ background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)", borderRadius: 8, padding: "9px 11px", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(139,92,246,.25)", color: "#c4b5fd", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{a.type}</span>
                <span style={{ fontWeight: 700, color: "#c4b5fd", fontSize: 12 }}>{a.name}</span>
              </div>
              <div style={{ color: "var(--t2)", fontSize: 11, lineHeight: 1.5 }}>{a.text}</div>
            </div>
          ))}

          {card.attacks?.map((atk, i) => (
            <div key={i} className="pv-atk">
              <div className="flex justify-between items-center">
                <div>
                  <div className="pv-atk-name">{atk.name}</div>
                  <div className="pv-atk-cost">Cost: {atk.cost?.join(" • ") || "—"}</div>
                </div>
                {atk.damage && <div className="pv-atk-dmg">{atk.damage}</div>}
              </div>
              {atk.text && <div className="pv-atk-text">{atk.text}</div>}
            </div>
          ))}

          {(card.weaknesses || card.resistances) && (
            <div className="flex gap-3 mt-3 mb-3 flex-wrap">
              {card.weaknesses?.map((w, i) => (
                <div key={i} style={{ fontSize: 11 }}>Weak: <strong style={{ color: "#f87171" }}>{w.type} {w.value}</strong></div>
              ))}
              {card.resistances?.map((r, i) => (
                <div key={i} style={{ fontSize: 11 }}>Resist: <strong style={{ color: "#4ade80" }}>{r.type} {r.value}</strong></div>
              ))}
            </div>
          )}

          {Object.keys(tcgPrices).length > 0 && (
            <>
              <div className="pv-section-title">TCGPLAYER PRICES (USD)</div>
              <table className="pv-price-tbl">
                <thead><tr><th>Variant</th><th>Low</th><th>Mid</th><th>Market</th><th>High</th></tr></thead>
                <tbody>
                  {Object.entries(tcgPrices).map(([k, p]) => (
                    <tr key={k}>
                      <td>{k.replace(/([A-Z])/g, " $1")}</td>
                      <td>{p.low ? formatPrice(p.low) : "—"}</td>
                      <td>{p.mid ? formatPrice(p.mid) : "—"}</td>
                      <td style={{ color: "var(--gold)", fontWeight: 700 }}>{p.market ? formatPrice(p.market) : "—"}</td>
                      <td>{p.high ? formatPrice(p.high) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {cmPrices && (
            <>
              <div className="pv-section-title">CARDMARKET (EUR)</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  ["Trend", cmPrices.trendPrice],
                  ["Avg", cmPrices.averageSellPrice],
                  ["Low", cmPrices.lowPrice],
                  ["1d", cmPrices.avg1], ["7d", cmPrices.avg7], ["30d", cmPrices.avg30],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} style={{ background: "rgba(255,255,255,.05)", padding: "8px 12px", borderRadius: 8, textAlign: "center", minWidth: 70 }}>
                    <div style={{ color: "var(--t3)", fontSize: 9 }}>{k}</div>
                    <div style={{ color: "#60a5fa", fontWeight: 700, fontFamily: "monospace" }}>€{(v as number).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {card.flavorText && (
            <div style={{ marginTop: 14, padding: "10px 13px", background: "rgba(255,255,255,.04)", borderRadius: 8, color: "var(--t2)", fontSize: 12, fontStyle: "italic", lineHeight: 1.6 }}>
              "{card.flavorText}"
            </div>
          )}

          <PokedexPanel cardName={card.name} />
          <BulbapediaPanel cardName={card.name} />
          <AltArtworksPanel card={card} />
          <PriceComparePanel query={`${card.name} ${card.set.name} ${card.number ?? ""}`.trim()} cardId={card.id} />
          <EbaySoldPanel query={`${card.name} ${card.set.name} ${card.number ?? ""}`.trim()} />
        </div>
      </div>
    </div>
  );
}

function PokedexPanel({ cardName }: { cardName: string }) {
  const [data, setData] = useState<Pokedex | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); getPokedex(cardName).then(d => { setData(d); setLoading(false); }); }, [cardName]);
  if (loading) return <div className="pv-panel"><div className="pv-panel-title">POKÉDEX</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Loading PokeAPI…</div></div>;
  if (!data) return null;
  const maxStat = Math.max(...data.stats.map(s => s.base), 100);
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">POKÉDEX #{String(data.id).padStart(3, "0")}</div>
        <div className="pv-panel-tag">PokeAPI</div>
      </div>
      <div className="pv-pokedex-grid">
        {data.artwork && <img src={data.artwork} alt={data.name} />}
        <div>
          {data.genus && <div style={{ fontSize: 11, color: "var(--gold)", letterSpacing: 1, marginBottom: 4 }}>{data.genus.toUpperCase()}</div>}
          {data.flavorText && <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>"{data.flavorText}"</div>}
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>
            <div><span style={{ color: "var(--t3)" }}>HT</span> {(data.height / 10).toFixed(1)} m</div>
            <div><span style={{ color: "var(--t3)" }}>WT</span> {(data.weight / 10).toFixed(1)} kg</div>
          </div>
          {data.stats.map(s => (
            <div className="pv-stat-bar" key={s.name}>
              <div className="pv-stat-bar-lbl">{s.name.replace("special-", "sp.")}</div>
              <div className="pv-stat-bar-bar"><div className="pv-stat-bar-fill" style={{ width: `${Math.min(100, (s.base / maxStat) * 100)}%` }} /></div>
              <div className="pv-stat-bar-val">{s.base}</div>
            </div>
          ))}
          {data.evolutionChain.length > 1 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--t3)" }}>
              Evolution: <span style={{ color: "var(--t1)", textTransform: "capitalize" }}>{data.evolutionChain.join(" → ")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AltArtworksPanel({ card }: { card: TCGCard }) {
  const [arts, setArts] = useState<AltArt[] | null>(null);
  useEffect(() => { setArts(null); getAltArtworks(card).then(setArts).catch(() => setArts([])); }, [card.id]);
  if (!arts) return <div className="pv-panel"><div className="pv-panel-title">INTERNATIONAL ARTWORKS</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Searching TCGdex…</div></div>;
  if (arts.length === 0) return null;
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">INTERNATIONAL PRINTINGS</div>
        <div className="pv-panel-tag">TCGdex • {arts.length}</div>
      </div>
      <div className="pv-alt-strip hide-scroll">
        {arts.map(a => (
          <a key={a.lang} className="pv-alt" href={a.url} target="_blank" rel="noreferrer">
            <img src={a.url} alt={a.lang} loading="lazy" />
            <div className="pv-alt-lbl">{a.lang}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function EbaySoldPanel({ query }: { query: string }) {
  const [data, setData] = useState<EbayResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setData(null); setErr(null); getEbaySold(query).then(setData).catch(e => setErr(String(e))); }, [query]);
  return (
    <div className="pv-panel">
      <div className="pv-panel-hdr">
        <div className="pv-panel-title">EBAY SOLD COMPS</div>
        <div className="pv-panel-tag">Last completed listings</div>
      </div>
      {!data && !err && <div style={{ fontSize: 11, color: "var(--t3)" }}>Scanning eBay…</div>}
      {err && <div style={{ fontSize: 11, color: "#f87171" }}>Failed to load eBay data.</div>}
      {data?.summary && (
        <div className="pv-ebay-summary">
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">SOLD</div><div className="pv-ebay-stat-val" style={{ color: "var(--t1)" }}>{data.summary.count}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">MEDIAN</div><div className="pv-ebay-stat-val">${data.summary.median.toFixed(0)}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">AVG</div><div className="pv-ebay-stat-val">${data.summary.avg.toFixed(0)}</div></div>
          <div className="pv-ebay-stat"><div className="pv-ebay-stat-lbl">RANGE</div><div className="pv-ebay-stat-val" style={{ fontSize: 11 }}>${data.summary.min.toFixed(0)}-${data.summary.max.toFixed(0)}</div></div>
        </div>
      )}
      {data?.listings.slice(0, 6).map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="pv-ebay-row" style={{ textDecoration: "none", color: "inherit" }}>
          {l.image ? <img src={l.image} alt="" loading="lazy" /> : <div style={{ width: 40, height: 40, background: "var(--s2)", borderRadius: 4 }} />}
          <div>
            <div className="pv-ebay-title">{l.title}</div>
            {l.soldDate && <div style={{ fontSize: 9, color: "var(--t3)" }}>Sold {l.soldDate}</div>}
          </div>
          <div className="pv-ebay-price">{l.price}</div>
        </a>
      ))}
      {data && data.listings.length === 0 && !err && (
        <div style={{ fontSize: 11, color: "var(--t3)" }}>No recent sold listings found.</div>
      )}
    </div>
  );
}

function BulbapediaPanel({ cardName }: { cardName: string }) {
  const [info, setInfo] = useState<BulbaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchBulbapedia(cardName).then(setInfo).finally(() => setLoading(false));
  }, [cardName]);
  if (loading) return (
    <div className="pv-bulba-panel">
      <div className="pv-bulba-head"><span>📖</span>BULBAPEDIA</div>
      <div style={{ fontSize: 11, color: "var(--t3)" }}>Looking up…</div>
    </div>
  );
  if (!info) return null;
  return (
    <div className="pv-bulba-panel">
      <div className="pv-bulba-head"><span>📖</span>BULBAPEDIA · {info.title}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {info.image && (
          <img src={info.image} alt={info.title} style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,.04)", padding: 6, flexShrink: 0 }} loading="lazy" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 8 }}>{info.extract || "No summary available."}</p>
          <a href={info.url} target="_blank" rel="noreferrer" style={{ color: "var(--gold)", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            READ FULL ENTRY →
          </a>
        </div>
      </div>
    </div>
  );
}
