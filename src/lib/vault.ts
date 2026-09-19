import { useEffect, useState, useCallback } from "react";
import type { TCGCard } from "./pokemon-api";
import { getMarketPrice, getCard } from "./pokemon-api";
import { pushVaultSnapshot } from "./friends";
import { supabase } from "@/integrations/supabase/client";
import { addToParty, saveMonStats } from "./gbgame";
import { movesAtLevel } from "./pokeapi-moves";

/** Historical localStorage key — still used for one-time migration + meta stub. */
const VAULT_KEY = "pokevault.v1";
const WISH_KEY = "pokewish.v1";
const META_KEY = "pokevault.v1.meta";
const PRICE_REFRESH_KEY = "pokevault.priceRefreshedAt";
const PRICE_REFRESH_TTL_MS = 6 * 60 * 60 * 1000; // refresh stored vault prices every 6h

const IDB_NAME = "pokevault-db";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

export type VaultEntry = { card: TCGCard; qty: number; addedAt: number };

export type VaultStorageInfo = {
  backend: "idb" | "localStorage";
  approxBytes: number;
  migrated: boolean;
};

const VAULT_START_LEVEL = 50;

type MetaStub = {
  migrated: boolean;
  at: number;
  backend: "idb";
  vaultBytes?: number;
  wishBytes?: number;
};

// ─── In-memory mirror (keeps hook reads fast after hydrate) ─────────────────
let memVault: Record<string, VaultEntry> = {};
let memWish: Record<string, TCGCard> = {};
let readyPromise: Promise<void> | null = null;
let storageBackend: "idb" | "localStorage" = "idb";
let migratedFlag = false;

function lsAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

function lsReadRaw(key: string): string | null {
  if (!lsAvailable()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsWriteRaw(key: string, value: string) {
  if (!lsAvailable()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function lsRemove(key: string) {
  if (!lsAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function lsReadJson<T>(key: string, fallback: T): T {
  const raw = lsReadRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function byteLen(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value ?? null)]).size;
  } catch {
    return JSON.stringify(value ?? null).length;
  }
}

// ─── IndexedDB (raw, no deps) ───────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

async function idbGetVaultSnapshot(): Promise<{
  vault?: Record<string, VaultEntry>;
  wish?: Record<string, TCGCard>;
  present: boolean;
  nonEmpty: boolean;
}> {
  try {
    const v = await idbGet<Record<string, VaultEntry>>(VAULT_KEY);
    const w = await idbGet<Record<string, TCGCard>>(WISH_KEY);
    const present = v !== undefined || w !== undefined;
    const vaultKeys = v && typeof v === "object" ? Object.keys(v).length : 0;
    const wishKeys = w && typeof w === "object" ? Object.keys(w).length : 0;
    return { vault: v, wish: w, present, nonEmpty: vaultKeys > 0 || wishKeys > 0 };
  } catch {
    return { present: false, nonEmpty: false };
  }
}

function readMeta(): MetaStub | null {
  return lsReadJson<MetaStub | null>(META_KEY, null);
}

function writeMeta(partial: Partial<MetaStub> & { migrated: boolean }) {
  const prev = readMeta() || { migrated: false, at: 0, backend: "idb" as const };
  const next: MetaStub = {
    ...prev,
    ...partial,
    backend: "idb",
    at: partial.at ?? Date.now(),
  };
  lsWriteRaw(META_KEY, JSON.stringify(next));
  migratedFlag = next.migrated;
}

async function migrateFromLocalStorageIfNeeded(): Promise<void> {
  const meta = readMeta();
  if (meta?.migrated) {
    migratedFlag = true;
    return;
  }

  const idbSnap = await idbGetVaultSnapshot();
  const lsVaultRaw = lsReadRaw(VAULT_KEY);
  const lsWishRaw = lsReadRaw(WISH_KEY);
  const lsHasData = !!(lsVaultRaw || lsWishRaw);

  // Prefer non-empty IDB; only clear LS once we know data is safe in IDB (or LS empty).
  if (idbSnap.nonEmpty) {
    writeMeta({
      migrated: true,
      vaultBytes: lsVaultRaw?.length,
      wishBytes: lsWishRaw?.length,
    });
    if (lsVaultRaw) lsRemove(VAULT_KEY);
    if (lsWishRaw) lsRemove(WISH_KEY);
    return;
  }

  if (lsHasData) {
    // Migrate once: LS → IDB, then leave meta stub and clear large LS payloads.
    const vault = lsReadJson<Record<string, VaultEntry>>(VAULT_KEY, {});
    const wish = lsReadJson<Record<string, TCGCard>>(WISH_KEY, {});
    try {
      await idbSet(VAULT_KEY, vault);
      await idbSet(WISH_KEY, wish);
      writeMeta({
        migrated: true,
        vaultBytes: lsVaultRaw?.length ?? 0,
        wishBytes: lsWishRaw?.length ?? 0,
      });
      lsRemove(VAULT_KEY);
      lsRemove(WISH_KEY);
      storageBackend = "idb";
    } catch (e) {
      console.warn("pokevault: IDB migrate failed, falling back to localStorage", e);
      storageBackend = "localStorage";
    }
    return;
  }

  // Fresh install (or IDB empty stub only): seed empty IDB + meta.
  try {
    if (!idbSnap.present) {
      await idbSet(VAULT_KEY, {});
      await idbSet(WISH_KEY, {});
    }
    writeMeta({ migrated: true, vaultBytes: 0, wishBytes: 0 });
    storageBackend = "idb";
  } catch {
    storageBackend = "localStorage";
  }
}

async function loadIntoMemory(): Promise<void> {
  if (storageBackend === "localStorage") {
    memVault = lsReadJson(VAULT_KEY, {});
    memWish = lsReadJson(WISH_KEY, {});
    return;
  }
  try {
    memVault = (await idbGet<Record<string, VaultEntry>>(VAULT_KEY)) ?? {};
    memWish = (await idbGet<Record<string, TCGCard>>(WISH_KEY)) ?? {};
  } catch (e) {
    console.warn("pokevault: IDB read failed, falling back to localStorage", e);
    storageBackend = "localStorage";
    memVault = lsReadJson(VAULT_KEY, {});
    memWish = lsReadJson(WISH_KEY, {});
  }
}

/** Ensure migration + memory hydrate have completed (idempotent). */
export function ensureVaultReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        await migrateFromLocalStorageIfNeeded();
      } catch (e) {
        console.warn("pokevault: migrate error", e);
        storageBackend = "localStorage";
      }
      await loadIntoMemory();
    })();
  }
  return readyPromise;
}

