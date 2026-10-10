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
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;

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

// ── Date and Phone Normalizers ────────────────────────────────────────────────
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

function normalizePhoneDigits(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) {
    digits = '0' + digits.slice(3);
  }
  return digits.slice(-10);
}

function normalizeTimeSlot(slotStr: string): string | null {
  const s = String(slotStr || '').toLowerCase().trim();
  if (['morning', '9am', '10am', '11am', '12pm', '09:00', '10:00', '11:00', '12:00'].some(k => s.includes(k))) return 'morning';
  if (['afternoon', '1pm', '2pm', '3pm', '13:00', '14:00', '15:00'].some(k => s.includes(k))) return 'afternoon';
  if (['evening', '4pm', '5pm', '6pm', '7pm', '16:00', '17:00', '18:00', '19:00'].some(k => s.includes(k))) return 'evening';
  return null;
}

// ── Vapi API Summary Helper ──────────────────────────────────────────────────
async function fetchVapiCall(callId: string) {
  try {
    const r = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}` },
      signal: AbortSignal.timeout(5000)
    });
    return r.ok ? await r.json() : null;
  } catch (_e) {
    return null;
  }
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

// ── Tool Implementations (Strictly Bounded Timeouts & Zero Hallucinated Numbers) ──

async function getPricing(_args: any) {
  try {
    const [pricingRes, companyRes] = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit&order=display_order.asc`, {
        headers: dbH(),
        signal: AbortSignal.timeout(4000)
      }),
      fetch(`${SUPABASE_URL}/rest/v1/company_info?select=minimum_order&limit=1`, {
        headers: dbH(),
        signal: AbortSignal.timeout(4000)
      })
    ]);

    if (pricingRes.status !== 'fulfilled' || !pricingRes.value.ok) {
      return "Pricing data is temporarily unavailable. Please ask the caller to call back in a few minutes or contact us on WhatsApp.";
    }
    const rows = await pricingRes.value.json();
    if (rows.length === 0) return "No pricing data found in our catalog. Please check WhatsApp for custom inquiries.";

    let minOrderNum: number | null = null;
    if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
      const compRows = await companyRes.value.json();
      if (compRows.length > 0 && compRows[0].minimum_order != null) {
        minOrderNum = Number(compRows[0].minimum_order);
      }
    }

    const cats: Record<string, string[]> = {};
    for (const r of rows) {
      const cat = r.category || 'Other';
      if (!cats[cat]) cats[cat] = [];
      const price = Number(r.price);
      const isPerKg = r.unit && /kg|kilo/i.test(r.unit);
      let note = '';
      if (minOrderNum !== null && !isPerKg && !isNaN(price)) {
        note = price >= minOrderNum
          ? 'meets the minimum order on its own'
          : `is ${(minOrderNum - price).toLocaleString()} Naira below the minimum order`;
      }
      const unitStr = r.unit ? ' per ' + r.unit : '';
      const noteStr = note ? ` (${note})` : '';
      cats[cat].push(`${r.service_name}: ${r.price} Naira${unitStr}${noteStr}`);
    }

    let resultStr = "Live Pricing Data:\n";
    for (const [cat, items] of Object.entries(cats)) {
      resultStr += `${cat}:\n- ${items.join('\n- ')}\n\n`;
    }
    if (minOrderNum !== null) {
      resultStr += `Minimum Order: ${minOrderNum.toLocaleString()} Naira (required for free doorstep pickup and delivery across Lagos).`;
    } else {
      resultStr += `Minimum Order: Minimum order threshold is not currently specified. Please advise caller to confirm with customer support on WhatsApp.`;
    }
    return resultStr;
  } catch (_e) {
    return "Our pricing system is currently taking too long to reply. Please advise the caller to call back shortly or check fresh-press-chi.vercel.app/pricing.";
  }
}

