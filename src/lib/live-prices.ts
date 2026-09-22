import { useEffect, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getMarketPrice } from "@/lib/pokemon-api";

type Quote = { market: number; source: string; soldAvg?: number };

const cache = new Map<string, Quote>();
const inflight = new Set<string>();
const waiters = new Map<string, Array<(q: Quote | null) => void>>();
const EVT = "pv-live-price";

function displayMarket(q: Quote): number {
  if (q.soldAvg && q.soldAvg > 0) return q.soldAvg;
  return q.market > 0 ? q.market : 0;
}

function isStrongQuote(q: Quote): boolean {
  return (
    (q.soldAvg || 0) > 0 ||
    q.source === "sold-avg" ||
    q.source === "tcgplayer-market" ||
    q.source === "pokemontcg-market"
  );
}

function emit(id: string, q: Quote) {
  const normalized: Quote = {
    ...q,
    market: displayMarket(q),
    soldAvg: q.soldAvg && q.soldAvg > 0 ? q.soldAvg : undefined,
  };
  cache.set(id, normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { id, ...normalized } }));
  }
}

function quoted(card: TCGCard): number {
  return getMarketPrice(card);
}

export function cachedLivePrice(id: string): number | null {
  const q = cache.get(id);
  if (!q) return null;
  const n = displayMarket(q);
  return n > 0 ? n : null;
}

export function applyLiveQuote(card: TCGCard, market: number): TCGCard {
  if (!(market > 0)) return card;
  const prices = { ...(card.tcgplayer?.prices || {}) };
  const prefer = prices.holofoil ? "holofoil" : prices.reverseHolofoil ? "reverseHolofoil" : "normal";
  const prev = prices[prefer] || {};
  return {
    ...card,
    tcgplayer: {
      ...card.tcgplayer,
      prices: { ...prices, [prefer]: { ...prev, market } },
    },
  };
}

async function fetchBatch(ids: string[]): Promise<Record<string, Quote>> {
  if (!ids.length) return {};
  const url = `/api/public/prices?ids=${encodeURIComponent(ids.join(","))}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return {};
  const json = (await r.json()) as { prices?: Record<string, Quote> };
  return json.prices || {};
}

let timer: ReturnType<typeof setTimeout> | null = null;
const pending: string[] = [];

function flush() {
  timer = null;
  const ids = pending.splice(0, 24).filter((id) => !cache.has(id) && !inflight.has(id));
  if (!ids.length) {
    if (pending.length) schedule();
    return;
  }
  ids.forEach((id) => inflight.add(id));
  fetchBatch(ids)
    .then((got) => {
      for (const id of ids) {
        const q = got[id];
        const wait = waiters.get(id) || [];
        waiters.delete(id);
        inflight.delete(id);
        if (q && (q.market > 0 || (q.soldAvg || 0) > 0)) {
          emit(id, q);
          wait.forEach((fn) => fn(cache.get(id) || q));
        } else {
          wait.forEach((fn) => fn(null));
        }
      }
    })
    .catch(() => {
      for (const id of ids) {
        inflight.delete(id);
        const wait = waiters.get(id) || [];
        waiters.delete(id);
        wait.forEach((fn) => fn(null));
      }
    })
    .finally(() => {
      if (pending.length) schedule();
    });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 40);
}

export function requestLivePrice(id: string): Promise<Quote | null> {
  if (!id) return Promise.resolve(null);
  const hit = cache.get(id);
  if (hit && isStrongQuote(hit)) return Promise.resolve(hit);
  if (hit) cache.delete(id);
  return new Promise((resolve) => {
    const list = waiters.get(id) || [];
    list.push(resolve);
    waiters.set(id, list);
    if (!inflight.has(id) && !pending.includes(id)) pending.push(id);
    schedule();
  });
}

export function hydrateLivePrices(cards: TCGCard[]) {
  for (const c of cards) {
    if (!c?.id) continue;
    const hit = cache.get(c.id);
    if (hit && isStrongQuote(hit)) continue;
    void requestLivePrice(c.id);
  }
}

/** Live sold-avg / TCGPlayer market; falls back to already-quoted card price. */
export function useLivePrice(card: TCGCard | null | undefined): number {
  const id = card?.id || "";
  const seed = card ? quoted(card) : 0;
  const [n, setN] = useState(() => cachedLivePrice(id) ?? seed);

  useEffect(() => {
    const next = cachedLivePrice(id) ?? seed;
    setN(next);
    if (!id) return;
    let alive = true;
    void requestLivePrice(id).then((q) => {
      if (alive && q) {
        const m = displayMarket(q);
        if (m > 0) setN(m);
      }
    });
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: string; market?: number; soldAvg?: number };
      if (d?.id !== id) return;
      const m = (d.soldAvg && d.soldAvg > 0 ? d.soldAvg : d.market) || 0;
      if (m > 0) setN(m);
    };
    window.addEventListener(EVT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVT, on);
    };
  }, [id, seed]);

  return n;
}
