/**
 * FreshPress — Order Status: Single Source of Truth
 *
 * Previously duplicated across:
 *   - OrderTrackingPage.tsx (customer)
 *   - pages/Index.tsx (staff)
 *   - lib/supabase.ts (staff)
 *
 * All components import from here. Update in one place, reflected everywhere.
 */

import type { Order, OrderStatus, TimeSlot } from '@/types';

// ─── Status ordering ──────────────────────────────────────────────────────────

/**
 * Canonical order of statuses — used for progress tracking.
 * "completed" is treated as equivalent to "delivered" visually.
 */
export const STATUS_ORDER: OrderStatus[] = [
  'pending',
  'picked_up',
  'processing',
  'invoiced',
  'ready',
  'delivered',
  'completed',
];

/** Returns the numeric index of a status in STATUS_ORDER (-1 if unknown) */
export function getStatusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as OrderStatus);
}

// ─── Status labels ────────────────────────────────────────────────────────────

/** Human-readable label + Tailwind badge class for each status */
export const STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  pending:    { label: 'Pending',              className: 'bg-gray-100 text-gray-700' },
  picked_up:  { label: 'Picked Up',            className: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing',           className: 'bg-yellow-100 text-yellow-700' },
  invoiced:   { label: 'Invoice Sent',         className: 'bg-purple-100 text-purple-700' },
  ready:      { label: 'Ready for Delivery',   className: 'bg-green-100 text-green-700' },
  delivered:  { label: 'Delivered',            className: 'bg-teal-100 text-teal-700' },
  completed:  { label: 'Completed',            className: 'bg-emerald-700 text-white' },
};

/** Resolves a status badge, falling back gracefully for unknown values */
export function getStatusBadge(status: string): { label: string; className: string } {
  return (
    STATUS_LABELS[status] ?? {
      label: (status || '').replace('_', ' ').toUpperCase(),
      className: 'bg-gray-100 text-gray-700',
    }
  );
}

// ─── Status steps (for the tracking timeline) ────────────────────────────────

/**
 * The 6 visible steps shown in the order progress timeline.
 * Used by both OrderTrackingPage (customer) and future staff views.
 * "completed" maps visually to the "delivered" step.
 */
export const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending',    label: 'Order Placed' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'processing', label: 'Processing' },
  { key: 'invoiced',  label: 'Invoice Sent' },
  { key: 'ready',     label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
];

// ─── Time slot labels ─────────────────────────────────────────────────────────

export const TIME_SLOT_LABELS: Record<TimeSlot | string, string> = {
  morning:   'Morning (9AM–12PM)',
  afternoon: 'Afternoon (1PM–4PM)',
  evening:   'Evening (4PM–7PM)',
};

export const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'morning',   label: 'Morning (9AM - 12PM)' },
  { value: 'afternoon', label: 'Afternoon (1PM - 4PM)' },
  { value: 'evening',   label: 'Evening (4PM - 7PM)' },
];

// ─── Overdue detection ────────────────────────────────────────────────────────

/**
 * Returns true if a pending order has passed its expected pickup window.
 * An order is overdue if the current time is more than 2 hours past the
 * end of the pickup slot.
 *
 * Previously duplicated in Index.tsx (staff) and OverviewPage.tsx (admin).
 */
export function isOverdue(order: Pick<Order, 'status' | 'pickup_date' | 'pickup_time_slot'>): boolean {
  if (order.status !== 'pending') return false;

  const slotEndHours: Record<string, number> = {
    morning: 12,
    afternoon: 16,
    evening: 19,
  };

  const pickupDeadline = new Date(order.pickup_date);
  const slotEnd = slotEndHours[order.pickup_time_slot || 'evening'] ?? 19;
  pickupDeadline.setHours(slotEnd + 2);

  return new Date() > pickupDeadline;
}

// ─── Step timestamp helpers (for tracking page) ───────────────────────────────

/**
 * Retrieves the relevant timestamp for a given status step from an Order.
 * Falls back gracefully if the specific timestamp column is missing.
 */
export function getStepTimestamp(order: Partial<Order>, stepKey: string): string | null {
  switch (stepKey) {
    case 'pending':    return order.pending_at ?? order.created_at ?? null;
    case 'picked_up':  return order.picked_up_at ?? null;
    case 'processing': return order.processing_at ?? null;
    case 'invoiced':   return order.invoiced_at ?? null;
    case 'ready':      return order.ready_at ?? null;
    case 'delivered':  return order.delivered_at ?? order.completed_at ?? null;
    default:           return null;
  }
}