async function getCompanyInfo(_args: any) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/company_info?select=*&limit=1`, {
      headers: dbH(),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return "Company information is temporarily unavailable. Please call back shortly.";
    const rows = await res.json();
    if (rows.length === 0) return "Company information not configured. Please call back.";
    
    const c = rows[0];
    let info = `FreshPress Laundry Information:\n`;
    const lagosTime = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
    info += `- Current Live Date & Time: ${lagosTime}\n`;
    if (c.minimum_order != null) {
      info += `- Minimum Order: ${Number(c.minimum_order).toLocaleString()} Naira (required for free doorstep pickup and delivery across Lagos)\n`;
    }
    if (c.service_areas) info += `- Free Pickup Coverage Areas: ${c.service_areas}\n`;
    info += `- Pickup Windows: Morning (9:00 AM to 12:00 PM), Afternoon (1:00 PM to 4:00 PM), Evening (4:00 PM to 7:00 PM). Note: These are arrival windows, not fixed minutes.\n`;
    if (c.company_address) info += `- Address: ${c.company_address}\n`;
    if (c.company_phone) info += `- Phone/WhatsApp: ${c.company_phone}\n`;
    if (c.company_email) info += `- Email: ${c.company_email}\n`;
    
    let bankName = c.bank_name || 'Bank';
    const bnLower = bankName.toLowerCase();
    if (bnLower.includes('opay')) bankName = 'Oh-Pay';
    else if (bnLower.includes('gtb') || bnLower.includes('guaranty')) bankName = 'G T B';
    else if (bnLower.includes('fcmb')) bankName = 'F C M B';
    else if (bnLower.includes('kuda')) bankName = 'Koo-dah Bank';
    else if (bnLower.includes('uba')) bankName = 'U B A';
    
    if (c.account_number) info += `- Bank Account: ${c.account_number} (${bankName})\n`;
    info += `- Working Hours: Monday-Saturday 7AM-8PM, closed Sundays.\n`;
    return info;
  } catch (_e) {
    return "Company information service is temporarily slow. FreshPress operates Monday to Saturday 7AM to 8PM. Please call back in a moment or reach us on WhatsApp.";
  }
}

// ── Caller Verification Guard on Order Lookups ────────────────────────────────
async function checkOrderStatus(args: any, callerPhone: string | null) {
  const rawId = (args.order_id || '').toString().trim();
  
  if (isSpokenInjection(rawId)) {
    console.warn('[SECURITY ALERT: VOICE_INJECTION_PARAM] Blocked invalid order status query');
    return "I can only check valid FreshPress order numbers. Please provide a standard Order ID like LAU-123456.";
  }

  const orderId = rawId.toUpperCase();
  if (!orderId || !/^LAU-\d{6}$/i.test(orderId)) {
    return "Please provide a valid order ID in the format LAU-123456.";
  }
  
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,phone,status,payment_status,total_amount,pickup_date,pickup_time_slot,delay_reason`,
      { headers: dbH(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return "Failed to lookup order. Please call back in a moment or check on WhatsApp.";
    const rows = await res.json();
    if (rows.length === 0) return `Order ${orderId} not found in our system.`;
    
    const order = rows[0];

    // Caller Verification: Ensure caller number matches phone on order
    if (callerPhone && order.phone) {
      const normCaller = normalizePhoneDigits(callerPhone);
      const normOrder  = normalizePhoneDigits(order.phone);
      if (normCaller.length >= 7 && normOrder.length >= 7 && normCaller !== normOrder) {
        return `For security and privacy, I can only provide order details to the phone number on file for this booking. If you are calling from a different line, please contact our team on WhatsApp at +2348113143272 with your Order ID.`;
      }
    }
    
    let info = `Order ${order.order_id} is currently ${order.status}. Payment is ${order.payment_status}.`;
    if (order.status === 'pending') {
      info += ` Scheduled for pickup on ${order.pickup_date} (${order.pickup_time_slot}).`;
      if (order.delay_reason) info += ` Note: Rescheduled due to ${order.delay_reason}.`;
    }
    if (order.total_amount) info += ` Total amount is ${Number(order.total_amount).toLocaleString()} Naira.`;
    
    return info;
  } catch (_e) {
    return "The order lookup service took too long to respond. Please ask the caller to track their order at fresh-press-chi.vercel.app/track or contact us on WhatsApp.";
  }
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

  const cleanName    = String(customer_name).replace(/-/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
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

  const validTimeSlot = normalizeTimeSlot(pickup_time_slot);
  if (!validTimeSlot) return "I did not catch a valid time slot. Ask the caller to choose morning, afternoon, or evening.";

  // DB Atomic Idempotency Check: 10-minute bucket key
  const timeBucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const idempotencyKey = `${phoneDigits}_${pickup_date}_${validTimeSlot}_${timeBucket}`;

  try {
    const lockCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/order_idempotency_keys?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=order_id&limit=1`,
      { headers: dbH(), signal: AbortSignal.timeout(3000) }
    );
    if (lockCheck.ok) {
      const existing = await lockCheck.json();
      if (existing.length > 0) {
        return `An order for this caller and pickup slot already exists. The Order ID is ${existing[0].order_id}. Read it out and do not create another.`;
      }
    }
  } catch (_e) {
    // Non-blocking fallback to create-order
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
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

    if (!res.ok) {
      console.error("Order creation failed", await res.text().catch(() => ''));
      return "Failed to create order due to a system error. Please instruct the caller to call back in a moment, use fresh-press-chi.vercel.app, or reach us on WhatsApp.";
    }

    const data = await res.json();
    const orderId = data.orderId || 'an order';

    // Save idempotency key asynchronously
    fetch(`${SUPABASE_URL}/rest/v1/order_idempotency_keys`, {
      method: 'POST',
      headers: dbH(),
      body: JSON.stringify({ idempotency_key: idempotencyKey, order_id: orderId })
    }).catch(() => {});

    return `Order successfully created! The Order ID is ${orderId}. Inform the customer that our team will arrive on ${pickup_date} during the ${validTimeSlot} slot.`;
  } catch (_e) {
    console.error('create-order call timed out');
    return "The booking system is taking too long right now. Ask the caller to call back in a couple of minutes or use the website at fresh-press-chi.vercel.app.";
  }
}

async function saveVapiRecording(callId: string, initialUrl: string): Promise<string> {
  const fileName = `${callId}.wav`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const vapiCall = await fetchVapiCall(callId);
      const candidates = [
        vapiCall?.artifact?.presignedMonoUrl,
        vapiCall?.artifact?.presignedRecordingUrl,
        vapiCall?.artifact?.stereoRecordingUrl,
        vapiCall?.artifact?.recordingUrl,
        initialUrl
      ].filter(Boolean);

      for (const url of candidates) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
        try {
          const audioRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob();
            if (audioBlob.size > 100) {
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
                return fileName;
              }
            }
          }
        } catch (_e) {}
      }
    } catch (e) {
      console.warn(`[vapi-webhook] Recording fetch attempt ${attempt + 1} error:`, e);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 6000));
  }
  return initialUrl || '';
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

  const rawRecordingUrl = message.recordingUrl || message.artifact?.recordingUrl || message.call?.artifact?.recordingUrl || '';
  const recordingUrl = await saveVapiRecording(callId, rawRecordingUrl);
  const endedReason = message.endedReason || '';
  const durationSeconds = message.durationSeconds || message.call?.duration || 0;
  const cost = message.cost || 0;

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
        headers: dbH(),
        signal: AbortSignal.timeout(4000)
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

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? '';
  const key1 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key2 = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = Boolean((key1 && authHeader.includes(key1)) || (key2 && authHeader.includes(key2)));

  const internalSecret = req.headers.get("x-internal-secret") ?? '';
  const expectedInternal = Deno.env.get('INTERNAL_API_SECRET') ?? '';
  const isInternalSecret = safeEqual(internalSecret, expectedInternal);

  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Internal Management API for pushing config changes to Vapi using server secret
  if ((isServiceRole || isInternalSecret) && body.action === 'sync_vapi_assistant') {
    try {
      const assistantId = body.assistant_id || "4fea51b0-d6b7-4e9a-8a4a-8cb59ad6cc1b";
      const vapiKey = Deno.env.get('VAPI_API_KEY');
      if (!vapiKey) {
        return Response.json({ error: 'VAPI_API_KEY secret not found on server' }, { status: 500 });
      }
      const patchRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vapiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body.patch_payload)
      });
      const patchData = await patchRes.json();
      return Response.json({ success: patchRes.ok, status: patchRes.status, data: patchData }, { status: patchRes.status });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  const secret = req.headers.get("x-vapi-secret") ?? '';
  const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET') ?? '';

  if (!isServiceRole && !isInternalSecret && !safeEqual(secret, expectedSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerPhone = body.message?.call?.customer?.number 
    || body.message?.call?.phoneCallProviderDetails?.from 
    || null;

  try {
    const type = body.message?.type;
    
    if (type === 'tool-calls') {
      const rawList = body.message.toolWithToolCallList || body.message.toolCalls || body.message.toolCallList || [];
      const results = [];

      for (const item of rawList) {
        const toolCallObj = item.toolCall || item;
        const toolCallId = toolCallObj.id;
        const functionName = toolCallObj.function?.name || toolCallObj.name;
        
        const raw = toolCallObj.function?.arguments || toolCallObj.arguments;
        let args: any = {};
        try { args = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {}); } catch (_e) {}
        
        let resultData = "";
        
        if (functionName === 'get_pricing') {
          resultData = await getPricing(args);
        } else if (functionName === 'get_company_info') {
          resultData = await getCompanyInfo(args);
        } else if (functionName === 'check_order_status') {
          resultData = await checkOrderStatus(args, callerPhone);
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
