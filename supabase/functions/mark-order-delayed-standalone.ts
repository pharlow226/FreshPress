/**
 * mark-order-delayed-standalone.ts
 *
 * Handles both "Mark as Delayed" (still within pickup window) and
 * "Mark as Rescheduled" (pickup window has passed / overdue).
 *
 * Deploy this file's contents as a Supabase Edge Function named
 * "mark-order-delayed" in the Supabase Dashboard → Edge Functions.
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL,
 *   EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME
 */

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!;
const BREVO_API_KEY     = Deno.env.get('BREVO_API_KEY')!;
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@freshpress.ng';
const EVOLUTION_API_URL  = Deno.env.get('EVOLUTION_API_URL') ?? '';
const EVOLUTION_API_KEY  = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? '';
const ADMIN_EMAIL_FALLBACK = 'faloyesamuel400@gmail.com'; // only used inside getAdminEmail()

const SLOT_DISPLAY: Record<string, string> = {
  morning:   'Morning (9AM–12PM)',
  afternoon: 'Afternoon (1PM–4PM)',
  evening:   'Evening (4PM–7PM)',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Supabase helpers ──────────────────────────────────────────────────────────

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
    `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,customer_name,email,phone,address,pickup_date,pickup_time_slot,status,delay_reason`,
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
  } catch (e) {
    console.warn('[mark-order-delayed] activity log failed:', e);
  }
}

async function getAdminEmail(): Promise<string> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?role=eq.admin&active=eq.true&select=email&limit=1`,
      { headers: dbHeaders() }
    );
    if (!res.ok) return ADMIN_EMAIL_FALLBACK;
    const rows: any[] = await res.json();
    return rows[0]?.email ?? ADMIN_EMAIL_FALLBACK;
  } catch { return ADMIN_EMAIL_FALLBACK; }
}

// ── Email helper ──────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:   { name: 'FreshPress Laundry', email: BREVO_SENDER_EMAIL },
      to:       [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo email failed: ${res.status} ${await res.text()}`);
}

