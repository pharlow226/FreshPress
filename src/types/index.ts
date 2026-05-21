/**
 * FreshPress — Shared TypeScript Types
 *
 * Single source of truth for all data shapes used across
 * customer, staff, accountant, and admin routes.
 *
 * These types are derived from the Supabase schema. Update here
 * whenever the database schema changes.
 */

// ─── Order lifecycle ──────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'picked_up'
  | 'processing'
  | 'invoiced'
  | 'ready'
  | 'delivered'
  | 'completed';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

/** Full order row — matches the `orders` table */
export interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  pickup_date: string;
  pickup_time_slot?: TimeSlot | string | null;
  status: OrderStatus | string;
  payment_status: PaymentStatus | string;
  total_amount?: number | null;
  delay_reason?: string | null;
  invoice_pdf_url?: string | null;
  invoice_number?: string | null;
  special_instructions?: string | null;
  delivery_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Status timestamps (any subset may be populated)
  pending_at?: string | null;
  picked_up_at?: string | null;
  processing_at?: string | null;
  invoiced_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

/** Row from the `pricing` table */
export interface PricingItem {
  id: number;
  service_code: string;
  service_name: string;
  category: string;
  price: number;
  unit: string;
  description?: string;
  active: boolean;
  display_order: number;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

/** Row from the `invoice_items` table */
export interface InvoiceItem {
  id?: number;
  order_id: string;
  service_code: string;
  service_name: string;
  category?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffRole = 'pickup' | 'accountant' | 'admin';

/** Minimal shape stored in localStorage for display purposes (non-security) */
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  full_name?: string;
  active?: boolean;
  force_password_change?: boolean;
}

/** Full row from the `staff_members` table */
export interface StaffMember {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  role: StaffRole;
  active: boolean;
  force_password_change?: boolean;
  reset_token?: string | null;
  reset_token_expires?: string | null;
  created_at?: string;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export type CustomerType = 'new' | 'returning' | 'vip';

/** Row from the `customers` table */
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customer_type?: CustomerType;
  created_at?: string;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActivityType =
  | 'order_created'
  | 'picked_up'
  | 'invoice_generated'
  | 'payment_confirmed'
  | 'delivered'
  | 'status_changed'
  | 'order_cancelled'
  | 'delayed';

/** Row from the `staff_activities` table */
export interface StaffActivity {
  id?: string;
  order_id?: string;
  staff_id?: string;
  staff_name: string;
  activity_type: ActivityType | string;
  description?: string;
  created_at: string;
}

// ─── Chat (AI Assistant) ──────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system';

export interface SuggestedAction {
  type: 'navigate' | 'whatsapp' | 'call' | 'link' | string;
  label: string;
  url?: string;
  href?: string;
  link?: string;
  target?: string;
  phone?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  suggested_actions?: SuggestedAction[];
}

/** Row from the `chat_sessions` table */
export interface ChatSession {
  session_id: string;
  started_at: string;
  last_activity_at?: string;
  messages_count?: number;
}

// ─── n8n Webhook payloads (outbound) ─────────────────────────────────────────

/** Payload sent to the customer-pickup-order webhook */
export interface OrderWebhookPayload {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  pickup_date: string;
  pickup_time_slot: TimeSlot | string;
  special_instructions?: string;
  timestamp: string;
}

/** Response from the customer-pickup-order webhook */
export interface OrderWebhookResponse {
  success: boolean;
  orderId: string;
  customerName?: string;
  pickupDate?: string;
  timeSlot?: string;
  message?: string;
}

/** Payload sent to the freshpress-chat webhook */
export interface ChatWebhookPayload {
  session_id: string;
  message: string;
  conversation_history: Pick<ChatMessage, 'role' | 'content'>[];
  timestamp: string;
}

/** Response from the freshpress-chat webhook */
export interface ChatWebhookResponse {
  reply: string;
  suggested_actions?: SuggestedAction[];
}
