import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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

const TABS: { id: Tab; label: string; pro?: boolean; cluster?: "play" }[] = [
  { id: "pokedex", label: "Pokédex" },
  { id: "vault", label: "Vault" },
  { id: "scan", label: "Scan" },
  { id: "buy", label: "Buy", pro: true },
  { id: "sell", label: "Sell", pro: true },
  { id: "discover", label: "Discover" },
  { id: "market", label: "Market" },
  { id: "sets", label: "Sets" },
  { id: "search", label: "Search" },
  { id: "wishlist", label: "Wishlist" },
  { id: "adventure", label: "Adventure", cluster: "play" },
  { id: "gb", label: "Game Boy", cluster: "play" },
  { id: "battle", label: "Battle", cluster: "play" },
  { id: "friends", label: "Friends" },
  { id: "pricing", label: "Pricing" },
];

function Index() {
  const nav = useNavigate();
  const { user, isOwner, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("pokedex");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [setView, setSetView] = useState<TCGSet | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { totalValue } = useVault();
  const { isPro, tier, scansLeft, FREE_SCAN_LIMIT } = usePremium();
  const { show, node } = useToast();


  useEffect(() => { if (detailId) window.scrollTo({ top: 0 }); }, [detailId]);
  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent).detail as Tab;
      setDetailId(null); setSetView(null); setTab(t);
    };
    window.addEventListener("pv-goto", h);
    return () => window.removeEventListener("pv-goto", h);
  }, []);

  const openCard = (id: string) => setDetailId(id);

  const renderTabs = () => {
    const nodes: ReactNode[] = [];
    let playOpened = false;
    TABS.forEach((t) => {
      if (t.cluster === "play" && !playOpened) {
        playOpened = true;
        nodes.push(
          <span key="play-cluster" className="pv-tab-cluster" role="group" aria-label="Play">
            <span className="pv-tab-cluster-lbl">Play</span>
            {TABS.filter(x => x.cluster === "play").map(pt => (
              <button
                key={pt.id}
                className={`pv-tab ${tab === pt.id && !detailId ? "on" : ""}`}
                onClick={() => { setDetailId(null); setSetView(null); setTab(pt.id); }}
                title={pt.pro && !isPro ? "Pro feature" : undefined}
              >
                {pt.label}{pt.pro && !isPro ? " 🔒" : ""}
              </button>
            ))}
          </span>
        );
      }
      if (t.cluster === "play") return;
      nodes.push(
        <button
          key={t.id}
          className={`pv-tab ${tab === t.id && !detailId ? "on" : ""}`}
          onClick={() => { setDetailId(null); setSetView(null); setTab(t.id); }}
          title={t.pro && !isPro ? "Pro feature" : undefined}
        >
          {t.label}{t.pro && !isPro ? " 🔒" : ""}
        </button>
      );
    });
    return nodes;
  };

  return (
    <div className="pv-app">
      {node}
      <div className="pv-lab">
        <header className="pv-hdr">
          <div className="pv-hdr-brand">
            <div className="pv-pokeball" aria-hidden />
            <button
              className="pv-logo-text"
              onClick={() => { setDetailId(null); setSetView(null); setTab("vault"); }}
              title="PokéVault"
            >
              PokéVault
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
              {scansLeft}/{FREE_SCAN_LIMIT} scans
            </div>
          )}
          <button
            onClick={async () => { if (user) { await signOut(); } else { nav({ to: "/login" }); } }}
            className="pv-gb-badge"
            style={{ cursor: "pointer" }}
            aria-label={user ? "Sign out" : "Sign in"}
          >{user ? "Sign out" : "Sign in"}</button>
          <button className="pv-gear" onClick={() => setSettingsOpen(s => !s)} aria-label="Settings">⚙</button>
        </header>
        <div className="pv-energy-strip" aria-hidden />

        {settingsOpen && <SettingsPanel onToast={show} />}

        <nav className="pv-tabs hide-scroll">
          {renderTabs()}
        </nav>

        <main className="pv-lab-body">
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
              {tab === "sell" && <SellView />}
              {tab === "buy" && <BuyView onOpen={openCard} />}
              {tab === "pricing" && <Paywall />}
            </>
          )}
        </main>

        <footer className="pv-gb-footer">
          Card data &amp; prices from <a href="https://pokemontcg.io" target="_blank" rel="noreferrer">pokemontcg.io</a>
        </footer>
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
        <button
          className="pv-kclear"
          onClick={async () => {
            const { refreshAllImageCaches } = await import("@/lib/card-images");
            const n = refreshAllImageCaches();
            onToast(`Cleared ${n} cached entries. Reloading for fresh HD art…`);
            location.reload();
          }}
          title="Re-pull all card art in HD"
        >
          ↻ HD Art
        </button>
      </div>
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 7 }}>
        Without key: ~100 req/day. With key: 20,000+/day. Free key at dev.pokemontcg.io
      </div>
    </div>
  );
}
