import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OrderDialog, type ShopItem, TYPE_LABEL } from "@/components/shop/OrderDialog";
import { type Variant, sortVariants, variantLabel } from "@/lib/shop/grades";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({ meta: [{ title: "Product — PokéVault Pro Shop" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const [item, setItem] = useState<ShopItem | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [buying, setBuying] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [vid, setVid] = useState<string>("");
  useEffect(() => {
    fetch(`/api/public/shop?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => {
      const it = j.items?.[0];
      const vs = sortVariants((j.variants ?? []) as Variant[]);
      setVariants(vs);
      const first = vs.find((v) => v.price_status === "priced"); setVid(first?.id ?? "");
      if (it) { setItem(it); setState("ok"); document.title = `${it.name} — PokéVault Pro Shop`; } else setState("missing");
    }).catch(() => setState("missing"));
  }, [id]);
  if (state === "loading") return <main className="mx-auto max-w-4xl p-6 text-white"><div className="h-96 animate-pulse rounded-xl bg-white/5" /></main>;
  if (!item) return <main className="mx-auto max-w-4xl p-6 text-white"><p>This product isn't available.</p><Link to="/shop" className="underline">Back to shop</Link></main>;
  const affiliate = item.sell_mode === "affiliate" && item.affiliate_url;
  const chosen = variants.find((v) => v.id === vid) ?? null;
  const price = chosen?.sale_price ?? item.sale_price;
  const onRequest = chosen?.price_status === "on_request";
  return (
    <main className="mx-auto max-w-4xl p-4 text-white">
      <Link to="/shop" className="text-sm opacity-70 hover:underline">← Back to shop</Link>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-4">{item.image_url && <img src={item.image_url} alt={item.name} className="mx-auto max-h-[480px] object-contain" />}</div>
        <div>
          <div className="text-sm opacity-60">{TYPE_LABEL[item.product_type ?? ""] ?? item.product_type} · {item.set_name}{item.card_number ? ` #${item.card_number}` : ""}</div>
          <h1 className="mb-3 text-2xl font-bold">{item.name}</h1>
          {variants.length > 0 && (
            <fieldset className="mb-3">
              <legend className="mb-1 text-sm opacity-70">Condition / grade</legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <label key={v.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${v.id === vid ? "border-yellow-400 bg-yellow-400/10" : "border-white/15 bg-white/5"}`}>
                    <input type="radio" name="variant" value={v.id} checked={v.id === vid} onChange={() => setVid(v.id)} className="sr-only" />
                    <span className="block">{variantLabel(v)}</span>
                    <span className="block font-semibold">{v.price_status === "priced" && v.sale_price != null ? `$${Number(v.sale_price).toFixed(2)}` : "Price on request"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="mb-1 text-3xl font-bold">{onRequest ? "Price on request" : `$${Number(price).toFixed(2)}`}</div>
          <div className="mb-4 text-xs opacity-60">{onRequest ? <>Graded prices are quoted on request · we'll reply by email</> : <>Best price from {item.seller_count} seller{item.seller_count === 1 ? "" : "s"} we checked · updated {new Date(item.updated_at).toLocaleString()}</>}</div>
          <div className="mb-4 inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-300">{item.in_stock ? "In stock" : "Out of stock"}</div>
          {affiliate ? (
            <a href={item.affiliate_url!} target="_blank" rel="sponsored noopener noreferrer" className="block w-full rounded-lg bg-yellow-400 py-3 text-center font-semibold text-black">Buy</a>
          ) : onRequest ? (
            import.meta.env.VITE_SHOP_CONTACT_EMAIL ? (
              <a href={`mailto:${import.meta.env.VITE_SHOP_CONTACT_EMAIL}?subject=${encodeURIComponent(`Quote request: ${item.name} (${chosen ? variantLabel(chosen) : ""})`)}`} className="block w-full rounded-lg bg-white/10 py-3 text-center font-semibold">Request a quote</a>
            ) : (
              <p className="rounded-lg bg-white/10 py-3 text-center text-sm">Not available to buy online yet. Choose a priced grade above.</p>
            )
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
      {buying && <OrderDialog item={item} variant={chosen && chosen.sale_price != null ? { id: chosen.id, label: variantLabel(chosen), sale_price: chosen.sale_price } : null} onClose={() => setBuying(false)} />}
    </main>
  );
}
