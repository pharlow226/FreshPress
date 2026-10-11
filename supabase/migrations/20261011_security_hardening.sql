-- ============================================================================
-- 20261011_security_hardening.sql
-- FRESHPRESS SECURITY HARDENING MIGRATION
-- ============================================================================

-- ============================================================================
-- PART A: Admin-only staff and pricing writes + Non-recursive is_admin()
-- ============================================================================

-- Helper that checks the caller's role WITHOUT triggering RLS on staff_members.
-- SECURITY DEFINER avoids infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE id = auth.uid()
      AND role = 'admin'
      AND active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---- staff_members ---------------------------------------------------------
DROP POLICY IF EXISTS "staff_read_all"   ON staff_members;
DROP POLICY IF EXISTS "staff_update_all" ON staff_members;
DROP POLICY IF EXISTS "staff_delete_all" ON staff_members;

-- Everyone signed in can read their own row
DROP POLICY IF EXISTS "Authenticated staff can read own record" ON staff_members;
CREATE POLICY "Authenticated staff can read own record"
ON staff_members FOR SELECT
TO authenticated
USING (email = auth.email());

-- Admins can read, update and delete every staff row.
DROP POLICY IF EXISTS "staff_read_admin"   ON staff_members;
DROP POLICY IF EXISTS "staff_update_admin" ON staff_members;
DROP POLICY IF EXISTS "staff_delete_admin" ON staff_members;

CREATE POLICY "staff_read_admin" ON staff_members
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "staff_update_admin" ON staff_members
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "staff_delete_admin" ON staff_members
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Privilege escalation trigger: Prevent staff from changing role, active, email, or id
CREATE OR REPLACE FUNCTION public.guard_staff_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role, SQL editor, and migrations have no auth.uid(): allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role   IS DISTINCT FROM OLD.role
  OR NEW.active IS DISTINCT FROM OLD.active
  OR NEW.email  IS DISTINCT FROM OLD.email
  OR NEW.id     IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only an admin can change role, active status, email or id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_staff_privileged_columns ON staff_members;
CREATE TRIGGER guard_staff_privileged_columns
  BEFORE UPDATE ON staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_staff_privileged_columns();

-- ---- pricing ---------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_read_all"   ON pricing;
DROP POLICY IF EXISTS "pricing_write_all"  ON pricing;
DROP POLICY IF EXISTS "pricing_read_staff" ON pricing;
DROP POLICY IF EXISTS "pricing_write_admin" ON pricing;

CREATE POLICY "pricing_read_staff" ON pricing
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pricing_write_admin" ON pricing
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- PART B: Scoped Chat Reads & Private Invoices Bucket
-- ============================================================================

-- ---- chat: history is readable only by someone who knows the session id -----
CREATE OR REPLACE FUNCTION public.get_chat_history(p_session_id text)
RETURNS TABLE (role text, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role, m.content, m.created_at
  FROM public.chat_messages m
  WHERE m.session_id = p_session_id
    AND length(p_session_id) >= 15      -- session ids must be long random strings
  ORDER BY m.created_at ASC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.get_chat_history(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_history(text) TO anon, authenticated;

-- Drop wide-open anonymous table read/update policies
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_sessions_select" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_update" ON chat_sessions;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_sessions_insert" ON chat_sessions;

-- ---- invoices: private bucket, staff read via policy, customers via signed URL
UPDATE storage.buckets SET public = false WHERE id = 'invoices';

DROP POLICY IF EXISTS "Public can download invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can read invoices" ON storage.objects;

CREATE POLICY "Authenticated staff can read invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');
