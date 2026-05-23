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
 *  5. Customer confirmation email (Brevo primary, Resend fallback)
 *  6. Staff notification email
 *  7. Brevo CRM upsert
 *  8. WhatsApp placeholder (Evolution API — uncomment when ready)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'faloyesamuel400@gmail.com';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderPayload {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  pickup_date: string;
  pickup_time_slot: 'morning' | 'afternoon' | 'evening';
  special_instructions?: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  last_assigned_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** LAU-XXXXXX format — 6 random digits */
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

// ── Brevo email sender ────────────────────────────────────────────────────────
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

// ── Email templates ───────────────────────────────────────────────────────────

function customerConfirmationEmail(p: {
  orderId: string; customerName: string; pickupDate: string;
  timeSlot: string; address: string; phone: string; notes?: string;
}): string {
  const rows = [
    ['Order ID',    p.orderId],
    ['Pickup Date', fmtDate(p.pickupDate)],
    ['Time Slot',   SLOTS[p.timeSlot] || p.timeSlot],
    ['Address',     p.address],
    ['WhatsApp',    p.phone],
    ...(p.notes ? [['Notes', p.notes]] : []),
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
  <tr><td style="background:#eef2ff;padding:16px 40px;text-align:center;border-bottom:1px solid #e0e7ff;">
    <p style="margin:0;font-size:11px;color:#6366f1;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Your Order ID</p>
    <p style="margin:6px 0 0;font-size:28px;font-weight:900;color:#3b5bdb;font-family:monospace;letter-spacing:3px;">${p.orderId}</p>
    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Track at: fresh-press-chi.vercel.app/track</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Hi <strong>${p.customerName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">Your pickup has been confirmed. Our courier will arrive at your address during the window below.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr><td style="padding:13px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #e0e7ff;' : ''}">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</p>
      </td></tr>`).join('')}
    </table>
    <div style="text-align:center;">
      <a href="https://fresh-press-chi.vercel.app/track"
         style="display:inline-block;background:linear-gradient(135deg,#3b5bdb,#4c3d9e);color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;text-decoration:none;">
        Track My Order
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8faff;border-top:1px solid #e0e7ff;padding:18px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Call or WhatsApp: <strong style="color:#3b5bdb;">+234 811 314 3272</strong></p>
    <p style="margin:0;font-size:11px;color:#cbd5e1;">FreshPress Laundry Services - Lagos, Nigeria</p>
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
    ['Customer',       p.customerName],
    ['Phone',          p.customerPhone],
    ['Pickup Address', p.address],
    ['Pickup Date',    fmtDate(p.pickupDate)],
    ['Time Slot',      SLOTS[p.timeSlot] || p.timeSlot],
    ...(p.notes ? [['Notes', p.notes]] : []),
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
    <p style="margin:10px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Hi ${p.staffName}, you have a new pickup job.</p>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">
      A new order has been assigned to you. Please review the details below and ensure you arrive within the selected time window.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr><td style="padding:13px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #bbf7d0;' : ''}">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</p>
      </td></tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#94a3b8;text-align:center;">Log in to the staff portal to view full order details and update the status.</p>
  </td></tr>
  <tr><td style="background:#f0fdf4;border-top:1px solid #bbf7d0;padding:16px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#6b7280;">FreshPress Laundry Services - Lagos, Nigeria</p>
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
  <p style="color:#1e293b;white-space:pre-wrap;">${body}</p>
  <p style="font-size:12px;color:#94a3b8;">Sent by FreshPress Edge Function — create-order</p>
</div>
</body></html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Read secrets
  const brevoKey    = Deno.env.get('BREVO_API_KEY') ?? '';
  const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
  const brevoList   = Deno.env.get('BREVO_LIST_ID') ?? '';
  const resendKey   = Deno.env.get('RESEND_API_KEY') ?? '';
  const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? '';  // NOT SUPABASE_ prefix
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  const canEmail = !!(brevoKey && brevoSender);

  try {
    // ── 1. Validate payload ───────────────────────────────────────
    const body: OrderPayload = await req.json();
    const required = ['customer_name','phone','email','address','pickup_date','pickup_time_slot'] as const;
    for (const f of required) {
      if (!body[f]?.toString().trim()) {
        return new Response(JSON.stringify({ success: false, message: `Missing required field: ${f}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 2. Generate LAU-XXXXXX order ID ──────────────────────────
    const orderId = generateOrderId();

    // ── 3. Init Supabase client ───────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── 4. Insert order row ───────────────────────────────────────
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
      created_at:           new Date().toISOString(),
    });

    if (dbErr) {
      console.error('[create-order] DB insert failed:', dbErr.message);

      // Admin alert on DB failure
      if (canEmail) {
        await sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: ADMIN_EMAIL, name: 'FreshPress Admin' }],
          subject: `[ALERT] Order DB insert failed - ${orderId}`,
          html: adminAlertEmail(
            'DB Insert Failure',
            `Order ID: ${orderId}\nCustomer: ${body.customer_name}\nPhone: ${body.phone}\nError: ${dbErr.message}\nTime: ${new Date().toISOString()}`
          ),
        }).catch(e => console.error('[create-order] Admin alert email failed:', e));
      }

      return new Response(JSON.stringify({ success: false, message: 'Failed to save your order. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[create-order] Order ${orderId} inserted`);

    // ── 5. Round-robin staff assignment ───────────────────────────
    let assignedStaff: StaffMember | null = null;

    const { data: staffRows, error: staffErr } = await supabase
      .from('staff_members')
      .select('id, full_name, email, last_assigned_at')
      .eq('role', 'pickup')
      .eq('active', true)
      .eq('availability_status', 'available')   // skip staff on leave or sick
      .order('last_assigned_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (staffErr) {
      console.error('[create-order] Staff query error:', staffErr.message);
    } else if (staffRows && staffRows.length > 0) {
      assignedStaff = staffRows[0] as StaffMember;
      const now = new Date().toISOString();

      // Update staff last_assigned_at
      await supabase
        .from('staff_members')
        .update({ last_assigned_at: now })
        .eq('id', assignedStaff.id);

      // Patch order with assigned staff
      await supabase
        .from('orders')
        .update({ assigned_staff_id: assignedStaff.id })
        .eq('order_id', orderId);

      console.log(`[create-order] Assigned to staff: ${assignedStaff.full_name} (${assignedStaff.id})`);
    } else {
      console.warn('[create-order] No active pickup staff found');
    }

    // ── 6. Customer confirmation email ────────────────────────────
    const customerHtml = customerConfirmationEmail({
      orderId, customerName: body.customer_name, pickupDate: body.pickup_date,
      timeSlot: body.pickup_time_slot, address: body.address,
      phone: body.phone, notes: body.special_instructions,
    });

    let emailSent = false;

    // Primary: Brevo (sends to any email, no domain needed)
    if (canEmail) {
      emailSent = await sendBrevoEmail({
        apiKey: brevoKey, senderEmail: brevoSender,
        to: [{ email: body.email, name: body.customer_name }],
        subject: `Order Confirmed - ${orderId} | FreshPress`,
        html: customerHtml,
      });
      if (emailSent) console.log(`[create-order] Customer email sent via Brevo to ${body.email}`);
    }

    // Fallback: Resend (only reaches account owner email in sandbox)
    if (!emailSent && resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'FreshPress <onboarding@resend.dev>', to: [body.email],
          subject: `Order Confirmed - ${orderId} | FreshPress`, html: customerHtml,
        }),
      }).catch(e => console.error('[create-order] Resend fallback failed:', e));
    }

    // ── 7. Staff notification email ───────────────────────────────
    if (canEmail) {
      if (assignedStaff && assignedStaff.email) {
        // Notify assigned staff
        await sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: assignedStaff.email, name: assignedStaff.full_name }],
          subject: `New Pickup Assigned - ${orderId} | FreshPress`,
          html: staffNotificationEmail({
            orderId, staffName: assignedStaff.full_name,
            customerName: body.customer_name, customerPhone: body.phone,
            address: body.address, pickupDate: body.pickup_date,
            timeSlot: body.pickup_time_slot, notes: body.special_instructions,
          }),
        }).catch(e => console.error('[create-order] Staff notification failed:', e));
        console.log(`[create-order] Staff notification sent to ${assignedStaff.email}`);
      } else {
        // No staff available — alert admin
        await sendBrevoEmail({
          apiKey: brevoKey, senderEmail: brevoSender,
          to: [{ email: ADMIN_EMAIL, name: 'FreshPress Admin' }],
          subject: `[ALERT] No staff available for order ${orderId}`,
          html: adminAlertEmail(
            'No Pickup Staff Available',
            `A new order was placed but no active pickup staff was found.\n\nOrder ID: ${orderId}\nCustomer: ${body.customer_name}\nPhone: ${body.phone}\nAddress: ${body.address}\nPickup Date: ${fmtDate(body.pickup_date)}\nTime: ${SLOTS[body.pickup_time_slot]}\n\nPlease assign a staff member manually.`
          ),
        }).catch(e => console.error('[create-order] Admin no-staff alert failed:', e));
        console.warn('[create-order] Admin alerted: no pickup staff found');
      }
    }

    // ── 8. Brevo CRM upsert ───────────────────────────────────────
    if (brevoKey && brevoList) {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:         body.email,
          updateEnabled: true,
          attributes: {
            FIRSTNAME: body.customer_name.split(' ')[0],
            LASTNAME:  body.customer_name.split(' ').slice(1).join(' ') || '',
            SMS:       body.phone,
            SOURCE:    'FreshPress Order Form',
          },
          listIds: [parseInt(brevoList, 10)],
        }),
      }).catch(e => console.error('[create-order] Brevo CRM upsert failed:', e));
    }

    // ── 9. WhatsApp via Evolution API (uncomment when Oracle ready) ─
    // const evoUrl  = Deno.env.get('EVOLUTION_API_URL');
    // const evoKey  = Deno.env.get('EVOLUTION_API_KEY');
    // const evoInst = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    // if (evoUrl && evoKey && evoInst) {
    //   const raw = body.phone.replace(/\D/g, '');
    //   const wa  = raw.startsWith('0') ? '234' + raw.slice(1) : raw;
    //   const msg =
    //     `Hello ${body.customer_name}! Your FreshPress order *${orderId}* is confirmed.\n\n` +
    //     `Pickup: *${fmtDate(body.pickup_date)}*\nTime: *${SLOTS[body.pickup_time_slot]}*\n` +
    //     `Address: ${body.address}\n\nTrack: fresh-press-chi.vercel.app/track\n` +
    //     `Questions? Call +234 811 314 3272`;
    //   await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    //     body: JSON.stringify({ number: wa, textMessage: { text: msg } }),
    //   }).catch(e => console.error('[create-order] WhatsApp failed:', e));
    // }

    // ── 10. Return success ────────────────────────────────────────
    return new Response(JSON.stringify({
      success:       true,
      orderId,
      customerName:  body.customer_name,
      pickupDate:    body.pickup_date,
      timeSlot:      SLOTS[body.pickup_time_slot] || body.pickup_time_slot,
      assignedStaff: assignedStaff?.full_name ?? null,
      message:       'Order confirmed. Check your email for details.',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[create-order] Unhandled error:', err);
    return new Response(JSON.stringify({ success: false, message: 'An unexpected error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