function emitChange(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pv-store-change", { detail: key }));
  }
}

async function persistVault(value: Record<string, VaultEntry>) {
  memVault = value;
  if (storageBackend === "idb") {
    try {
      await idbSet(VAULT_KEY, value);
    } catch (e) {
      console.warn("pokevault: IDB write failed", e);
      storageBackend = "localStorage";
      lsWriteRaw(VAULT_KEY, JSON.stringify(value));
    }
  } else {
    lsWriteRaw(VAULT_KEY, JSON.stringify(value));
  }
  emitChange(VAULT_KEY);
  pushVaultSnapshot(value).catch(() => {});
}

async function persistWish(value: Record<string, TCGCard>) {
  memWish = value;
  if (storageBackend === "idb") {
    try {
      await idbSet(WISH_KEY, value);
    } catch (e) {
      console.warn("pokevault: IDB wish write failed", e);
      storageBackend = "localStorage";
      lsWriteRaw(WISH_KEY, JSON.stringify(value));
    }
  } else {
    lsWriteRaw(WISH_KEY, JSON.stringify(value));
  }
  emitChange(WISH_KEY);
}

/** Storage health helper for a future settings/status badge. */
export async function getVaultStorageInfo(): Promise<VaultStorageInfo> {
  await ensureVaultReady();
  const approxBytes = byteLen(memVault) + byteLen(memWish);
  const meta = readMeta();
  return {
    backend: storageBackend,
    approxBytes,
    migrated: !!(meta?.migrated || migratedFlag || storageBackend === "idb"),
  };
}

