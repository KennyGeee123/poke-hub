import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  HF, SHIMMER, PILL, TIERS, DEMO, RECENT, DISCLAIMER, FOOTER, bestMatches, fare, findDemo, fmtClock, usd, type Tier,
} from "@/lib/holofare";

const U: CSSProperties = { fontFamily: "'Unbounded', sans-serif" };
const D: CSSProperties = { fontFamily: "'DM Sans', sans-serif" };
const M: CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 };

export function Pill({ label, dot }: { label: string; dot?: boolean }) {
  const c = PILL[label] ?? { bg: HF.panelBorder, fg: HF.frost };
  return (
    <span className="hf-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: c.bg, color: c.fg, ...D }}>
      {dot && <span className="hf-blink inline-block h-2 w-2 rounded-full" style={{ background: c.fg }} />}
      {label}
    </span>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="16" rx="14.5" ry="7" fill="none" stroke={HF.cyan} strokeWidth="1.8" transform="rotate(-25 16 16)" />
        <rect x="10" y="6" width="12" height="20" rx="2" fill={HF.gold} />
        <rect x="12.5" y="9" width="7" height="8" rx="1" fill={HF.magenta} />
      </svg>
      <span style={{ ...U, fontWeight: 700, fontSize: size * 0.72, color: HF.frost }}>HoloFare</span>
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hf-root relative z-[1] min-h-screen" style={{ isolation: "isolate", background: HF.voidNavy, color: HF.frost, ...D }}>
      <div className="w-full py-1.5 text-center text-xs font-semibold" style={{ background: "#4D3E10", color: HF.gold }}>
        Demo build with sample data. No real purchases, holds or charges happen here.
      </div>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/holofare" aria-label="HoloFare home"><Logo /></Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm" style={{ color: HF.softLilac }}>
          <span title="Future screen">Deals</span><span title="Future screen">Binder</span><span title="Future screen">Watchlist</span>
          <Link to="/holofare/how-money-works" style={{ color: HF.cyan }}>How money works</Link>
          <Link to="/holofare/build-log" style={{ color: HF.cyan }}>Build log</Link>
          <button className="rounded-full px-4 py-2 font-semibold" style={{ border: `1px solid ${HF.inputBorder}`, color: HF.frost, minHeight: 44 }}>Sign in</button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-5 pb-10 text-[13px] leading-normal" style={{ color: HF.dimLilac }}>
        <div className="mb-3 h-px w-full" style={{ background: SHIMMER, opacity: 0.6 }} />
        <p>{FOOTER}</p>
        <p className="mt-2">Back to <Link to="/" style={{ color: HF.softLilac, textDecoration: "underline" }}>PokéVault</Link></p>
      </footer>
      <style>{`
        .hf-blink{animation:hfb 1s steps(2) infinite}@keyframes hfb{50%{opacity:.2}}
        .hf-sheen{position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);background-size:250% 100%;animation:hfs 3s ease-in-out infinite}
        @keyframes hfs{0%{background-position:150% 0}100%{background-position:-50% 0}}
        .hf-stamp{animation:hfst .45s cubic-bezier(.2,1.6,.4,1) both}@keyframes hfst{0%{transform:scale(2.4) rotate(-14deg);opacity:0}100%{transform:scale(1) rotate(-8deg);opacity:1}}
        .hf-flip{animation:hff .6s ease both}@keyframes hff{0%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
        .hf-root button:focus-visible,.hf-root a:focus-visible,.hf-root input:focus-visible{outline:2px solid ${HF.cyan};outline-offset:2px}
        @media (prefers-reduced-motion: reduce){.hf-sheen,.hf-blink,.hf-stamp,.hf-flip{animation:none}.hf-tilt{transform:none!important}}
      `}</style>
    </div>
  );
}

const panel: CSSProperties = { background: HF.deepOrbit, border: `1px solid ${HF.panelBorder}`, borderRadius: 18 };

type Cond = "any" | "raw" | "graded";
type Screen = "home" | "match" | "tracker" | "nomatch";

