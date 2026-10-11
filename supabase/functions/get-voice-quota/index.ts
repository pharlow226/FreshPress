/**
 * get-voice-quota/index.ts
 * Supabase Edge Function to fetch ElevenLabs voice quota for Admin dashboard.
 *
 * Security & Reliability:
 * - Admin authorization check (active admin only)
 * - 8-second timeout on upstream call
 * - 60-second in-memory response cache
 * - Error masking (prevents exposing internal details to client)
 * - Modern Deno.serve handler with proper HTTP status codes
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface QuotaCache {
  data: { character_count: number; character_limit: number; tier: string };
  expiresAt: number;
}

let cachedQuota: QuotaCache | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;

  // 1. Authenticate caller and verify active admin role
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return Response.json({ error: 'Unauthorized: Missing session token' }, { status: 401, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized: Invalid session' }, { status: 401, headers: corsHeaders });
  }

  // Check admin role in staff_members
  const { data: staff, error: staffError } = await supabaseAdmin
    .from('staff_members')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (staffError || !staff || !staff.active || staff.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403, headers: corsHeaders });
  }

  // 2. Return cached quota if fresh (60 seconds)
  const now = Date.now();
  if (cachedQuota && cachedQuota.expiresAt > now) {
    return Response.json(cachedQuota.data, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  // 3. Fetch from ElevenLabs with 8s timeout
  const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!elevenLabsKey) {
    console.error('[get-voice-quota] ELEVENLABS_API_KEY secret is not set.');
    return Response.json({ error: 'Voice provider credentials not configured' }, { status: 500, headers: corsHeaders });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errDetail = await response.text().catch(() => '');
      console.error(`[get-voice-quota] ElevenLabs upstream error ${response.status}:`, errDetail);
      return Response.json({ error: 'Voice provider service temporarily unavailable' }, { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const result = {
      character_count: data.character_count ?? 0,
      character_limit: data.character_limit ?? 0,
      tier: data.tier ?? 'free',
    };

    // Cache for 60 seconds
    cachedQuota = {
      data: result,
      expiresAt: now + 60 * 1000,
    };

    return Response.json(result, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('[get-voice-quota] Fetch error:', err);
    return Response.json({ error: 'Voice provider request timed out' }, { status: 504, headers: corsHeaders });
  }
});
