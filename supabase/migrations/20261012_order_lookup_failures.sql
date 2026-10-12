-- Migration: 20261012_order_lookup_failures.sql
-- Description: Rate limiting failed order verification attempts to prevent brute-force guessing

CREATE TABLE IF NOT EXISTS public.order_lookup_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_olf_order ON public.order_lookup_failures (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_olf_call  ON public.order_lookup_failures (call_id, created_at);

ALTER TABLE public.order_lookup_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on order_lookup_failures" ON public.order_lookup_failures;
CREATE POLICY "Service role full access on order_lookup_failures"
  ON public.order_lookup_failures FOR ALL TO service_role USING (true) WITH CHECK (true);
