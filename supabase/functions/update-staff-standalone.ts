/**
 * update-staff-standalone.ts
 * Deploy as: "update-staff" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets: SERVICE_ROLE_KEY, SUPABASE_URL
 *
 * Payload:
 *   {
 *     staffId:    "uuid",          // required
 *     full_name?: "John Thomas",   // optional
 *     phone?:     "+447911123456", // optional — any format, stored as-is
 *     email?:     "new@email.com"  // optional — updates BOTH staff_members + Supabase Auth
 *   }
 *
 * Notes:
 *   - At least one of full_name, phone, email must be provided
 *   - Email change updates Supabase Auth user (changes their login credentials)
 *   - Phone stored exactly as entered — no formatting applied
 *   - Admin emails only sent on failure (not on success — admin can see activity log)
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return Response.json({ success: false, message: 'Method not allowed' }, { status: 405, headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const { staffId, full_name, phone, email } = body;

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!staffId) {
      return Response.json({ success: false, message: 'staffId is required' }, { status: 400, headers: CORS });
    }
    const hasUpdate = full_name !== undefined || phone !== undefined || email !== undefined;
    if (!hasUpdate) {
      return Response.json({ success: false, message: 'At least one field (full_name, phone, email) must be provided' }, { status: 400, headers: CORS });
    }
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
      return Response.json({ success: false, message: 'Invalid email address' }, { status: 400, headers: CORS });
    }

    // ── Build DB patch (only include provided fields) ─────────────────────────
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) patch.full_name = (full_name as string).trim();
    if (phone     !== undefined) patch.phone     = phone ? (phone as string).trim() : null;
    if (email     !== undefined) patch.email     = (email as string).trim().toLowerCase();

    // ── Step 1 — Update staff_members table ──────────────────────────────────
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?id=eq.${encodeURIComponent(staffId)}`,
      { method: 'PATCH', headers: dbHeaders(), body: JSON.stringify(patch) },
    );
    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error('[update-staff] DB update failed:', dbErr);
      return Response.json({ success: false, message: 'Failed to update staff record. Please try again.' }, { status: 500, headers: CORS });
    }

    // ── Step 2 — If email changed, update Supabase Auth too ──────────────────
    if (email !== undefined) {
      const authRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${staffId}`,
        {
          method:  'PUT',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ email: (email as string).trim().toLowerCase() }),
        },
      );
      if (!authRes.ok) {
        const authErr = await authRes.text();
        console.error('[update-staff] Auth email update failed:', authErr);
        // DB is already updated — warn but don't fail the whole operation
        return Response.json({
          success: true,
          warning: 'Profile updated but login email could not be changed. Staff member may need to use their old email to log in.',
        }, { status: 200, headers: CORS });
      }
    }

    // ── Log to staff_activities (non-blocking) ────────────────────────────────
    const changedFields = Object.keys(patch).filter(k => k !== 'updated_at').join(', ');
    fetch(`${SUPABASE_URL}/rest/v1/staff_activities`, {
      method:  'POST',
      headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        staff_id:      staffId,
        staff_name:    patch.full_name ?? 'Staff',
        activity_type: 'status_changed',
        description:   `Staff profile updated by admin. Fields changed: ${changedFields}`,
        new_value:     'profile_updated',
        created_at:    new Date().toISOString(),
      }),
    }).catch(e => console.warn('[update-staff] activity log failed:', e));

    return Response.json({ success: true, message: 'Staff profile updated successfully.' }, { status: 200, headers: CORS });

  } catch (err: any) {
    console.error('[update-staff] unhandled error:', err);
    return Response.json({ success: false, message: 'An unexpected error occurred. Please try again.' }, { status: 500, headers: CORS });
  }
});
