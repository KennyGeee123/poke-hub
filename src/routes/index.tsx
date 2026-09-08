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
import {
  AppShell,
  MORE_ITEMS,
  type AppTab,
  type PrimaryTabId,
} from "@/components/pokevault/AppShell";
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

type Tab = Exclude<AppTab, "more">;

function Index() {
  const nav = useNavigate();
  const { user, isOwner, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("discover");
  const [moreOpen, setMoreOpen] = useState(false);
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
      setDetailId(null); setSetView(null); setMoreOpen(false); setTab(t);
    };
    window.addEventListener("pv-goto", h);
    return () => window.removeEventListener("pv-goto", h);
  }, []);

  const openCard = (id: string) => setDetailId(id);

  const goTab = (t: Tab) => {
    setDetailId(null);
    setSetView(null);
    setMoreOpen(false);
    setTab(t);
  };

  const onPrimary = (id: PrimaryTabId) => {
    if (id === "more") {
      setMoreOpen((o) => !o);
      return;
    }
    goTab(id);
  };

  const contentKey = detailId
    ? `detail:${detailId}`
    : setView
      ? `set:${setView.id}`
      : `tab:${tab}`;

  const header = (
    <>
      <header className="pv-hdr pv-hdr-glass">
        <div className="pv-hdr-brand">
          <div className="pv-pokeball" aria-hidden />
          <button
            className="pv-logo-text"
            onClick={() => goTab("discover")}
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
        <div className="pv-gb-badge pv-vb-on" title="Site shields on. Not desktop antivirus.">Virus Buster</div>
        <button
          onClick={async () => { if (user) { await signOut(); } else { nav({ to: "/login" }); } }}
          className="pv-gb-badge pv-auth-btn"
          aria-label={user ? "Sign out" : "Sign in"}
        >{user ? "Sign out" : "Sign in"}</button>
        <button className="pv-gear" onClick={() => setSettingsOpen(s => !s)} aria-label="Settings">⚙</button>
      </header>
      {settingsOpen && <SettingsPanel onToast={show} />}
    </>
  );

  const body = detailId ? (
    <CardDetail cardId={detailId} onBack={() => setDetailId(null)} onToast={show} />
  ) : setView ? (
    <SetCardsView set={setView} onBack={() => setSetView(null)} onOpen={openCard} />
  ) : (
    <>
      {tab === "discover" && <DiscoverView onOpen={openCard} onTab={(t) => goTab(t as Tab)} />}
      {tab === "market" && <MarketView onOpen={openCard} />}
      {tab === "sets" && <SetsView onPickSet={setSetView} />}
      {tab === "vault" && <VaultView onOpen={openCard} />}
      {tab === "search" && <SearchView onOpen={openCard} />}
      {tab === "wishlist" && <WishlistView onOpen={openCard} />}
      {tab === "battle" && <BattleHub onExit={() => goTab("vault")} />}
      {tab === "gb" && <GameBoyView />}
      {tab === "friends" && <FriendsView onOpenCard={openCard} />}
      {tab === "adventure" && <AdventureView />}
      {tab === "scan" && <ScannerView onOpen={openCard} />}
      {tab === "pokedex" && <PokedexHub />}
      {tab === "sell" && <SellView />}
      {tab === "buy" && <BuyView onOpen={openCard} />}
      {tab === "pricing" && <Paywall />}
    </>
  );

  return (
    <>
      {node}
      <AppShell
        header={header}
        tab={tab}
        moreOpen={moreOpen}
        isPro={isPro}
        onPrimary={onPrimary}
        onMoreClose={() => setMoreOpen(false)}
        onMorePick={(id) => {
          const item = MORE_ITEMS.find((x) => x.id === id);
          if (item?.pro && !isPro) {
            goTab("pricing");
            return;
          }
          goTab(id);
        }}
        contentKey={contentKey}
        footer={
          <footer className="pv-gb-footer">
            Card data &amp; prices from <a href="https://pokemontcg.io" target="_blank" rel="noreferrer">pokemontcg.io</a>
          </footer>
        }
      >
        {body}
      </AppShell>
      <MusicPlayer />
    </>
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
