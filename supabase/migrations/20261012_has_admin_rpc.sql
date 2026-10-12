-- ============================================================================
-- FreshPress - has_admin RPC Function
-- ============================================================================
-- Checks if an active admin account exists in staff_members without exposing
-- staff PII or bypassing RLS on table queries.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE role = 'admin' AND active = true
  );
$$;

REVOKE ALL ON FUNCTION public.has_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin() TO anon, authenticated;
