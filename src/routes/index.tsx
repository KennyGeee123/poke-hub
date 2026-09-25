import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { TCGSet } from "@/lib/pokemon-api";
import { useVault, formatPrice } from "@/lib/vault";
import { DiscoverView, SearchView } from "@/components/pokevault/views";
import { useToast } from "@/components/pokevault/CardTile";
import {
  AppShell,
  MORE_ITEMS,
  StorageHealthChip,
  type AppTab,
  type PrimaryTabId,
} from "@/components/pokevault/AppShell";
import { usePremium } from "@/lib/premium";
import { useAuth } from "@/lib/auth";

/* Eager: Discover + Search. Everything else code-split. */
const CardDetail = lazy(() =>
  import("@/components/pokevault/CardDetail").then((m) => ({ default: m.CardDetail })),
);
const MarketView = lazy(() =>
  import("@/components/pokevault/views").then((m) => ({ default: m.MarketView })),
);
const SetsView = lazy(() =>
  import("@/components/pokevault/views").then((m) => ({ default: m.SetsView })),
);
const SetCardsView = lazy(() =>
  import("@/components/pokevault/views").then((m) => ({ default: m.SetCardsView })),
);
const VaultView = lazy(() =>
  import("@/components/pokevault/views").then((m) => ({ default: m.VaultView })),
);
const WishlistView = lazy(() =>
  import("@/components/pokevault/views").then((m) => ({ default: m.WishlistView })),
);
const BattleHub = lazy(() =>
  import("@/components/pokevault/Battle").then((m) => ({ default: m.BattleHub })),
);
const ScannerView = lazy(() =>
  import("@/components/pokevault/Scanner").then((m) => ({ default: m.ScannerView })),
);
const FairTradeView = lazy(() =>
  import("@/components/pokevault/FairTrade").then((m) => ({ default: m.FairTradeView })),
);
const SellView = lazy(() =>
  import("@/components/pokevault/Marketplace").then((m) => ({ default: m.SellView })),
);
const BuyView = lazy(() =>
  import("@/components/pokevault/Marketplace").then((m) => ({ default: m.BuyView })),
);
const Paywall = lazy(() =>
  import("@/components/pokevault/Paywall").then((m) => ({ default: m.Paywall })),
);
const GameBoyView = lazy(() =>
  import("@/components/pokevault/GameBoy").then((m) => ({ default: m.GameBoyView })),
);
const FriendsView = lazy(() =>
  import("@/components/pokevault/Friends").then((m) => ({ default: m.FriendsView })),
);
const AdventureView = lazy(() =>
  import("@/components/pokevault/Adventure").then((m) => ({ default: m.AdventureView })),
);
const PokedexHub = lazy(() =>
  import("@/components/pokevault/PokedexHub").then((m) => ({ default: m.PokedexHub })),
);
const MusicPlayer = lazy(() =>
  import("@/components/pokevault/MusicPlayer").then((m) => ({ default: m.MusicPlayer })),
);

function TabFallback() {
  return (
    <div className="pv-lab" style={{ padding: 24, minHeight: 240 }} aria-busy="true">
      <div className="pv-card-skel" style={{ height: 120, borderRadius: 12 }} />
      <div style={{ height: 12 }} />
      <div className="pv-card-skel" style={{ height: 48, borderRadius: 8 }} />
    </div>
  );
}

