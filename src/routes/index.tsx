import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { TCGSet } from "@/lib/pokemon-api";
import { useVault, formatPrice } from "@/lib/vault";
import { CardDetail } from "@/components/pokevault/CardDetail";
import {
  DiscoverView, MarketView, SetsView, SetCardsView,
  SearchView, VaultView, WishlistView,
} from "@/components/pokevault/views";
import { BattleHub } from "@/components/pokevault/Battle";
import { ScannerView } from "@/components/pokevault/Scanner";
import { SellView, BuyView } from "@/components/pokevault/Marketplace";
import { Paywall } from "@/components/pokevault/Paywall";
import { useToast } from "@/components/pokevault/CardTile";
import { MusicPlayer } from "@/components/pokevault/MusicPlayer";
import { GameBoyView } from "@/components/pokevault/GameBoy";
import { FriendsView } from "@/components/pokevault/Friends";
import { AdventureView } from "@/components/pokevault/Adventure";
import { PokedexHub } from "@/components/pokevault/PokedexHub";
import { usePremium } from "@/lib/premium";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PokéVault Pro — Pokémon TCG Prices, Scanner & Collection Tracker" },
      { name: "description", content: "Scan Pokémon cards, track market prices, battle with your collection, find best buy prices, and list to every marketplace from one Vault." },
    ],
  }),
  component: Index,
});

type Tab = "discover" | "market" | "sets" | "vault" | "search" | "wishlist" | "battle" | "scan" | "sell" | "buy" | "pricing" | "gb" | "friends" | "adventure" | "pokedex";

const TABS: { id: Tab; label: string; pro?: boolean }[] = [
  { id: "pokedex", label: "📕 Pokédex" },
  { id: "vault", label: "🔒 Vault" },
  { id: "scan", label: "📸 Scan" },
  { id: "buy", label: "🛒 Buy", pro: true },
  { id: "sell", label: "💰 Sell", pro: true },
  { id: "discover", label: "🏠 Discover" },
  { id: "market", label: "📈 Market" },
  { id: "sets", label: "📦 Sets" },
  { id: "search", label: "🔍 Search" },
  { id: "wishlist", label: "⭐ Wishlist" },
  { id: "battle", label: "⚔ Battle" },
  { id: "gb", label: "🎮 Game Boy" },
  { id: "friends", label: "🤝 Friends" },
  { id: "adventure", label: "🌍 Adventure" },
  { id: "pricing", label: "⚡ Pricing" },
];

