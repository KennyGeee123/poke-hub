import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OrderDialog, type ShopItem as Item, TYPE_LABEL } from "@/components/shop/OrderDialog";

export const Route = createFileRoute("/shop/")({
  head: () => ({
    meta: [
      { title: "Shop sealed & singles — PokéVault Pro" },
      { name: "description", content: "Pokémon booster boxes, ETBs and single cards at the lowest prices we can find." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const [kind, setKind] = useState<"sealed" | "single">("sealed");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Item[]; total: number; pageSize: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buying, setBuying] = useState<Item | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [kind, debounced, sort]);
  useEffect(() => {
    const ctl = new AbortController();
    const p = new URLSearchParams({ kind, q: debounced, sort, page: String(page), pageSize: "24" });
    fetch(`/api/public/shop?${p}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => { if (j.error) setErr(j.error); else { setErr(null); setData(j); } })
      .catch((e) => { if (e.name !== "AbortError") setErr("Could not load the shop."); });
    return () => ctl.abort();
  }, [kind, debounced, sort, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <main className="mx-auto max-w-6xl p-4 text-white">
      <h1 className="mb-1 text-2xl font-bold">Shop</h1>
      <p className="mb-4 text-sm opacity-70">We check many sellers for the lowest price and ship it to you. <Link to="/shop/order" search={{ code: "" }} className="underline">Track an order</Link></p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["sealed", "single"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm ${kind === k ? "bg-yellow-400 text-black" : "bg-white/10"}`}>
            {k === "sealed" ? "Sealed products" : "Single cards"}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search set or card…" className="min-w-48 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-sm">
          <option value="price_asc">Lowest price</option>
          <option value="price_desc">Highest price</option>
          <option value="newest">Recently updated</option>
        </select>
      </div>
      {err && <p className="text-red-400">{err}</p>}
      {!data && !err && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      )}
      {data && data.items.length === 0 && <p className="opacity-70">No products yet.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data?.items.map((it) => (
          <div key={it.id} className="flex flex-col rounded-xl bg-white/5 p-3">
            <Link to="/shop/$id" params={{ id: it.id }} className="block">
              {it.image_url && <img src={it.image_url} alt={it.name} loading="lazy" className="mb-2 aspect-square w-full rounded object-contain" />}
            <div className="text-xs opacity-60">{TYPE_LABEL[it.product_type ?? ""] ?? it.product_type} · {it.set_name}{it.card_number ? ` #${it.card_number}` : ""}</div>
            <div className="mb-2 line-clamp-2 text-sm font-medium hover:underline">{it.name}</div>
            </Link>
            <div className="mt-auto flex items-end justify-between">
              <div>
                <div className="text-lg font-bold">${Number(it.sale_price).toFixed(2)}</div>
                <div className="text-[10px] opacity-50">Checked {it.seller_count} seller{it.seller_count === 1 ? "" : "s"} · {new Date(it.updated_at).toLocaleDateString()}</div>
              </div>
              {it.sell_mode === "affiliate" && it.affiliate_url ? (
                <a href={it.affiliate_url} target="_blank" rel="sponsored noopener noreferrer" className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-black">Buy</a>
              ) : (
                <button onClick={() => setBuying(it)} className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-black">Buy</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded bg-white/10 px-3 py-1 disabled:opacity-30">Prev</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded bg-white/10 px-3 py-1 disabled:opacity-30">Next</button>
        </div>
      )}
      {buying && <OrderDialog item={buying} onClose={() => setBuying(null)} />}
    </main>
  );
}
