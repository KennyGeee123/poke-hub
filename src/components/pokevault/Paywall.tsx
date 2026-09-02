import { TIERS, usePremium, type Tier } from "@/lib/premium";
import { useAuth } from "@/lib/auth";

type Props = {
  reason?: string;
  onClose?: () => void;
};

export function Paywall({ reason }: Props) {
  const { tier, setTier } = usePremium();
  const { user } = useAuth();

  const handleSelect = (t: Tier) => {
    if (t === "free") return;
    if (!user) {
      window.location.assign("/login");
      return;
    }
    // TODO: swap for Paddle checkout once enabled:
    //   await paddle.Checkout.open({ items: [{ priceId: PADDLE_PRICE_IDS[t] }] })
    // For now, simulate a successful subscription locally so the UX is testable.
    const label =
      t === "scout" ? "Deal Scout ($4.99/mo)" :
      t === "pro" ? "Pro Trainer ($9.99/mo)" :
      "Elite Champion ($19.99/mo)";
    const ok = window.confirm(
      `Subscribe to ${label}?\n\n` +
      `(Paddle checkout will activate here once payment setup is finished.)`
    );
    if (ok) setTier(t);
  };

  return (
    <div className="pv-paywall">
      <div className="pv-paywall-head">
        <div className="pv-paywall-eyebrow">★ PokéVault Premium</div>
        <h1 className="pv-paywall-title">UNLOCK THE FULL POKÉDEX</h1>
        <p className="pv-paywall-sub">
          {reason ?? "Catch every feature. Cancel anytime."}
        </p>
      </div>

      <div className="pv-tier-grid">
        {TIERS.map((t) => {
          const isCurrent = tier === t.id;
          const featured = t.id === "scout";
          return (
            <div
              key={t.id}
              className={`pv-tier ${featured ? "featured" : ""}`}
            >
              {t.badge && <div className="pv-tier-badge">{t.badge}</div>}
              <div className="pv-tier-name">{t.name}</div>
              <div className="pv-tier-price">
                ${t.price}
                <small>{t.period}</small>
              </div>
              <ul className="pv-tier-list">
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                className="pv-tier-cta"
                disabled={isCurrent}
                onClick={() => handleSelect(t.id)}
                style={isCurrent ? { opacity: 0.6, cursor: "default" } : undefined}
              >
                {isCurrent ? "✓ Current Plan" : t.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: "center", color: "var(--t3)", fontSize: 11, marginTop: 20 }}>
        Secure checkout powered by Paddle · Taxes & VAT handled automatically · Cancel anytime
      </p>
    </div>
  );
}

export function TrialBanner() {
  const { isPro, scansLeft, FREE_SCAN_LIMIT } = usePremium();
  if (isPro) return null;
  return (
    <div className="pv-trial-banner">
      <span>⚡</span>
      <span>
        <b>{scansLeft}</b> of {FREE_SCAN_LIMIT} free scans left — upgrade for unlimited.
      </span>
      <button
        className="pv-trial-cta"
        onClick={() => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "pricing" }))}
      >
        Upgrade
      </button>
    </div>
  );
}
