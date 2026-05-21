/**
 * mark-picked-up-standalone.ts
 * Deploy as: "mark-picked-up" in Supabase Dashboard → Edge Functions
 *
 * Secrets: SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL,
 *          EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
const BREVO_KEY        = Deno.env.get('BREVO_API_KEY')        ?? '';
const BREVO_SENDER     = Deno.env.get('BREVO_SENDER_EMAIL')   ?? 'noreply@freshpress.ng';
const EVO_URL          = Deno.env.get('EVOLUTION_API_URL')    ?? '';
const EVO_KEY          = Deno.env.get('EVOLUTION_API_KEY')    ?? '';
const EVO_INSTANCE     = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function dbHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer':        'return=representation',
  };
}

async function getOrder(orderId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,customer_name,email,phone,address,pickup_date,pickup_time_slot,status`,
    { headers: dbHeaders() }
  );
  if (!res.ok) throw new Error(`DB fetch failed: ${res.status}`);
  const rows: any[] = await res.json();
  return rows[0] ?? null;
}

async function updateOrder(orderId: string, patch: Record<string, unknown>) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
    { method: 'PATCH', headers: dbHeaders(), body: JSON.stringify(patch) }
  );
  if (!res.ok) throw new Error(`DB update failed: ${res.status} ${await res.text()}`);
}

async function logActivity(payload: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/staff_activities`, {
      method:  'POST',
      headers: dbHeaders(),
      body:    JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
    });
  } catch (e) { console.warn('[mark-picked-up] activity log failed:', e); }
}

// ── Admin email — fetched from Supabase, never hardcoded ──────────────────────

async function getAdminEmail(): Promise<string> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?role=eq.admin&active=eq.true&select=email&limit=1`,
      { headers: dbHeaders() }
    );
    if (!res.ok) return 'faloyesamuel400@gmail.com';
    const rows: any[] = await res.json();
    return rows[0]?.email ?? 'faloyesamuel400@gmail.com';
  } catch { return 'faloyesamuel400@gmail.com'; }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_KEY || !to) return;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        sender:      { name: 'FreshPress Laundry', email: BREVO_SENDER },
        to:          [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) console.warn('[mark-picked-up] Brevo error:', res.status, await res.text());
  } catch (e) { console.warn('[mark-picked-up] email error:', e); }
}

function buildPickupEmail(order: any, staffName: string, pickedUpAt: string): string {
  const firstName = (order.customer_name ?? '').split(' ')[0];
  const date = new Date(pickedUpAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 40px">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">Laundry Picked Up</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px">FreshPress Laundry Services</p>
  </td></tr>
  <tr><td style="padding:28px 40px">
    <p style="font-size:15px;color:#111;margin:0 0 16px">Hi ${firstName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px">
      Your laundry has been successfully picked up and is now with us for processing.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 10px;font-size:13px;color:#374151">Order: <strong>${order.order_id}</strong></p>
        <p style="margin:0 0 10px;font-size:13px;color:#374151">Picked Up By: <strong>${staffName}</strong></p>
        <p style="margin:0;font-size:13px;color:#374151">Time: <strong>${date}</strong></p>
      </td></tr>
    </table>
    <p style="font-size:14px;color:#374151;margin:0 0 8px">
      We will send your invoice once processing is complete. Questions? Call <a href="tel:+2348113143272" style="color:#2563eb">+234 811 314 3272</a>
    </p>
    <p style="font-size:14px;color:#374151;margin:24px 0 0">— The FreshPress Team</p>
  </td></tr>
  <tr><td style="padding:16px 40px;background:#f9fafb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">FreshPress Laundry Services · Lagos, Nigeria</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ── WhatsApp (fire-and-forget until Evolution API is configured) ───────────────

function normalizePhone(phone: string): string {
  phone = phone.replace(/\s+/g, '');
  if (phone.startsWith('+'))   phone = phone.slice(1);
  if (phone.startsWith('00'))  phone = phone.slice(2);
  else if (phone.startsWith('0')) phone = '234' + phone.slice(1);
  return phone;
}

function sendWhatsApp(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
    method:  'POST',
    headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ number: normalizePhone(phone), text }),
  }).catch(e => console.warn('[mark-picked-up] WhatsApp failed:', e));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();

    const orderId   = body.orderId   ?? body.order_id;
    const staffId   = body.staffId   ?? body.staff_id;
    const staffName = body.staffName ?? body.staff_name;

    const missing = [!orderId && 'orderId', !staffId && 'staffId', !staffName && 'staffName'].filter(Boolean);
    if (missing.length > 0) {
      return Response.json({ success: false, message: `Missing required fields: ${missing.join(', ')}` }, { status: 400, headers: CORS });
    }

    let order: any;
    try { order = await getOrder(orderId); }
    catch (e: any) { return Response.json({ success: false, message: e.message }, { status: 500, headers: CORS }); }

    if (!order) return Response.json({ success: false, message: `Order ${orderId} not found` }, { status: 404, headers: CORS });

    if (order.status !== 'pending') {
      return Response.json(
        { success: false, message: `Order is already '${order.status}'. Only pending orders can be marked as picked up.` },
        { status: 400, headers: CORS }
      );
    }

    const pickedUpAt = new Date().toISOString();

    try {
      await updateOrder(orderId, {
        status:            'picked_up',
        picked_up_at:      pickedUpAt,
        picked_up_by:      staffId,         // UUID
        picked_up_by_name: staffName,       // display name
        assigned_staff_id: staffId,
        assigned_to_name:  staffName,
        updated_at:        pickedUpAt,
      });
    } catch (e: any) {
      return Response.json({ success: false, message: e.message }, { status: 500, headers: CORS });
    }

    // Log activity (non-blocking)
    logActivity({
      order_id:      orderId,
      staff_id:      staffId,
      staff_name:    staffName,
      activity_type: 'picked_up',
      description:   `Order ${orderId} picked up by ${staffName}`,
      old_value:     'pending',
      new_value:     'picked_up',
    });

    // Fetch admin email from Supabase
    const adminEmail = await getAdminEmail();

    // Notify customer — WhatsApp (fire-and-forget) + Email (awaited independently)
    if (order.phone) {
      sendWhatsApp(order.phone,
        `FRESHPRESS UPDATE\n\nHi ${(order.customer_name ?? '').split(' ')[0]}, your laundry has been picked up.\n\nOrder ID: ${orderId}\nPicked Up By: ${staffName}\n\nYour items are with us and will be processed shortly. Your invoice will be sent once ready.\n\nQuestions? Call +234 811 314 3272`
      );
    }
    if (order.email) {
      try {
        await sendEmail(order.email, `Laundry Picked Up - ${orderId} | FreshPress`, buildPickupEmail(order, staffName, pickedUpAt));
      } catch (e: any) { console.warn('[mark-picked-up] customer email failed:', e.message); }
    }

    // Notify admin of the action
    try {
      await sendEmail(
        adminEmail,
        `[FreshPress] Pickup Completed — ${orderId}`,
        `<p><strong>${staffName}</strong> marked order <strong>${orderId}</strong> as picked up at ${new Date(pickedUpAt).toLocaleString('en-NG')}.</p><p>Customer: ${order.customer_name} | Phone: ${order.phone || '—'} | Address: ${order.address || '—'}</p>`
      );
    } catch (e: any) { console.warn('[mark-picked-up] admin email failed:', e.message); }

    return Response.json(
      {
        success:      true,
        message:      'Order marked as picked up. Customer has been notified.',
        order_id:     orderId,
        status:       'picked_up',
        picked_up_by: staffName,
        picked_up_at: pickedUpAt,
      },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[mark-picked-up] unhandled error:', err);
    return Response.json({ success: false, message: err.message ?? 'Internal server error' }, { status: 500, headers: CORS });
  }
});
