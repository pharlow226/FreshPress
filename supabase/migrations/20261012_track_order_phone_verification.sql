-- ============================================================================
-- FreshPress - track_order two-argument phone verification
-- ============================================================================
-- Adds (p_order_id text, p_phone text) overload to public.track_order
-- Matches last 10 digits of Nigerian/international phone numbers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_order(p_order_id text, p_phone text)
RETURNS TABLE (
  order_id text, status text, pickup_date date,
  pickup_time_slot text, delay_reason text, payment_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.order_id, o.status, o.pickup_date, o.pickup_time_slot, o.delay_reason, o.payment_status
  FROM public.orders o
  WHERE o.order_id = upper(trim(p_order_id))
    AND length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 10
    AND right(regexp_replace(coalesce(o.phone,''), '\D', '', 'g'), 10)
      = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;
