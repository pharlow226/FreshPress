/**
 * FreshPress — create-staff Edge Function (standalone, dashboard-ready)
 *
 * HOW TO DEPLOY:
 *  Supabase Dashboard -> Edge Functions -> New Function -> name: create-staff -> paste -> Deploy
 *
 * Required secrets (same as create-order):
 *  SERVICE_ROLE_KEY     Supabase service role key
 *  BREVO_API_KEY        Brevo API key
 *  BREVO_SENDER_EMAIL   Verified sender email
 *
 * Flow:
 *  1. Validate payload (full_name, email, phone, role)
 *  2. Generate temp password: FirstName + 4digits + symbol
 *  3. Create Supabase Auth user (email_confirm: true)
 *  4. Insert into staff_members (force_password_change: true)
 *  5. Rollback auth user if DB insert fails
 *  6. Send welcome email to staff via Brevo
 *  7. Alert admin on any failure
 *  8. WhatsApp placeholder (Evolution API — uncomment when ready)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL  = 'faloyesamuel400@gmail.com';
const LOGIN_URL    = 'https://stafffreshpress.lovable.app';
const SYMBOLS      = ['!', '@', '#', '$', '%', '&'];

interface StaffPayload {
  full_name: string;
  email:     string;
  phone?:    string;
  role:      'pickup' | 'accountant' | 'admin';
}

function generateTempPassword(fullName: string): string {
  const firstName = fullName.trim().split(' ')[0];
  const digits    = Math.floor(1000 + Math.random() * 9000);
  const symbol    = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  return `${firstName}${digits}${symbol}`;
}

async function sendBrevoEmail(apiKey: string, senderEmail: string, to: { email: string; name?: string }[], subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'FreshPress Laundry', email: senderEmail }, to, subject, htmlContent: html }),
  });
  return res.ok;
}

function welcomeEmail(p: { name: string; email: string; tempPassword: string; role: string; loginUrl: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f0f4ff;">
<tr><td align="center">
<table style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#3b5bdb,#4c3d9e);padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FreshPress Staff Portal</p>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">Welcome to the Team!</h1>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <p style="color:#1e293b;font-size:15px;">Hi <strong>${p.name}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;">Your FreshPress staff account has been created. Use the credentials below to log in and complete your account setup.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;margin:20px 0;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e0e7ff;">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Role</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;text-transform:capitalize;">${p.role}</p>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e0e7ff;">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Email</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${p.email}</p>
      </td></tr>
      <tr><td style="padding:14px 20px;">
        <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Temporary Password</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#3b5bdb;font-family:monospace;letter-spacing:2px;">${p.tempPassword}</p>
        <p style="margin:6px 0 0;font-size:11px;color:#f59e0b;">You will be required to change this on first login.</p>
      </td></tr>
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="${p.loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b5bdb,#4c3d9e);color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;text-decoration:none;">Login to Staff Portal</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:20px;">For security, do not share your password with anyone. Contact admin if you have issues.</p>
  </td></tr>
  <tr><td style="background:#f8faff;border-top:1px solid #e0e7ff;padding:16px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">FreshPress Laundry Services - Lagos, Nigeria</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function adminAlertEmail(subject: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:monospace;padding:24px;background:#fff1f2;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #fca5a5;border-radius:12px;padding:24px;">
  <h2 style="color:#dc2626;margin-top:0;">FreshPress Alert</h2>
  <p style="color:#1e293b;white-space:pre-wrap;">${body}</p>
</div></body></html>`;
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
  const canEmail    = !!(brevoKey && brevoSender);

  try {
    const body = await req.json() as StaffPayload & { setupSecret?: string };
    if (!body.full_name?.trim() || !body.email?.trim() || !body.role) {
      return new Response(JSON.stringify({ success: false, message: 'full_name, email, and role are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Setup-secret guard (first-admin bootstrap only) ─────────────
    // If SETUP_SECRET is configured as a Supabase secret, any request
    // that creates an admin account MUST provide it in the payload.
    // This replaces the old client-side VITE_SETUP_SECRET check.
    const serverSecret = Deno.env.get('SETUP_SECRET') ?? '';
    if (body.role === 'admin' && serverSecret) {
      if (!body.setupSecret || body.setupSecret !== serverSecret) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid or missing setup secret. Contact your system administrator.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const VALID_ROLES = ['pickup', 'accountant', 'admin'];
    if (!VALID_ROLES.includes(body.role)) {
      return new Response(JSON.stringify({ success: false, message: 'role must be pickup, accountant, or admin' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tempPassword = generateTempPassword(body.full_name);

    // 1. Create Supabase Auth user
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:         body.email.trim().toLowerCase(),
        password:      tempPassword,
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim(), role: body.role },
      }),
    });

    const authData = await authRes.json();
    if (!authRes.ok || !authData.id) {
      console.error('[create-staff] Auth creation failed:', authData);
      if (canEmail) {
        await sendBrevoEmail(brevoKey, brevoSender, [{ email: ADMIN_EMAIL }],
          '[ALERT] Staff auth creation failed',
          adminAlertEmail('Auth Creation Failed', `Name: ${body.full_name}\nEmail: ${body.email}\nError: ${JSON.stringify(authData)}`));
      }
      return new Response(JSON.stringify({ success: false, message: authData?.msg || 'Failed to create auth user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authData.id;

    // 2. Insert into staff_members
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/staff_members`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id:                    userId,
        email:                 body.email.trim().toLowerCase(),
        full_name:             body.full_name.trim(),
        phone:                 body.phone?.trim() || null,
        role:                  body.role,
        active:                true,
        force_password_change: true,
        created_at:            new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      }),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error('[create-staff] DB insert failed:', dbErr);

      // Rollback: delete auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
      }).catch(e => console.error('[create-staff] Rollback failed:', e));

      if (canEmail) {
        await sendBrevoEmail(brevoKey, brevoSender, [{ email: ADMIN_EMAIL }],
          '[ALERT] Staff DB insert failed — auth user rolled back',
          adminAlertEmail('DB Insert Failed (Auth Rolled Back)', `Name: ${body.full_name}\nEmail: ${body.email}\nError: ${dbErr}`));
      }
      return new Response(JSON.stringify({ success: false, message: 'Failed to save staff record. Auth user rolled back.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Send welcome email
    if (canEmail) {
      await sendBrevoEmail(brevoKey, brevoSender,
        [{ email: body.email, name: body.full_name }],
        'Welcome to FreshPress Staff Portal',
        welcomeEmail({ name: body.full_name.split(' ')[0], email: body.email, tempPassword, role: body.role, loginUrl: LOGIN_URL })
      ).catch(e => console.error('[create-staff] Welcome email failed:', e));
    }

    // 4. WhatsApp via Evolution API (uncomment when ready)
    // const evoUrl  = Deno.env.get('EVOLUTION_API_URL');
    // const evoKey  = Deno.env.get('EVOLUTION_API_KEY');
    // const evoInst = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    // if (evoUrl && evoKey && evoInst && body.phone) {
    //   const raw = body.phone.replace(/\D/g, '');
    //   const wa  = raw.startsWith('0') ? '234' + raw.slice(1) : raw;
    //   await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    //     body: JSON.stringify({ number: wa, textMessage: { text:
    //       `Hello ${body.full_name.split(' ')[0]}! Your FreshPress staff account is ready.\n\nLogin: ${LOGIN_URL}\nEmail: ${body.email}\nTemp Password: ${tempPassword}\n\nYou will be prompted to change your password on first login.`
    //     }}),
    //   }).catch(e => console.error('[create-staff] WhatsApp failed:', e));
    // }

    return new Response(JSON.stringify({ success: true, userId, message: `Staff account created for ${body.full_name}. Welcome email sent.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[create-staff] Unhandled error:', err);
    return new Response(JSON.stringify({ success: false, message: 'Unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
