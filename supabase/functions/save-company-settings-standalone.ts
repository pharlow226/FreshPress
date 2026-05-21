/**
 * save-company-settings-standalone.ts
 * Deploy as: "save-company-settings" in Supabase Dashboard → Edge Functions
 *
 * company_info is a SINGLETON table — exactly ONE row, always.
 * This function always updates that one row.
 * If no row exists yet, it inserts the first one.
 * If somehow duplicates exist, it cleans them up automatically.
 *
 * Secrets needed: SERVICE_ROLE_KEY
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

// Whitelisted columns — no arbitrary writes allowed
const ALLOWED_FIELDS = [
  'company_name', 'company_email', 'company_phone',
  'company_address', 'company_whatsapp',
  'account_name', 'account_number', 'bank_name',
  'tax_rate', 'currency', 'minimum_order',
  // SEO / Social Media
  'og_image_url', 'latitude', 'longitude', 'service_areas',
];

const NUMERIC_FIELDS = new Set(['tax_rate', 'latitude', 'longitude', 'minimum_order']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();

    // Build patch from whitelisted fields only
    const patch: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined && body[key] !== '') {
        patch[key] = NUMERIC_FIELDS.has(key) ? parseFloat(body[key]) : body[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return Response.json(
        { success: false, message: 'No valid fields provided' },
        { status: 400, headers: CORS }
      );
    }

    // Validate tax_rate
    if (patch.tax_rate !== undefined) {
      const v = patch.tax_rate as number;
      if (isNaN(v) || v < 0 || v > 1) {
        return Response.json(
          { success: false, message: 'tax_rate must be between 0 and 1 (e.g. 0.075 for 7.5%)' },
          { status: 400, headers: CORS }
        );
      }
    }

    // Validate latitude / longitude ranges
    if (patch.latitude !== undefined && (isNaN(patch.latitude as number) || Math.abs(patch.latitude as number) > 90)) {
      return Response.json({ success: false, message: 'Invalid latitude (must be -90 to 90)' }, { status: 400, headers: CORS });
    }
    if (patch.longitude !== undefined && (isNaN(patch.longitude as number) || Math.abs(patch.longitude as number) > 180)) {
      return Response.json({ success: false, message: 'Invalid longitude (must be -180 to 180)' }, { status: 400, headers: CORS });
    }

    // ── Fetch ALL existing rows ───────────────────────────────────────────────
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/company_info?select=id&order=created_at.asc`,
      { headers: dbHeaders() }
    );
    const existing: any[] = checkRes.ok ? await checkRes.json() : [];

    let result: any;

    if (existing.length > 0) {
      // ── UPDATE the FIRST (oldest) row ──────────────────────────────────────
      const canonicalId = existing[0].id;

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/company_info?id=eq.${canonicalId}`,
        { method: 'PATCH', headers: dbHeaders(), body: JSON.stringify(patch) }
      );
      if (!updateRes.ok) {
        throw new Error(`DB update failed: ${updateRes.status} ${await updateRes.text()}`);
      }
      result = { id: canonicalId, ...patch };

      // ── Self-heal: delete any duplicate rows (keep only the canonical one) ─
      if (existing.length > 1) {
        const duplicateIds = existing.slice(1).map((r: any) => r.id);
        console.log(`[save-company-settings] Cleaning up ${duplicateIds.length} duplicate row(s)…`);
        for (const dupId of duplicateIds) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/company_info?id=eq.${dupId}`,
            { method: 'DELETE', headers: dbHeaders() }
          ).catch(e => console.warn('[save-company-settings] delete duplicate failed:', e));
        }
      }

    } else {
      // ── INSERT first-ever row ───────────────────────────────────────────────
      const insertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/company_info`,
        { method: 'POST', headers: dbHeaders(), body: JSON.stringify(patch) }
      );
      if (!insertRes.ok) {
        throw new Error(`DB insert failed: ${insertRes.status} ${await insertRes.text()}`);
      }
      const rows: any[] = await insertRes.json();
      result = rows[0] ?? patch;
    }

    return Response.json(
      { success: true, message: 'Company settings saved successfully', data: result },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[save-company-settings] error:', err);
    return Response.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
});
