// Shared (client + server) checkout helpers: address validation, order codes, email templates, Stripe signature check.
export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
] as const;

export const REGIONS: Record<string, [string, string][]> = {
  US: [["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["PR","Puerto Rico"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]],
  CA: [["AB","Alberta"],["BC","British Columbia"],["MB","Manitoba"],["NB","New Brunswick"],["NL","Newfoundland and Labrador"],["NS","Nova Scotia"],["NT","Northwest Territories"],["NU","Nunavut"],["ON","Ontario"],["PE","Prince Edward Island"],["QC","Quebec"],["SK","Saskatchewan"],["YT","Yukon"]],
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validZip(zip: string, country: string): boolean {
  const z = zip.trim();
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(z);
  if (country === "CA") return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(z);
  return z.length >= 3 && z.length <= 10;
}

export type Shipping = { line1: string; line2?: string; city: string; state: string; zip: string; country: string };

export function validateShipping(s: Partial<Shipping>): string | null {
  const country = String(s.country ?? "");
  if (!REGIONS[country]) return "We currently ship to the US and Canada only";
  if (!String(s.line1 ?? "").trim()) return "Address is required";
  if (!String(s.city ?? "").trim()) return "City is required";
  if (!REGIONS[country].some(([c]) => c === s.state)) return "Choose a state / province";
  if (!validZip(String(s.zip ?? ""), country)) return country === "US" ? "ZIP must be 5 digits (or ZIP+4)" : "Postal code must look like A1A 1A1";
  return null;
}

export function formatAddress(name: string | null | undefined, a: Partial<Shipping> | null | undefined): string {
  if (!a) return name ?? "";
  return [name, a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.zip ?? ""}`.trim(), a.country].filter((x) => x && String(x).trim()).join("\n");
}

/** Short public order number: first 8 hex chars of the uuid, uppercased. */
export function orderCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export type OrderEmailInput = { code: string; productName: string; quantity: number; total: number; tracking?: string | null; siteUrl: string };
export function orderEmail(kind: "received" | "paid" | "shipped" | "admin_new", o: OrderEmailInput): { subject: string; text: string } {
  const lookup = `${o.siteUrl}/shop/order?code=${o.code}`;
  const line = `${o.quantity} × ${o.productName} — $${o.total.toFixed(2)}`;
  switch (kind) {
    case "received":
      return { subject: `Order ${o.code} received`, text: `Thanks for your order!\n\n${line}\n\nWe'll email you when it's paid and shipped. Check status anytime: ${lookup}` };
    case "paid":
      return { subject: `Order ${o.code} confirmed`, text: `Payment received, thank you!\n\n${line}\n\nWe're preparing your order now. Status: ${lookup}` };
    case "shipped":
      return { subject: `Order ${o.code} shipped`, text: `Your order is on the way!\n\n${line}\n${o.tracking ? `Tracking: ${o.tracking}\n` : ""}\nStatus: ${lookup}` };
    case "admin_new":
      return { subject: `New shop order ${o.code}`, text: `${line}\n\nOpen ${o.siteUrl}/shop/admin to fulfill.` };
  }
}

/** Verify a Stripe-Signature header (v1, HMAC-SHA256 over "t.payload"). Uses WebCrypto (works in workers + bun). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2 && p[0] === "t"));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}
