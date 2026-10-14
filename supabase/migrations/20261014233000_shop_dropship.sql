-- Dropship shop: products (sealed + singles), per-source listings, customer orders.
-- source_price / source_url are admin-only. Public reads go through shop_catalog (sale price only).

CREATE TABLE public.shop_products (
  id text PRIMARY KEY,                       -- e.g. "tcgp:704143"
  kind text NOT NULL CHECK (kind IN ('sealed','single')),
  product_type text,                         -- booster_box, etb, bundle, tin, collection, card ...
  name text NOT NULL,
  set_name text,
  card_number text,
  image_url text,
  match_key text,                            -- normalized key used to match other sellers
  cheapest_source_price numeric(10,2),
  cheapest_source text,
  cheapest_source_url text,
  sale_price numeric(10,2),                  -- cheapest_source_price + markup
  in_stock boolean NOT NULL DEFAULT true,
  affiliate_url text,                        -- reserved for later
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_products_kind_price_idx ON public.shop_products (kind, sale_price);
CREATE INDEX shop_products_name_idx ON public.shop_products USING gin (to_tsvector('simple', name));

CREATE TABLE public.shop_listings (
  product_id text NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  source text NOT NULL,                      -- tcgplayer, ebay, hobbiesville, totalcards ...
  source_title text,
  source_price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  source_url text,
  in_stock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, source)
);

CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.shop_products(id),
  product_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  sale_price numeric(10,2) NOT NULL,
  source_price_snapshot numeric(10,2),
  source_snapshot text,
  source_url_snapshot text,
  customer_email text NOT NULL,
  customer_name text,
  shipping_address jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','ordered_from_source','shipped','delivered','cancelled','refunded')),
  stripe_session_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tiered markup (admin-editable). sale_price = cheapest source + flat_usd + percent% of source.
CREATE TABLE public.shop_markup_rules (
  id serial PRIMARY KEY,
  min_price numeric(10,2) NOT NULL DEFAULT 0,
  max_price numeric(10,2),                   -- NULL = no upper bound
  flat_usd numeric(10,2) NOT NULL DEFAULT 0,
  percent numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.shop_markup_rules (min_price, max_price, flat_usd, percent) VALUES
  (0, 20, 5, 0), (20, 100, 10, 0), (100, NULL, 0, 8);
ALTER TABLE public.shop_markup_rules ENABLE ROW LEVEL SECURITY;

-- Per-product choice: sell on-site (store) or link out via affiliate_url (affiliate).
ALTER TABLE public.shop_products ADD COLUMN sell_mode text NOT NULL DEFAULT 'store' CHECK (sell_mode IN ('store','affiliate'));

-- RLS: no direct client access to raw tables; server uses service role.
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- Public catalog view: no source prices/urls exposed.
CREATE VIEW public.shop_catalog WITH (security_invoker = false) AS
SELECT p.id, p.kind, p.product_type, p.name, p.set_name, p.card_number, p.image_url,
       p.sale_price, p.in_stock, p.updated_at, p.sell_mode,
       CASE WHEN p.sell_mode = 'affiliate' THEN p.affiliate_url END AS affiliate_url,
       (SELECT count(*) FROM public.shop_listings l WHERE l.product_id = p.id) AS seller_count
FROM public.shop_products p
WHERE p.sale_price IS NOT NULL;
GRANT SELECT ON public.shop_catalog TO anon, authenticated;
