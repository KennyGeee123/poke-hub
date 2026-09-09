import { useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import {
  getCardPrices,
  listingTotal,
  listingKey,
  listingHasShipping,
  rankQueue,
  preferredPrintsFromCard,
  FX_EUR_USD,
  type Listing,
} from "@/lib/card-prices";
import { formatPrice } from "@/lib/vault";
import { useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";

function prettyVariant(name: string) {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function queueFromCard(card: TCGCard): Listing[] {
  const out: Listing[] = [];
  const tp = card.tcgplayer;
  if (tp?.url && tp.prices) {
    for (const [name, p] of Object.entries(tp.prices)) {
      const price = p.low ?? p.directLow;
      if (typeof price !== "number" || price <= 0) continue;
      out.push({
        source: "TCGplayer",
        title: `${card.name} · ${prettyVariant(name)} low`,
        price,
        priceRaw: `$${price.toFixed(2)}`,
        currency: "USD",
        url: tp.url,
        image: card.images.small,
        condition: prettyVariant(name),
        variant: name,
        kind: "listing",
      });
    }
  }
  const cm = card.cardmarket;
  const eur = cm?.prices?.lowPrice ?? cm?.prices?.trendPrice;
  if (cm?.url && typeof eur === "number" && eur > 0) {
    const usd = Math.round(eur * FX_EUR_USD * 100) / 100;
    out.push({
      source: "Cardmarket",
      title: `${card.name} · EU low`,
      price: usd,
      priceRaw: `€${eur.toFixed(2)}`,
      currency: "EUR",
      url: cm.url,
      image: card.images.small,
      variant: "low",
      kind: "listing",
    });
  }
  return rankQueue(
    { query: "", cheapest: out[0] ?? null, queue: out, sources: [], generatedAt: "" },
    [],
    { preferPrints: preferredPrintsFromCard(card) },
  );
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
  cardIdRef.current = card.id;

  function applyQueue(listings: Listing[]) {
    return rankQueue(
      { query: "", cheapest: null, queue: listings, sources: [], generatedAt: "" },
      skipRef.current,
      { preferPrints },
    );
  }

  function mergeLive(seed: Listing[], live: Listing[]) {
    const ranked = applyQueue([...live.filter((l) => listingTotal(l) > 0), ...seed]);
    liveRef.current = ranked;
    return ranked;
  }

  function refreshLive(seed: Listing[]) {
    const q = `${card.name} ${card.set.name} ${card.number ?? ""}`.trim();
    const id = card.id;
    getCardPrices(q, { cheapOnly: true, fresh: true, cardId: card.id })
      .then((r) => {
        if (cardIdRef.current !== id) return;
        const live = (r.queue ?? r.sources.flatMap((s) => s.listings)).filter(
          (l) => listingTotal(l) > 0 && l.url,
        );
        if (!live.length) {
          const fallback = applyQueue(liveRef.current.length ? liveRef.current : seed);
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
        setQueue(fallback);
        setLiveStatus(fallback.length ? "error" : "error");
      });
  }

  useEffect(() => {
    skipRef.current = [];
    liveRef.current = [];
    setStruck(null);
    setLiveStatus("loading");
    const seed = queueFromCard(card);
    setQueue(seed);
    refreshLive(seed);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLive(liveRef.current.length ? liveRef.current : queueFromCard(card));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
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
    window.setTimeout(() => refreshLive(next.length ? next : queueFromCard(card)), 400);
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

      {liveStatus === "loading" && !current && (
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
