/**
 * vapi-webhook.ts
 * Deploy as: "vapi-webhook" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *   SUPABASE_URL
 *   VAPI_WEBHOOK_SECRET
 *   VAPI_API_KEY
 *   INTERNAL_API_SECRET
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function dbH() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer':        'return=representation',
  };
}

// ── Constant-Time Secret Comparison ───────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Anti-Prompt Injection & Spoken Guardrails ──────────────────────────────────
const VOICE_INJECTION_PATTERNS = [
  /(ignore|disregard|forget|bypass|override)\s+(all\s+)?(the\s+)?(previous\s+|prior\s+|above\s+|system\s+|earlier\s+)?instructions/i,
  /you\s+are\s+(now\s+)?(no\s+longer|codebot|dan|developer\s+mode|unconstrained|jailbroken)/i,
  /system\s+prompt/i,
  /system\s+override/i,
  /developer\s+override/i,
  /admin\s+mode/i,
  /reveal\s+(your\s+)?(instructions|system\s+rules|api\s+key|prompt)/i,
  /repeat\s+(everything|the\s+prompt|all\s+words)\s+(above|before)/i,
  /write\s+(a\s+)?(python|javascript|typescript|c\+\+|java|sql|code|script|algorithm)/i,
  /drop\s+table|select\s+\*\s+from/i,
];

function isSpokenInjection(text: string): boolean {
  if (!text) return false;
  return VOICE_INJECTION_PATTERNS.some(regex => regex.test(text));
}

function userSpeechOnly(transcript: string): string {
  return transcript
    .split('\n')
    .filter(line => /^user:/i.test(line.trim()))
    .join('\n');
}

function checkPickupDate(d: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'The date must be a real calendar date. Ask the caller to repeat it.';
  const dt = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== d) return 'That is not a valid calendar date.';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  if (d < today) return 'That date is in the past. Ask for today or a later date.';
  if (dt.getUTCDay() === 0) return 'We are closed on Sundays. Ask for Monday to Saturday.';
  const max = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (d > max) return 'Pickups can only be booked up to sixty days ahead.';
  return null;
}

// ── Vapi API Summary Helper ──────────────────────────────────────────────────
async function fetchVapiCall(callId: string) {
  const r = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: { 'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}` }
  });
  return r.ok ? await r.json() : null;
}

async function getSummaryWithRetry(callId: string, initial: string): Promise<string> {
  if (initial) return initial;
  for (let i = 0; i < 4; i++) {
    const call = await fetchVapiCall(callId);
    const s = call?.analysis?.summary || call?.summary || '';
    if (s) return s;
    await new Promise(r => setTimeout(r, 8000));
  }
  return '';
}

// ── Tool Implementations ──────────────────────────────────────────────────────

async function getPricing(args: any) {
  const [pricingRes, companyRes] = await Promise.allSettled([
    fetch(`${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit&order=display_order.asc`, { headers: dbH() }),
    fetch(`${SUPABASE_URL}/rest/v1/company_info?select=minimum_order&limit=1`, { headers: dbH() })
  ]);

  if (pricingRes.status !== 'fulfilled' || !pricingRes.value.ok) return "Pricing data is temporarily unavailable.";
  const rows = await pricingRes.value.json();
  if (rows.length === 0) return "No pricing data found.";

  let minOrder = '2,000';
  if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
    const compRows = await companyRes.value.json();
    if (compRows.length > 0 && compRows[0].minimum_order != null) {
      minOrder = Number(compRows[0].minimum_order).toLocaleString();
    }
  }

  const cats: Record<string, string[]> = {};
  for (const r of rows) {
    const cat = r.category || 'Other';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(`${r.service_name}: ${r.price} Naira${r.unit ? ' per ' + r.unit : ''}`);
  }

  let resultStr = "Live Pricing Data:\n";
  for (const [cat, items] of Object.entries(cats)) {
    resultStr += `${cat}:\n- ${items.join('\n- ')}\n\n`;
  }
  resultStr += `Minimum Order: ${minOrder} Naira (required for free doorstep pickup and delivery across Lagos).`;
  return resultStr;
}

async function getCompanyInfo(_args: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/company_info?select=*&limit=1`, { headers: dbH() });
  if (!res.ok) return "Company information is temporarily unavailable.";
  const rows = await res.json();
  if (rows.length === 0) return "Company information not configured.";
  
  const c = rows[0];
  let info = `FreshPress Laundry Information:\n`;
  const lagosTime = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
  info += `- Current Live Date & Time: ${lagosTime}\n`;
  if (c.minimum_order) info += `- Minimum Order: ${Number(c.minimum_order).toLocaleString()} Naira (required for free doorstep pickup and delivery across Lagos)\n`;
  if (c.company_address) info += `- Address: ${c.company_address}\n`;
  if (c.company_phone) info += `- Phone/WhatsApp: ${c.company_phone}\n`;
  if (c.company_email) info += `- Email: ${c.company_email}\n`;
  
  let bankName = c.bank_name || 'Bank';
  if (bankName.toLowerCase().includes('opay')) {
    bankName = 'Oh-Pay';
  } else if (bankName.toLowerCase().includes('gtb') || bankName.toLowerCase().includes('guaranty')) {
    bankName = 'G T B';
  } else if (bankName.toLowerCase().includes('fcmb')) {
    bankName = 'F C M B';
  }
  
  if (c.account_number) info += `- Bank Account: ${c.account_number} (${bankName})\n`;
  info += `- Working Hours: Monday-Saturday 7AM-8PM, closed Sundays.\n`;
  return info;
}

async function checkOrderStatus(args: any) {
  const rawId = (args.order_id || '').toString().trim();
  
  if (isSpokenInjection(rawId)) {
    console.warn('[SECURITY ALERT: VOICE_INJECTION_PARAM] Blocked invalid order status query');
    return "I can only check valid FreshPress order numbers. Please provide a standard Order ID like LAU-123456.";
  }

  const orderId = rawId.toUpperCase();
  if (!orderId || !/^LAU-\d{6}$/i.test(orderId)) {
    return "Please provide a valid order ID in the format LAU-123456.";
  }
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,status,payment_status,total_amount,pickup_date,pickup_time_slot,delay_reason`, { headers: dbH() });
  if (!res.ok) return "Failed to lookup order.";
  const rows = await res.json();
  if (rows.length === 0) return `Order ${orderId} not found.`;
  
  const order = rows[0];
  let info = `Order ${order.order_id} is currently ${order.status}. Payment is ${order.payment_status}.`;
  if (order.status === 'pending') {
    info += ` Scheduled for pickup on ${order.pickup_date} (${order.pickup_time_slot}).`;
    if (order.delay_reason) info += ` Note: Rescheduled due to ${order.delay_reason}.`;
  }
  if (order.total_amount) info += ` Total amount is ${order.total_amount} Naira.`;
  
  return info;
}

async function createPickupOrder(args: any) {
  const { customer_name, phone, email, address, pickup_date, pickup_time_slot } = args;

  if (!customer_name || !phone || !email || !address || !pickup_date || !pickup_time_slot) {
    return "Missing required fields. Need customer name, phone number, email address, pickup address, date, and time slot.";
  }

  const combinedArgs = `${customer_name} ${phone} ${email} ${address} ${pickup_date}`;
  if (isSpokenInjection(combinedArgs)) {
    console.warn('[SECURITY ALERT: VOICE_INJECTION_PARAM] Blocked order payload');
    return "I could not process the booking because the information provided contains invalid terms. Please state your full name and pickup address clearly.";
  }

  const cleanName    = String(customer_name).trim().slice(0, 100);
  const cleanPhone   = String(phone).trim().slice(0, 25);
  const cleanEmail   = String(email).toLowerCase().replace(/\s/g, '').slice(0, 100);
  const cleanAddress = String(address).trim().slice(0, 250);

  const phoneDigits = cleanPhone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return "The phone number looks incomplete. Ask the caller to repeat it digit by digit.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return "The email address looks invalid. Ask the caller to spell it out using words.";
  }
  const dateProblem = checkPickupDate(String(pickup_date));
  if (dateProblem) return dateProblem;

  const slotLower = String(pickup_time_slot).toLowerCase();
  let validTimeSlot: string | null = null;
  if (slotLower.includes('morning') || /9am|10am|11am|09:00|10:00|11:00/.test(slotLower)) validTimeSlot = 'morning';
  else if (slotLower.includes('afternoon') || /12pm|1pm|2pm|3pm|12:00|13:00|14:00|15:00/.test(slotLower)) validTimeSlot = 'afternoon';
  else if (slotLower.includes('evening') || /4pm|5pm|6pm|7pm|16:00|17:00|18:00|19:00/.test(slotLower)) validTimeSlot = 'evening';
  if (!validTimeSlot) return "I did not catch a valid time slot. Ask the caller to choose morning, afternoon, or evening.";

  // Duplicate guard: same phone, date and slot in the last 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const dupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?phone=eq.${encodeURIComponent(cleanPhone)}&pickup_date=eq.${pickup_date}&pickup_time_slot=eq.${validTimeSlot}&created_at=gte.${encodeURIComponent(since)}&select=order_id&limit=1`,
    { headers: dbH() }
  );
  if (dupRes.ok) {
    const dup = await dupRes.json();
    if (dup.length > 0) {
      return `An order for this caller already exists. The Order ID is ${dup[0].order_id}. Read it out and do not create another.`;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': Deno.env.get('INTERNAL_API_SECRET') ?? '',
      },
      body: JSON.stringify({
        customer_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress,
        pickup_date,
        pickup_time_slot: validTimeSlot,
        special_instructions: "Created via Voice AI Assistant",
        source: 'phone'
      })
    });
  } catch (_e) {
    console.error('create-order call failed or timed out');
    return "The booking system is slow right now. Ask the caller to try again in a minute or use the website.";
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    console.error("Order creation failed", await res.text());
    return "Failed to create order due to a system error. Please instruct the caller to use the website at fresh-press-chi.vercel.app or reach us on WhatsApp.";
  }

  const data = await res.json();
  const orderId = data.orderId || 'an order';
  return `Order successfully created! The Order ID is ${orderId}. Inform the customer that our team will arrive on ${pickup_date} during the ${validTimeSlot} slot.`;
}

async function logEndOfCallReport(message: any) {
  const callId = message.call?.id;
  if (!callId) return;

  const phone = message.call?.customer?.number || message.call?.phoneCallProviderDetails?.from || null;
  const transcript = message.transcript || '';
  
  // Security Guardrail: Scan voice transcript for spoken prompt injection on caller lines only
  const injectionDetected = isSpokenInjection(userSpeechOnly(transcript));
  
  let initialSummary = message.analysis?.summary || message.call?.analysis?.summary || message.summary || '';
  let summary = await getSummaryWithRetry(callId, initialSummary);

  if (injectionDetected) {
    console.warn(`[SECURITY ALERT: VOICE_INJECTION] Spoken injection detected in call ${callId}`);
    summary = `[SECURITY ALERT: SPOKEN INJECTION ATTEMPT DETECTED] ${summary}`;
  }

  let recordingUrl = message.recordingUrl || '';
  const endedReason = message.endedReason || '';
  const durationSeconds = message.durationSeconds || message.call?.duration || 0;
  const cost = message.cost || 0;

  if (recordingUrl && callId) {
    try {
      const vapiCall = await fetchVapiCall(callId);
      if (vapiCall?.artifact?.presignedMonoUrl) {
        const audioRes = await fetch(vapiCall.artifact.presignedMonoUrl);
        if (audioRes.ok) {
          const audioBlob = await audioRes.blob();
          const fileName = `${callId}.wav`;
          
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/recordings/${fileName}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'audio/wav',
              'x-upsert': 'true',
            },
            body: audioBlob
          });
          
          if (uploadRes.ok) {
            recordingUrl = fileName;
          }
        }
      }
    } catch (e) {
      console.warn("[vapi-webhook] Failed to upload audio file:", e);
    }
  }

  const metadata = message.call?.metadata || {};
  const orderId = metadata.order_id || null;
  let customerId = metadata.customer_id || null;

  if (phone && !customerId) {
    try {
      let localPhone = phone.replace(/\D/g, '');
      if (localPhone.startsWith('234')) {
        localPhone = '0' + localPhone.slice(3);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?phone=eq.${encodeURIComponent(localPhone)}&select=id&limit=1`, {
        headers: dbH()
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          customerId = rows[0].id;
        }
      }
    } catch (e) {
      console.warn("[vapi-webhook] Customer lookup error:", e);
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vapi_call_logs?on_conflict=call_id`, {
      method: 'POST',
      headers: {
        ...dbH(),
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        call_id: callId,
        phone_number: phone,
        order_id: orderId,
        customer_id: customerId,
        transcript,
        summary,
        recording_url: recordingUrl,
        ended_reason: endedReason,
        duration_seconds: durationSeconds,
        cost,
        created_at: new Date().toISOString()
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[vapi-webhook] DB upsert failed: ${res.status} ${errText}`);
    }
  } catch (err) {
    console.error('[vapi-webhook] Failed to log end-of-call report:', err);
  }
}

// ── Main Webhook Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const secret = req.headers.get("x-vapi-secret") ?? '';
  const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET') ?? '';

  if (!safeEqual(secret, expectedSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const type = body.message?.type;
    
    if (type === 'tool-calls') {
      const toolCalls = body.message.toolWithToolCallList || [];
      const results = [];

      for (const item of toolCalls) {
        const toolCallId = item.toolCall.id;
        const functionName = item.toolCall.function.name;
        
        const raw = item.toolCall.function.arguments;
        let args: any = {};
        try { args = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {}); } catch (_e) {}
        
        let resultData = "";
        
        if (functionName === 'get_pricing') {
          resultData = await getPricing(args);
        } else if (functionName === 'get_company_info') {
          resultData = await getCompanyInfo(args);
        } else if (functionName === 'check_order_status') {
          resultData = await checkOrderStatus(args);
        } else if (functionName === 'create_pickup_order') {
          resultData = await createPickupOrder(args);
        } else {
          resultData = `Tool ${functionName} is not recognized.`;
        }

        results.push({
          toolCallId,
          result: resultData
        });
      }

      return Response.json({ results }, { status: 200 });
    } else if (type === 'end-of-call-report') {
      const job = logEndOfCallReport(body.message).catch(e => console.error(e));
      // @ts-ignore EdgeRuntime is provided by Supabase
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(job);
      else await job;
      return Response.json({ success: true }, { status: 200 });
    }

    return Response.json({ success: true }, { status: 200 });

  } catch (err: any) {
    console.error('[vapi-webhook] error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