function LazyTab({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TabFallback />}>{children}</Suspense>;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PokéVault Pro — Pokémon TCG Prices, Scanner & Collection Tracker" },
      {
        name: "description",
        content:
          "Scan Pokémon cards, track market prices, battle with your collection, find best buy prices, and list to every marketplace from one Vault.",
      },
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

  useEffect(() => {
    if (detailId) window.scrollTo({ top: 0 });
  }, [detailId]);
  useEffect(() => {
    document.body.dataset.pvTab = tab;
    return () => {
      delete document.body.dataset.pvTab;
    };
  }, [tab]);
  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent).detail as Tab;
      setDetailId(null);
      setSetView(null);
      setMoreOpen(false);
      setTab(t);
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

  const contentKey = detailId ? `detail:${detailId}` : setView ? `set:${setView.id}` : `tab:${tab}`;

  const header = (
    <>
      <header className="pv-hdr pv-hdr-glass">
        <div className="pv-hdr-brand">
          <div className="pv-pokeball" aria-hidden />
          <button
            type="button"
            className="pv-logo-text"
            onClick={() => goTab("discover")}
            title="PokéVault"
            aria-label="PokéVault home"
          >
            PokéVault
          </button>
        </div>
        <div className="pv-hdr-actions">
          <div className="pv-hdr-val">{formatPrice(totalValue)}</div>
          {isPro ? (
            <button
              type="button"
              className={`pv-pro-chip ${tier === "elite" ? "elite" : "pro"}`}
              title={tier === "elite" ? "Elite Champion" : "Pro Trainer"}
              onClick={() => goTab("pricing")}
            >
              <span className="pv-pro-star" aria-hidden>
                ★
              </span>
              {isOwner ? "Owner" : tier === "elite" ? "Elite" : "Pro"}
            </button>
          ) : (
            <button
              type="button"
              className="pv-pro-chip free"
              title="Upgrade for unlimited scans & Pro tabs"
              onClick={() => goTab("pricing")}
            >
              <span className="pv-pro-star" aria-hidden>
                ☆
              </span>
              {scansLeft}/{FREE_SCAN_LIMIT} scans
            </button>
          )}
          <div className="pv-gb-badge pv-vb-on" title="Site shields on. Not desktop antivirus.">
            Virus Buster
          </div>
          <button
            onClick={async () => {
              if (user) {
                await signOut();
              } else {
                nav({ to: "/login" });
              }
            }}
            className="pv-gb-badge pv-auth-btn"
            aria-label={user ? "Sign out" : "Sign in"}
          >
            {user ? "Sign out" : "Sign in"}
          </button>
          <button
            className="pv-gear"
            onClick={() => setSettingsOpen((s) => !s)}
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>
      {settingsOpen && <SettingsPanel onToast={show} isSignedIn={!!user} />}
    </>
  );

  const body = detailId ? (
    <LazyTab>
      <CardDetail cardId={detailId} onBack={() => setDetailId(null)} onToast={show} />
    </LazyTab>
  ) : setView ? (
    <LazyTab>
      <SetCardsView set={setView} onBack={() => setSetView(null)} onOpen={openCard} />
    </LazyTab>
  ) : (
    <>
      {tab === "discover" && <DiscoverView onOpen={openCard} onTab={(t) => goTab(t as Tab)} />}
      {tab === "search" && <SearchView onOpen={openCard} />}
      {tab === "market" && (
        <LazyTab>
          <MarketView onOpen={openCard} />
        </LazyTab>
      )}
      {tab === "sets" && (
        <LazyTab>
          <SetsView onPickSet={setSetView} />
        </LazyTab>
      )}
      {tab === "vault" && (
        <LazyTab>
          <VaultView onOpen={openCard} />
        </LazyTab>
      )}
      {tab === "wishlist" && (
        <LazyTab>
          <WishlistView onOpen={openCard} />
        </LazyTab>
      )}
      {tab === "battle" && (
        <LazyTab>
          <BattleHub onExit={() => goTab("vault")} />
        </LazyTab>
      )}
      {tab === "gb" && (
        <LazyTab>
          <GameBoyView />
        </LazyTab>
      )}
      {tab === "friends" && (
        <LazyTab>
          <FriendsView onOpenCard={openCard} />
        </LazyTab>
      )}
      {tab === "adventure" && (
        <LazyTab>
          <AdventureView />
        </LazyTab>
      )}
      {tab === "scan" && (
        <LazyTab>
          <ScannerView onOpen={openCard} />
        </LazyTab>
      )}
      {tab === "fairtrade" && (
        <LazyTab>
          <FairTradeView />
        </LazyTab>
      )}
      {tab === "pokedex" && (
        <LazyTab>
          <PokedexHub />
        </LazyTab>
      )}
      {tab === "sell" && (
        <LazyTab>
          <SellView />
        </LazyTab>
      )}
      {tab === "buy" && (
        <LazyTab>
          <BuyView onOpen={openCard} />
        </LazyTab>
      )}
      {tab === "pricing" && (
        <LazyTab>
          <Paywall />
        </LazyTab>
      )}
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
          <footer className="pv-gb-footer pv-gb-footer-row">
            <span>
              Card data &amp; prices from{" "}
              <a href="https://pokemontcg.io" target="_blank" rel="noreferrer">
                pokemontcg.io
              </a>
            </span>
            <StorageHealthChip />
          </footer>
        }
      >
        {body}
      </AppShell>
      <MusicPlayerGate />
    </>
  );
}

