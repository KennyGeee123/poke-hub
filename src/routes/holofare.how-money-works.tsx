import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Shell, Pill } from "@/components/holofare/HoloFare";
import { hfHead } from "@/components/holofare/head";
import { HF, DISCLAIMER, usd } from "@/lib/holofare";

export const Route = createFileRoute("/holofare/how-money-works")({ head: () => hfHead("How the money works — HoloFare (demo)"), component: Money });

const U: CSSProperties = { fontFamily: "'Unbounded', sans-serif", fontWeight: 700 };
const M: CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 };
const panel: CSSProperties = { background: HF.deepOrbit, border: `1px solid ${HF.panelBorder}`, borderRadius: 18 };

const FLOW: [string, string, string, string][] = [
  ["1", "Customer taps Lock it in", "Short hold for the total landed price.", "Hold placed"],
  ["2", "HoloFare buys the listing", "Hold stays in place.", "Purchasing"],
  ["3", "Seller confirms the sale", "No change yet.", "Purchasing"],
  ["4", "HoloFare verifies the proof", "Hold becomes a real charge.", "Verified"],
  ["5", "Seller ships", "No change.", "In transit"],
  ["6", "Package arrives", "No change.", "Delivered"],
];
const WRONG: [string, string][] = [
  ["Listing sold before we could buy", "This listing just sold. We released your hold. Here is the next closest price."],
  ["Price rose a little before we bought", "Nothing changes. The total stays the same."],
  ["Price rose more than the cushion", "The price went up more than we can cover, so we did not buy and released your hold. Here is the new total."],
  ["Seller rejects or cancels the order", "The seller canceled. Your card was not charged."],
  ["Purchase went through but proof is missing", "Tracker stays on Purchasing with a note that we are confirming."],
  ["Card is declined at the hold", "Your card was declined. Try another card. Nothing was purchased."],
  ["Item arrives wrong or damaged", "A Report a problem button on the order page."],
];

function Money() {
  const A = 412, B = 8.5, C = Math.round(A * 0.075 * 100) / 100, Dt = A + B + C;
  return (
    <Shell>
      <h1 className="pt-6 text-[32px] md:text-[40px]" style={{ ...U, lineHeight: 1.1 }}>How the money works</h1>
      <p className="mt-3 max-w-2xl" style={{ color: HF.softLilac }}>
        We place a hold, not a charge. If the purchase fails, there is nothing to refund, because nothing was ever taken. A released hold simply disappears.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="p-6" style={panel}>
          <h2 className="text-[22px]" style={{ ...U, fontWeight: 500 }}>Two clocks</h2>
          <table className="mt-4 w-full text-sm"><tbody style={{ color: HF.softLilac }}>
            <tr><td></td><td className="pb-2 font-bold" style={{ color: HF.frost }}>Fare Lock timer</td><td className="pb-2 font-bold" style={{ color: HF.frost }}>Payment hold</td></tr>
            <tr><td className="py-1 pr-2">Starts</td><td>The match appears on screen.</td><td>The customer taps Lock it in.</td></tr>
            <tr><td className="py-1 pr-2">Length</td><td>45 seconds, 3 minutes or 10 minutes, by demand.</td><td>Never more than 2 minutes.</td></tr>
            <tr><td className="py-1 pr-2">Money moves?</td><td>No.</td><td>Reserved first, charged only after verification.</td></tr>
          </tbody></table>
        </div>
        <div className="p-6" style={panel}>
          <h2 className="text-[22px]" style={{ ...U, fontWeight: 500 }}>Every fee, on its own line</h2>
          {[["Card price", A], ["Shipping charged by the seller", B], ["HoloFare service fee", C]].map(([k, v]) => (
            <div key={k as string} className="flex justify-between py-1.5"><span style={{ color: HF.softLilac }}>{k}</span><span style={M}>{usd(v as number)}</span></div>
          ))}
          <div className="my-2 h-px" style={{ background: HF.panelBorder }} />
          <div className="flex justify-between"><span className="font-semibold">Total landed price</span><span style={{ ...M, fontSize: 26, color: HF.gold }}>{usd(Dt)}</span></div>
          <p className="mt-4 text-[13px]" style={{ color: HF.dimLilac }}>
            Price protection is limited: the lesser of 2 percent of the card price or $10.00 (here {usd(Math.min(A * 0.02, 10))}), paid by HoloFare, never by you. A bigger rise means we do not buy, release the hold and offer a new fare. If the price falls, you pay the lower total.
          </p>
        </div>
      </div>
      <h2 className="mt-10 text-[22px]" style={{ ...U, fontWeight: 500 }}>The money flow, step by step</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl" style={{ border: `1px solid ${HF.panelBorder}` }}>
        {FLOW.map(([n, ev, card, st]) => (
          <div key={n} className="grid grid-cols-[32px_1fr_1fr_auto] items-center gap-4 px-5 py-3 text-sm" style={{ background: HF.boardNavy, borderTop: n !== "1" ? `1px solid ${HF.panelBorder}` : undefined }}>
            <span style={{ ...M, color: HF.cyan }}>{n}</span><span className="font-semibold">{ev}</span><span style={{ color: HF.softLilac }}>{card}</span><Pill label={st} />
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-[22px]" style={{ ...U, fontWeight: 500 }}>When something goes wrong</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {WRONG.map(([p, m]) => (
          <div key={p} className="p-4" style={panel}><div className="font-semibold">{p}</div><p className="mt-1 text-sm" style={{ color: HF.softLilac }}>{m}</p></div>
        ))}
      </div>
      <h2 className="mt-10 text-[22px]" style={{ ...U, fontWeight: 500 }}>Shipping</h2>
      <p className="mt-2 max-w-3xl" style={{ color: HF.softLilac }}>
        Cards ship direct from the seller to you. That keeps things cheap and fast. HoloFare never touches the card, so we cannot inspect it before it reaches you. We will help you open a dispute with the seller or the marketplace if the card is not as listed, give you the order record, seller details and tracking, and release or refund according to the published policy.
      </p>
      <p className="mt-6 text-[13px]" style={{ color: HF.dimLilac }}>{DISCLAIMER} (Draft wording, pending legal review.)</p>
    </Shell>
  );
}
