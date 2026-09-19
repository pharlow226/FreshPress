-- Drop the overly broad anon tracking policy that exposes PII
DROP POLICY IF EXISTS "Public can track order by order_id" ON orders;

-- Create secure tracking RPC function returning only non-sensitive status fields
CREATE OR REPLACE FUNCTION track_order(p_order_id text)
RETURNS TABLE (
  order_id text,
  status text,
  pickup_date date,
  pickup_time_slot text,
  delay_reason text,
  payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func
BEGIN
  RETURN QUERY
  SELECT 
    o.order_id, 
    o.status, 
    o.pickup_date, 
    o.pickup_time_slot, 
    o.delay_reason, 
    o.payment_status
  FROM orders o
  WHERE o.order_id = p_order_id
  LIMIT 1;
END;
$func;
