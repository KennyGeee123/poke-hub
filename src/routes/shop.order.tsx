import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/shop/order")({
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s.code === "string" ? s.code.slice(0, 12) : "" }),
  head: () => ({ meta: [{ title: "Track your order — PokéVault Pro" }] }),
  component: Lookup,
});

const STEPS = ["pending", "paid", "ordered_from_source", "shipped", "delivered"];
const LABEL: Record<string, string> = { pending: "Awaiting payment", paid: "Paid", ordered_from_source: "Being prepared", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };

type Order = { order_code: string; product_id: string; product_name: string; quantity: number; total: number; status: string; tracking_number: string | null; created_at: string };

function Lookup() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const j = await fetch("/api/public/shop-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, email }) }).then((r) => r.json()).catch(() => ({ error: "Network error" }));
    setBusy(false);
    if (j.error) { setOrder(null); setErr(j.error); } else setOrder(j.order);
  };
  const idx = order ? STEPS.indexOf(order.status) : -1;
  return (
    <main className="mx-auto max-w-lg p-6 text-white">
      <h1 className="mb-4 text-2xl font-bold">Track your order</h1>
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-xs opacity-70">Order number<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 709E4EC4" className="w-full rounded bg-white/10 px-3 py-2 text-sm uppercase" /></label>
        <label className="block text-xs opacity-70">Email used at checkout<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded bg-white/10 px-3 py-2 text-sm" /></label>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button disabled={busy} className="w-full rounded bg-yellow-400 py-2 font-semibold text-black">{busy ? "Looking up…" : "Find order"}</button>
      </form>
      {order && (
        <div className="mt-6 space-y-3 rounded-xl bg-white/5 p-4">
          <div className="text-sm opacity-60">Order #{order.order_code} · {new Date(order.created_at).toLocaleDateString()}</div>
          <div className="font-medium">{order.quantity} × <Link to="/shop/$id" params={{ id: order.product_id }} className="underline">{order.product_name}</Link></div>
          <div>Total ${order.total.toFixed(2)}</div>
          <div className="text-lg font-bold">{LABEL[order.status] ?? order.status}</div>
          {idx >= 0 && <div className="flex gap-1">{STEPS.map((s, i) => <div key={s} title={LABEL[s]} className={`h-2 flex-1 rounded ${i <= idx ? "bg-yellow-400" : "bg-white/10"}`} />)}</div>}
          {order.tracking_number && <div className="text-sm">Tracking: <span className="font-mono">{order.tracking_number}</span></div>}
        </div>
      )}
    </main>
  );
}