export function HoloFareApp({ initial }: { initial?: { screen?: string; tier?: string; q?: string; step?: string } }) {
  const [screen, setScreen] = useState<Screen>((initial?.screen as Screen) || "home");
  const [q, setQ] = useState(initial?.q || "");
  const [cond, setCond] = useState<Cond>("any");
  const [query, setQuery] = useState(initial?.q || "Shiny Charizard");
  const go = (s: string) => {
    const d = findDemo(s);
    setQuery(s || "Shiny Charizard");
    setScreen(d ? "match" : "nomatch");
  };
  return (
    <Shell>
      {screen === "home" && <Home q={q} setQ={setQ} cond={cond} setCond={setCond} onFetch={() => go(q)} />}
      {screen === "nomatch" && (
        <section className="mx-auto mt-10 max-w-xl p-8" style={panel}>
          <h2 style={{ ...U, fontWeight: 700, fontSize: 27 }}>No match</h2>
          <p className="mt-3" style={{ color: HF.softLilac }}>We could not find that card at a fair price right now. Set a price alert and we will tell you when it appears.</p>
          <p className="mt-2 text-[13px]" style={{ color: HF.dimLilac }}>Demo catalog: Shiny Charizard, Umbreon Alt Art, Gengar Holo.</p>
          <div className="mt-6 flex gap-3"><Btn kind="outline" onClick={() => setScreen("home")}>Back to search</Btn><Btn kind="outline">Set price alert</Btn></div>
        </section>
      )}
      {screen === "match" && (
        <Match query={query} cond={cond} initialTier={initial?.tier as Tier | undefined}
          onLock={() => setScreen("tracker")} onPass={() => setScreen("home")} onAnother={() => setScreen("home")} />
      )}
      {screen === "tracker" && <Tracker query={query} cond={cond} startStep={Number(initial?.step) || 0} onNew={() => setScreen("home")} />}
    </Shell>
  );
}

function Btn({ children, kind, onClick, big }: { children: ReactNode; kind: "mint" | "outline" | "shimmer"; onClick?: () => void; big?: boolean }) {
  const s: CSSProperties = { ...U, fontWeight: 700, fontSize: big ? 19 : 16, minHeight: 44, borderRadius: 999, padding: big ? "16px 32px" : "11px 22px" };
  if (kind === "mint") Object.assign(s, { background: HF.mint, color: HF.voidNavy });
  if (kind === "shimmer") Object.assign(s, { background: SHIMMER, color: HF.voidNavy });
  if (kind === "outline") Object.assign(s, { border: `1px solid ${HF.inputBorder}`, color: HF.frost, background: "transparent" });
  return <button onClick={onClick} style={s}>{children}</button>;
}

