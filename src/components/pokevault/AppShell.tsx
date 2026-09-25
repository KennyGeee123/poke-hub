import { useEffect, useState, type ReactNode } from "react";
import { getVaultStorageInfo, type VaultStorageInfo } from "@/lib/vault";
import { getCatalogCacheInfo } from "@/lib/catalog-cache";
import {
  Compass,
  Search,
  Vault,
  TrendingUp,
  MoreHorizontal,
  BookOpen,
  ScanLine,
  ShoppingBag,
  Tag,
  Layers,
  Heart,
  Swords,
  Gamepad2,
  Users,
  Mountain,
  Crown,
  ArrowLeftRight,
  X,
} from "lucide-react";

export type AppTab =
  | "discover"
  | "market"
  | "sets"
  | "vault"
  | "search"
  | "wishlist"
  | "battle"
  | "scan"
  | "sell"
  | "buy"
  | "pricing"
  | "gb"
  | "friends"
  | "adventure"
  | "pokedex"
  | "fairtrade"
  | "more";

export type PrimaryTabId = "discover" | "search" | "vault" | "market" | "more";

export const PRIMARY_TABS: {
  id: PrimaryTabId;
  label: string;
  Icon: typeof Compass;
}[] = [
  { id: "discover", label: "Discover", Icon: Compass },
  { id: "search", label: "Search", Icon: Search },
  { id: "vault", label: "Vault", Icon: Vault },
  { id: "market", label: "Market", Icon: TrendingUp },
  { id: "more", label: "More", Icon: MoreHorizontal },
];

export const MORE_ITEMS: {
  id: Exclude<AppTab, "more">;
  label: string;
  Icon: typeof Compass;
  pro?: boolean;
  cluster?: "play" | "trade";
}[] = [
  { id: "pokedex", label: "Pokédex", Icon: BookOpen },
  { id: "scan", label: "Scan", Icon: ScanLine },
  { id: "fairtrade", label: "Fair Trade", Icon: ArrowLeftRight, cluster: "trade" },
  { id: "sets", label: "Sets", Icon: Layers },
  { id: "wishlist", label: "Wishlist", Icon: Heart },
  { id: "buy", label: "Buy", Icon: ShoppingBag, pro: true, cluster: "trade" },
  { id: "sell", label: "Sell", Icon: Tag, pro: true, cluster: "trade" },
  { id: "adventure", label: "Adventure", Icon: Mountain, cluster: "play" },
  { id: "gb", label: "Game Boy", Icon: Gamepad2, cluster: "play" },
  { id: "battle", label: "Battle", Icon: Swords, cluster: "play" },
  { id: "friends", label: "Friends", Icon: Users },
  { id: "pricing", label: "Pricing", Icon: Crown },
];

export function isPrimaryTab(tab: AppTab): tab is PrimaryTabId {
  return PRIMARY_TABS.some((t) => t.id === tab);
}

export function primaryForTab(tab: AppTab): PrimaryTabId {
  if (isPrimaryTab(tab) && tab !== "more") return tab;
  return "more";
}

type TabBarProps = {
  activeTab: AppTab;
  moreOpen: boolean;
  onPrimary: (id: PrimaryTabId) => void;
};

