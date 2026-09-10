import { useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import {
  getCardPrices,
  listingTotal,
  listingKey,
  listingHasShipping,
  preferredPrintsFromCard,
  seedListingsFromCard,
  mergeLiveQueue,
  needsRefill,
  FX_EUR_USD,
  TICK_MS,
  TTL_MS,
  type Listing,
} from "@/lib/card-prices";
import { formatPrice } from "@/lib/vault";
import { useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";

function prettyVariant(name: string) {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function queueFromCard(card: TCGCard): Listing[] {
  return seedListingsFromCard({
    name: card.name,
    number: card.number,
    images: card.images,
    set: card.set,
    tcgplayer: card.tcgplayer,
    cardmarket: card.cardmarket,
  });
}

function money(l: Listing) {
  const total = listingTotal(l);
  if (!total) return "—";
  const formatted = formatPrice(total);
  return listingHasShipping(l) ? formatted : `${formatted} ex-ship`;
}

export function QuickStrike({ card }: { card: TCGCard }) {
  const { user } = useAuth();
  const { hasCheapLoop } = usePremium();
  const unlocked = !!user && hasCheapLoop;
  const preferPrints = preferredPrintsFromCard(card);
  const [queue, setQueue] = useState<Listing[]>(() => queueFromCard(card));
  const [struck, setStruck] = useState<Listing | null>(null);
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading");
  const skipRef = useRef<string[]>([]);
  const liveRef = useRef<Listing[]>([]);
  const cardIdRef = useRef(card.id);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);
  cardIdRef.current = card.id;

  function applyQueue(listings: Listing[]) {
    return mergeLiveQueue([], listings, skipRef.current, preferPrints);
  }

  function mergeLive(seed: Listing[], live: Listing[]) {
    const ranked = mergeLiveQueue(seed, live, skipRef.current, preferPrints);
    liveRef.current = ranked;
    return ranked;
  }

  function refreshLive(seed: Listing[], opts?: { force?: boolean }) {
    if (inFlightRef.current && !opts?.force) return;
    const q = `${card.name} ${card.set.name} ${card.number ?? ""}`.trim();
    const id = card.id;
    inFlightRef.current = true;
    getCardPrices(q, {
      cheapOnly: true,
      fresh: true,
      cardId: card.id,
      skipKeys: skipRef.current,
    })
      .then((r) => {
        if (cardIdRef.current !== id) return;
        const live = (r.queue ?? r.sources.flatMap((s) => s.listings)).filter(
          (l) => listingTotal(l) > 0 && l.url,
        );
        lastFetchRef.current = Date.now();
        if (!live.length) {
          const fallback = applyQueue(liveRef.current.length ? liveRef.current : seed);
          liveRef.current = fallback;
          setQueue(fallback);
          setLiveStatus(fallback.length ? "live" : "error");
          return;
        }
        setQueue(mergeLive(seed, live));
        setLiveStatus("live");
      })
      .catch(() => {
        if (cardIdRef.current !== id) return;
        const fallback = applyQueue(liveRef.current.length ? liveRef.current : seed);
        liveRef.current = fallback;
        setQueue(fallback);
        setLiveStatus("error");
      })
      .finally(() => {
        if (cardIdRef.current === id) inFlightRef.current = false;
      });
  }

  useEffect(() => {
    skipRef.current = [];
    liveRef.current = [];
    lastFetchRef.current = 0;
    inFlightRef.current = false;
    setStruck(null);
    setLiveStatus("loading");
    const seed = queueFromCard(card);
    setQueue(seed);
    refreshLive(seed, { force: true });

    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshLive(liveRef.current.length ? liveRef.current : queueFromCard(card));
      }
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (cardIdRef.current !== card.id) return;
      const seed = liveRef.current.length ? liveRef.current : queueFromCard(card);
      const ranked = applyQueue(seed);
      liveRef.current = ranked;
      setQueue(ranked);
      const stale = Date.now() - lastFetchRef.current > TTL_MS;
      if (stale || needsRefill(ranked)) {
        refreshLive(ranked.length ? ranked : queueFromCard(card));
      }
    }, TICK_MS);

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const current = queue[0] ?? null;
  const nextUp = queue[1] ?? null;

  function advance(listing: Listing, openUrl: boolean) {
    if (openUrl) window.open(listing.url, "_blank", "noopener,noreferrer");
    setStruck(listing);
    skipRef.current = [...skipRef.current, listingKey(listing)];
    const next = applyQueue(liveRef.current.length ? liveRef.current : queue);
    liveRef.current = next;
    setQueue(next);
    if (needsRefill(next)) {
      if (!next.length) setLiveStatus("loading");
      refreshLive(next.length ? next : queueFromCard(card), { force: true });
    } else {
      window.setTimeout(() => refreshLive(next), 400);
    }
  }

  function strike() {
    if (!current) return;
    advance(current, true);
  }

  function skipOnly() {
    if (!current) return;
    advance(current, false);
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        background: "linear-gradient(180deg, rgba(226,181,58,.12), rgba(11,18,32,.55))",
        border: "1px solid var(--gold-brd, #e2b53a55)",
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--t3)", fontWeight: 700 }}>
        QUICK STRIKE · CHEAP CARD LOOP
      </div>

      {liveStatus === "loading" && !current && skipRef.current.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>Finding live listings…</div>
      )}

      {current && (
        <>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 36, color: "var(--gold)", letterSpacing: 1, lineHeight: 1.1, marginTop: 4 }}>
            {money(current)}
          </div>
          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {liveStatus === "loading" ? "catalog · refreshing live… · " : ""}
            {current.source}
            {current.variant ? ` · ${prettyVariant(current.variant)}` : current.condition ? ` · ${current.condition}` : ""}
            {current.priceRaw && current.currency === "EUR" ? ` · ${current.priceRaw}≈USD×${FX_EUR_USD}` : ""}
            {!listingHasShipping(current) ? " · shipping TBD" : current.shipping ? ` · ship ${formatPrice(current.shipping)}` : " · ship incl."}
            {" · "}
            {current.title}
          </div>
          {unlocked ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="pv-btn pv-btn-fill"
                onClick={strike}
                style={{ flex: 1, letterSpacing: 1.5, fontWeight: 800 }}
              >
                STRIKE · BUY NOW
              </button>
              <button
                className="pv-btn"
                onClick={skipOnly}
                style={{ letterSpacing: 1, fontWeight: 700, padding: "0 14px" }}
                title="Skip this listing without opening it"
              >
                SKIP
              </button>
            </div>
          ) : (
            <button
              className="pv-btn pv-btn-fill"
              onClick={() => {
                if (!user) window.location.assign("/login");
                else window.dispatchEvent(new CustomEvent("pv-goto", { detail: "pricing" }));
              }}
              style={{ width: "100%", letterSpacing: 1.5, fontWeight: 800 }}
            >
              {!user ? "SIGN IN TO STRIKE" : "JOIN DEAL SCOUT · $4.99/MO"}
            </button>
          )}
          {unlocked && nextUp ? (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)" }}>
              Next up {money(nextUp)} · {nextUp.source}
              {queue.length > 2 ? ` · ${queue.length - 1} more in the loop` : ""}
            </div>
          ) : unlocked && !nextUp && current ? (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)" }}>
              Last live buy on this card.
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)" }}>
              {!user
                ? "Member sign-in unlocks Strike and the next-cheapest loop."
                : "Deal Scout members get Strike + auto-next listing."}
            </div>
          )}
        </>
      )}

      {!current && liveStatus === "loading" && skipRef.current.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>Refilling loop…</div>
      )}

      {!current && liveStatus !== "loading" && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>
          {skipRef.current.length
            ? "Loop empty — every listing on this card was struck or skipped."
            : "No live buy link for this card."}
        </div>
      )}

      {struck && current && listingKey(struck) !== listingKey(current) && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#4ade80", letterSpacing: 0.6 }}>
          Last strike sent. Next cheap listing is up.
        </div>
      )}
    </div>
  );
}
