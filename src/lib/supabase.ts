/**
 * FreshPress — Unified Supabase Client & Utilities
 *
 * Single Supabase client for the entire merged app.
 * All helper functions from both original apps are consolidated here.
 *
 * The anon key and URL are read from environment variables ONLY.
 * See .env.example — never hardcode credentials.
 */

import { createClient } from '@supabase/supabase-js';
import type { StaffUser } from '@/types';

// ─── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[FreshPress] Missing Supabase environment variables. ' +
    'Copy .env.example to .env and fill in your credentials.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exported for components that build manual fetch() headers (legacy pattern)
export { SUPABASE_URL, SUPABASE_ANON_KEY };

// ─── Config checks ────────────────────────────────────────────────────────────

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─── Staff session helpers ────────────────────────────────────────────────────

/**
 * Reads the display-only staff user from localStorage.
 * NOT used for auth decisions — only for showing name/role in UI.
 * Auth decisions must use supabase.auth.getSession().
 */
export function getStaffUser(): StaffUser | null {
  try {
    return JSON.parse(localStorage.getItem('staff_user') || 'null');
  } catch {
    return null;
  }
}

export function setStaffUser(user: StaffUser): void {
  localStorage.setItem('staff_user', JSON.stringify(user));
}

export function clearStaffUser(): void {
  localStorage.removeItem('staff_user');
}

// ─── Currency & date formatting ───────────────────────────────────────────────

/** Formats a number as Nigerian Naira: ₦1,234 */
export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

/** Formats an ISO date string as "12 May 2026" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Formats an ISO date string as "12 May 2026 02:30 PM" */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${formatDate(dateStr)} ${d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Formats a timestamp for locale-aware display on the tracking page */
export function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Status colour helpers (used by admin charts and staff views) ─────────────

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'hsl(45, 93%, 47%)',
    picked_up: 'hsl(217, 91%, 60%)',
    processing: 'hsl(280, 67%, 55%)',
    invoiced: 'hsl(262, 83%, 58%)',
    ready: 'hsl(160, 84%, 39%)',
    delivered: 'hsl(187, 72%, 43%)',
    completed: 'hsl(142, 76%, 36%)',
  };
  return colors[status] || 'hsl(0, 0%, 60%)';
}

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    picked_up: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    invoiced: 'bg-violet-100 text-violet-800',
    ready: 'bg-emerald-100 text-emerald-800',
    delivered: 'bg-teal-100 text-teal-800',
    completed: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    unpaid: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

export function getActivityColor(type: string): string {
  const colors: Record<string, string> = {
    order_created: 'text-blue-600 bg-blue-50',
    picked_up: 'text-green-600 bg-green-50',
    invoice_generated: 'text-purple-600 bg-purple-50',
    payment_confirmed: 'text-green-700 bg-green-50',
    delivered: 'text-teal-600 bg-teal-50',
    status_changed: 'text-yellow-600 bg-yellow-50',
    order_cancelled: 'text-red-600 bg-red-50',
    delayed:         'text-orange-600 bg-orange-50',
    reassigned:      'text-indigo-600 bg-indigo-50',
  };
  return colors[type] || 'text-gray-600 bg-gray-50';
}
