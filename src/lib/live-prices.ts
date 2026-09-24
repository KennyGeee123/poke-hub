import { useEffect, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getMarketPrice } from "@/lib/pokemon-api";

type Quote = {
  market: number;
  source: string;
  soldAvg?: number;
  pending?: boolean;
  /** When this quote was cached (ms). Used for pending TTL. */
  at?: number;
  /** How many times we got pending-new-set for this id. */
  tries?: number;
};

const cache = new Map<string, Quote>();
const inflight = new Set<string>();
const waiters = new Map<string, Array<(q: Quote | null) => void>>();
const EVT = "pv-live-price";

const PENDING_SET_RE = /^(30th|30th-c|me55|me55c)(-|$)/i;
/** Pending quotes are soft — refetch after this so tcgcsv/sold-avg can land. */
const PENDING_TTL_MS = 45_000;
/** After this many pending responses, stop showing "Pending" (show — / N/A). */
const PENDING_MAX_TRIES = 3;
/** Once exhausted, still poke the API occasionally (longer TTL). */
const PENDING_EXHAUSTED_TTL_MS = 5 * 60_000;

export function isPendingPriceSet(cardOrId: TCGCard | string | null | undefined): boolean {
  if (!cardOrId) return false;
  if (typeof cardOrId === "string") return PENDING_SET_RE.test(cardOrId);
  const id = cardOrId.id || "";
  const setId = cardOrId.set?.id || "";
  return PENDING_SET_RE.test(id) || PENDING_SET_RE.test(setId);
}

function displayMarket(q: Quote): number {
  // Real money always wins over a stale pending flag.
  if (q.soldAvg && q.soldAvg > 0) return q.soldAvg;
  if (q.market > 0) return q.market;
  if (q.pending) return 0;
  return 0;
}

function hasMoney(q: Quote | null | undefined): boolean {
  if (!q) return false;
  return (q.soldAvg || 0) > 0 || q.market > 0;
}

/** Real market quotes are strong. pending is NEVER strong — must allow refetch. */
function isStrongQuote(q: Quote): boolean {
  if (q.pending && !hasMoney(q)) return false;
  return (
    (q.soldAvg || 0) > 0 ||
    q.source === "sold-avg" ||
    q.source === "tcgplayer-market" ||
    q.source === "pokemontcg-market" ||
    q.source === "tcgcsv-market" ||
    q.source === "tcgplayer-mid" ||
    q.source === "tcgplayer-low" ||
    q.source === "cardmarket-low"
  );
}

function pendingTtl(q: Quote): number {
  return (q.tries || 0) >= PENDING_MAX_TRIES ? PENDING_EXHAUSTED_TTL_MS : PENDING_TTL_MS;
}

function isFreshPending(q: Quote): boolean {
  if (!q.pending || hasMoney(q)) return false;
  const at = q.at || 0;
  return Date.now() - at < pendingTtl(q);
}

function isPendingExhausted(q: Quote | undefined): boolean {
  return !!q?.pending && !hasMoney(q) && (q.tries || 0) >= PENDING_MAX_TRIES;
}

function normalizeQuote(q: Quote, prev?: Quote): Quote {
  const money = hasMoney(q);
  const tries = q.pending && !money ? (prev?.tries || 0) + 1 : 0;
  return {
    ...q,
    market: money ? displayMarket(q) : q.market > 0 ? q.market : 0,
    soldAvg: q.soldAvg && q.soldAvg > 0 ? q.soldAvg : undefined,
    // Clear pending whenever we have a real price.
    pending: money ? false : !!q.pending,
    at: Date.now(),
    tries: money ? 0 : tries || q.tries || 0,
  };
}