export function BottomTabBar({ activeTab, moreOpen, onPrimary }: TabBarProps) {
  const activePrimary = moreOpen || !isPrimaryTab(activeTab) ? "more" : activeTab;

  return (
    <nav className="pv-tabbar" aria-label="Primary">
      <div className="pv-tabbar-inner">
        {PRIMARY_TABS.map(({ id, label, Icon }) => {
          const on = activePrimary === id;
          return (
            <button
              key={id}
              type="button"
              className={`pv-tabbar-item ${on ? "on" : ""}`}
              onClick={() => onPrimary(id)}
              aria-current={on ? "page" : undefined}
            >
              <span className="pv-tabbar-ico" aria-hidden>
                <Icon size={22} strokeWidth={on ? 2.5 : 2} />
              </span>
              <span className="pv-tabbar-lbl">{label}</span>
              {on && <span className="pv-tabbar-glow" aria-hidden />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MoreGrid({
  items,
  activeTab,
  isPro,
  onPick,
}: {
  items: typeof MORE_ITEMS;
  activeTab: AppTab;
  isPro: boolean;
  onPick: (id: Exclude<AppTab, "more">) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="pv-more-grid">
      {items.map((item) => {
        const on = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`pv-more-item ${on ? "on" : ""} ${item.cluster ? `cluster-${item.cluster}` : ""}`}
            onClick={() => onPick(item.id)}
            title={item.pro && !isPro ? "Pro feature" : undefined}
          >
            <span className="pv-more-ico" aria-hidden>
              <item.Icon size={20} />
            </span>
            <span className="pv-more-lbl">
              {item.label}
              {item.pro && !isPro ? " 🔒" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type MoreSheetProps = {
  open: boolean;
  activeTab: AppTab;
  isPro: boolean;
  onClose: () => void;
  onPick: (id: Exclude<AppTab, "more">) => void;
};

export function MoreSheet({ open, activeTab, isPro, onClose, onPick }: MoreSheetProps) {
  if (!open) return null;
  return (
    <div className="pv-more-root" role="dialog" aria-modal="true" aria-label="More">
      <button
        type="button"
        className="pv-more-backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="pv-more-sheet">
        <div className="pv-more-handle" aria-hidden />
        <div className="pv-more-head">
          <div>
            <div className="pv-more-kicker">PokéVault</div>
            <h2 className="pv-more-title">More</h2>
          </div>
          <button type="button" className="pv-more-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <MoreGrid
          items={MORE_ITEMS.filter((i) => !i.cluster)}
          activeTab={activeTab}
          isPro={isPro}
          onPick={onPick}
        />
        <div className="pv-more-sec">Play</div>
        <MoreGrid
          items={MORE_ITEMS.filter((i) => i.cluster === "play")}
          activeTab={activeTab}
          isPro={isPro}
          onPick={onPick}
        />
        <div className="pv-more-sec">Trade</div>
        <MoreGrid
          items={MORE_ITEMS.filter((i) => i.cluster === "trade")}
          activeTab={activeTab}
          isPro={isPro}
          onPick={onPick}
        />

        <div className="pv-more-sec">Legal</div>
        <div className="pv-more-legal">
          <a href="/privacy.html" className="pv-more-legal-link">
            Privacy Policy
          </a>
          <a href="/terms.html" className="pv-more-legal-link">
            Terms of Service
          </a>
          <a href="/support.html" className="pv-more-legal-link">
            Support
          </a>
          <p className="pv-more-legal-note">
            Unofficial fan app — not affiliated with Nintendo, The Pokémon Company, or Game Freak.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Compact vault storage health for footer/header — IDB vs LS, migrate, size. */
export function StorageHealthChip() {
  const [info, setInfo] = useState<VaultStorageInfo | null>(null);
  const [catalogSets, setCatalogSets] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getVaultStorageInfo()
        .then((v) => {
          if (!cancelled) setInfo(v);
        })
        .catch(() => {
          if (!cancelled) setInfo(null);
        });
      getCatalogCacheInfo()
        .then((c) => {
          if (!cancelled) setCatalogSets(c.backend === "idb" ? c.setCount : 0);
        })
        .catch(() => {
          if (!cancelled) setCatalogSets(null);
        });
    };
    load();
    const onChange = () => load();
    window.addEventListener("pv-store-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("pv-store-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  if (!info) {
    return (
      <span className="pv-storage-chip" title="Checking vault storage…">
        <span className="pv-storage-dot" aria-hidden />
        storage…
      </span>
    );
  }

  const backend = info.backend === "idb" ? "idb" : "localStorage";
  const migrated = info.migrated ? "yes" : "no";
  return (
    <span
      className="pv-storage-chip"
      title={`Vault backend: ${backend}. Migrated from pokevault.v1: ${migrated}. Approx size: ${formatBytes(info.approxBytes)}. Catalog IDB keys: ${catalogSets ?? "…"}.`}
    >
      <span className={`pv-storage-dot ${info.backend === "idb" ? "ok" : "warn"}`} aria-hidden />
      <span className="pv-storage-k">store</span>
      <span className="pv-storage-v cyan">{backend}</span>
      <span className="pv-storage-sep" aria-hidden>
        ·
      </span>
      <span className="pv-storage-k">migrated</span>
      <span className={`pv-storage-v ${info.migrated ? "gold" : "warn"}`}>{migrated}</span>
      <span className="pv-storage-sep" aria-hidden>
        ·
      </span>
      <span className="pv-storage-k">size</span>
      <span className="pv-storage-v">{formatBytes(info.approxBytes)}</span>
    </span>
  );
}

type ShellProps = {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tab: AppTab;
  moreOpen: boolean;
  isPro: boolean;
  onPrimary: (id: PrimaryTabId) => void;
  onMoreClose: () => void;
  onMorePick: (id: Exclude<AppTab, "more">) => void;
  contentKey: string;
};

function FoilPointerTracker() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.(".pv-card-wrap");
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 100;
      const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 100;
      const wrap = t.querySelector(".pv-card-img-wrap") as HTMLElement | null;
      wrap?.style.setProperty("--mx", `${x}%`);
      wrap?.style.setProperty("--my", `${y}%`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
  return null;
}

export function AppShell({
  header,
  children,
  footer,
  tab,
  moreOpen,
  isPro,
  onPrimary,
  onMoreClose,
  onMorePick,
  contentKey,
}: ShellProps) {
  return (
    <div className="pv-app pv-app-shell" data-tab={tab}>
      <FoilPointerTracker />
      <div className="pv-lab">
        {header}
        <div className="pv-energy-strip" aria-hidden />
        <main className="pv-lab-body" key={contentKey}>
          <div className="pv-page-enter">{children}</div>
        </main>
        {footer}
      </div>
      <BottomTabBar activeTab={tab} moreOpen={moreOpen} onPrimary={onPrimary} />
      <MoreSheet
        open={moreOpen}
        activeTab={tab}
        isPro={isPro}
        onClose={onMoreClose}
        onPick={onMorePick}
      />
    </div>
  );
}
