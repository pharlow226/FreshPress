/**
 * forgot-password-standalone.ts
 * Deploy as: "forgot-password" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY, SUPABASE_URL, BREVO_API_KEY, BREVO_SENDER_EMAIL,
 *   RESET_SECRET, STAFF_SITE_URL
 *
 * Flow:
 *  1. Validate email
 *  2. Look up staff_members
 *  3. Generate secure HMAC-signed reset token
 *  4. Save token + expiry to staff_members
 *  5. Send branded Brevo email
 *  6. Log to staff_activities (non-blocking)
 *  7. Always return the same success message
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
const BREVO_KEY        = Deno.env.get('BREVO_API_KEY')        ?? '';
const BREVO_SENDER     = Deno.env.get('BREVO_SENDER_EMAIL')   ?? 'noreply@freshpress.ng';
const RESET_SECRET     = Deno.env.get('RESET_SECRET')         ?? 'freshpress-reset-secret-2026';
const STAFF_SITE_URL   = Deno.env.get('STAFF_SITE_URL')       ?? 'https://freshpresslaundryservice.lovable.app';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Generic success response (always the same — prevents email enumeration) ───
const SUCCESS_BODY = JSON.stringify({
  success: true,
  message: 'If your email is registered, you will receive a reset link shortly.',
});

function dbHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer':        'return=representation',
  };
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** Generates a hex string of `byteLen` random bytes */
function randomHex(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 of `message` using `secret`, returned as hex */
async function hmacSign(secret: string, message: string): Promise<string> {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Email template ────────────────────────────────────────────────────────────

function buildResetEmail(firstName: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
<tr><td align="center">
<table style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
    <p style="margin:0 0 6px;color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Staff Portal</p>
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:900;">Reset Your Password</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Password reset request received</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      We received a request to reset the password for your FreshPress staff account. Click the button below to set a new password.
      This link will expire in <strong>1 hour</strong>.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td align="center" style="background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:12px;">
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          Reset My Password
        </a>
      </td></tr>
    </table>

    <!-- Plain text fallback -->
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:11px;color:#64748b;word-break:break-all;">${resetUrl}</p>

    <!-- Warning box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;margin-bottom:8px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#713f12;line-height:1.5;">
          <strong>Did not request this?</strong> Ignore this email. Your password will not change unless you click the link above.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;">FreshPress Laundry Services — Lagos, Nigeria</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      Questions? WhatsApp: +234 811 314 3272
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return Response.json({ success: false, message: 'Method not allowed' }, { status: 405, headers: CORS });

  try {
    // ── Step 1 — Validate email ─────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ success: false, message: 'Invalid email address' }, { status: 400, headers: CORS });
    }

    // ── Step 2 — Check staff exists ─────────────────────────────────────────
    const staffRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?email=eq.${encodeURIComponent(email)}&active=eq.true&select=id,email,full_name`,
      { headers: dbHeaders() },
    );
    if (!staffRes.ok) {
      console.error('[forgot-password] DB fetch failed:', await staffRes.text());
      return Response.json({ success: false, message: 'Service temporarily unavailable. Please try again.' }, { status: 500, headers: CORS });
    }
    const staffRows: any[] = await staffRes.json();
    const staff = staffRows[0];

    // If staff not found — return the same generic success to prevent email enumeration
    if (!staff) {
      console.log(`[forgot-password] No active staff for email: ${email}`);
      return new Response(SUCCESS_BODY, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Step 3 — Generate secure HMAC-signed reset token ───────────────────
    const rawToken    = randomHex(32);
    const expiresAt   = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const expTimestamp = new Date(expiresAt).getTime().toString();
    const hmacPayload  = `${staff.id}:${email}:${expTimestamp}`;
    const signature    = await hmacSign(RESET_SECRET, hmacPayload);
    const secureToken  = `${rawToken}.${signature}`;

    const resetUrl = `${STAFF_SITE_URL}/reset-password?token=${encodeURIComponent(secureToken)}&staff_id=${staff.id}`;

    // ── Step 4 — Persist token in staff_members ─────────────────────────────
    const saveRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?id=eq.${staff.id}`,
      {
        method:  'PATCH',
        headers: dbHeaders(),
        body:    JSON.stringify({ reset_token: secureToken, reset_token_expires: expiresAt }),
      },
    );
    if (!saveRes.ok) {
      console.error('[forgot-password] Token save failed:', await saveRes.text());
      return Response.json({ success: false, message: 'Failed to save reset token. Please try again.' }, { status: 500, headers: CORS });
    }

    // ── Step 5 — Send Brevo email ───────────────────────────────────────────
    if (!BREVO_KEY) {
      console.warn('[forgot-password] BREVO_API_KEY not set — skipping email');
    } else {
      const firstName  = (staff.full_name ?? 'Staff').split(' ')[0];
      const emailRes   = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: 'FreshPress Laundry', email: BREVO_SENDER },
          to:          [{ email: staff.email, name: staff.full_name }],
          subject:     'Reset Your Password — FreshPress Staff Portal',
          htmlContent: buildResetEmail(firstName, resetUrl),
        }),
      });
      if (!emailRes.ok) {
        console.error('[forgot-password] Brevo send failed:', await emailRes.text());
        return Response.json({ success: false, message: 'Failed to send reset email. Please try again or contact admin.' }, { status: 500, headers: CORS });
      }
    }

    // ── Step 6 — Log activity (non-blocking) ────────────────────────────────
    fetch(`${SUPABASE_URL}/rest/v1/staff_activities`, {
      method:  'POST',
      headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        staff_id:      staff.id,
        staff_name:    staff.full_name,
        activity_type: 'status_changed',
        description:   `Password reset link requested and sent to ${email}`,
        new_value:     'reset_requested',
        created_at:    new Date().toISOString(),
      }),
    }).catch(e => console.warn('[forgot-password] activity log failed:', e));

    // ── Step 7 — Return generic success ─────────────────────────────────────
    return new Response(SUCCESS_BODY, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[forgot-password] unhandled error:', err);
    return Response.json({ success: false, message: 'An unexpected error occurred. Please try again.' }, { status: 500, headers: CORS });
  }
});
