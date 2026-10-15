import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OrderDialog, type ShopItem, TYPE_LABEL } from "@/components/shop/OrderDialog";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({ meta: [{ title: "Product — PokéVault Pro Shop" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const [item, setItem] = useState<ShopItem | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [buying, setBuying] = useState(false);
  useEffect(() => {
    fetch(`/api/public/shop?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => {
      const it = j.items?.[0]; if (it) { setItem(it); setState("ok"); document.title = `${it.name} — PokéVault Pro Shop`; } else setState("missing");
    }).catch(() => setState("missing"));
  }, [id]);
  if (state === "loading") return <main className="mx-auto max-w-4xl p-6 text-white"><div className="h-96 animate-pulse rounded-xl bg-white/5" /></main>;
  if (!item) return <main className="mx-auto max-w-4xl p-6 text-white"><p>This product isn't available.</p><Link to="/shop" className="underline">Back to shop</Link></main>;
  const affiliate = item.sell_mode === "affiliate" && item.affiliate_url;
  return (
    <main className="mx-auto max-w-4xl p-4 text-white">
      <Link to="/shop" className="text-sm opacity-70 hover:underline">← Back to shop</Link>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-4">{item.image_url && <img src={item.image_url} alt={item.name} className="mx-auto max-h-[480px] object-contain" />}</div>
        <div>
          <div className="text-sm opacity-60">{TYPE_LABEL[item.product_type ?? ""] ?? item.product_type} · {item.set_name}{item.card_number ? ` #${item.card_number}` : ""}</div>
          <h1 className="mb-3 text-2xl font-bold">{item.name}</h1>
          <div className="mb-1 text-3xl font-bold">${Number(item.sale_price).toFixed(2)}</div>
          <div className="mb-4 text-xs opacity-60">Best price from {item.seller_count} seller{item.seller_count === 1 ? "" : "s"} we checked · updated {new Date(item.updated_at).toLocaleString()}</div>
          <div className="mb-4 inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-300">{item.in_stock ? "In stock" : "Out of stock"}</div>
          {affiliate ? (
            <a href={item.affiliate_url!} target="_blank" rel="sponsored noopener noreferrer" className="block w-full rounded-lg bg-yellow-400 py-3 text-center font-semibold text-black">Buy</a>
          ) : (
            <button onClick={() => setBuying(true)} className="w-full rounded-lg bg-yellow-400 py-3 font-semibold text-black">Buy now</button>
          )}
          <ul className="mt-4 space-y-1 text-sm opacity-80">
            <li>• {item.kind === "sealed" ? "Factory sealed, English" : "Raw single card, Near Mint unless noted"}</li>
            <li>• Ships to the US and Canada</li>
            <li>• Track your order anytime with your order number + email</li>
          </ul>
        </div>
      </div>
      {buying && <OrderDialog item={item} onClose={() => setBuying(false)} />}
    </main>
  );
}