/** Mount full MusicPlayer only after first open — keeps Discover critical path light. */
function MusicPlayerGate() {
  const [mounted, setMounted] = useState(false);
  const [wantOpen, setWantOpen] = useState(false);
  if (!mounted) {
    return (
      <button
        type="button"
        className="pv-music-fab"
        aria-label="Open music player"
        title="Poké Radio"
        onClick={() => {
          setMounted(true);
          setWantOpen(true);
        }}
      >
        <span className="pv-music-fab-note" aria-hidden>
          ♪
        </span>
      </button>
    );
  }
  return (
    <Suspense fallback={null}>
      <MusicPlayer defaultOpen={wantOpen} />
    </Suspense>
  );
}

function SettingsPanel({
  onToast,
  isSignedIn,
}: {
  onToast: (m: string) => void;
  isSignedIn?: boolean;
}) {
  const [key, setKey] = useState("");
  useEffect(() => {
    setKey(localStorage.getItem("pokeApiKey") ?? "");
  }, []);
  return (
    <div className="pv-settings">
      <div className="pv-settings-row">
        <button
          type="button"
          className="pv-settings-action"
          onClick={async () => {
            const { refreshAllImageCaches } = await import("@/lib/card-images");
            const n = refreshAllImageCaches();
            onToast(`Cleared ${n} cached entries. Reloading for fresh HD art…`);
            location.reload();
          }}
          title="Re-pull all card art in HD"
        >
          ↻ Refresh HD Art
        </button>
        {isSignedIn ? (
          <details className="pv-settings-advanced">
            <summary>Advanced · pokemontcg.io API key</summary>
            <div className="pv-settings-key-row">
              <input
                className="pv-key-in"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Optional — paste key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-label="pokemontcg.io API key"
              />
              <button
                type="button"
                className="pv-ksave"
                onClick={() => {
                  localStorage.setItem("pokeApiKey", key);
                  onToast("Key saved");
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="pv-kclear"
                onClick={() => {
                  localStorage.removeItem("pokeApiKey");
                  setKey("");
                  onToast("Key cleared");
                }}
              >
                Clear
              </button>
            </div>
            <p className="pv-settings-hint">
              Optional. Without key: ~100 req/day. With key: 20,000+/day. Free at{" "}
              <a href="https://dev.pokemontcg.io" target="_blank" rel="noreferrer">
                dev.pokemontcg.io
              </a>
              .
            </p>
          </details>
        ) : (
          <p className="pv-settings-hint" style={{ margin: 0 }}>
            Sign in to manage Advanced API settings.
          </p>
        )}
      </div>
      <div className="pv-settings-row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        <a className="pv-settings-action" href="/privacy.html">
          Privacy
        </a>
        <a className="pv-settings-action" href="/terms.html">
          Terms
        </a>
        <a className="pv-settings-action" href="/support.html">
          Support
        </a>
      </div>
      <p className="pv-settings-hint" style={{ marginTop: 8 }}>
        Unofficial fan app — not affiliated with Nintendo, The Pokémon Company, or Game Freak.
      </p>
    </div>
  );
}
