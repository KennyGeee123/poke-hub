// Compares SQL shop_sale_price() with TS salePrice() on ~4,300 prices.
// Usage: PGHOST=... PGPORT=... PGUSER=... PGDATABASE=... bun scripts/shop-price-parity.ts
// Reads the live pricing settings + tiers from the DB so both sides use the same config.
import { normalizePricing, salePrice, type MarkupRule } from "../src/lib/shop/core";
const psql = (q: string) => Bun.spawnSync(["psql", "-tAF,", "-c", q]).stdout.toString().trim();
const S = normalizePricing(JSON.parse(psql("select value from shop_state where key='pricing'") || "{}"));
const rules: MarkupRule[] = psql("select min_price,coalesce(max_price::text,''),flat_usd,percent,min_profit_usd,coalesce(fixed_price_usd::text,'') from shop_markup_rules where active")
  .split("\n").filter(Boolean).map((l) => { const [a, b, c, d, e, f] = l.split(","); return { min_price: +a, max_price: b === "" ? null : +b, flat_usd: +c, percent: +d, min_profit_usd: +e, fixed_price_usd: f === "" ? null : +f }; });
const vals: number[] = [];
for (let c = 1; c <= 30000; c += 7) vals.push(c / 100);
vals.push(0.05, 0.2, 0.8, 0.99, 1, 2.5, 4.99, 7, 19.99, 45, 111, 300, 1000, 99999.99);
const out = psql(`select v, shop_sale_price(v) from unnest(array[${vals.join(",")}]::numeric[]) v`).split("\n");
let bad = 0;
for (const line of out) {
  const [v, s] = line.split(",").map(Number);
  if (Math.round(salePrice(v, rules, S) * 100) !== Math.round(s * 100)) { bad++; if (bad <= 5) console.log("MISMATCH", v, "sql", s, "ts", salePrice(v, rules, S)); }
}
console.log(`${out.length} prices compared (${S.rounding}, floor $${S.min_profit_usd}): ${bad} mismatches`);
process.exit(bad ? 1 : 0);
