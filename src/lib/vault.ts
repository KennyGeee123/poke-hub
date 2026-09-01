import { useEffect, useState, useCallback } from "react";
import type { TCGCard } from "./pokemon-api";
import { getMarketPrice, getCard } from "./pokemon-api";
import { pushVaultSnapshot } from "./friends";
import { supabase } from "@/integrations/supabase/client";
import { addToParty, saveMonStats } from "./gbgame";
import { movesAtLevel } from "./pokeapi-moves";

const VAULT_KEY = "pokevault.v1";
const WISH_KEY = "pokewish.v1";
const PRICE_REFRESH_KEY = "pokevault.priceRefreshedAt";
const PRICE_REFRESH_TTL_MS = 6 * 60 * 60 * 1000; // refresh stored vault prices every 6h

export type VaultEntry = { card: TCGCard; qty: number; addedAt: number };

const VAULT_START_LEVEL = 50;

// Refresh stored card data for vault/wishlist so prices stay current even
// when the cached snapshot is stale or was added before pricing was available.
async function refreshVaultPrices() {
  if (typeof localStorage === "undefined") return;
  const last = Number(localStorage.getItem(PRICE_REFRESH_KEY) || 0);
  if (Date.now() - last < PRICE_REFRESH_TTL_MS) return;

  const vault = read<Record<string, VaultEntry>>(VAULT_KEY, {});
  const wish = read<Record<string, TCGCard>>(WISH_KEY, {});
  const ids = new Set([...Object.keys(vault), ...Object.keys(wish)]);
  if (!ids.size) {
    localStorage.setItem(PRICE_REFRESH_KEY, String(Date.now()));
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
      } catch { /* ignore individual failures */ }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (mutatedVault) write(VAULT_KEY, vault);
  if (mutatedWish) write(WISH_KEY, wish);
  localStorage.setItem(PRICE_REFRESH_KEY, String(Date.now()));
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


function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pv-store-change", { detail: key }));
  // Push vault changes to cloud so friends can view it
  if (key === VAULT_KEY) {
    pushVaultSnapshot(value as Record<string, VaultEntry>).catch(() => {});
  }
}

export function useVault() {
  const [vault, setVault] = useState<Record<string, VaultEntry>>({});
  const [wish, setWish] = useState<Record<string, TCGCard>>({});

  useEffect(() => {
    setVault(read(VAULT_KEY, {}));
    setWish(read(WISH_KEY, {}));
    const handler = () => {
      setVault(read(VAULT_KEY, {}));
      setWish(read(WISH_KEY, {}));
    };
    window.addEventListener("pv-store-change", handler);
    window.addEventListener("storage", handler);
    // Kick off a background price refresh (throttled internally to 6h).
    refreshVaultPrices().catch(() => {});
    return () => {
      window.removeEventListener("pv-store-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addToVault = useCallback((card: TCGCard) => {
    const current = read<Record<string, VaultEntry>>(VAULT_KEY, {});
    const existing = current[card.id];
    const isNew = !existing;
    current[card.id] = existing
      ? { ...existing, qty: existing.qty + 1 }
      : { card, qty: 1, addedAt: Date.now() };
    write(VAULT_KEY, current);
    // First time owning this card → auto-enlist in the Game Boy party at Lv 50.
    if (isNew) autoEnlistInParty(card);
  }, []);

  const removeFromVault = useCallback((id: string) => {
    const current = read<Record<string, VaultEntry>>(VAULT_KEY, {});
    delete current[id];
    write(VAULT_KEY, current);
  }, []);

  const toggleWish = useCallback((card: TCGCard) => {
    const current = read<Record<string, TCGCard>>(WISH_KEY, {});
    if (current[card.id]) delete current[card.id];
    else current[card.id] = card;
    write(WISH_KEY, current);
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
  };
}

export function formatPrice(n: number): string {
  if (!n || !isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