function emit(id: string, q: Quote) {
  const prev = cache.get(id);
  const normalized = normalizeQuote(q, prev);
  const targets = priceIdAliases(id);
  for (const key of targets) cache.set(key, normalized);
  if (typeof window !== "undefined") {
    for (const key of targets) {
      window.dispatchEvent(new CustomEvent(EVT, { detail: { id: key, ...normalized } }));
    }
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

/** True only while we still owe the user a short "Pending" wait — not after retries exhaust. */
export function cachedPricePending(id: string): boolean {
  const q = cache.get(id);
  if (!q?.pending || hasMoney(q)) return false;
  if (isPendingExhausted(q)) return false;
  return true;
}

export function applyLiveQuote(card: TCGCard, market: number): TCGCard {
  if (!(market > 0)) return card;
  const prices = { ...(card.tcgplayer?.prices || {}) };
  const prefer = prices.holofoil
    ? "holofoil"
    : prices.reverseHolofoil
      ? "reverseHolofoil"
      : "normal";
  const prev = prices[prefer] || {};
  return {
    ...card,
    tcgplayer: {
      ...card.tcgplayer,
      prices: { ...prices, [prefer]: { ...prev, market } },
    },
  };
}

/** Encode each id; keep literal commas so servers that split on "," stay correct. */
function pricesQuery(ids: string[]): string {
  return ids.map((id) => encodeURIComponent(id)).join(",");
}

/** Same-set pad aliases + Celebration me55↔30th. Classic never cross-maps by number. */
export function priceIdAliases(id: string): string[] {
  const m = id.match(/^([a-z0-9.-]+?)-(\d+[a-z]?)$/i);
  if (!m) return [id];
  const setKey = m[1].toLowerCase();
  const raw = m[2];
  const unpadded = raw.replace(/^0+/, "") || "0";
  const padded = raw.replace(/\D/g, "").padStart(3, "0") || raw;
  const locals = [...new Set([raw, unpadded, padded])];
  const classic = setKey === "30th-c" || setKey === "me55c";
  const sets = classic
    ? [setKey]
    : setKey === "30th" || setKey === "me55"
      ? ["30th", "me55"]
      : setKey === "me2pt5" || setKey === "me02.5"
        ? ["me2pt5", "me02.5"]
        : [setKey];
  const out: string[] = [];
  for (const s of sets) for (const loc of locals) out.push(`${s}-${loc}`);
  return [...new Set(out)];
}

async function fetchBatch(ids: string[]): Promise<Record<string, Quote>> {
  if (!ids.length) return {};
  const url = `/api/public/prices?ids=${pricesQuery(ids)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return {};
  const json = (await r.json()) as { prices?: Record<string, Quote> };
  return json.prices || {};
}

let timer: ReturnType<typeof setTimeout> | null = null;
const pending: string[] = [];

function shouldFetch(id: string): boolean {
  if (inflight.has(id)) return false;
  const hit = cache.get(id);
  if (!hit) return true;
  if (isStrongQuote(hit)) return false;
  if (hit.pending && isFreshPending(hit)) return false;
  return true;
}

function flush() {
  timer = null;
  const ids = pending.splice(0, 24).filter((id) => shouldFetch(id));
  if (!ids.length) {
    if (pending.length) schedule();
    return;
  }
  ids.forEach((id) => inflight.add(id));
  fetchBatch(ids)
    .then((got) => {
      for (const id of ids) {
        let q = got[id];
        if (!q) {
          for (const alias of priceIdAliases(id)) {
            if (got[alias]) {
              q = got[alias];
              break;
            }
          }
        }
        const wait = waiters.get(id) || [];
        waiters.delete(id);
        inflight.delete(id);
        if (q && (hasMoney(q) || q.pending)) {
          // Drop pending flag if the payload already has money.
          if (hasMoney(q)) q = { ...q, pending: false };
          emit(id, q);
          wait.forEach((fn) => fn(cache.get(id) || q));
        } else if (isPendingPriceSet(id)) {
          // Soft pending for new sets — TTL + try budget so UI can leave "Pending".
          const pend: Quote = { market: 0, source: "pending-new-set", pending: true };
          emit(id, pend);
          wait.forEach((fn) => fn(cache.get(id) || pend));
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
  // Fresh pending: resolve immediately so tiles can show Pending without re-queue spam.
  if (hit?.pending && isFreshPending(hit)) return Promise.resolve(hit);
  // Stale / weak — drop so flush will fetch again.
  if (hit && (!hit.pending || !isFreshPending(hit))) {
    for (const key of priceIdAliases(id)) {
      const cur = cache.get(key);
      if (cur && !isStrongQuote(cur)) cache.delete(key);
    }
  }
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
    if (hit?.pending && isFreshPending(hit)) continue;
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
      if (!alive || !q) return;
      const m = displayMarket(q);
      if (m > 0) setN(m);
    });
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        id?: string;
        market?: number;
        soldAvg?: number;
        pending?: boolean;
      };
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

/** True while waiting for first quotes on a new set — false after money lands or retries exhaust. */
export function usePricePending(card: TCGCard | null | undefined): boolean {
  const id = card?.id || "";
  const seed = isPendingPriceSet(card);
  const [pendingFlag, setPendingFlag] = useState(
    () => cachedPricePending(id) || (seed && !(cachedLivePrice(id) ?? 0)),
  );

  useEffect(() => {
    setPendingFlag(cachedPricePending(id) || (seed && !(cachedLivePrice(id) ?? 0)));
    if (!id) return;
    let alive = true;
    void requestLivePrice(id).then((q) => {
      if (!alive) return;
      if (q && hasMoney(q)) {
        setPendingFlag(false);
        return;
      }
      if (q?.pending) {
        setPendingFlag(!isPendingExhausted(q) && cachedPricePending(id));
        return;
      }
      // Non-pending empty for a new-set id: keep Pending only until try budget is spent.
      if (seed) {
        const cached = cache.get(id);
        setPendingFlag(cachedPricePending(id) || (!cached && !(cachedLivePrice(id) ?? 0)));
      } else {
        setPendingFlag(false);
      }
    });
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        id?: string;
        market?: number;
        soldAvg?: number;
        pending?: boolean;
        tries?: number;
      };
      if (d?.id !== id) return;
      if ((d.soldAvg || 0) > 0 || (d.market || 0) > 0) {
        setPendingFlag(false);
        return;
      }
      if (d.pending) {
        setPendingFlag(!((d.tries || 0) >= PENDING_MAX_TRIES));
      }
    };
    window.addEventListener(EVT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVT, on);
    };
  }, [id, seed]);

  return pendingFlag && !(cachedLivePrice(id) ?? 0);
}
