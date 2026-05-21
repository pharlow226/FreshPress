/**
 * FreshPress — Core Operational Functions (Supabase Direct)
 *
 * These replace the n8n webhooks that previously handled state mutations.
 * All write directly to Supabase. Notification side-effects (WhatsApp, email)
 * are triggered server-side via Supabase DB webhooks → n8n, so the frontend
 * never calls n8n for operational state changes.
 *
 * Architecture:
 *   Frontend → these functions → Supabase (state change + activity log)
 *   Supabase DB webhook → n8n (WhatsApp / email notification only)
 *
 * Phase 4: Wrap critical ones in Supabase Edge Functions for server-side validation.
 */

import { supabase } from '@/lib/supabase';
import type { Order, StaffUser, TimeSlot } from '@/types';

// ─── Shared activity logger ───────────────────────────────────────────────────

async function logActivity(
  orderId: string,
  staffUser: Pick<StaffUser, 'id' | 'name'>,
  activityType: string,
  description: string,
  extra?: Record<string, unknown>
) {
  // Non-blocking — activity logging failures shouldn't surface to user
  supabase.from('staff_activities').insert({
    order_id: orderId,
    staff_id: staffUser.id || null,
    staff_name: staffUser.name || 'Staff',
    activity_type: activityType,
    description,
    ...extra,
  }).then(({ error }) => {
    if (error) console.warn('[FreshPress] Activity log failed:', error.message);
  });
}

// ─── Order status mutations ───────────────────────────────────────────────────

/**
 * Mark an order as picked up.
 * Replaces: POST n8n /webhook/freshpress-mark-picked-up
 */
export async function markPickedUp(
  order: Pick<Order, 'order_id'>,
  staffUser: Pick<StaffUser, 'id' | 'name'>
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({
      status:       'picked_up',
      picked_up_by: staffUser.name,
      picked_up_at: now,
      updated_at:   now,
    })
    .eq('order_id', order.order_id);

  if (error) throw new Error(`Failed to mark as picked up: ${error.message}`);

  logActivity(
    order.order_id,
    staffUser,
    'picked_up',
    `Order ${order.order_id} picked up by ${staffUser.name}`,
    { old_value: 'pending', new_value: 'picked_up' }
  );
}

/**
 * Mark an order as delivered.
 * Replaces: POST n8n /webhook/freshpress-mark-delivered
 */
export async function markDelivered(
  order: Pick<Order, 'order_id'>,
  staffUser: Pick<StaffUser, 'id' | 'name'>
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({
      status:       'delivered',
      delivered_by: staffUser.name,
      delivered_at: now,
      updated_at:   now,
    })
    .eq('order_id', order.order_id);

  if (error) throw new Error(`Failed to mark as delivered: ${error.message}`);

  logActivity(
    order.order_id,
    staffUser,
    'delivered',
    `Order ${order.order_id} delivered by ${staffUser.name}`,
    { old_value: 'ready', new_value: 'delivered' }
  );
}

/**
 * Reschedule a delayed pickup.
 * Replaces: POST n8n /webhook/freshpress-mark-delayed
 * Notification (WhatsApp + email) triggered by Supabase DB webhook → n8n.
 */
export async function markDelayed(
  order: Pick<Order, 'order_id'>,
  staffUser: Pick<StaffUser, 'id' | 'name'>,
  opts: { delayReason: string; newPickupDate: string; newTimeSlot: TimeSlot | string }
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      delay_reason: opts.delayReason,
      pickup_date: opts.newPickupDate,
      pickup_time_slot: opts.newTimeSlot,
    })
    .eq('order_id', order.order_id);

  if (error) throw new Error(`Failed to reschedule: ${error.message}`);

  logActivity(
    order.order_id,
    staffUser,
    'delayed',
    `Order ${order.order_id} rescheduled — ${opts.delayReason}`,
    { new_pickup_date: opts.newPickupDate, new_time_slot: opts.newTimeSlot }
  );
}

/**
 * Confirm payment received and complete the order.
 * Replaces: POST n8n /webhook/freshpress-confirm-payment
 */
export async function confirmPayment(
  order: Pick<Order, 'order_id' | 'total_amount'>,
  staffUser: Pick<StaffUser, 'id' | 'name'>
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('order_id', order.order_id);

  if (error) throw new Error(`Failed to confirm payment: ${error.message}`);

  logActivity(
    order.order_id,
    staffUser,
    'payment_confirmed',
    `Payment of ₦${(order.total_amount ?? 0).toLocaleString()} confirmed for ${order.order_id}`
  );
}

// ─── Pricing mutations ────────────────────────────────────────────────────────

/** Update the price of a service item. (Was already Supabase direct — confirmed correct.) */
export async function updatePrice(id: number, newPrice: number): Promise<void> {
  const { error } = await supabase.from('pricing').update({ price: newPrice }).eq('id', id);
  if (error) throw new Error(`Failed to update price: ${error.message}`);
}

/** Toggle a pricing item active/inactive. (Was already Supabase direct — confirmed correct.) */
export async function togglePricingActive(id: number, currentActive: boolean): Promise<void> {
  const { error } = await supabase.from('pricing').update({ active: !currentActive }).eq('id', id);
  if (error) throw new Error(`Failed to toggle pricing: ${error.message}`);
}

// ─── Auth operations ──────────────────────────────────────────────────────────

/** Staff sign-in. Replaces the n8n password reset flows for the login step. */
export async function staffSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Request a password reset email.
 * Replaces: POST n8n /webhook/freshpress-password-reset
 * Uses Supabase Auth built-in — cryptographically secure, no custom tokens.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/staff/reset-password`,
  });
  if (error) throw error;
}

/**
 * Update password after reset (called from the reset-password page).
 * Replaces: POST n8n /webhook/freshpress-reset-password-confirm
 * Uses Supabase Auth — password never passes through n8n.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sign out current session */
export async function staffSignOut(): Promise<void> {
  await supabase.auth.signOut();
}
