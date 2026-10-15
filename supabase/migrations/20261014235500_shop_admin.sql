-- Shop admin: tracking, hide, manual price override, recompute function.
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS price_override numeric(10,2);

DROP VIEW IF EXISTS public.shop_catalog;
CREATE VIEW public.shop_catalog WITH (security_invoker = false) AS
SELECT p.id, p.kind, p.product_type, p.name, p.set_name, p.card_number, p.image_url,
       COALESCE(p.price_override, p.sale_price) AS sale_price, p.in_stock, p.updated_at, p.sell_mode,
       CASE WHEN p.sell_mode = 'affiliate' THEN p.affiliate_url END AS affiliate_url,
       (SELECT count(*) FROM public.shop_listings l WHERE l.product_id = p.id) AS seller_count
FROM public.shop_products p
WHERE NOT p.hidden AND COALESCE(p.price_override, p.sale_price) IS NOT NULL;
GRANT SELECT ON public.shop_catalog TO anon, authenticated;

-- Recompute sale_price from cheapest_source_price using active markup tiers (highest matching min_price wins).
CREATE OR REPLACE FUNCTION public.shop_recompute_prices() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.shop_products p
     SET sale_price = round(p.cheapest_source_price + COALESCE((
           SELECT r.flat_usd + p.cheapest_source_price * r.percent / 100
             FROM public.shop_markup_rules r
            WHERE r.active AND p.cheapest_source_price >= r.min_price
              AND (r.max_price IS NULL OR p.cheapest_source_price < r.max_price)
            ORDER BY r.min_price DESC LIMIT 1), 0), 2)
   WHERE p.cheapest_source_price IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.shop_recompute_prices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_recompute_prices() TO service_role;
