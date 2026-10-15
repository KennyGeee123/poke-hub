import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ADMIN_HEADER, ORDER_STATUSES } from "@/lib/shop/admin";
import { DEFAULT_PRICING, type MarkupRule, type PricingSettings, type RoundingMode, normalizePricing, salePrice } from "@/lib/shop/core";
import { profit as calcProfit, profitPct } from "@/lib/shop/admin";
import { formatAddress, orderCode, plural } from "@/lib/shop/checkout";

export const Route = createFileRoute("/shop/admin")({
  head: () => ({ meta: [{ title: "Shop admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const KEY = "shop-admin-secret";
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const pct = (n: unknown) => (n == null ? "" : ` (${Number(n).toFixed(1)}%)`);
const money = (n: unknown) => (n == null || n === "" ? "—" : `$${Number(n).toFixed(2)}`);
const box = "rounded-xl bg-white/5 p-3";
const btn = "rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20 disabled:opacity-40";
const input = "rounded bg-white/10 px-2 py-1 text-sm";

function useAdmin(secret: string, onUnauthorized: () => void) {
  return useCallback(
    async (action: string, args: Any = {}): Promise<Any> => {
      const r = await fetch("/api/shop-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_HEADER]: secret },
        body: JSON.stringify({ action, ...args }),
      });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (r.status === 401) onUnauthorized();
      if (j.error) throw new Error(j.error);
      return j;
    },
    [secret, onUnauthorized],
  );
}

function AdminPage() {
  const [secret, setSecret] = useState("");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "products" | "markup" | "refresh">("orders");
  useEffect(() => setSecret(sessionStorage.getItem(KEY) ?? ""), []);
  const logout = useCallback(() => { sessionStorage.removeItem(KEY); setSecret(""); setErr("Wrong or expired admin secret."); }, []);
  const call = useAdmin(secret, logout);

  if (!secret)
    return (
      <main className="mx-auto max-w-sm p-6 text-white">
        <h1 className="mb-3 text-xl font-bold">Shop admin</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const r = await fetch("/api/shop-admin", { method: "POST", headers: { "Content-Type": "application/json", [ADMIN_HEADER]: draft }, body: JSON.stringify({ action: "ping" }) });
          if (r.ok) { sessionStorage.setItem(KEY, draft); setSecret(draft); setErr(null); } else setErr("Wrong admin secret.");
        }} className="space-y-2">
          <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Admin secret" className={`${input} w-full py-2`} />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button className="w-full rounded bg-yellow-400 py-2 font-semibold text-black">Unlock</button>
        </form>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl p-4 text-white">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Shop admin</h1>
        {(["orders", "products", "markup", "refresh"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${btn} ${tab === t ? "bg-yellow-400 text-black" : ""}`}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
        <button onClick={logout} className={btn}>Lock</button>
      </div>
      {tab === "orders" && <Orders call={call} />}
      {tab === "products" && <Products call={call} />}
      {tab === "markup" && <Markup call={call} />}
      {tab === "refresh" && <Refresh call={call} />}
    </main>
  );
}

type Call = ReturnType<typeof useAdmin>;

function Orders({ call }: { call: Call }) {
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<Any[]>([]);
  const [open, setOpen] = useState<Any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => call("orders.list", { status: status || undefined }).then((j) => setOrders(j.orders)).catch((e) => setMsg(e.message)), [call, status]);
  useEffect(() => { load(); }, [load]);
  const total = orders.reduce((s, o) => s + (o.profit ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={load} className={btn}>Reload</button>
        <span className="ml-auto text-sm opacity-70">{plural(orders.length, "order")} · est. profit {money(total)}{orders.some((o) => o.negative_margin) && <span className="ml-2 text-red-400">⚠ {plural(orders.filter((o) => o.negative_margin).length, "order")} now cost more than sale price</span>}</span>
      </div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <table className="w-full text-sm">
        <thead className="text-left opacity-60"><tr><th>#</th><th>Date</th><th>Product</th><th>Qty</th><th>Sale</th><th>Source</th><th>Profit</th><th>Status</th><th /></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={`border-t border-white/10 ${o.negative_margin ? "bg-red-500/10" : ""}`}>
              <td className="font-mono">{orderCode(o.id)}</td>
              <td>{new Date(o.created_at).toLocaleString()}</td><td>{o.product_name}</td><td>{o.quantity}</td>
              <td>{money(o.sale_price)}</td><td>{money(o.source_price_snapshot)} {o.source_snapshot}</td><td>{money(o.profit)}{pct(o.profit_pct)}{o.negative_margin && <span title={`Cheapest source is now ${money(o.current_source_price)}`} className="ml-1 text-red-400">⚠</span>}</td><td>{o.status}</td>
              <td><button className={btn} onClick={() => call("order.get", { id: o.id }).then(setOpen).catch((e) => setMsg(e.message))}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <OrderDetail data={open} call={call} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function OrderDetail({ data, call, onClose }: { data: Any; call: Call; onClose: () => void }) {
  const o = data.order;
  const [f, setF] = useState({ status: o.status, tracking_number: o.tracking_number ?? "", notes: o.notes ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const address = formatAddress(o.customer_name, o.shipping_address);
  const cheapestUrl = data.product?.cheapest_source_url ?? o.source_url_snapshot;
  const now = data.product?.cheapest_source_price;
  const negative = (o.status === "pending" || o.status === "paid") && now != null && Number(now) > Number(o.sale_price);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl bg-neutral-900 p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold">{o.product_name} × {o.quantity}</h2>
        <div className={box + " text-sm"}>
          <div className="mb-1 opacity-70">Order #{orderCode(o.id)} · {o.customer_email}</div>
          <pre className="whitespace-pre-wrap font-sans">{address}</pre>
          <div className="mt-2 flex gap-2">
            <button className={btn} onClick={() => navigator.clipboard.writeText(address).then(() => setMsg("Address copied"), () => setMsg("Copy failed"))}>Copy address</button>
            {cheapestUrl && <a href={cheapestUrl} target="_blank" rel="noreferrer" className="rounded bg-yellow-400 px-3 py-1 text-sm font-semibold text-black">Open cheapest source</a>}
          </div>
        </div>
        <div className={box + " text-sm"}>
          <div>Sold at {money(o.sale_price)} · Snapshot source: {o.source_snapshot} {money(o.source_price_snapshot)} · Profit {money(o.profit)}{pct(o.profit_pct)}</div>
          {o.source_url_snapshot && <a href={o.source_url_snapshot} target="_blank" rel="noreferrer" className="text-yellow-300 underline">Snapshot source link</a>}
          {negative && <div className="my-1 rounded bg-red-500/20 p-2 text-red-300">⚠ Cheapest source is now {money(now)}, above the sale price {money(o.sale_price)}. You would lose money fulfilling this order.</div>}
          <div className="mt-1">Current cheapest: {data.product?.cheapest_source} {money(data.product?.cheapest_source_price)} · Profit now {money(data.currentProfit)}{pct(data.currentProfitPct)}
            {data.product?.cheapest_source_url && <> · <a href={data.product.cheapest_source_url} target="_blank" rel="noreferrer" className="text-yellow-300 underline">buy</a></>}</div>
          <ul className="mt-1 opacity-70">{data.listings.map((l: Any) => <li key={l.source}>{l.source}: {money(l.source_price)} {l.currency} {l.in_stock ? "" : "(out of stock)"}</li>)}</ul>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <input value={f.tracking_number} onChange={(e) => setF({ ...f, tracking_number: e.target.value })} placeholder="Tracking number" className={input} />
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Notes" className={`${input} col-span-2 h-20`} />
        </div>
        {msg && <p className="text-sm text-yellow-300">{msg}</p>}
        <div className="flex gap-2">
          <button className="rounded bg-yellow-400 px-4 py-1 font-semibold text-black" onClick={() => call("order.update", { id: o.id, ...f }).then(onClose).catch((e) => setMsg(e.message))}>Save</button>
          <button className={btn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Products({ call }: { call: Call }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => call("products.list", { q, page }).then(setData).catch((e) => setMsg(e.message)), [call, q, page]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  const update = (id: string, patch: Any) => {
    // Optimistic: reflect the change immediately, then reconcile with the server.
    setData((d: Any) => (d ? { ...d, products: d.products.map((p: Any) => (p.id === id ? { ...p, ...patch } : p)) } : d));
    return call("product.update", { id, ...patch }).then(() => { setMsg(null); load(); }).catch((e) => { setMsg(e.message); load(); });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search products…" className={`${input} w-full py-2`} />
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      {data?.products.map((p: Any) => (
        <div key={p.id} className={`${box} grid grid-cols-1 gap-2 text-sm md:grid-cols-[2fr_1fr_1fr_2fr_auto]`}>
          <div><div className="font-medium">{p.name}</div><div className="opacity-60">{p.kind} · {p.set_name}{p.card_number ? ` #${p.card_number}` : ""}</div>
            <div className="opacity-60">Source {p.cheapest_source} {money(p.cheapest_source_price)} → sale {money(p.price_override ?? p.sale_price)} · profit {money(calcProfit(p.price_override ?? p.sale_price, p.cheapest_source_price))}{pct(profitPct(p.price_override ?? p.sale_price, p.cheapest_source_price))}</div></div>
          <select defaultValue={p.sell_mode} onChange={(e) => update(p.id, { sell_mode: e.target.value })} className={input}><option value="store">store</option><option value="affiliate">affiliate</option></select>
          <input defaultValue={p.price_override ?? ""} placeholder="Price override" onBlur={(e) => e.target.value !== String(p.price_override ?? "") && update(p.id, { price_override: e.target.value })} className={input} />
          <input defaultValue={p.affiliate_url ?? ""} placeholder="Affiliate URL" onBlur={(e) => e.target.value !== (p.affiliate_url ?? "") && update(p.id, { affiliate_url: e.target.value })} className={input} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={p.hidden} onChange={(e) => update(p.id, { hidden: e.target.checked })} />Hide</label>
        </div>
      ))}
      {data && <div className="flex items-center justify-center gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn}>Prev</button><span>Page {page} of {pages} · {plural(data.total, "product")}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className={btn}>Next</button></div>}
    </div>
  );
}

function Markup({ call }: { call: Call }) {
  const [rules, setRules] = useState<Any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const load = useCallback(() => Promise.all([
    call("rules.list").then((j) => setRules(j.rules)),
    call("pricing.get").then((j) => setPricing(normalizePricing(j.pricing))),
  ]).catch((e) => setMsg(e.message)), [call]);
  useEffect(() => { load(); }, [load]);
  const active: MarkupRule[] = rules.filter((r) => r.active).map((r) => ({ min_price: Number(r.min_price), max_price: r.max_price == null ? null : Number(r.max_price), flat_usd: Number(r.flat_usd), percent: Number(r.percent), min_profit_usd: Number(r.min_profit_usd ?? 0) }));
  const edit = (i: number, k: string, v: unknown) => setRules(rules.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = (r: Any) => call("rules.save", { rule: r }).then(() => { setMsg("Saved"); load(); }).catch((e) => setMsg(e.message));
  return (
    <div className="space-y-3 text-sm">
      <table className="w-full">
        <thead className="text-left opacity-60"><tr><th>Min $</th><th>Max $ (blank = none)</th><th>Flat $ (optional)</th><th>Percent of price %</th><th>Min profit $</th><th>Active</th><th /></tr></thead>
        <tbody>{rules.map((r, i) => (
          <tr key={r.id ?? `new-${i}`}>
            {(["min_price", "max_price", "flat_usd", "percent", "min_profit_usd"] as const).map((k) => (
              <td key={k}><input value={r[k] ?? ""} onChange={(e) => edit(i, k, e.target.value)} className={`${input} w-24`} /></td>
            ))}
            <td><input type="checkbox" checked={r.active !== false} onChange={(e) => edit(i, "active", e.target.checked)} /></td>
            <td className="space-x-1"><button className={btn} onClick={() => save(r)}>Save</button>
              {r.id && <button className={btn} onClick={() => call("rules.delete", { id: r.id }).then(load).catch((e) => setMsg(e.message))}>Delete</button>}</td>
          </tr>))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <label>Store-wide minimum profit $ <input value={pricing.min_profit_usd} onChange={(e) => setPricing({ ...pricing, min_profit_usd: e.target.value as unknown as number })} className={`${input} w-20`} /></label>
        <label htmlFor="pricing-rounding">Rounding </label><select id="pricing-rounding" value={pricing.rounding} onChange={(e) => setPricing({ ...pricing, rounding: e.target.value as RoundingMode })} className={input}>
          <option value="whole">Up to whole dollar (default)</option><option value="99">Up to .99</option><option value="none">None (exact cents)</option>
        </select>
        <button className={btn} onClick={() => call("pricing.save", { pricing: { ...pricing, min_profit_usd: Number(pricing.min_profit_usd) } }).then(() => setMsg("Pricing settings saved")).catch((e) => setMsg(e.message))}>Save settings</button>
      </div>
      <div className="flex gap-2">
        <button className={btn} onClick={() => setRules([...rules, { min_price: 0, max_price: "", flat_usd: 0, percent: 10, min_profit_usd: 0, active: true }])}>Add tier</button>
        <button className="rounded bg-yellow-400 px-3 py-1 font-semibold text-black" onClick={() => call("prices.recompute").then((j) => setMsg(`Recomputed ${j.updated} products`)).catch((e) => setMsg(e.message))}>Recompute all sale prices</button>
      </div>
      {msg && <p className="opacity-80">{msg}</p>}
      <div className={box}>
        <div className="mb-1 font-medium">Preview (active tiers shown above)</div>
        <table className="text-sm"><thead className="text-left opacity-60"><tr><th className="pr-6">Source</th><th className="pr-6">Sale</th><th>Profit</th></tr></thead><tbody>
        {[0.05, 0.2, 0.8, 0.99, 1, 2.5, 4.99, 7, 19.99, 45, 111, 300].map((p) => {
          const sp = salePrice(p, active, { min_profit_usd: Number(pricing.min_profit_usd) || 0, rounding: pricing.rounding });
          return <tr key={p}><td className="pr-6">{money(p)}</td><td className="pr-6">{money(sp)}</td><td>{money(calcProfit(sp, p))}{pct(profitPct(sp, p))}</td></tr>;
        })}</tbody></table>
      </div>
    </div>
  );
}

function Refresh({ call }: { call: Call }) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(3);
  const [kinds, setKinds] = useState({ sealed: true, single: true });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const run = async (loop: boolean) => {
    setBusy(true);
    let off = offset;
    try {
      for (;;) {
        const r = await call("refresh", { offset: off, limit, kinds: Object.entries(kinds).filter(([, v]) => v).map(([k]) => k) });
        const line = `offset ${off} → ${r.nextOffset}${r.done ? " (done)" : ""}: ${r.groups.join(", ")} · ${r.products} products, ${r.listings} listings ${JSON.stringify(r.sources)}`;
        setLog((l) => [line, ...l].slice(0, 100));
        off = r.nextOffset; setOffset(off);
        if (!loop || r.done) break;
      }
    } catch (e) { setLog((l) => [`Error: ${(e as Error).message}`, ...l]); }
    setBusy(false);
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label>Offset <input type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value))} className={`${input} w-20`} /></label>
        <label>Sets per batch <input type="number" min={1} max={10} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${input} w-16`} /></label>
        {(["sealed", "single"] as const).map((k) => <label key={k}><input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} /> {k}</label>)}
        <button disabled={busy} className={btn} onClick={() => run(false)}>Run one batch</button>
        <button disabled={busy} className="rounded bg-yellow-400 px-3 py-1 font-semibold text-black disabled:opacity-40" onClick={() => run(true)}>Run until done</button>
        {busy && <span className="opacity-70">Running…</span>}
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-xs">{log.join("\n")}</pre>
    </div>
  );
}
