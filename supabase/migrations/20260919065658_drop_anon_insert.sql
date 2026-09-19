-- Drop the unnecessary anon insert policy to prevent direct database inserts.
-- The create-order Edge Function handles this securely using the service_role key.
DROP POLICY IF EXISTS "Public can create orders" ON orders;
