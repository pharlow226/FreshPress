/**
 * vapi-webhook-standalone.ts
 * Deploy as: "vapi-webhook" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY, SUPABASE_URL
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function dbH() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer':        'return=representation',
  };
}

// ── Tool Implementations ──────────────────────────────────────────────────────

async function getPricing(args: any) {
  let url = `${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit&order=display_order.asc`;
  const res = await fetch(url, { headers: dbH() });
  if (!res.ok) return "Pricing data is temporarily unavailable.";
  const rows = await res.json();
  if (rows.length === 0) return "No pricing data found.";
  
  // Format nicely for the AI to read
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
  return resultStr;
}

async function getCompanyInfo(args: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/company_info?select=*&limit=1`, { headers: dbH() });
  if (!res.ok) return "Company information is temporarily unavailable.";
  const rows = await res.json();
  if (rows.length === 0) return "Company information not configured.";
  
  const c = rows[0];
  let info = `FreshPress Laundry Information:\n`;
  const lagosTime = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
  info += `- Current Live Date & Time: ${lagosTime}\n`;
  if (c.minimum_order) info += `- Minimum Order: ${c.minimum_order} Naira\n`;
  if (c.company_address) info += `- Address: ${c.company_address}\n`;
  if (c.company_phone) info += `- Phone/WhatsApp: ${c.company_phone}\n`;
  if (c.company_email) info += `- Email: ${c.company_email}\n`;
  // Fix TTS pronunciation for common Nigerian banks
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
  const orderId = args.order_id?.toUpperCase();
  if (!orderId) return "Please provide a valid order ID (e.g. LAU-123456).";
  
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
    return "Missing required fields. Need name, phone, email, address, date, and time slot.";
  }

    let validTimeSlot = 'morning';
  const slotLower = (pickup_time_slot || '').toLowerCase();
  
  // Smarter slot mapping handling times
  if (slotLower.includes('afternoon') || slotLower.match(/12pm|1pm|2pm|3pm|12:00|13:00|14:00|15:00/)) {
    validTimeSlot = 'afternoon';
  } else if (slotLower.includes('evening') || slotLower.match(/4pm|5pm|6pm|7pm|16:00|17:00|18:00|19:00/)) {
    validTimeSlot = 'evening';
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
      customer_name,
      email: email.toLowerCase().replace(/\s/g, ''),
      phone,
      address,
      pickup_date,
      pickup_time_slot: validTimeSlot,
      special_instructions: "Created via Voice AI",
      source: 'phone'
    })
  });

  if (!res.ok) {
    console.error("Order creation failed", await res.text());
    return "Failed to create order due to a system error. Please instruct the customer to use the website.";
  }
  
  const data = await res.json();
  const orderId = data.orderId || `an order`;
  
  return `Order successfully created! The Order ID is ${orderId}. Inform the customer that our team will arrive on ${pickup_date} during the ${validTimeSlot} slot.`;
}

async function logEndOfCallReport(message: any) {
  const callId = message.call?.id;
  if (!callId) return;

  const phone = message.call?.customer?.number || message.call?.phoneCallProviderDetails?.from || null;
  const transcript = message.transcript || '';
  const summary = message.analysis?.summary || message.summary || '';
  let recordingUrl = message.recordingUrl || '';
  const endedReason = message.endedReason || '';
  const durationSeconds = message.durationSeconds || message.call?.duration || 0;
  const cost = message.cost || 0;

  // Securely intercept and host the audio file to fetch and store the audio recording for internal observability
  if (recordingUrl && callId) {
    try {
      // 1. Fetch the actual call details from Vapi
      const vapiRes = await fetch(`https://api.vapi.ai/call/${callId}`, {
        headers: { 'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}` }
      });
      if (vapiRes.ok) {
        const vapiCall = await vapiRes.json();
        if (vapiCall.artifact?.presignedMonoUrl) {
          // 2. Download the audio file directly from Vapi
          const audioRes = await fetch(vapiCall.artifact.presignedMonoUrl);
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob();
            const fileName = `${callId}.wav`;
            
            // 3. Upload to our own Supabase Storage bucket
            const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/recordings/${fileName}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'audio/wav',
              },
              body: audioBlob
            });
            
            if (uploadRes.ok || uploadRes.status === 400 /* duplicate */) {
              // 4. Override the broken Vapi recordingUrl with our own public URL
              recordingUrl = `${SUPABASE_URL}/storage/v1/object/public/recordings/${fileName}`;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[vapi-webhook] Failed to secure audio file", e);
    }
  }

  // Extract metadata (useful for Web SDK calls where phone is null)
  const metadata = message.call?.metadata || {};
  const orderId = metadata.order_id || null;
  let customerId = metadata.customer_id || null;

  // If it's a real phone call (we have a phone number but no customerId), look up the customer!
  if (phone && !customerId) {
    try {
      // Normalize Vapi's +234 format to match the local 080 format stored in the customers table
      let localPhone = phone.replace(/\D/g, ''); // strip non-digits
      if (localPhone.startsWith('234')) {
        localPhone = '0' + localPhone.slice(3);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?phone=eq.${localPhone}&select=id&limit=1`, {
        headers: dbH()
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          customerId = rows[0].id;
        }
      }
    } catch (e) {
      console.warn("Failed to lookup customer by phone", e);
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });

  const secret = req.headers.get("x-vapi-secret");
  if (secret !== Deno.env.get('VAPI_WEBHOOK_SECRET')) {
    console.error("Unauthorized request blocked!");
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  try {
    const body = await req.json();
    const type = body.message?.type;
    
    // Vapi sends "tool-calls" when the AI wants to use a function
    if (type === 'tool-calls') {
      const toolCalls = body.message.toolWithToolCallList || [];
      const results = [];

      for (const item of toolCalls) {
        const toolCallId = item.toolCall.id;
        const functionName = item.toolCall.function.name;
        let args = {};
        try { args = JSON.parse(item.toolCall.function.arguments || '{}'); } catch(e) {}
        
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

      return Response.json({ results }, { status: 200, headers: CORS });
    } else if (type === 'end-of-call-report') {
      await logEndOfCallReport(body.message);
      return Response.json({ success: true }, { status: 200, headers: CORS });
    }

    // Default return for other events (like 'status-update')
    return Response.json({ success: true }, { status: 200, headers: CORS });

  } catch (err: any) {
    console.error('[vapi-webhook] error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});




