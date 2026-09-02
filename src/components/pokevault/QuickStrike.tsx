import { useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getCardPrices, listingTotal, listingKey, rankQueue, type Listing } from "@/lib/card-prices";
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
      });
    }
  }
  const cm = card.cardmarket;
  const eur = cm?.prices?.lowPrice ?? cm?.prices?.trendPrice;
  if (cm?.url && typeof eur === "number" && eur > 0) {
    const usd = Math.round(eur * 1.08 * 100) / 100;
    out.push({
      source: "Cardmarket",
      title: `${card.name} · EU low`,
      price: usd,
      priceRaw: `€${eur.toFixed(2)}`,
      currency: "EUR",
      url: cm.url,
      image: card.images.small,
      condition: "Low",
    });
  }
  const nkw = encodeURIComponent(`${card.name} ${card.set.name} ${card.number ?? ""} pokemon`.trim());
  out.push({
    source: "eBay",
    title: `${card.name} · lowest Buy It Now`,
    price: 0,
    priceRaw: "LIVE",
    currency: "USD",
    url: `https://www.ebay.com/sch/i.html?_nkw=${nkw}&_sacat=183454&LH_BIN=1&_sop=15`,
    image: card.images.small,
    condition: "BIN",
  });
  return rankQueue({ query: "", cheapest: out[0] ?? null, queue: out, sources: [], generatedAt: "" });
}

function money(l: Listing) {
  if (!l.price) return "LIVE";
  return formatPrice(listingTotal(l));
}

export function QuickStrike({ card }: { card: TCGCard }) {
  const { user } = useAuth();
  const { hasCheapLoop } = usePremium();
  const unlocked = !!user && hasCheapLoop;
  const [queue, setQueue] = useState<Listing[]>(() => queueFromCard(card));
  const [struck, setStruck] = useState<Listing | null>(null);
  const skipRef = useRef<string[]>([]);
  const cardIdRef = useRef(card.id);
  cardIdRef.current = card.id;

  function mergeLive(seed: Listing[], live: Listing[]) {
    return rankQueue(
      { query: "", cheapest: null, queue: [...live.filter((l) => listingTotal(l) > 0), ...seed], sources: [], generatedAt: "" },
      skipRef.current
    );
  }

  function refreshLive(seed: Listing[]) {
    const q = `${card.name} ${card.set.name} ${card.number ?? ""}`.trim();
    const id = card.id;
    getCardPrices(q, { cheapOnly: true, fresh: true, cardId: card.id })
      .then((r) => {
        if (cardIdRef.current !== id) return;
        const live = (r.queue ?? r.sources.flatMap((s) => s.listings)).filter((l) => listingTotal(l) > 0 && l.url);
        if (!live.length) {
          setQueue(rankQueue({ query: q, cheapest: seed[0] ?? null, queue: seed, sources: [], generatedAt: "" }, skipRef.current));
          return;
        }
        setQueue(mergeLive(seed, live));
      })
      .catch(() => {
        setQueue(rankQueue({ query: q, cheapest: seed[0] ?? null, queue: seed, sources: [], generatedAt: "" }, skipRef.current));
      });
  }

  useEffect(() => {
    skipRef.current = [];
    setStruck(null);
    const seed = queueFromCard(card);
    setQueue(seed);
    refreshLive(seed);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLive(queueFromCard(card));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const current = queue[0] ?? null;
  const nextUp = queue[1] ?? null;

  function strike() {
    if (!current) return;
    window.open(current.url, "_blank", "noopener,noreferrer");
    setStruck(current);
    skipRef.current = [...skipRef.current, listingKey(current)];
    const seed = queueFromCard(card);
    setQueue(rankQueue({ query: "", cheapest: null, queue: seed, sources: [], generatedAt: "" }, skipRef.current));
    window.setTimeout(() => refreshLive(seed), 1200);
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

      {current && (
        <>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 36, color: "var(--gold)", letterSpacing: 1, lineHeight: 1.1, marginTop: 4 }}>
            {money(current)}
          </div>
          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {current.source}
            {current.condition ? ` · ${current.condition}` : ""}
            {current.priceRaw && current.currency === "EUR" ? ` · ${current.priceRaw}` : ""}
            {" · "}
            {current.title}
          </div>
          {unlocked ? (
            <button
              className="pv-btn pv-btn-fill"
              onClick={strike}
              style={{ width: "100%", letterSpacing: 1.5, fontWeight: 800 }}
            >
              STRIKE · BUY NOW
            </button>
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
          ) : unlocked && !nextUp ? (
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

      {!current && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>No live buy link for this card.</div>
      )}

      {struck && current && listingKey(struck) !== listingKey(current) && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#4ade80", letterSpacing: 0.6 }}>
          Last strike sent. Next cheap listing is up.
        </div>
      )}
    </div>
  );
}
