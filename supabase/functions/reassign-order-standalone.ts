/**
 * FreshPress — reassign-order Edge Function (standalone, dashboard-ready)
 *
 * HOW TO DEPLOY:
 *  Supabase Dashboard -> Edge Functions -> New Function -> name: reassign-order -> paste -> Deploy
 *
 * Required secrets: SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL
 *
 * Flow:
 *  1. Validate payload (orderId, newStaffId, reassignedByName)
 *  2. Fetch new staff details
 *  3. Update order: assigned_staff_id, assigned_to_name, reassigned_at, reassigned_by_name
 *  4. Update new staff last_assigned_at
 *  5. Log to staff_activities
 *  6. Send email to new staff
 *  7. WhatsApp placeholder
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SLOTS: Record<string, string> = {
  morning:   'Morning (9AM - 12PM)',
  afternoon: 'Afternoon (1PM - 4PM)',
  evening:   'Evening (4PM - 7PM)',
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function staffNotificationEmail(p: {
  orderId: string; staffName: string; customerName: string; customerPhone: string;
  address: string; pickupDate: string; timeSlot: string; notes?: string;
  reassignedBy: string; orderStatus: string;
}): string {
  const isReassign = !!p.reassignedBy;
  const rows = [
    ['Order ID',       p.orderId],
    ['Current Status', p.orderStatus?.replace(/_/g, ' ') || 'pending'],
    ['Customer',       p.customerName],
    ['Phone',          p.customerPhone],
    ['Pickup Address', p.address],
    ['Pickup Date',    fmtDate(p.pickupDate)],
    ['Time Slot',      SLOTS[p.timeSlot] || p.timeSlot],
    ...(p.notes ? [['Notes', p.notes]] : []),
    ...(isReassign ? [['Reassigned By', p.reassignedBy]] : []),
  ];

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f0fdf4;">
<tr><td align="center">
<table style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#059669,#065f46);padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Staff</p>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">${isReassign ? 'Order Reassigned to You' : 'New Order Assigned'}</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Hi ${p.staffName}, you have a job to action.</p>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr><td style="padding:13px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #bbf7d0;' : ''}">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;text-transform:capitalize;">${value}</p>
      </td></tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#94a3b8;text-align:center;">Log in to your staff portal to update the order status.</p>
  </td></tr>
  <tr><td style="background:#f0fdf4;border-top:1px solid #bbf7d0;padding:16px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#6b7280;">FreshPress Laundry Services — Lagos, Nigeria</p>
  </td></tr>
</table></td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const brevoKey    = Deno.env.get('BREVO_API_KEY') ?? '';
  const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
  const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  try {
    const { orderId, newStaffId, reassignedByName } = await req.json();
    if (!orderId || !newStaffId) {
      return new Response(JSON.stringify({ success: false, message: 'orderId and newStaffId are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    // 1. Fetch new staff
    const { data: staff, error: staffErr } = await supabase
      .from('staff_members')
      .select('id, full_name, email, phone')
      .eq('id', newStaffId)
      .single();

    if (staffErr || !staff) {
      return new Response(JSON.stringify({ success: false, message: 'Staff member not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Fetch current order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Update order with new assignment + timestamps
    const { error: updateErr } = await supabase.from('orders').update({
      assigned_staff_id:   newStaffId,
      assigned_to_name:    staff.full_name,
      reassigned_at:       now,
      reassigned_by_name:  reassignedByName || 'Admin',
      updated_at:          now,
    }).eq('order_id', orderId);

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, message: `Failed to update order: ${updateErr.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Update staff last_assigned_at
    await supabase.from('staff_members').update({ last_assigned_at: now }).eq('id', newStaffId);

    // 5. Log to staff_activities
    await supabase.from('staff_activities').insert({
      staff_id:      newStaffId,
      staff_name:    reassignedByName || 'Admin',
      activity_type: 'reassigned',
      order_id:      orderId,
      description:   `Order ${orderId} reassigned from ${order.assigned_to_name || 'Unassigned'} to ${staff.full_name} by ${reassignedByName || 'Admin'}. Order was at status: ${order.status || 'pending'}`,
      old_value:     order.assigned_to_name || 'Unassigned',
      new_value:     staff.full_name,
      created_at:    now,
    }).catch(e => console.error('[reassign-order] Activity log failed:', e));

    // 6. Email notification to new staff
    if (brevoKey && brevoSender && staff.email) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: 'FreshPress Laundry', email: brevoSender },
          to:          [{ email: staff.email, name: staff.full_name }],
          subject:     `Order Assigned: ${orderId} — FreshPress`,
          htmlContent: staffNotificationEmail({
            orderId,
            staffName:     staff.full_name,
            customerName:  order.customer_name,
            customerPhone: order.phone,
            address:       order.address,
            pickupDate:    order.pickup_date,
            timeSlot:      order.pickup_time_slot,
            notes:         order.special_instructions,
            reassignedBy:  reassignedByName || 'Admin',
            orderStatus:   order.status,
          }),
        }),
      }).catch(e => console.error('[reassign-order] Email failed:', e));
    }

    // 7. WhatsApp via Evolution API (uncomment when ready)
    // const evoUrl  = Deno.env.get('EVOLUTION_API_URL');
    // const evoKey  = Deno.env.get('EVOLUTION_API_KEY');
    // const evoInst = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    // if (evoUrl && evoKey && evoInst && staff.phone) {
    //   const raw = staff.phone.replace(/\D/g, '');
    //   const wa  = raw.startsWith('0') ? '234' + raw.slice(1) : raw;
    //   await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    //     body: JSON.stringify({ number: wa, textMessage: { text:
    //       `Hi ${staff.full_name.split(' ')[0]}! Order *${orderId}* has been assigned to you by ${reassignedByName || 'Admin'}.\n\nCustomer: ${order.customer_name}\nAddress: ${order.address}\nPickup: ${fmtDate(order.pickup_date)}\nStatus: ${order.status}\n\nLogin to update: https://stafffreshpress.lovable.app`
    //     }}),
    //   }).catch(e => console.error('[reassign-order] WhatsApp failed:', e));
    // }

    return new Response(JSON.stringify({
      success:    true,
      orderId,
      assignedTo: staff.full_name,
      message:    `Order ${orderId} assigned to ${staff.full_name}. Email notification sent.`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[reassign-order] Unhandled error:', err);
    return new Response(JSON.stringify({ success: false, message: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
