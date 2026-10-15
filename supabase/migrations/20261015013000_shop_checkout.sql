-- Shop checkout: public order code for lookup, payment/shipping timestamps, cron state.
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS order_code text
  GENERATED ALWAYS AS (upper(left(replace(id::text, '-', ''), 8))) STORED;
CREATE INDEX IF NOT EXISTS shop_orders_code_idx ON public.shop_orders (order_code);
CREATE INDEX IF NOT EXISTS shop_orders_stripe_idx ON public.shop_orders (stripe_session_id);
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

-- Key/value state for the scheduled refresh (next offset etc.). Server-only.
CREATE TABLE IF NOT EXISTS public.shop_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_state ENABLE ROW LEVEL SECURITY;

-- Catalog images are served through /api/public/shop-image so the upstream CDN is never exposed.
DROP VIEW IF EXISTS public.shop_catalog;
CREATE VIEW public.shop_catalog WITH (security_invoker = false) AS
SELECT p.id, p.kind, p.product_type, p.name, p.set_name, p.card_number,
       CASE WHEN p.image_url IS NOT NULL THEN '/api/public/shop-image?id=' || p.id END AS image_url,
       COALESCE(p.price_override, p.sale_price) AS sale_price, p.in_stock, p.updated_at, p.sell_mode,
       CASE WHEN p.sell_mode = 'affiliate' THEN p.affiliate_url END AS affiliate_url,
       (SELECT count(*) FROM public.shop_listings l WHERE l.product_id = p.id) AS seller_count
FROM public.shop_products p
WHERE NOT p.hidden AND COALESCE(p.price_override, p.sale_price) IS NOT NULL;
GRANT SELECT ON public.shop_catalog TO anon, authenticated;

-- Sliding-scale pricing: percent tiers with a per-tier minimum profit, optional store-wide floor and .99 rounding.
ALTER TABLE public.shop_markup_rules ADD COLUMN IF NOT EXISTS min_profit_usd numeric(10,2) NOT NULL DEFAULT 0;
-- Replace the earlier default tiers if the admin hasn't customised them.
DO $$
DECLARE sig text;
BEGIN
  SELECT string_agg(min_price || ':' || COALESCE(max_price::text, '-') || ':' || flat_usd || ':' || percent, ',' ORDER BY min_price)
    INTO sig FROM public.shop_markup_rules;
  IF sig IS NULL
     OR sig = '0.00:20.00:5.00:0.00,20.00:100.00:10.00:0.00,100.00:-:0.00:8.00'
     OR sig = '0.00:5.00:0.00:50.00,5.00:20.00:0.00:30.00,20.00:50.00:0.00:20.00,50.00:100.00:0.00:15.00,100.00:250.00:0.00:10.00,250.00:-:0.00:8.00' THEN
    DELETE FROM public.shop_markup_rules;
    INSERT INTO public.shop_markup_rules (min_price, max_price, flat_usd, percent, min_profit_usd) VALUES
      (0, 1, 0, 50, 0.10), (1, 5, 0, 40, 0.25), (5, 20, 0, 30, 0), (20, 50, 0, 20, 0),
      (50, 100, 0, 15, 0), (100, 250, 0, 10, 0), (250, NULL, 0, 8, 0);
  END IF;
END $$;
INSERT INTO public.shop_state (key, value) VALUES ('pricing', '{"min_profit_usd": 0, "round_99": false}')
ON CONFLICT (key) DO NOTHING;

-- Must match src/lib/shop/core.ts salePriceCents(): all math in exact numeric cents.
CREATE OR REPLACE FUNCTION public.shop_sale_price(src numeric) RETURNS numeric
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  c bigint := round(src * 100);
  r record;
  m bigint := 0;
  floor_c bigint;
  r99 boolean;
  total bigint;
BEGIN
  SELECT round(COALESCE((value->>'min_profit_usd')::numeric, 0) * 100), COALESCE((value->>'round_99')::boolean, false)
    INTO floor_c, r99 FROM public.shop_state WHERE key = 'pricing';
  floor_c := COALESCE(floor_c, 0); r99 := COALESCE(r99, false);
  SELECT * INTO r FROM public.shop_markup_rules
   WHERE active AND c >= round(min_price * 100) AND (max_price IS NULL OR c < round(max_price * 100))
   ORDER BY min_price DESC LIMIT 1;
  IF FOUND THEN
    m := round(r.flat_usd * 100) + floor((c * round(r.percent * 100) + 5000) / 10000.0);
    m := greatest(m, round(r.min_profit_usd * 100));
  END IF;
  total := c + greatest(m, floor_c);
  IF r99 THEN total := ceil((total + 1) / 100.0) * 100 - 1; END IF;
  RETURN total / 100.0;
END $$;
REVOKE ALL ON FUNCTION public.shop_sale_price(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_sale_price(numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.shop_recompute_prices() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.shop_products SET sale_price = public.shop_sale_price(cheapest_source_price)
   WHERE cheapest_source_price IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.shop_recompute_prices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_recompute_prices() TO service_role;
