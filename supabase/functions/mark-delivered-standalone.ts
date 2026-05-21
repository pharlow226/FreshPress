/**
 * mark-delivered-standalone.ts
 * Deploy as: "mark-delivered" in Supabase Dashboard → Edge Functions
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
    `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,customer_name,email,phone,address,status,payment_status,assigned_staff_id`,
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
  } catch (e) { console.warn('[mark-delivered] activity log failed:', e); }
}

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
    if (!res.ok) console.warn('[mark-delivered] Brevo error:', res.status, await res.text());
  } catch (e) { console.warn('[mark-delivered] email error:', e); }
}

function buildDeliveryEmail(order: any, staffName: string, deliveredAt: string): string {
  const firstName = (order.customer_name ?? '').split(' ')[0];
  const date = new Date(deliveredAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:28px 40px">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">Your Laundry Has Been Delivered!</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px">FreshPress Laundry Services</p>
  </td></tr>
  <tr><td style="padding:28px 40px">
    <p style="font-size:15px;color:#111;margin:0 0 16px">Hi ${firstName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px">
      Your fresh laundry has been delivered. We hope everything is perfect!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 10px;font-size:13px;color:#374151">Order: <strong>${order.order_id}</strong></p>
        <p style="margin:0 0 10px;font-size:13px;color:#374151">Delivered By: <strong>${staffName}</strong></p>
        <p style="margin:0;font-size:13px;color:#374151">Time: <strong>${date}</strong></p>
      </td></tr>
    </table>
    <p style="font-size:14px;color:#374151;margin:0 0 8px">
      Thank you for choosing FreshPress. We look forward to serving you again!
    </p>
    <p style="font-size:14px;color:#374151;margin:24px 0 0">— The FreshPress Team</p>
  </td></tr>
  <tr><td style="padding:16px 40px;background:#f9fafb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">FreshPress Laundry Services · Lagos, Nigeria · +234 811 314 3272</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

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
  }).catch(e => console.warn('[mark-delivered] WhatsApp failed:', e));
}

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

    if (order.status !== 'ready') {
      return Response.json(
        { success: false, message: `Order status is '${order.status}'. Only ready orders can be marked as delivered.` },
        { status: 400, headers: CORS }
      );
    }
    if (order.payment_status !== 'paid') {
      return Response.json(
        { success: false, message: 'Payment has not been confirmed. Cannot mark as delivered.' },
        { status: 400, headers: CORS }
      );
    }

    const now = new Date().toISOString();

    try {
      await updateOrder(orderId, {
        status:            'delivered',
        delivery_status:   'delivered',
        delivered_by:      staffId,      // UUID
        delivered_by_name: staffName,    // display name
        delivered_at:      now,
        completed_at:      now,
        updated_at:        now,
      });
    } catch (e: any) {
      return Response.json({ success: false, message: e.message }, { status: 500, headers: CORS });
    }

    // Log activity (non-blocking)
    logActivity({
      order_id:      orderId,
      staff_id:      staffId,
      staff_name:    staffName,
      activity_type: 'delivered',
      description:   `Order ${orderId} delivered to customer by ${staffName}`,
      old_value:     'ready',
      new_value:     'delivered',
    });

    // Fetch admin email from Supabase
    const adminEmail = await getAdminEmail();

    // Notify customer — WhatsApp (fire-and-forget) + Email (awaited independently)
    const firstName = (order.customer_name ?? '').split(' ')[0];
    if (order.phone) {
      sendWhatsApp(order.phone,
        `ORDER DELIVERED - FRESHPRESS\n\nHi ${firstName}, your fresh laundry has been delivered!\n\nOrder: ${orderId}\nDelivered By: ${staffName}\n\nThank you for choosing FreshPress! We look forward to serving you again.\n\nCall: +234 811 314 3272`
      );
    }
    if (order.email) {
      try {
        await sendEmail(order.email, `Your Laundry Has Been Delivered - ${orderId} | FreshPress`, buildDeliveryEmail(order, staffName, now));
      } catch (e: any) { console.warn('[mark-delivered] customer email failed:', e.message); }
    }

    // Notify admin
    try {
      await sendEmail(
        adminEmail,
        `[FreshPress] Delivery Completed — ${orderId}`,
        `<p><strong>${staffName}</strong> marked order <strong>${orderId}</strong> as delivered at ${new Date(now).toLocaleString('en-NG')}.</p><p>Customer: ${order.customer_name} | Phone: ${order.phone || '—'} | Address: ${order.address || '—'}</p>`
      );
    } catch (e: any) { console.warn('[mark-delivered] admin email failed:', e.message); }

    return Response.json(
      {
        success:      true,
        message:      'Order marked as delivered. Customer has been notified.',
        order_id:     orderId,
        status:       'delivered',
        delivered_by: staffName,
        delivered_at: now,
        completed_at: now,
      },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[mark-delivered] unhandled error:', err);
    return Response.json({ success: false, message: err.message ?? 'Internal server error' }, { status: 500, headers: CORS });
  }
});
