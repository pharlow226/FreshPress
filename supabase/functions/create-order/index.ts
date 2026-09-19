/**
 * FreshPress — create-order Edge Function (standalone, dashboard-ready)
 *
 * HOW TO DEPLOY:
 *  1. Go to: https://supabase.com/dashboard/project/pofiytkpduprbkmgunbg/functions
 *  2. Open the create-order function -> Edit -> paste entire file -> Deploy
 *
 * Secrets required (Dashboard -> Edge Functions -> Secrets):
 *  SERVICE_ROLE_KEY      Supabase service role key (NOT prefixed with SUPABASE_)
 *  BREVO_API_KEY         Brevo API key
 *  BREVO_SENDER_EMAIL    Verified sender email in Brevo
 *  BREVO_LIST_ID         Brevo contacts list ID (optional, for CRM)
 *  RESEND_API_KEY        Resend key (fallback only)
 *
 * Flow:
 *  1. Validate payload
 *  2. Generate LAU-XXXXXX order ID
 *  3. Insert order into Supabase (admin alert on failure)
 *  4. Round-robin staff assignment
 *  5. Dispatch Emails and CRM concurrently
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// -- CORS ----------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'faloyesamuel400@gmail.com';

// -- Types ---------------------------------------------------------------------
interface OrderPayload {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  pickup_date: string;
  pickup_time_slot: 'morning' | 'afternoon' | 'evening';
  special_instructions?: string;
  source?: 'website' | 'phone' | 'whatsapp' | 'walkin';
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  last_assigned_at: string | null;
}

// -- Helpers -------------------------------------------------------------------
function escapeHtml(str: string) {
  if (!str) return '';
  return str.toString().replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag)
  );
}

function generateOrderId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `LAU-${digits}`;
}

const SLOTS: Record<string, string> = {
  morning:   'Morning (9AM - 12PM)',
  afternoon: 'Afternoon (1PM - 4PM)',
  evening:   'Evening (4PM - 7PM)',
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// -- Brevo email sender --------------------------------------------------------
async function sendBrevoEmail(params: {
  apiKey: string;
  senderEmail: string;
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': params.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'FreshPress Laundry', email: params.senderEmail },
      to:          params.to,
      subject:     params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    console.error('[create-order] Brevo send error:', err);
    return false;
  }
  return true;
}

// -- Email templates -----------------------------------------------------------

function customerConfirmationEmail(p: {
  orderId: string; customerName: string; pickupDate: string;
  timeSlot: string; address: string; phone: string; notes?: string;
}): string {
  const rows = [
    ['Order ID',    p.orderId],
    ['Pickup Date', fmtDate(p.pickupDate)],
    ['Time Slot',   SLOTS[p.timeSlot] || p.timeSlot],
    ['Address',     escapeHtml(p.address)],
    ['WhatsApp',    escapeHtml(p.phone)],
    ...(p.notes ? [['Notes', escapeHtml(p.notes)]] : []),
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Order Confirmed - FreshPress</title></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f0f4ff;">
<tr><td align="center">
<table style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#3b5bdb,#4c3d9e);padding:32px 40px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Laundry</p>
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;">Order Confirmed</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Your laundry is in good hands.</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Hi <strong>${escapeHtml(p.customerName)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">Your pickup has been confirmed. Our courier will arrive at your address during the window below.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr><td style="padding:13px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #e0e7ff;' : ''}">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</p>
      </td></tr>`).join('')}
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function staffNotificationEmail(p: {
  orderId: string; staffName: string;
  customerName: string; customerPhone: string;
  address: string; pickupDate: string; timeSlot: string; notes?: string;
}): string {
  const rows = [
    ['Order ID',       p.orderId],
    ['Customer',       escapeHtml(p.customerName)],
    ['Phone',          escapeHtml(p.customerPhone)],
    ['Pickup Address', escapeHtml(p.address)],
    ['Pickup Date',    fmtDate(p.pickupDate)],
    ['Time Slot',      SLOTS[p.timeSlot] || p.timeSlot],
    ...(p.notes ? [['Notes', escapeHtml(p.notes)]] : []),
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Pickup Assignment - FreshPress</title></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f0fdf4;">
<tr><td align="center">
<table style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#059669,#065f46);padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Staff</p>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">New Pickup Assigned</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Hi ${escapeHtml(p.staffName)}, you have a new pickup job.</p>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr><td style="padding:13px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #bbf7d0;' : ''}">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</p>
      </td></tr>`).join('')}
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function adminAlertEmail(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="font-family:monospace;padding:24px;background:#fff1f2;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #fca5a5;border-radius:12px;padding:24px;">
  <h2 style="color:#dc2626;margin-top:0;">FreshPress Alert</h2>
  <p style="color:#1e293b;white-space:pre-wrap;">${escapeHtml(body)}</p>
  <p style="font-size:12px;color:#94a3b8;">Sent by FreshPress Edge Function — create-order</p>
</div>
</body></html>`;
}

// -- Main handler --------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const brevoKey    = Deno.env.get('BREVO_API_KEY') ?? '';
  const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
  const brevoList   = Deno.env.get('BREVO_LIST_ID') ?? '';
  const resendKey   = Deno.env.get('RESEND_API_KEY') ?? '';
  const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? ''; 
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const canEmail = !!(brevoKey && brevoSender);

  try {
    const body: OrderPayload = await req.json();
    const required = ['customer_name','phone','email','address','pickup_date','pickup_time_slot'] as const;
    for (const f of required) {
      if (!body[f]?.toString().trim()) {
        return new Response(JSON.stringify({ success: false, message: `Missing required field: ${f}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
    }

    const orderId = generateOrderId();
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: dbErr } = await supabase.from('orders').insert({
      order_id:             orderId,
      customer_name:        body.customer_name.trim(),
      phone:                body.phone.trim(),
      email:                body.email.trim().toLowerCase(),
      address:              body.address.trim(),
      pickup_date:          body.pickup_date,
      pickup_time_slot:     body.pickup_time_slot,
      special_instructions: body.special_instructions?.trim() || null,
      status:               'pending',
      payment_status:       'unpaid',
      source:               ['website','phone','whatsapp','walkin'].includes(body.source ?? '') ? body.source : 'website',
      created_at:           new Date().toISOString(),
    });

    if (dbErr) {
      console.error('[create-order] DB insert failed:', dbErr.message);
      if (canEmail) {
        await sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: ADMIN_EMAIL, name: 'FreshPress Admin' }],
          subject: `[ALERT] Order DB insert failed - ${orderId}`,
          html: adminAlertEmail('DB Insert Failure', `Order ID: ${orderId}\nError: ${dbErr.message}`),
        }).catch(e => console.error(e));
      }
      return new Response(JSON.stringify({ success: false, message: 'Failed to save your order.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    let assignedStaff: StaffMember | null = null;
    const { data: staffRows, error: staffErr } = await supabase.rpc('assign_pickup_staff');

    if (staffErr) {
      console.error('[create-order] Staff assignment RPC error:', staffErr.message);
    } else if (staffRows && staffRows.length > 0) {
      assignedStaff = staffRows[0] as StaffMember;
      const { error: patchErr } = await supabase.from('orders').update({ assigned_staff_id: assignedStaff.id }).eq('order_id', orderId);
      if (patchErr) console.error('[create-order] Patch staff ID failed:', patchErr.message);
    }

    const tasks: Promise<any>[] = [];

    // Customer Email
    if (canEmail) {
      tasks.push((async () => {
        let sent = await sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: body.email, name: body.customer_name }],
          subject: `Order Confirmed - ${orderId} | FreshPress`,
          html: customerConfirmationEmail({
            orderId, customerName: body.customer_name, pickupDate: body.pickup_date,
            timeSlot: body.pickup_time_slot, address: body.address,
            phone: body.phone, notes: body.special_instructions,
          }),
        });
        if (!sent && resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FreshPress <onboarding@resend.dev>', to: [body.email],
              subject: `Order Confirmed - ${orderId} | FreshPress`, 
              html: customerConfirmationEmail({
                orderId, customerName: body.customer_name, pickupDate: body.pickup_date,
                timeSlot: body.pickup_time_slot, address: body.address, phone: body.phone, notes: body.special_instructions,
              }),
            }),
          });
        }
      })().catch(e => console.error(e)));
    }

    // Staff / Admin Email
    if (canEmail) {
      if (assignedStaff && assignedStaff.email) {
        tasks.push(sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: assignedStaff.email, name: assignedStaff.full_name }],
          subject: `New Pickup Assigned - ${orderId} | FreshPress`,
          html: staffNotificationEmail({
            orderId, staffName: assignedStaff.full_name, customerName: body.customer_name, 
            customerPhone: body.phone, address: body.address, pickupDate: body.pickup_date, 
            timeSlot: body.pickup_time_slot, notes: body.special_instructions,
          }),
        }).catch(e => console.error(e)));
      } else {
        tasks.push(sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: ADMIN_EMAIL, name: 'FreshPress Admin' }],
          subject: `[ALERT] No staff available for order ${orderId}`,
          html: adminAlertEmail('No Pickup Staff Available', `Order ID: ${orderId}\nPlease assign a staff member manually.`),
        }).catch(e => console.error(e)));
      }
    }

    // CRM Upsert
    if (brevoKey && brevoList) {
      tasks.push(fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: body.email, updateEnabled: true,
          attributes: { FIRSTNAME: body.customer_name, SMS: body.phone, SOURCE: 'FreshPress Order Form' },
          listIds: [parseInt(brevoList, 10)]
        })
      }).catch(e => console.error(e)));
    }

    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({
      success: true, orderId, customerName: body.customer_name, pickupDate: body.pickup_date,
      timeSlot: SLOTS[body.pickup_time_slot] || body.pickup_time_slot,
      assignedStaff: assignedStaff?.full_name ?? null, message: 'Order confirmed.'
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});
