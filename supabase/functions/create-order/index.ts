/**
 * FreshPress — create-order Edge Function
 * Runtime: Deno (Supabase Edge Functions)
 *
 * Flow:
 *  1. Validate incoming order payload
 *  2. Generate unique FP-XXXXXX order ID
 *  3. Insert order into Supabase `orders` table
 *  4. Send branded confirmation email via Resend
 *  5. Upsert customer contact into Brevo CRM
 *  6. [TODO] WhatsApp via Evolution API — uncomment when instance ready
 *
 * Deploy:
 *  Supabase Dashboard → Edge Functions → New Function → paste this file
 *  OR: supabase functions deploy create-order
 *
 * Required secrets (Supabase Dashboard → Edge Functions → Secrets):
 *  RESEND_API_KEY            re_xxxxxxxx
 *  BREVO_API_KEY             xkeysib-xxxxxxxx
 *  BREVO_LIST_ID             12  (numeric ID of your contacts list)
 *  SUPABASE_SERVICE_ROLE_KEY eyJhbGci...
 *  SUPABASE_URL              https://xxxxxx.supabase.co  (auto-injected)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderPayload {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  pickup_date: string;
  pickup_time_slot: 'morning' | 'afternoon' | 'evening';
  special_instructions?: string;
  timestamp?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderId(): string {
  // Avoid O, 0, I, 1 — reduces customer confusion when reading aloud
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'FP-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning:   'Morning (9AM – 12PM)',
  afternoon: 'Afternoon (1PM – 4PM)',
  evening:   'Evening (4PM – 7PM)',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Resend — confirmation email ──────────────────────────────────────────────

function buildConfirmationEmail(p: {
  orderId: string; customerName: string; pickupDate: string;
  timeSlot: string; address: string; phone: string; specialInstructions?: string;
}): string {
  const slot = TIME_SLOT_LABELS[p.timeSlot] || p.timeSlot;
  const date = formatDate(p.pickupDate);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#3b5bdb,#4c3d9e);padding:32px 40px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Laundry</p>
    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;">Order Confirmed</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,.8);font-size:15px;">Your laundry is in good hands.</p>
  </td></tr>

  <!-- Order ID -->
  <tr><td style="background:#eef2ff;padding:16px 40px;text-align:center;border-bottom:1px solid #e0e7ff;">
    <p style="margin:0;font-size:12px;color:#6366f1;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Your Order ID</p>
    <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#3b5bdb;font-family:monospace;letter-spacing:3px;">${p.orderId}</p>
    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Use this to track your order at freshpresslaundryservice.lovable.app/track</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 20px;font-size:16px;color:#1e293b;">Hi <strong>${p.customerName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
      Your pickup has been confirmed. Our courier will arrive at your address during the time window below.
      You will receive a WhatsApp message when we are on our way.
    </p>

    <!-- Detail rows -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;margin-bottom:24px;">
      ${[
        ['Pickup Date', date],
        ['Time Slot',   slot],
        ['Address',     p.address],
        ['WhatsApp',    p.phone],
        ...(p.specialInstructions ? [['Special Notes', p.specialInstructions]] : []),
      ].map(([label, value], i, arr) => `
      <tr><td style="padding:14px 20px;${i < arr.length - 1 ? 'border-bottom:1px solid #e0e7ff;' : ''}">
        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">${label}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</p>
      </td></tr>`).join('')}
    </table>

    <!-- Steps -->
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.5px;">What happens next</p>
    ${['Our courier picks up your laundry at the scheduled time.','We clean, press, and package your items with professional care.','Your fresh laundry is delivered to your door within 48 hours.']
      .map((step, i) => `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
      <td style="width:26px;vertical-align:top;padding-top:2px;">
        <div style="width:22px;height:22px;border-radius:50%;background:#3b5bdb;color:#fff;font-size:11px;font-weight:900;text-align:center;line-height:22px;">${i + 1}</div>
      </td>
      <td style="padding-left:10px;font-size:13px;color:#475569;line-height:1.6;">${step}</td>
    </tr></table>`).join('')}

    <!-- CTA -->
    <div style="text-align:center;margin-top:28px;">
      <a href="https://freshpresslaundryservice.lovable.app/track"
         style="display:inline-block;background:linear-gradient(135deg,#3b5bdb,#4c3d9e);color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Track My Order
      </a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8faff;border-top:1px solid #e0e7ff;padding:20px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Questions? Call or WhatsApp us at <strong style="color:#3b5bdb;">+234 811 314 3272</strong></p>
    <p style="margin:0;font-size:11px;color:#cbd5e1;">FreshPress Laundry Services &mdash; Lagos, Nigeria</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendResendEmail(params: {
  apiKey: string; to: string; subject: string; html: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'FreshPress <onboarding@resend.dev>',
      to:      [params.to],
      subject: params.subject,
      html:    params.html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ─── Brevo — CRM contact upsert ───────────────────────────────────────────────

async function upsertBrevoContact(params: {
  apiKey: string; listId: number;
  email: string; firstName: string; phone: string;
}): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key':      params.apiKey,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      email:         params.email,
      updateEnabled: true,          // upsert — won't duplicate existing contacts
      attributes: {
        FIRSTNAME: params.firstName.split(' ')[0],
        LASTNAME:  params.firstName.split(' ').slice(1).join(' ') || '',
        SMS:       params.phone,
        SOURCE:    'FreshPress Order Form',
      },
      listIds: [params.listId],
    }),
  });

  // 204 = created, 400 with code 'duplicate_parameter' = already exists (fine)
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    // If contact already exists Brevo returns 400 with "Contact already exist"
    if (body?.message?.toLowerCase().includes('already exist')) return;
    throw new Error(`Brevo error ${res.status}: ${JSON.stringify(body)}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ── 1. Parse payload ────────────────────────────────────────
    const body: OrderPayload = await req.json();

    const required = ['customer_name','phone','email','address','pickup_date','pickup_time_slot'] as const;
    for (const field of required) {
      if (!body[field]?.toString().trim()) {
        return new Response(
          JSON.stringify({ success: false, message: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── 2. Generate Order ID ────────────────────────────────────
    const orderId = generateOrderId();

    // ── 3. Insert into Supabase ─────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error: dbError } = await supabase.from('orders').insert({
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

    if (dbError) {
      console.error('[create-order] DB insert error:', dbError.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to save order. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.log(`[create-order] Order ${orderId} inserted into DB`);

    // ── 4. Resend — confirmation email ──────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      try {
        await sendResendEmail({
          apiKey:  resendKey,
          to:      body.email,
          subject: `Order Confirmed — ${orderId} | FreshPress`,
          html:    buildConfirmationEmail({
            orderId,
            customerName:        body.customer_name,
            pickupDate:          body.pickup_date,
            timeSlot:            body.pickup_time_slot,
            address:             body.address,
            phone:               body.phone,
            specialInstructions: body.special_instructions,
          }),
        });
        console.log(`[create-order] Confirmation email sent to ${body.email}`);
      } catch (err) {
        // Non-fatal — order is saved, email delivery failed
        console.error('[create-order] Resend failed (non-fatal):', err);
      }
    } else {
      console.warn('[create-order] RESEND_API_KEY not set — skipping email');
    }

    // ── 5. Brevo — upsert CRM contact ──────────────────────────
    const brevoKey    = Deno.env.get('BREVO_API_KEY');
    const brevoListId = Deno.env.get('BREVO_LIST_ID');
    if (brevoKey && brevoListId) {
      try {
        await upsertBrevoContact({
          apiKey:    brevoKey,
          listId:    parseInt(brevoListId, 10),
          email:     body.email,
          firstName: body.customer_name,
          phone:     body.phone,
        });
        console.log(`[create-order] Brevo contact upserted: ${body.email}`);
      } catch (err) {
        // Non-fatal — order and email are fine
        console.error('[create-order] Brevo upsert failed (non-fatal):', err);
      }
    } else {
      console.warn('[create-order] BREVO_API_KEY or BREVO_LIST_ID not set — skipping CRM sync');
    }

    // ── 6. Evolution API — WhatsApp ─────────────────────────────
    // TODO: Uncomment when your Oracle instance is running
    //
    // const evolutionUrl  = Deno.env.get('EVOLUTION_API_URL');
    // const evolutionKey  = Deno.env.get('EVOLUTION_API_KEY');
    // const instanceName  = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    //
    // if (evolutionUrl && evolutionKey && instanceName) {
    //   const raw = body.phone.replace(/\D/g, '');
    //   const waNumber = raw.startsWith('0') ? '234' + raw.slice(1) : raw;
    //   const message =
    //     `Hello ${body.customer_name}! Your FreshPress order *${orderId}* is confirmed.\n\n` +
    //     `Pickup: *${formatDate(body.pickup_date)}*\n` +
    //     `Time: *${TIME_SLOT_LABELS[body.pickup_time_slot]}*\n` +
    //     `Address: ${body.address}\n\n` +
    //     `Track your order: freshpresslaundryservice.lovable.app/track\n\n` +
    //     `Questions? Reply here or call +234 811 314 3272.`;
    //
    //   await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
    //     body: JSON.stringify({ number: waNumber, textMessage: { text: message } }),
    //   }).catch(err => console.error('[create-order] Evolution API failed (non-fatal):', err));
    // }

    // ── 7. Return success ───────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:      true,
        orderId,
        customerName: body.customer_name,
        pickupDate:   body.pickup_date,
        timeSlot:     TIME_SLOT_LABELS[body.pickup_time_slot] || body.pickup_time_slot,
        message:      'Order confirmed. Check your email for details.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[create-order] Unhandled error:', err);
    return new Response(
      JSON.stringify({ success: false, message: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
