/**
 * FreshPress — n8n Automation Webhook Configuration
 *
 * ═══════════════════════════════════════════════════════════════════
 * ARCHITECTURE RULE:
 *
 * n8n is the AUTOMATION LAYER, not the core backend.
 *
 * Only webhooks for external automation tasks belong here:
 *   ✅ AI chat / RAG (LLM orchestration)
 *   ✅ PDF invoice generation (until replaced by Edge Function)
 *   ✅ Customer order intake (triggers WhatsApp + email confirmation)
 *   ✅ Scheduled jobs (delay monitor, marketing)
 *   ✅ CRM / external integrations
 *
 * Operational state mutations go DIRECTLY through Supabase:
 *   ❌ mark-picked-up    → supabase.from('orders').update(...)
 *   ❌ mark-delivered    → supabase.from('orders').update(...)
 *   ❌ mark-delayed      → supabase.from('orders').update(...)
 *   ❌ confirm-payment   → supabase.from('orders').update(...)
 *   ❌ add-staff         → Supabase Admin API via Edge Function
 *   ❌ password reset    → supabase.auth.resetPasswordForEmail()
 *
 * The correct flow for operations WITH notifications:
 *   Frontend → Supabase SDK (state change + activity log)
 *   Supabase DB trigger / Edge Function → n8n (notification only)
 * ═══════════════════════════════════════════════════════════════════
 *
 * All URLs from environment variables only. See .env.example.
 */

// ─── Supabase Edge Function endpoints ─────────────────────────────────────────

export const EDGE_FUNCTIONS = {
  /**
   * create-order: Validates payload → inserts to DB → sends Resend email
   * → (future) sends WhatsApp via Evolution API.
   * Replaced n8n customer-pickup-order webhook.
   */
  CREATE_ORDER: import.meta.env.VITE_CREATE_ORDER_URL as string,
} as const;

// ─── n8n automation webhook URLs ─────────────────────────────────────────────
// Only CHAT remains after Phase 2 migration.

export const WEBHOOKS = {
  /**
   * Customer pickup order intake.
   * Now handled by Supabase Edge Function (EDGE_FUNCTIONS.CREATE_ORDER).
   * This n8n URL is kept as a fallback during transition.
   */
  ORDER: import.meta.env.VITE_N8N_ORDER_WEBHOOK as string,

  /**
   * AI chat (Pressy) — migrated from n8n to Supabase Edge Function.
   * Uses gpt-4.1-mini via OpenAI API with live pricing + order lookup.
   */
  CHAT: (import.meta.env.VITE_CHAT_ASSISTANT_URL as string)
    || 'https://pofiytkpduprbkmgunbg.supabase.co/functions/v1/chat-assistant',

  /**
   * PDF invoice generation.
   * Phase 3: Replace with Supabase Edge Function.
   */
  INVOICE: import.meta.env.VITE_N8N_INVOICE_WEBHOOK as string,
} as const;

// ─── Guard helpers ────────────────────────────────────────────────────────────

/** Returns true if the webhook URL is configured and not a placeholder */
export function isWebhookConfigured(url: string | undefined): boolean {
  return (
    typeof url === 'string' &&
    url.length > 0 &&
    !url.includes('your-n8n-instance') &&
    !url.includes('undefined')
  );
}

/** Asserts a webhook is configured and returns the URL, or throws a clear error */
export function requireWebhook(url: string | undefined, name: string): string {
  if (!isWebhookConfigured(url)) {
    throw new Error(
      `The ${name} webhook is not configured. ` +
        `Set the corresponding VITE_N8N_*_WEBHOOK in your .env file.`
    );
  }
  return url!;
}

// ─── Convenience checks ───────────────────────────────────────────────────────

export const isOrderWebhookConfigured   = () => isWebhookConfigured(WEBHOOKS.ORDER);
export const isChatWebhookConfigured    = () => isWebhookConfigured(WEBHOOKS.CHAT);
export const isInvoiceWebhookConfigured = () => isWebhookConfigured(WEBHOOKS.INVOICE);
