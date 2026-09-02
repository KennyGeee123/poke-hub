import { useEffect, useRef, useState } from "react";
import { getCheapestPrice, type Listing } from "@/lib/card-prices";
import { usePremium } from "@/lib/premium";
import { useAuth } from "@/lib/auth";

/**
 * Tiny inline pill that lazily fetches the cheapest live listing across
 * fast marketplaces (eBay + TCGplayer + Cardmarket) for a card. Loads only
 * when scrolled into view, and the underlying request is cached for 10min.
 */
export function CheapestPill({ query, marketPrice, cardId }: { query: string; marketPrice?: number; cardId?: string }) {
  const { user } = useAuth();
  const { hasCheapLoop } = usePremium();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [listing, setListing] = useState<Listing | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== "idle") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        setState("loading");
        if (!user || !hasCheapLoop) { setState("done"); return; }
        getCheapestPrice(query, cardId)
          .then(l => { setListing(l); setState("done"); })
          .catch(() => setState("error"));
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query, cardId, state]);

  const total = listing ? listing.price + (listing.shipping ?? 0) : null;
  const savings = total != null && marketPrice && marketPrice > total ? marketPrice - total : 0;

  return (
    <a
      ref={ref}
      href={listing?.url ?? "#"}
      target={listing ? "_blank" : undefined}
      rel="noreferrer"
      onClick={(e) => { if (!listing) e.preventDefault(); e.stopPropagation(); }}
      className="pv-cheap-pill"
      title={listing ? `${listing.source}: ${listing.title}` : "Find cheapest online"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 8px", marginTop: 4,
        fontSize: 10, fontFamily: "var(--mono, monospace)",
        textDecoration: "none", borderRadius: 6,
        border: "1px solid var(--brd)",
        background: savings > 0 ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
        color: savings > 0 ? "#4ade80" : "var(--t2)",
        cursor: listing ? "pointer" : "default",
      }}
    >
      {!user || !hasCheapLoop ? (
        <>🔒 Deal Scout</>
      ) : state === "idle" || state === "loading" ? (
        <>🔎 finding…</>
      ) : state === "error" || !listing || total == null ? (
        <>— no live listing</>
      ) : (
        <>
          🏆 ${total.toFixed(2)} <span style={{ opacity: .7 }}>· {listing.source}</span>
          {savings > 0 && <span style={{ marginLeft: 4 }}>save ${savings.toFixed(0)}</span>}
        </>
      )}
    </a>
  );
}
