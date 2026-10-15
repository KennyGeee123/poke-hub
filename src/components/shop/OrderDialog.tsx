import { useState } from "react";
import { COUNTRIES, EMAIL_RE, REGIONS, validateShipping } from "@/lib/shop/checkout";

export type ShopItem = {
  id: string; kind: "sealed" | "single"; product_type: string | null; name: string; set_name: string | null;
  card_number: string | null; image_url: string | null; sale_price: number; in_stock: boolean; updated_at: string;
  seller_count: number; sell_mode: "store" | "affiliate"; affiliate_url: string | null;
};

export const TYPE_LABEL: Record<string, string> = {
  booster_box: "Booster Box", etb: "Elite Trainer Box", pc_etb: "Pokémon Center ETB", bundle: "Booster Bundle", pack: "Booster Pack",
  blister: "Blister", tin: "Tin", upc: "Ultra Premium", collection: "Collection", case: "Case", card: "Single",
};

const lbl = "mb-0.5 block text-xs opacity-70";
const inp = "w-full rounded bg-white/10 px-3 py-2 text-sm";

export function OrderDialog({ item, onClose, variant }: { item: ShopItem; onClose: () => void; variant?: { id: string; label: string; sale_price: number } | null }) {
  const unit = Number(variant?.sale_price ?? item.sale_price);
  const [f, setF] = useState({ name: "", email: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US", quantity: 1 });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value, ...(k === "country" ? { state: "" } : {}) });
  const qty = Math.min(20, Math.max(1, Number(f.quantity) || 1));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(f.email)) return setMsg("Enter a valid email");
    const shipErr = validateShipping(f);
    if (shipErr) return setMsg(shipErr);
    setSending(true); setMsg(null);
    const r = await fetch("/api/public/shop-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: item.id, variantId: variant?.id, quantity: qty, email: f.email, name: f.name, shipping: f }),
    }).then((r) => r.json()).catch(() => ({ error: "Network error" }));
    if (r.error) { setMsg(r.error); setSending(false); return; }
    if (r.checkoutUrl) { window.location.href = r.checkoutUrl; return; }
    window.location.href = `/shop/confirmation?order=${encodeURIComponent(r.order.id)}`;
  };
  const country = f.country;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} noValidate className="max-h-[92vh] w-full max-w-md space-y-2 overflow-auto rounded-xl bg-neutral-900 p-4 text-white">
        <h2 className="font-bold">{item.name}</h2>
        {variant && <p className="text-sm text-yellow-300">{variant.label}</p>}
        <p className="text-sm">${unit.toFixed(2)} each</p>
        <label className={lbl}>Full name<input required value={f.name} onChange={set("name")} className={inp} autoComplete="name" /></label>
        <label className={lbl}>Email<input type="email" required value={f.email} onChange={set("email")} className={inp} autoComplete="email" /></label>
        <label className={lbl}>Address<input required value={f.line1} onChange={set("line1")} className={inp} autoComplete="address-line1" /></label>
        <label className={lbl}>Apt / suite (optional)<input value={f.line2} onChange={set("line2")} className={inp} autoComplete="address-line2" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={lbl}>City<input required value={f.city} onChange={set("city")} className={inp} autoComplete="address-level2" /></label>
          <div><label className={lbl} htmlFor="od-country">Country</label>
            <select id="od-country" value={country} onChange={set("country")} className={inp} autoComplete="country">{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div><label className={lbl} htmlFor="od-state">{country === "CA" ? "Province" : "State"}</label>
            <select id="od-state" required value={f.state} onChange={set("state")} className={inp} autoComplete="address-level1">
              <option value="">Choose…</option>
              {REGIONS[country].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select></div>
          <label className={lbl}>{country === "CA" ? "Postal code" : "ZIP"}
            <input required value={f.zip} onChange={set("zip")} className={inp} autoComplete="postal-code" inputMode={country === "US" ? "numeric" : "text"} placeholder={country === "US" ? "30301" : "K1A 0B1"} />
          </label>
        </div>
        <label className={lbl}>Quantity<input type="number" min={1} max={20} value={f.quantity} onChange={set("quantity")} className={`${inp} w-24`} /></label>
        {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
        <button disabled={sending} className="w-full rounded bg-yellow-400 py-2 font-semibold text-black disabled:opacity-60">
          {sending ? "Placing order…" : `Place order · $${(unit * qty).toFixed(2)}`}
        </button>
        <button type="button" onClick={onClose} className="w-full rounded bg-white/10 py-2 text-sm">Cancel</button>
      </form>
    </div>
  );
}