function buildCustomerEmail(order: any, delayReason: string, newDate: string, newSlot: string): string {
  const slotDisplay = SLOT_DISPLAY[newSlot] ?? newSlot;
  const firstName   = (order.customer_name ?? '').split(' ')[0];
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">
          Pickup Rescheduled
        </h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,.7);font-size:14px">FreshPress Laundry Services</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px 40px">
        <p style="font-size:16px;color:#111827;margin:0 0 16px">Hi ${firstName},</p>
        <p style="font-size:15px;color:#374151;margin:0 0 24px">
          We're sorry — your pickup for order <strong>${order.order_id}</strong> has been rescheduled.
        </p>
        <!-- Details card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;margin-bottom:24px">
          <tr><td style="padding:20px 24px">
            ${[
              ['Order ID',        order.order_id],
              ['Reason',          delayReason],
              ['New Pickup Date', newDate],
              ['Time Slot',       slotDisplay],
              ['Address',         order.address ?? '—'],
            ].map(([label, val]) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
                <tr>
                  <td style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;width:140px">${label}</td>
                  <td style="font-size:14px;color:#111827;font-weight:500">${val}</td>
                </tr>
              </table>`).join('')}
          </td></tr>
        </table>
        <p style="font-size:14px;color:#6b7280">
          Questions? Call us at <a href="tel:+2348113143272" style="color:#2563eb;font-weight:600">+234 811 314 3272</a>
        </p>
        <p style="font-size:14px;color:#374151;margin-top:24px">— The FreshPress Team</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:16px 40px;background:#f9fafb;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} FreshPress Laundry Services · Lagos, Nigeria</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── WhatsApp helper ───────────────────────────────────────────────────────────

function sendWhatsApp(phone: string, message: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    console.warn('[mark-order-delayed] WhatsApp not configured, skipping');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
    body: JSON.stringify({ number: `${cleanPhone}`, text: message }),
  }).catch(e => console.warn('[mark-order-delayed] WhatsApp failed:', e));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();

    // ── Step 1 — Validate payload ──────────────────────────────────────────
    const orderId      = body.orderId      ?? body.order_id;
    const staffId      = body.staffId      ?? body.staff_id;
    const staffName    = body.staffName    ?? body.staff_name;
    const delayReason  = body.delayReason  ?? body.delay_reason;
    const newPickupDate = body.newPickupDate ?? body.new_pickup_date;
    const newTimeSlot  = body.newTimeSlot  ?? body.new_time_slot;

    const missing = [
      !orderId      && 'orderId',
      !staffId      && 'staffId',
      !staffName    && 'staffName',
      !delayReason  && 'delayReason',
      !newPickupDate && 'newPickupDate',
      !newTimeSlot  && 'newTimeSlot',
    ].filter(Boolean);

    if (missing.length > 0) {
      return Response.json(
        { success: false, message: `Missing required fields: ${missing.join(', ')}` },
        { status: 400, headers: CORS }
      );
    }

    const validSlots = ['morning', 'afternoon', 'evening'];
    if (!validSlots.includes(newTimeSlot)) {
      return Response.json(
        { success: false, message: `newTimeSlot must be one of: ${validSlots.join(', ')}` },
        { status: 400, headers: CORS }
      );
    }

    // Reject past dates
    const today    = new Date(); today.setHours(0,0,0,0);
    const proposed = new Date(newPickupDate); proposed.setHours(0,0,0,0);
    if (proposed < today) {
      return Response.json(
        { success: false, message: 'newPickupDate must not be in the past' },
        { status: 400, headers: CORS }
      );
    }

    // ── Step 2 — Fetch order ───────────────────────────────────────────────
    let order: any;
    try {
      order = await getOrder(orderId);
    } catch (e: any) {
      return Response.json(
        { success: false, message: e.message },
        { status: 500, headers: CORS }
      );
    }

    if (!order) {
      return Response.json(
        { success: false, message: `Order ${orderId} not found` },
        { status: 404, headers: CORS }
      );
    }

    // ── Step 3 — Verify status ─────────────────────────────────────────────
    const allowedStatuses = ['pending'];
    if (!allowedStatuses.includes(order.status)) {
      return Response.json(
        {
          success: false,
          message: `Order is '${order.status}'. Only pending orders (including overdue ones) can be rescheduled.`,
        },
        { status: 400, headers: CORS }
      );
    }

    const oldPickupDate = order.pickup_date;

    // ── Step 4 — Update order ──────────────────────────────────────────────
    try {
      await updateOrder(orderId, {
        delay_reason:     delayReason,
        pickup_date:      newPickupDate,
        pickup_time_slot: newTimeSlot,
        updated_at:       new Date().toISOString(),
      });
    } catch (e: any) {
      return Response.json(
        { success: false, message: e.message },
        { status: 500, headers: CORS }
      );
    }

    // ── Step 5 — Log activity (non-blocking) ──────────────────────────────
    const slotDisplay = SLOT_DISPLAY[newTimeSlot] ?? newTimeSlot;
    await logActivity({
      order_id:      orderId,
      staff_id:      staffId,
      staff_name:    staffName,
      activity_type: 'status_changed',
      description:   `Pickup rescheduled by ${staffName}. Reason: ${delayReason}. Rescheduled to ${newPickupDate} (${slotDisplay})`,
      old_value:     oldPickupDate,
      new_value:     newPickupDate,
    });

    // ── Step 6 — Fetch admin email from Supabase ──────────────────────────
    const adminEmail = await getAdminEmail();

    // ── Step 7 — Customer email ────────────────────────────────────────────
    const firstName = (order.customer_name ?? '').split(' ')[0];
    let emailError: string | null = null;
    if (order.email) {
      try {
        await sendEmail(
          order.email,
          `FreshPress — Pickup Rescheduled (${orderId})`,
          buildCustomerEmail(order, delayReason, newPickupDate, newTimeSlot)
        );
      } catch (e: any) {
        emailError = e.message;
        console.error('[mark-order-delayed] Customer email failed:', e.message);
        try {
          await sendEmail(
            adminEmail,
            `[FreshPress] Failed to notify customer — ${orderId}`,
            `<p>Customer email notification failed for order <strong>${orderId}</strong>.</p><p>Error: ${e.message}</p>`
          );
        } catch {}
      }
    }

    // ── Step 8 — WhatsApp (fire-and-forget) ──────────────────────────────
    if (order.phone) {
      const waMessage =
`FRESHPRESS — PICKUP RESCHEDULED

Hi ${firstName}, your pickup has been rescheduled.

Order ID: ${orderId}
Reason: ${delayReason}

New Pickup Date: ${newPickupDate}
Time: ${slotDisplay}

We apologize for the inconvenience. Questions? Call +234 811 314 3272`;
      sendWhatsApp(order.phone, waMessage);
    }

    // ── Step 9 — Notify admin of action ──────────────────────────────────
    try {
      await sendEmail(
        adminEmail,
        `[FreshPress] Pickup Rescheduled — ${orderId}`,
        `<p><strong>${staffName}</strong> rescheduled the pickup for order <strong>${orderId}</strong>.</p><p>Customer: ${order.customer_name} | Reason: ${delayReason}</p><p>Old date: ${oldPickupDate} | New date: ${newPickupDate} (${slotDisplay})</p>`
      );
    } catch (e: any) { console.warn('[mark-order-delayed] admin email failed:', e.message); }

    // ── Step 10 — Success ──────────────────────────────────────────────────
    return Response.json(
      {
        success:          true,
        message:          'Order rescheduled successfully. Customer has been notified.',
        order_id:         orderId,
        delay_reason:     delayReason,
        new_pickup_date:  newPickupDate,
        new_time_slot:    newTimeSlot,
        rescheduled_by:   staffName,
        email_sent:       !emailError,
      },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[mark-order-delayed] Unhandled error:', err);
    return Response.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
});
