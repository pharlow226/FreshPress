-- Migration: 20261010_order_idempotency.sql
-- Description: Idempotency keys table to eliminate check-then-insert race conditions for phone & web bookings

CREATE TABLE IF NOT EXISTS public.order_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_idempotency_created 
  ON public.order_idempotency_keys (created_at);

-- RLS: Only service role can access idempotency table
ALTER TABLE public.order_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on order_idempotency_keys"
  ON public.order_idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