function Home({ q, setQ, cond, setCond, onFetch }: { q: string; setQ: (s: string) => void; cond: Cond; setCond: (c: Cond) => void; onFetch: () => void }) {
  return (
    <section className="pt-8">
      <h1 className="max-w-3xl text-[40px] md:text-[64px]" style={{ ...U, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.02em" }}>Name your card. We'll fetch it.</h1>
      <p className="mt-4 max-w-2xl text-[20px]" style={{ color: HF.softLilac }}>We find the closest-to-lowest Buy It Now price, add shipping, and hold the fare for you. You get one tap and a countdown.</p>
      <form className="mt-8 max-w-3xl p-5" style={panel} onSubmit={(e) => { e.preventDefault(); onFetch(); }}>
        <label htmlFor="hf-card" className="text-sm font-semibold" style={{ color: HF.softLilac }}>Card</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="hf-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Shiny Charizard"
            className="flex-1 rounded-xl px-4 py-3 text-lg" style={{ background: HF.voidNavy, border: `1px solid ${HF.inputBorder}`, color: HF.frost, minHeight: 52 }} />
          <button type="submit" style={{ ...U, fontWeight: 700, fontSize: 17, background: SHIMMER, color: HF.voidNavy, borderRadius: 14, padding: "0 28px", minHeight: 52 }}>Fetch it</button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm" role="radiogroup" aria-label="Condition">
          <span style={{ color: HF.softLilac }}>Condition:</span>
          {(["any", "raw", "graded"] as Cond[]).map((c) => (
            <button type="button" key={c} role="radio" aria-checked={cond === c} onClick={() => setCond(c)}
              className="rounded-full px-4 font-semibold" style={{ minHeight: 44, background: cond === c ? HF.cyan : "transparent", color: cond === c ? HF.voidNavy : HF.frost, border: `1px solid ${cond === c ? HF.cyan : HF.inputBorder}` }}>
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </form>
      <h2 className="mt-12 text-[22px]" style={{ ...U, fontWeight: 500 }}>Recently fetched</h2>
      <div className="mt-4 overflow-hidden rounded-2xl" style={{ border: `1px solid ${HF.panelBorder}` }}>
        {RECENT.map((r, i) => (
          <div key={r.name} className="hf-flip grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 sm:grid-cols-[1fr_120px_130px_130px]"
            style={{ background: HF.boardNavy, borderTop: i ? `1px solid ${HF.panelBorder}` : undefined, animationDelay: `${i * 120}ms` }}>
            <span className="font-semibold">{r.name}</span>
            <span className="hidden sm:block" style={{ color: HF.softLilac }}>{r.cond}</span>
            <span style={{ ...M, color: HF.gold, fontSize: 17 }}>{usd(r.price)}</span>
            <span><Pill label={r.status} /></span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[13px]" style={{ color: HF.dimLilac }}>Sample data for the mockup</p>
    </section>
  );
}

function Ring({ left, total }: { left: number; total: number }) {
  const r = 88, c = 2 * Math.PI * r, frac = Math.max(0, left / total);
  const color = frac < 0.25 ? HF.magenta : HF.cyan;
  return (
    <div className="relative mx-auto" style={{ width: 200, height: 200 }} role="timer" aria-label={`${fmtClock(left)} left on this fare`}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke={HF.trackBlue} strokeWidth="12" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={-c * (1 - frac)} transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ ...M, fontSize: 44, color: HF.frost, lineHeight: 1 }}>{fmtClock(left)}</span>
        <span className="mt-1 text-sm" style={{ color: HF.softLilac }}>left on this fare</span>
      </div>
    </div>
  );
}

function CardArt({ name, cond }: { name: string; cond: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <div>
      <div ref={ref} className="hf-tilt relative mx-auto aspect-[63/88] w-full max-w-[340px] rounded-[22px] p-[3px]"
        style={{ background: SHIMMER, transform: `perspective(900px) rotateX(${t.y}deg) rotateY(${t.x}deg)`, transition: "transform .15s" }}
        onMouseMove={(e) => { const b = ref.current!.getBoundingClientRect(); setT({ x: ((e.clientX - b.left) / b.width - 0.5) * 16, y: -((e.clientY - b.top) / b.height - 0.5) * 16 }); }}
        onMouseLeave={() => setT({ x: 0, y: 0 })}>
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[19px]"
          style={{ background: `radial-gradient(circle at 30% 20%, ${HF.deepOrbit}, ${HF.voidNavy})` }}>
          <svg width="96" height="96" viewBox="0 0 32 32" aria-hidden><rect x="9" y="4" width="14" height="24" rx="2" fill="none" stroke={HF.softLilac} strokeWidth="1.2" /><circle cx="16" cy="13" r="4" fill="none" stroke={HF.cyan} strokeWidth="1.2" /></svg>
          <span className="mt-3 text-xs" style={{ color: HF.dimLilac }}>Placeholder art (demo)</span>
          <div className="hf-sheen" />
        </div>
      </div>
      <div className="mt-4 text-center">
        <div className="text-xl font-bold">{name}</div>
        <div className="text-sm" style={{ color: HF.softLilac }}>{cond}</div>
      </div>
    </div>
  );
}

function Match({ query, cond, initialTier, onLock, onPass, onAnother }: { query: string; cond: Cond; initialTier?: Tier; onLock: () => void; onPass: () => void; onAnother: () => void }) {
  const demo = findDemo(query) ?? DEMO[0];
  const matches = useMemo(() => bestMatches(demo.listings, cond), [demo, cond]);
  const best = matches[0] ?? demo.listings[0];
  const f = fare(best);
  const [tier, setTier] = useState<Tier>(initialTier || demo.tier);
  const total = TIERS[tier].seconds;
  const [left, setLeft] = useState(total);
  useEffect(() => { setLeft(TIERS[tier].seconds); }, [tier]);
  useEffect(() => { if (left <= 0) return; const id = setTimeout(() => setLeft((s) => s - 1), 1000); return () => clearTimeout(id); }, [left]);
  const expired = left <= 0;
  const viewers = demo.viewers;
  return (
    <section className="grid gap-8 pt-4 md:grid-cols-[1fr_1.1fr]">
      <div className="order-3 md:order-1">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: HF.dimLilac }}>
          Demo toggle (prototype only):
          {(Object.keys(TIERS) as Tier[]).map((k) => (
            <button key={k} onClick={() => setTier(k)} className="rounded-full px-3 py-1" style={{ border: `1px solid ${tier === k ? HF.cyan : HF.inputBorder}`, color: tier === k ? HF.cyan : HF.softLilac }}>
              {k === "hot" ? "Hot (45 seconds)" : k === "steady" ? "Steady (3 minutes)" : "Slow (10 minutes)"}
            </button>
          ))}
          <button onClick={() => setLeft(0)} className="rounded-full px-3 py-1" style={{ border: `1px solid ${HF.inputBorder}`, color: HF.softLilac }}>Expire now</button>
        </div>
        <CardArt name={demo.name} cond={`${best.condition} · ${best.isSlab ? "Graded" : "Raw"}`} />
      </div>
      <div className="order-1 flex flex-col gap-4 md:order-2">
        {expired ? (
          <div className="p-6" style={{ ...panel, border: `2px solid ${HF.magenta}` }}>
            <h2 style={{ ...U, fontWeight: 700, fontSize: 27 }}>This fare expired</h2>
            <p className="mt-3" style={{ color: HF.softLilac }}>The lock ran out before you confirmed, so your card was not touched. Another buyer may take this listing. We can search again for the next closest price.</p>
            <div className="mt-5"><Btn kind="outline" onClick={onAnother}>Find me another</Btn></div>
          </div>
        ) : (
          <div className="p-6" style={panel}>
            <h2 className="mb-4 text-center" style={{ ...U, fontWeight: 700, fontSize: 27 }}>Fare Lock</h2>
            <Ring left={left} total={total} />
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center">
              <Pill label={TIERS[tier].label} dot />
              <span className="text-sm" style={{ color: HF.softLilac }}>{TIERS[tier].why}</span>
            </div>
            {viewers > 0 && (
              <p className="mt-3 text-center text-sm" style={{ color: viewers >= 10 ? HF.magenta : HF.softLilac }}>
                {viewers === 1 ? "1 person is looking at this card right now" : `${viewers} people are looking at this card right now`} <span style={{ color: HF.dimLilac }}>(sample)</span>
              </p>
            )}
          </div>
        )}
        <div className="p-6" style={panel}>
          <Row k="Card price" v={usd(f.card)} />
          <Row k="Shipping direct from seller" v={usd(f.shipping)} />
          <Row k="HoloFare service fee" v={usd(f.fee)} />
          <div className="my-3 h-px" style={{ background: HF.panelBorder }} />
          <div className="flex items-end justify-between"><span className="font-semibold">Total landed price</span><span style={{ ...M, fontSize: 32, color: HF.gold }}>{usd(f.total)}</span></div>
          <p className="mt-3 text-[13px]" style={{ color: HF.dimLilac }}>Price protected: if the seller's price rises a little before we buy, we cover the difference. Your total stays the same.</p>
          {!expired && (
            <div className="mt-5 flex flex-wrap gap-3"><Btn kind="mint" big onClick={onLock}>Lock it in</Btn><Btn kind="outline" onClick={onPass}>Pass</Btn></div>
          )}
          <p className="mt-4 text-[14px]" style={{ color: HF.softLilac }}>When you tap, we place a short hold on your card, usually for under a minute. The purchase goes straight through and your card is charged once it is verified. If anything fails, the hold is released automatically, and never later than 2 minutes.</p>
        </div>
        <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${HF.panelBorder}` }}>
          <div className="px-5 py-2 text-xs font-semibold" style={{ background: HF.boardNavy, color: HF.softLilac }}>Also found</div>
          {matches.slice(1, 3).map((l, i) => (
            <div key={i} className="flex justify-between px-5 py-2.5 text-sm" style={{ background: HF.boardNavy, borderTop: `1px solid ${HF.panelBorder}`, color: HF.softLilac }}>
              <span>{l.title}</span><span style={{ ...M, color: HF.gold }}>{usd(fare(l).total)}</span>
            </div>
          ))}
        </div>
        <p className="text-[13px]" style={{ color: HF.dimLilac }}>{DISCLAIMER}</p>
      </div>
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-1.5"><span style={{ color: HF.softLilac }}>{k}</span><span style={{ ...M, fontSize: 17 }}>{v}</span></div>
);

const STEPS = [
  ["Hold placed", (t: string) => `Short hold of ${t} on your card. Nothing is charged yet.`],
  ["Purchasing", () => "We are buying the listing from the seller now."],
  ["Verified", () => "Seller confirmation received. Your card is charged."],
  ["In transit", () => "Shipped direct from the seller. Tracking appears here."],
  ["Delivered", () => "Your card has arrived."],
] as const;

function Tracker({ query, cond, startStep, onNew }: { query: string; cond: Cond; startStep: number; onNew: () => void }) {
  const demo = findDemo(query) ?? DEMO[0];
  const best = bestMatches(demo.listings, cond)[0] ?? demo.listings[0];
  const t = usd(fare(best).total);
  const [step, setStep] = useState(startStep);
  useEffect(() => { if (step >= 4) return; const id = setTimeout(() => setStep((s) => s + 1), 2200); return () => clearTimeout(id); }, [step]);
  const title = step < 2 ? "Fetching your card" : step < 3 ? "Purchase verified" : "On its way to you";
  const charged = step >= 2;
  return (
    <section className="pt-4">
      <p className="text-sm font-semibold" style={{ color: HF.mint }}>Locked in</p>
      <h1 className="mt-1 text-[32px] md:text-[40px]" style={{ ...U, fontWeight: 700, lineHeight: 1.1 }}>{title}</h1>
      <p className="mt-2" style={{ color: HF.softLilac }}>{demo.name} · {best.condition}</p>
      <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <ol className="relative p-6" style={panel}>
          {STEPS.map(([name, detail], i) => {
            const done = i < step || (i === 4 && step === 4), now = i === step && step < 4;
            const col = done ? HF.mint : now ? HF.cyan : HF.inputBorder;
            return (
              <li key={name} className="relative flex gap-4 pb-6 last:pb-0" style={{ opacity: done || now ? 1 : 0.45 }}>
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-4 w-4 rounded-full" style={{ background: col, boxShadow: now ? `0 0 12px ${HF.cyan}` : undefined }} />
                  {i < 4 && <span className="mt-1 w-0.5 flex-1" style={{ background: i < step ? HF.mint : HF.panelBorder }} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-bold">{name}</span>
                    {done && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#17503A", color: HF.mint }}>Done</span>}
                    {now && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#10435A", color: HF.cyan }}>Now</span>}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: HF.softLilac }}>{detail(t)}</p>
                </div>
                {name === "Verified" && step >= 2 && (
                  <span className="hf-stamp absolute right-2 top-0 rounded-lg border-4 px-3 py-1 text-xl" style={{ ...U, fontWeight: 700, borderColor: HF.mint, color: HF.mint }}>VERIFIED</span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-4">
          <div className="p-6" style={panel}>
            <div className="text-sm font-semibold" style={{ color: HF.softLilac }}>Payment</div>
            <div className="mt-2" style={{ ...M, fontSize: 32, color: HF.gold }}>{t}</div>
            <div className="mt-3"><Pill label={charged ? "Charged" : "Hold placed"} /></div>
            <p className="mt-3 text-sm" style={{ color: HF.softLilac }}>
              {charged ? "The seller confirmed, so the hold became a charge." : "A short hold, not a charge. It is released automatically if anything fails."}
            </p>
            <p className="mt-2 text-[12px]" style={{ color: HF.dimLilac }}>Demo: no real hold or charge. Steps advance automatically.</p>
          </div>
          <Btn kind="outline" onClick={onNew}>Start a new search</Btn>
          <button className="text-left text-sm underline" style={{ color: HF.softLilac }}>Report a problem</button>
        </div>
      </div>
      <p className="mt-6 text-[13px]" style={{ color: HF.dimLilac }}>{DISCLAIMER}</p>
    </section>
  );
}
