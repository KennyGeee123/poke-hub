-- Grade/condition variants for single cards. Source price/url are admin-only.
CREATE TABLE IF NOT EXISTS public.shop_variants (
  id text PRIMARY KEY,                                   -- product|finish|grader|grade
  product_id text NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  finish text NOT NULL DEFAULT 'Normal',                 -- TCGplayer subType: Normal / Holofoil / Reverse Holofoil ...
  grader text NOT NULL CHECK (grader IN ('RAW','PSA','BGS','CGC','SGC','ANY')),
  grade text NOT NULL,                                   -- NM/LP/MP/HP/DMG for RAW; 1..10 / 9.5 for graded
  source text,                                           -- tcgplayer | ebay_active | ebay_sold | pricecharting
  source_price numeric(10,2),
  source_url text,
  sample_size int,                                       -- eBay sold matches used for the median
  sale_price numeric(10,2),
  price_status text NOT NULL DEFAULT 'priced' CHECK (price_status IN ('priced','on_request')),
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (price_status = 'on_request' OR (source_price IS NOT NULL AND sale_price IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shop_variants_product_idx ON public.shop_variants (product_id);
ALTER TABLE public.shop_variants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.shop_catalog_variants WITH (security_invoker = false) AS
SELECT v.id, v.product_id, v.finish, v.grader, v.grade,
       CASE WHEN v.price_status = 'priced' THEN v.sale_price END AS sale_price,
       v.price_status, v.updated_at
FROM public.shop_variants v
JOIN public.shop_products p ON p.id = v.product_id
WHERE NOT v.hidden AND NOT p.hidden;
GRANT SELECT ON public.shop_catalog_variants TO anon, authenticated;

ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS variant_id text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS variant_label text;

-- Recompute also reprices variants from their own source price.
CREATE OR REPLACE FUNCTION public.shop_recompute_prices() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; nv integer;
BEGIN
  UPDATE public.shop_products SET sale_price = public.shop_sale_price(cheapest_source_price)
   WHERE cheapest_source_price IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.shop_variants SET sale_price = public.shop_sale_price(source_price)
   WHERE price_status = 'priced' AND source_price IS NOT NULL;
  GET DIAGNOSTICS nv = ROW_COUNT;
  RETURN n + nv;
END $$;
REVOKE ALL ON FUNCTION public.shop_recompute_prices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_recompute_prices() TO service_role;
