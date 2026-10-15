import { expect, test } from "bun:test";
import { shopUnavailable } from "./core";
test("detects missing shop tables / config", () => {
  expect(shopUnavailable({ code: "PGRST205", message: "Could not find the table 'public.shop_catalog' in the schema cache" })).toBe(true);
  expect(shopUnavailable({ code: "42P01", message: 'relation "shop_orders" does not exist' })).toBe(true);
  expect(shopUnavailable(new Error("supabaseKey is required."))).toBe(true);
  expect(shopUnavailable({ code: "23505", message: "duplicate key" })).toBe(false);
  expect(shopUnavailable(null)).toBe(false);
});
