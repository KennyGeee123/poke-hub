import { describe, expect, it } from "bun:test";
import { formatAddress, orderCode, orderEmail, plural, validZip, validateShipping, verifyStripeSignature } from "./checkout";

describe("checkout helpers", () => {
  it("zip", () => {
    expect(validZip("30301", "US")).toBe(true);
    expect(validZip("30301-1234", "US")).toBe(true);
    expect(validZip("3030", "US")).toBe(false);
    expect(validZip("K1A 0B1", "CA")).toBe(true);
    expect(validZip("12345", "CA")).toBe(false);
  });
  it("shipping", () => {
    expect(validateShipping({ line1: "1 St", city: "Atlanta", state: "GA", zip: "30301", country: "US" })).toBeNull();
    expect(validateShipping({ line1: "1 St", city: "Atlanta", state: "ON", zip: "30301", country: "US" })).toMatch(/state/);
    expect(validateShipping({ line1: "1 St", city: "X", state: "GA", zip: "1", country: "US" })).toMatch(/ZIP/);
    expect(validateShipping({ line1: "1", city: "X", state: "GA", zip: "30301", country: "MX" })).toMatch(/US and Canada/);
  });
  it("format + codes", () => {
    expect(formatAddress("Kim", { line1: "1 St", city: "Atlanta", state: "GA", zip: "30301", country: "US" })).toBe("Kim\n1 St\nAtlanta, GA 30301\nUS");
    expect(orderCode("709e4ec4-1252-42e2-80ab-4cc64ee777b5")).toBe("709E4EC4");
    expect(plural(1, "order")).toBe("1 order");
    expect(plural(2, "order")).toBe("2 orders");
  });
  it("emails", () => {
    const e = orderEmail("shipped", { code: "ABC", productName: "ETB", quantity: 2, total: 100, tracking: "1Z", siteUrl: "https://x" });
    expect(e.subject).toBe("Order ABC shipped");
    expect(e.text).toContain("Tracking: 1Z");
    expect(e.text).toContain("https://x/shop/order?code=ABC");
  });
  it("stripe signature", async () => {
    const secret = "whsec_test", payload = '{"id":"evt"}', t = 1_700_000_000;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyStripeSignature(payload, `t=${t},v1=${hex}`, secret, 300, t * 1000)).toBe(true);
    expect(await verifyStripeSignature(payload + "x", `t=${t},v1=${hex}`, secret, 300, t * 1000)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${hex}`, secret, 300, (t + 3600) * 1000)).toBe(false);
  });
});
