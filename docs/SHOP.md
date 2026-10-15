# Shop (dropship + affiliate store)

## Migrations (apply in order)
1. `supabase/migrations/20261014233000_shop_dropship.sql`
2. `supabase/migrations/20261014235500_shop_admin.sql`
3. `supabase/migrations/20261015013000_shop_checkout.sql`

## Environment
| Var | Required | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | yes | DB access (service role is server-only) |
| `SHOP_ADMIN_SECRET` | yes | `/shop/admin` and admin APIs (`x-shop-admin` header) |
| `SHOP_SITE_URL` | recommended | Absolute site URL for Stripe redirects + email links (defaults to request origin) |
| `CRON_SECRET` | for cron | `Authorization: Bearer <CRON_SECRET>` on `/api/shop-cron` |
| `SHOP_CRON_BATCH` | optional | Sets per cron call (default 2, max 10) |
| `STRIPE_SECRET_KEY` | optional | Enables Stripe Checkout. Absent → orders stay `pending` and the customer is told a payment link will follow |
| `STRIPE_WEBHOOK_SECRET` | with Stripe | Verifies `/api/stripe-webhook` (`checkout.session.completed` → `paid`) |
| `RESEND_API_KEY` | optional | Order emails (received / paid / shipped + admin alert). Absent → silent no-op |
| `SHOP_EMAIL_FROM` | with Resend | e.g. `Kenny's Cards <orders@yourdomain.com>` (domain verified in Resend) |
| `SHOP_ADMIN_EMAIL` | optional | Receives new-order alerts |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | optional | eBay Browse API as an extra price source |

## Scheduled refresh
`GET|POST /api/shop-cron` refreshes the next batch of TCGplayer sets (plus Shopify/eBay for sealed items) and stores
its position in `shop_state`, wrapping to 0 after the last set. Call it every ~10 minutes:

- **Vercel** (`vercel.json`): `"crons": [{ "path": "/api/shop-cron", "schedule": "*/10 * * * *" }]` with `CRON_SECRET` set (Vercel sends the Bearer header automatically).
- **Cloudflare / any scheduler**: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/shop-cron`
- **Supabase pg_cron + pg_net**: `select cron.schedule('shop-refresh','*/10 * * * *', $$select net.http_get('https://<site>/api/shop-cron', headers := '{"Authorization":"Bearer <CRON_SECRET>"}'::jsonb)$$);`

## Stripe setup
1. Set `STRIPE_SECRET_KEY` and `SHOP_SITE_URL`.
2. In Stripe → Developers → Webhooks, add `https://<site>/api/stripe-webhook` for `checkout.session.completed` (and `checkout.session.async_payment_succeeded`), then copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Customer pages
`/shop` (catalog), `/shop/$id` (product), `/shop/confirmation`, `/shop/order` (lookup by order number + email).
Images go through `/api/public/shop-image?id=` so upstream CDNs are never exposed.

## Pricing
Sale price = cheapest source + tier markup (percent of source, at least the tier's min profit, at least the store-wide floor), then rounded.
A tier may set a **fixed sale price** that overrides markup, floors and rounding. By default every card under $1 sells for exactly **$1**.
Rounding modes: `whole` (default, ceil to the next whole dollar; already-whole stays), `99` (up to X.99), `none`.
All math uses integer cents. `scripts/shop-price-parity.ts` checks that SQL `shop_sale_price()` matches TypeScript `salePrice()` against a database.