// Refresh stored card data for vault/wishlist so prices stay current even
// when the cached snapshot is stale or was added before pricing was available.
async function refreshVaultPrices() {
  await ensureVaultReady();
  if (!lsAvailable() && storageBackend !== "idb") return;
  const last = Number(lsReadRaw(PRICE_REFRESH_KEY) || 0);
  if (Date.now() - last < PRICE_REFRESH_TTL_MS) return;

  const vault = { ...memVault };
  const wish = { ...memWish };
  const ids = new Set([...Object.keys(vault), ...Object.keys(wish)]);
  if (!ids.size) {
    lsWriteRaw(PRICE_REFRESH_KEY, String(Date.now()));
    return;
  }

  // Prioritise cards whose stored price is 0 (broken/stale).
  const ordered = Array.from(ids).sort((a, b) => {
    const pa = vault[a] ? getMarketPrice(vault[a].card) : getMarketPrice(wish[a]);
    const pb = vault[b] ? getMarketPrice(vault[b].card) : getMarketPrice(wish[b]);
    return (pa === 0 ? 0 : 1) - (pb === 0 ? 0 : 1);
  });

  let mutatedVault = false;
  let mutatedWish = false;
  const CONCURRENCY = 4;
  let i = 0;
  async function worker() {
    while (i < ordered.length) {
      const id = ordered[i++];
      try {
        const fresh = await getCard(id);
        if (vault[id]) {
          vault[id] = { ...vault[id], card: fresh };
          mutatedVault = true;
        }
        if (wish[id]) {
          wish[id] = fresh;
          mutatedWish = true;
        }
      } catch {
        /* ignore individual failures */
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (mutatedVault) await persistVault(vault);
  if (mutatedWish) await persistWish(wish);
  lsWriteRaw(PRICE_REFRESH_KEY, String(Date.now()));
}

async function autoEnlistInParty(card: TCGCard) {
  if (card.supertype !== "Pokémon") return;
  if (!card.attacks?.length && !(parseInt(card.hp || "") > 0)) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    // Skip if this card is already in the party.
    const { data: existing } = await supabase
      .from("gb_party")
      .select("id")
      .eq("user_id", uid)
      .eq("card_id", card.id)
      .maybeSingle();
    if (existing) return;
    const mon = await addToParty(card, VAULT_START_LEVEL);
    try {
      const real = await movesAtLevel(mon.name, mon.level, mon.attacks);
      if (real.length) {
        mon.attacks = real;
        await saveMonStats(mon);
      }
    } catch {}
  } catch (e) {
    console.warn("auto-enlist failed", e);
  }
}

export function useVault() {
  const [vault, setVault] = useState<Record<string, VaultEntry>>({});
  const [wish, setWish] = useState<Record<string, TCGCard>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureVaultReady().then(() => {
      if (cancelled) return;
      setVault({ ...memVault });
      setWish({ ...memWish });
      setHydrated(true);
    });

    const handler = () => {
      setVault({ ...memVault });
      setWish({ ...memWish });
    };
    window.addEventListener("pv-store-change", handler);
    window.addEventListener("storage", handler);
    // Kick off a background price refresh (throttled internally to 6h).
    refreshVaultPrices().catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener("pv-store-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addToVault = useCallback((card: TCGCard) => {
    void (async () => {
      await ensureVaultReady();
      const current = { ...memVault };
      const existing = current[card.id];
      const isNew = !existing;
      current[card.id] = existing
        ? { ...existing, qty: existing.qty + 1 }
        : { card, qty: 1, addedAt: Date.now() };
      await persistVault(current);
      // First time owning this card → auto-enlist in the Game Boy party at Lv 50.
      if (isNew) autoEnlistInParty(card);
    })();
  }, []);

  const removeFromVault = useCallback((id: string) => {
    void (async () => {
      await ensureVaultReady();
      const current = { ...memVault };
      delete current[id];
      await persistVault(current);
    })();
  }, []);

  const toggleWish = useCallback((card: TCGCard) => {
    void (async () => {
      await ensureVaultReady();
      const current = { ...memWish };
      if (current[card.id]) delete current[card.id];
      else current[card.id] = card;
      await persistWish(current);
    })();
  }, []);

  const totalValue = Object.values(vault).reduce(
    (sum, e) => sum + getMarketPrice(e.card) * e.qty,
    0
  );
  const totalCards = Object.values(vault).reduce((s, e) => s + e.qty, 0);
  const uniqueCards = Object.keys(vault).length;

  return {
    vault,
    wish,
    addToVault,
    removeFromVault,
    toggleWish,
    totalValue,
    totalCards,
    uniqueCards,
    inVault: (id: string) => !!vault[id],
    inWish: (id: string) => !!wish[id],
    /** True after first IDB/localStorage hydrate (optional for callers). */
    ready: hydrated,
  };
}

export function formatPrice(n: number): string {
  if (!n || !isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
