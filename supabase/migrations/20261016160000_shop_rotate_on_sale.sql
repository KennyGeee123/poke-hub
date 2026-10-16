-- Rotate the shop after a sale: the seller we bought from is claimed for 24h (CLAIM_HOLD_HOURS in core.ts), and the
-- product's shown price/seller moves to the next-cheapest unclaimed listing, or the product goes out of stock.
-- Called by /api/stripe-webhook once an order is paid. Idempotent per order (claimed_order_id).
ALTER TABLE public.shop_listings ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.shop_listings ADD COLUMN IF NOT EXISTS claimed_order_id uuid;

CREATE OR REPLACE FUNCTION public.shop_recompute_cheapest(p_product_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE best record;
BEGIN
  SELECT l.source, l.source_url,
         round(l.source_price * CASE l.currency WHEN 'CAD' THEN 0.73 ELSE 1 END, 2) AS usd
    INTO best
    FROM public.shop_listings l
   WHERE l.product_id = p_product_id AND l.in_stock AND l.source_price > 0
     AND (l.claimed_at IS NULL OR l.claimed_at < now() - interval '24 hours')
   ORDER BY usd ASC
   LIMIT 1;
  UPDATE public.shop_products
     SET cheapest_source_price = best.usd,
         cheapest_source = best.source,
         cheapest_source_url = best.source_url,
         sale_price = CASE WHEN best.usd IS NULL THEN sale_price ELSE public.shop_sale_price(best.usd) END,
         in_stock = best.usd IS NOT NULL,
         updated_at = now()
   WHERE id = p_product_id;
  RETURN best.usd IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.shop_rotate_after_sale(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; claimed int; still boolean;
BEGIN
  SELECT id, product_id, source_snapshot, variant_id, status INTO o FROM public.shop_orders WHERE id = p_order_id;
  IF o.id IS NULL OR o.status <> 'paid' THEN RETURN jsonb_build_object('rotated', false, 'reason', 'order not paid'); END IF;
  -- Graded/condition variants of singles price from shop_variants, not seller listings: nothing to rotate.
  IF o.variant_id IS NOT NULL OR o.source_snapshot IS NULL THEN RETURN jsonb_build_object('rotated', false, 'reason', 'no seller listing'); END IF;
  UPDATE public.shop_listings SET claimed_at = now(), claimed_order_id = o.id
   WHERE product_id = o.product_id AND source = o.source_snapshot
     AND claimed_order_id IS DISTINCT FROM o.id;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  still := public.shop_recompute_cheapest(o.product_id);
  RETURN jsonb_build_object('rotated', claimed > 0, 'product_id', o.product_id, 'claimed_source', o.source_snapshot, 'still_in_stock', still);
END $$;

REVOKE ALL ON FUNCTION public.shop_recompute_cheapest(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_rotate_after_sale(uuid) FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS shop_listings_claimed_idx ON public.shop_listings (product_id) WHERE claimed_at IS NOT NULL;
