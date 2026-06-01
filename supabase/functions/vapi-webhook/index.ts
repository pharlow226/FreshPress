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
    cats[cat].push(`${r.service_name}: ₦${r.price}${r.unit ? ' per ' + r.unit : ''}`);
  }
  
  let resultStr = "Live Pricing Data:\n";
  for (const [cat, items] of Object.entries(cats)) {
    resultStr += `${cat}:\n- ${items.join('\n- ')}\n\n`;
  }
  return resultStr;
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
  if (order.total_amount) info += ` Total amount is ₦${order.total_amount}.`;
  
  return info;
}

async function createPickupOrder(args: any) {
  const { customer_name, phone, address, pickup_date, pickup_time_slot } = args;
  if (!customer_name || !phone || !address || !pickup_date || !pickup_time_slot) {
    return "Missing required fields. Need name, phone, address, date, and time slot.";
  }

  // Generate LAU-XXXXXX
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const orderId = `LAU-${randomNum}`;

  let validTimeSlot = 'morning';
  const slotLower = (pickup_time_slot || '').toLowerCase();
  if (slotLower.includes('afternoon') || slotLower.includes('12pm')) validTimeSlot = 'afternoon';
  else if (slotLower.includes('evening') || slotLower.includes('3pm')) validTimeSlot = 'evening';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: dbH(),
    body: JSON.stringify({
      order_id: orderId,
      customer_name,
      email: `voice_${phone.replace(/\D/g, '')}@freshpress.ng`,
      phone,
      address,
      pickup_date,
      pickup_time_slot: validTimeSlot,
      status: 'pending',
      payment_status: 'unpaid'
    })
  });

  if (!res.ok) {
    console.error("Order creation failed", await res.text());
    return "Failed to create order due to a system error. Please instruct the customer to use the website.";
  }
  
  return `Order successfully created! The Order ID is ${orderId}. Inform the customer that our team will arrive on ${pickup_date} during the ${pickup_time_slot} slot.`;
}

// ── Main Webhook Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });

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
    }

    // Default return for other events (like 'status-update')
    return Response.json({ success: true }, { status: 200, headers: CORS });

  } catch (err: any) {
    console.error('[vapi-webhook] error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
