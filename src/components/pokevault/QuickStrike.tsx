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
  markListingSold,
  isListingSold,
  FX_EUR_USD,
  TICK_MS,
  TTL_MS,
  type Listing,
} from "@/lib/card-prices";
import { formatPrice } from "@/lib/vault";
import { useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";
import type { CardGrade } from "@/lib/card-grades";

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

export type ConditionFilter =
  | "all"
  | "raw"
  | "raw_mint"
  | "raw_nm"
  | "raw_lp"
  | "raw_mp"
  | "raw_hp"
  | "raw_dmg"
  | "slab"
  | "psa10"
  | "psa9"
  | "psa8"
  | "psa7"
  | "bgs"
  | "cgc"
  | "sgc";

const UNGRADED_OPTIONS: { id: ConditionFilter; label: string }[] = [
  { id: "raw", label: "All Raw / Ungraded" },
  { id: "raw_mint", label: "Raw Mint (Pack Fresh)" },
  { id: "raw_nm", label: "Raw Near Mint (NM)" },
  { id: "raw_lp", label: "Raw Lightly Played (LP / EX)" },
  { id: "raw_mp", label: "Raw Moderately Played (MP / VG)" },
  { id: "raw_hp", label: "Raw Heavily Played (HP / Good)" },
  { id: "raw_dmg", label: "Raw Damaged (DMG / Poor)" },
];

const SLAB_OPTIONS: { id: ConditionFilter; label: string }[] = [
  { id: "slab", label: "All Graded Slabs (PSA / BGS / CGC / SGC)" },
  { id: "psa10", label: "PSA 10 Gem Mint Slabs" },
  { id: "psa9", label: "PSA 9 Mint Slabs" },
  { id: "psa8", label: "PSA 8 NM-MT Slabs" },
  { id: "psa7", label: "PSA 7 Near Mint Slabs" },
  { id: "bgs", label: "BGS / Beckett Slabs" },
  { id: "cgc", label: "CGC Cards Slabs" },
  { id: "sgc", label: "SGC Tuxedo Slabs" },
];

export function QuickStrike({ card, selectedGrade }: { card: TCGCard; selectedGrade?: CardGrade }) {
  const { user } = useAuth();
  const { hasCheapLoop } = usePremium();
  
  // BETA MODE: Unlocked for testing without sign-up paywall
  const unlocked = true;

  const [condition, setCondition] = useState<ConditionFilter>(() => {
    if (selectedGrade === "psa10") return "psa10";
    if (selectedGrade === "psa9") return "psa9";
    if (selectedGrade && selectedGrade !== "raw") return "slab";
    return "all";
  });

  const [autoRandomize, setAutoRandomize] = useState(false);
  const preferPrints = preferredPrintsFromCard(card);
  const [queue, setQueue] = useState<Listing[]>(() => queueFromCard(card));
  const [struck, setStruck] = useState<Listing | null>(null);
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading");
  const [pollCountdown, setPollCountdown] = useState(5);
  const [soldCount, setSoldCount] = useState(0);

  const skipRef = useRef<string[]>([]);
  const liveRef = useRef<Listing[]>([]);
  const cardIdRef = useRef(card.id);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);
  cardIdRef.current = card.id;

  // Sync selectedGrade prop to condition if grade changes
  useEffect(() => {
    if (selectedGrade === "psa10") setCondition("psa10");
    else if (selectedGrade === "psa9") setCondition("psa9");
    else if (selectedGrade && selectedGrade !== "raw") setCondition("slab");
  }, [selectedGrade]);

  function applyQueue(listings: Listing[]) {
    return mergeLiveQueue([], listings, skipRef.current, preferPrints, condition);
  }

  function mergeLive(seed: Listing[], live: Listing[]) {
    const ranked = mergeLiveQueue(seed, live, skipRef.current, preferPrints, condition);
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
      condition,
    })
      .then((r) => {
        if (cardIdRef.current !== id) return;
        const live = (r.queue ?? r.sources.flatMap((s) => s.listings)).filter(
          (l) => listingTotal(l) > 0 && l.url && !isListingSold(listingKey(l)),
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
    setPollCountdown(5);

    const seed = queueFromCard(card);
    setQueue(applyQueue(seed));
    refreshLive(seed, { force: true });

    // 5-second live polling ticker loop
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (cardIdRef.current !== card.id) return;

      setPollCountdown((prev) => (prev <= 1 ? 5 : prev - 1));

      const seed = liveRef.current.length ? liveRef.current : queueFromCard(card);
      const ranked = applyQueue(seed);
      liveRef.current = ranked;
      setQueue(ranked);

      const stale = Date.now() - lastFetchRef.current > TTL_MS;
      if (stale || needsRefill(ranked)) {
        refreshLive(ranked.length ? ranked : queueFromCard(card));
      }
    }, 1000);

    return () => {
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, condition]);

  const current = queue[0] ?? null;
  const nextUp = queue[1] ?? null;

  function advance(listing: Listing, isBuy: boolean) {
    const key = listingKey(listing);
    if (isBuy) {
      // Mark as sold in shared registry & open vendor checkout
      markListingSold(key);
      setSoldCount((c) => c + 1);
      window.open(listing.url, "_blank", "noopener,noreferrer");
    }
    setStruck(listing);
    skipRef.current = [...skipRef.current, key];

    let next = applyQueue(liveRef.current.length ? liveRef.current : queue);

    // If auto-randomize is enabled, shuffle the remaining candidate queue
    if (autoRandomize && next.length > 2) {
      const remaining = [...next];
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      next = remaining;
    }

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

  function randomizeQueue() {
    if (queue.length <= 1) return;
    const shuffled = [...queue];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setQueue(shuffled);
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        background: "linear-gradient(180deg, rgba(226,181,58,.14), rgba(11,18,32,.75))",
        border: "1px solid var(--gold-brd, #e2b53a55)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--gold)", fontWeight: 800 }}>
          ⚡ QUICK STRIKE · BUY CHEAPEST CARD
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--mono, monospace)",
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(74, 222, 128, 0.15)",
              color: "#4ade80",
              fontWeight: 700,
            }}
          >
            BETA UNLOCKED
          </span>
          <span
            style={{
              fontSize: 9,
              color: "var(--t3)",
              fontFamily: "var(--mono, monospace)",
            }}
            title="Active 5s high-velocity polling buffer checking for sold/updated inventory"
          >
            ⟳ {pollCountdown}s
          </span>
        </div>
      </div>

      {/* Condition & Slab Selector */}
      <div style={{ marginTop: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: "var(--t3)", marginBottom: 3, fontWeight: 700, letterSpacing: 1 }}>
          CONDITION / SLAB FILTER:
        </div>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as ConditionFilter)}
          style={{
            width: "100%",
            background: "rgba(10, 15, 29, 0.95)",
            color: "var(--t1)",
            border: "1px solid var(--brd)",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
            fontFamily: "var(--mono, monospace)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">⚡ Any Condition or Grade (Absolute Lowest)</option>
          <optgroup label="📋 UNGRADED CONDITIONS (RAW)">
            {UNGRADED_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="🏆 GRADED SLABS">
            {SLAB_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {liveStatus === "loading" && !current && skipRef.current.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>
          Scanning across 15+ marketplaces for cheapest {condition.toUpperCase()} listing…
        </div>
      )}

      {current && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 36, color: "var(--gold)", letterSpacing: 1, lineHeight: 1.1 }}>
              {money(current)}
            </div>
            {queue.length > 1 && (
              <button
                onClick={randomizeQueue}
                style={{
                  fontSize: 10,
                  color: "var(--neon-cyan, #38bdf8)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
                title="Randomize / Shuffle cheapest candidates"
              >
                🔀 Shuffle ({queue.length} live)
              </button>
            )}
          </div>

          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {liveStatus === "loading" ? "catalog · refreshing… · " : ""}
            <strong style={{ color: "var(--t1)" }}>{current.source}</strong>
            {current.variant ? ` · ${prettyVariant(current.variant)}` : current.condition ? ` · ${current.condition}` : ""}
            {current.priceRaw && current.currency === "EUR" ? ` · ${current.priceRaw}≈USD×${FX_EUR_USD}` : ""}
            {!listingHasShipping(current) ? " · ship TBD" : current.shipping ? ` · ship ${formatPrice(current.shipping)}` : " · ship incl."}
            {" · "}
            {current.title}
          </div>

          {/* 1-Click Strike Action Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="pv-btn pv-btn-fill"
              onClick={strike}
              style={{
                flex: 1,
                letterSpacing: 1.5,
                fontWeight: 800,
                background: "linear-gradient(135deg, #f59e0b, #e11d48)",
                boxShadow: "0 0 16px rgba(245, 158, 11, 0.4)",
              }}
            >
              🚀 STRIKE · BUY NOW
            </button>
            <button
              className="pv-btn"
              onClick={skipOnly}
              style={{ letterSpacing: 1, fontWeight: 700, padding: "0 14px" }}
              title="Skip this listing and rotate to the next cheapest immediately"
            >
              SKIP
            </button>
          </div>

          {/* Next in buffer queue & sold tracking */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            {nextUp ? (
              <div style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Next: {money(nextUp)} · {nextUp.source} ({queue.length - 1} buffered)
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--t3)" }}>Last live listing in buffer.</div>
            )}
            {soldCount > 0 && (
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
                ✓ {soldCount} bought/rotated
              </div>
            )}
          </div>
        </>
      )}

      {!current && liveStatus === "loading" && skipRef.current.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>Polling next batch from markets…</div>
      )}

      {!current && liveStatus !== "loading" && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--t3)" }}>
          {skipRef.current.length
            ? "Loop finished — all candidate listings on this card were struck or skipped."
            : `No live listings found for ${condition.toUpperCase()} filter.`}
        </div>
      )}

      {struck && current && listingKey(struck) !== listingKey(current) && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#4ade80", letterSpacing: 0.6 }}>
          ✓ Card tracked as bought/sold. Next live lowest auto-loaded!
        </div>
      )}
    </div>
  );
}
