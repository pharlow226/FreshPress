/**
 * reset-password-standalone.ts
 * Deploy as: "reset-password" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY, SUPABASE_URL, BREVO_API_KEY, BREVO_SENDER_EMAIL,
 *   STAFF_SITE_URL
 *
 * Flow:
 *  1. Validate payload (staff_id, reset_token, new_password)
 *  2. Fetch staff record (id + token + expiry)
 *  3. Verify token not expired
 *  4. Update Supabase Auth password via admin API
 *  5. Clear token + set force_password_change = false (non-blocking)
 *  6. Log to staff_activities (non-blocking)
 *  7. Send confirmation email (non-blocking)
 *  8. Return success
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
const BREVO_KEY        = Deno.env.get('BREVO_API_KEY')      ?? '';
const BREVO_SENDER     = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@freshpress.ng';
const STAFF_SITE_URL   = Deno.env.get('STAFF_SITE_URL')     ?? 'https://freshpresslaundryservice.lovable.app';

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

function authAdminHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  };
}

// ── Password validation ───────────────────────────────────────────────────────

function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8)         return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))            return 'Password must contain at least one uppercase letter.';
  if (!/\d/.test(pw))               return 'Password must contain at least one number.';
  return null;
}

// ── Confirmation email template ───────────────────────────────────────────────

function buildConfirmEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
<tr><td align="center">
<table style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#059669,#065f46);padding:32px 40px;text-align:center;">
    <p style="margin:0 0 6px;color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Staff Portal</p>
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:900;">Password Reset Successful</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your account password has been updated</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      Your FreshPress staff portal password has been successfully updated. You can now log in with your new password.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td align="center" style="background:linear-gradient(135deg,#059669,#065f46);border-radius:12px;">
        <a href="${STAFF_SITE_URL}/login"
           style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          Login to Staff Portal
        </a>
      </td></tr>
    </table>

    <!-- Security warning box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;margin-bottom:8px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.5;">
          <strong>Did not make this change?</strong> Contact your administrator immediately via WhatsApp: +234 811 314 3272.
          Your account may have been accessed without your permission.
        </p>
      </td></tr>
    </table>

    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      All other active sessions have been invalidated for your security.
    </p>
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
    // ── Step 1 — Validate payload ───────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { staff_id, reset_token, new_password } = body;

    if (!staff_id)    return Response.json({ success: false, message: 'staff_id is required' },    { status: 400, headers: CORS });
    if (!reset_token) return Response.json({ success: false, message: 'reset_token is required' }, { status: 400, headers: CORS });
    if (!new_password) return Response.json({ success: false, message: 'new_password is required' }, { status: 400, headers: CORS });

    const pwError = validatePassword(new_password);
    if (pwError) return Response.json({ success: false, message: pwError }, { status: 400, headers: CORS });

    // ── Step 2 — Fetch staff record ─────────────────────────────────────────
    const staffRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?id=eq.${encodeURIComponent(staff_id)}&reset_token=eq.${encodeURIComponent(reset_token)}&select=id,full_name,email,reset_token_expires`,
      { headers: dbHeaders() },
    );
    if (!staffRes.ok) {
      console.error('[reset-password] DB fetch failed:', await staffRes.text());
      return Response.json({ success: false, message: 'Service temporarily unavailable. Please try again.' }, { status: 500, headers: CORS });
    }
    const staffRows: any[] = await staffRes.json();
    if (!staffRows.length) {
      return Response.json({ success: false, message: 'Invalid reset link. Please request a new one.' }, { status: 400, headers: CORS });
    }
    const staff = staffRows[0];

    // ── Step 3 — Verify token not expired ───────────────────────────────────
    if (!staff.reset_token_expires || new Date() > new Date(staff.reset_token_expires)) {
      return Response.json({ success: false, message: 'This reset link has expired. Please request a new one.' }, { status: 410, headers: CORS });
    }

    // ── Step 4 — Update Supabase Auth password ──────────────────────────────
    const authRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${staff_id}`,
      {
        method:  'PUT',
        headers: authAdminHeaders(),
        body:    JSON.stringify({ password: new_password }),
      },
    );
    if (!authRes.ok) {
      console.error('[reset-password] Auth update failed:', await authRes.text());
      return Response.json({ success: false, message: 'Failed to update password. Please try again or contact admin.' }, { status: 500, headers: CORS });
    }

    // ── Step 5 — Clear token + update staff record (non-blocking) ───────────
    fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?id=eq.${staff_id}`,
      {
        method:  'PATCH',
        headers: dbHeaders(),
        body:    JSON.stringify({
          reset_token:          null,
          reset_token_expires:  null,
          force_password_change: false,
          updated_at:           new Date().toISOString(),
        }),
      },
    ).catch(e => console.warn('[reset-password] clear token failed:', e));

    // ── Step 6 — Log activity (non-blocking) ────────────────────────────────
    fetch(`${SUPABASE_URL}/rest/v1/staff_activities`, {
      method:  'POST',
      headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        staff_id:      staff.id,
        staff_name:    staff.full_name,
        activity_type: 'status_changed',
        description:   'Password successfully reset via forgot password flow',
        new_value:     'password_reset_complete',
        created_at:    new Date().toISOString(),
      }),
    }).catch(e => console.warn('[reset-password] activity log failed:', e));

    // ── Step 7 — Send confirmation email (non-blocking) ─────────────────────
    if (BREVO_KEY && staff.email) {
      const firstName = (staff.full_name ?? 'Staff').split(' ')[0];
      fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: 'FreshPress Laundry', email: BREVO_SENDER },
          to:          [{ email: staff.email, name: staff.full_name }],
          subject:     'Your Password Has Been Reset — FreshPress Staff Portal',
          htmlContent: buildConfirmEmail(firstName),
        }),
      }).catch(e => console.warn('[reset-password] email failed:', e));
    }

    // ── Step 8 — Return success ──────────────────────────────────────────────
    return Response.json(
      { success: true, message: 'Password updated successfully. You can now log in with your new password.' },
      { status: 200, headers: CORS },
    );

  } catch (err: any) {
    console.error('[reset-password] unhandled error:', err);
    return Response.json({ success: false, message: 'An unexpected error occurred. Please try again.' }, { status: 500, headers: CORS });
  }
});
