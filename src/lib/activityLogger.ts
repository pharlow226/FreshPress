/**
 * FreshPress — Activity Logger
 * Writes rows to staff_activities table.
 * Use this everywhere a staff action occurs.
 */
import { supabase } from '@/lib/supabase';

export type ActivityType =
  | 'order_created'
  | 'picked_up'
  | 'invoice_generated'
  | 'payment_confirmed'
  | 'delivered'
  | 'status_changed'
  | 'order_cancelled';

interface LogActivityParams {
  staffId:     string;
  staffName:   string;
  activityType: ActivityType;
  orderId?:    string;
  description?: string;
  oldValue?:   string;
  newValue?:   string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { error } = await supabase.from('staff_activities').insert({
    staff_id:      params.staffId,
    staff_name:    params.staffName,
    activity_type: params.activityType,
    order_id:      params.orderId   || null,
    description:   params.description || null,
    old_value:     params.oldValue  || null,
    new_value:     params.newValue  || null,
    created_at:    new Date().toISOString(),
  });

  if (error) {
    // Non-fatal — log to console but don't break the action
    console.error('[logActivity] Failed to write activity log:', error.message);
  }
}