function Index() {
  const nav = useNavigate();
  const { user, loading, isOwner, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("vault");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [setView, setSetView] = useState<TCGSet | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { totalValue } = useVault();
  const { isPro, tier, scansLeft, scansUsed, FREE_SCAN_LIMIT } = usePremium();
  const { show, node } = useToast();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => { if (detailId) window.scrollTo({ top: 0 }); }, [detailId]);
  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent).detail as Tab;
      setDetailId(null); setSetView(null); setTab(t);
    };
    window.addEventListener("pv-goto", h);
    return () => window.removeEventListener("pv-goto", h);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const openCard = (id: string) => setDetailId(id);


  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #2a0a4a 0%, #1a0033 40%, #0d001a 100%)", padding: "16px 0" }}>
      {node}
      <div className="pv-gb-shell">
        <div className="pv-gb-screen-frame">
          <div className="pv-gb-screen-meta">
            <span>● DOT MATRIX WITH STEREO SOUND</span>
            <span className="pv-gb-power"><span className="pv-gb-power-dot" /> POWER</span>
          </div>
          <div className="pv-gb-lcd">
            <header className="pv-hdr">
              <div className="flex items-center gap-3">
                <div className="pv-pokeball" aria-hidden />
                <button
                  className="pv-dex-hub-btn"
                  onClick={() => { setDetailId(null); setSetView(null); setTab("pokedex"); }}
                  title="Pokédex Hub"
                >
                  Pokédex Hub
                </button>
                <button
                  className="pv-dex-hub-btn"
                  style={{ fontSize: 12 }}
                  onClick={async () => {
                    const { refreshAllImageCaches } = await import("@/lib/card-images");
                    const n = refreshAllImageCaches();
                    alert(`Cleared ${n} cached entries. Reloading for fresh HD art…`);
                    location.reload();
                  }}
                  title="Re-pull all card art in HD"
                >
                  ↻ HD Art
                </button>
              </div>
              <div className="pv-hdr-val">{formatPrice(totalValue)}</div>
              {isPro && (
                <div title={tier === "elite" ? "Elite Champion" : "Pro Trainer"} className="pv-gb-badge">
                  ★ {isOwner ? "owner" : tier}
                </div>
              )}
              {!isPro && (
                <div title="Free trial submissions remaining" className="pv-gb-badge">
                  {scansLeft}/{FREE_SCAN_LIMIT} left
                </div>
              )}
              <button className="pv-gear" onClick={() => setSettingsOpen(s => !s)} aria-label="Settings">⚙</button>
              <button
                onClick={async () => { await signOut(); nav({ to: "/login" }); }}
                className="pv-gb-badge"
                style={{ cursor: "pointer" }}
                aria-label="Sign out"
              >Sign out</button>
            </header>
            <div className="pv-energy-strip" aria-hidden />

            {settingsOpen && <SettingsPanel onToast={show} />}

            <nav className="pv-tabs hide-scroll">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`pv-tab ${tab === t.id && !detailId ? "on" : ""}`}
                  onClick={() => { setDetailId(null); setSetView(null); setTab(t.id); }}
                  title={t.pro && !isPro ? "Pro feature" : undefined}
                >
                  {t.label}{t.pro && !isPro ? " 🔒" : ""}
                </button>
              ))}
            </nav>

            {detailId ? (
              <CardDetail cardId={detailId} onBack={() => setDetailId(null)} onToast={show} />
            ) : setView ? (
              <SetCardsView set={setView} onBack={() => setSetView(null)} onOpen={openCard} />
            ) : (
              <>
                {tab === "discover" && <DiscoverView onOpen={openCard} onTab={(t) => setTab(t as Tab)} />}
                {tab === "market" && <MarketView onOpen={openCard} />}
                {tab === "sets" && <SetsView onPickSet={setSetView} />}
                {tab === "vault" && <VaultView onOpen={openCard} />}
                {tab === "search" && <SearchView onOpen={openCard} />}
                {tab === "wishlist" && <WishlistView onOpen={openCard} />}
                {tab === "battle" && <BattleHub onExit={() => setTab("vault")} />}
                {tab === "gb" && <GameBoyView />}
                {tab === "friends" && <FriendsView onOpenCard={openCard} />}
                {tab === "adventure" && <AdventureView />}
                {tab === "scan" && <ScannerView onOpen={openCard} />}
                {tab === "pokedex" && <PokedexHub />}
                {tab === "sell" && (isPro ? <SellView /> : <Paywall reason="Selling tools are a Pro feature. Unlock listings to 11 marketplaces." />)}
                {tab === "buy" && (isPro ? <BuyView onOpen={openCard} /> : <Paywall reason="Best-price finder is a Pro feature. Unlock to compare prices across 11 marketplaces." />)}
                {tab === "pricing" && <Paywall />}
              </>
            )}

            <footer className="pv-gb-footer">
              Card data &amp; prices from <a href="https://pokemontcg.io" target="_blank" rel="noreferrer">pokemontcg.io</a>
            </footer>
          </div>
        </div>
        <div className="pv-gb-controls">
          <div className="pv-gb-dpad" aria-hidden>
            <span className="pv-gb-dpad-h" />
            <span className="pv-gb-dpad-v" />
          </div>
          <div className="pv-gb-ab">
            <div className="pv-gb-btn">B</div>
            <div className="pv-gb-btn">A</div>
          </div>
        </div>
        <div className="pv-gb-startsel" aria-hidden>
          <span><span className="pv-gb-pill" /> SELECT</span>
          <span><span className="pv-gb-pill" /> START</span>
        </div>
        <div className="pv-gb-speaker" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <span key={i} />)}
        </div>
      </div>
      <MusicPlayer />
    </div>
  );
}

function SettingsPanel({ onToast }: { onToast: (m: string) => void }) {
  const [key, setKey] = useState("");
  useEffect(() => { setKey(localStorage.getItem("pokeApiKey") ?? ""); }, []);
  return (
    <div className="pv-settings">
      <div className="flex gap-2 items-center flex-wrap">
        <div style={{ fontSize: 11, color: "var(--t2)", fontWeight: 600 }}>POKEMONTCG.IO API KEY</div>
        <input className="pv-key-in" placeholder="Optional — paste key" value={key} onChange={e => setKey(e.target.value)} />
        <button className="pv-ksave" onClick={() => { localStorage.setItem("pokeApiKey", key); onToast("Key saved"); }}>Save</button>
        <button className="pv-kclear" onClick={() => { localStorage.removeItem("pokeApiKey"); setKey(""); onToast("Key cleared"); }}>Clear</button>
      </div>
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 7 }}>
        Without key: ~100 req/day. With key: 20,000+/day. Free key at dev.pokemontcg.io
      </div>
    </div>
  );
}
