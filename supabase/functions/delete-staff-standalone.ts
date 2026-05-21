/**
 * FreshPress — delete-staff Edge Function (standalone, dashboard-ready)
 *
 * HOW TO DEPLOY:
 *  Supabase Dashboard -> Edge Functions -> New Function -> name: delete-staff -> paste -> Deploy
 *
 * Required secrets: SERVICE_ROLE_KEY
 *
 * Deletes staff from both Supabase Auth AND staff_members table.
 * DB delete only happens AFTER auth delete succeeds.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  try {
    const { staffId } = await req.json();
    if (!staffId) {
      return new Response(JSON.stringify({ success: false, message: 'staffId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Delete from Supabase Auth first
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${staffId}`, {
      method: 'DELETE',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
    });

    if (!authRes.ok && authRes.status !== 404) {
      const err = await authRes.text().catch(() => 'unknown');
      return new Response(JSON.stringify({ success: false, message: `Auth delete failed: ${err}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Delete from staff_members
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/staff_members?id=eq.${staffId}`, {
      method: 'DELETE',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Prefer': 'return=minimal' },
    });

    if (!dbRes.ok) {
      const err = await dbRes.text().catch(() => 'unknown');
      return new Response(JSON.stringify({ success: false, message: `DB delete failed: ${err}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Staff member deleted successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[delete-staff] Error:', err);
    return new Response(JSON.stringify({ success: false, message: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
