/**
 * chat-assistant-standalone.ts
 * Deploy as: "chat-assistant" in Supabase Dashboard -> Edge Functions
 *
 * Required secrets:
 *   SERVICE_ROLE_KEY    — Supabase service role key
 *   SUPABASE_URL        — e.g. https://xxxx.supabase.co
 *   OPENAI_API_KEY      — OpenAI API key (model: gpt-4o-mini)
 *   BREVO_API_KEY       — For human-escalation emails
 *   BREVO_SENDER_EMAIL  — Verified sender
 *   ADMIN_EMAIL         — faloyesamuel400@gmail.com
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Accept either the manually-set secret OR Supabase's auto-injected variable
const SERVICE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')
                  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const OPENAI_KEY   = Deno.env.get('OPENAI_API_KEY')!;
const BREVO_KEY    = Deno.env.get('BREVO_API_KEY')      ?? '';
const BREVO_SENDER = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@freshpress.ng';
const ADMIN_EMAIL  = Deno.env.get('ADMIN_EMAIL')        ?? 'faloyesamuel400@gmail.com';

const SITE_URL         = 'https://freshpresslaundryservice.lovable.app';
const WHATSAPP         = '+2348113143272';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function dbH(extra: Record<string, any> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (SERVICE_KEY) {
    headers['apikey'] = SERVICE_KEY;
    headers['Authorization'] = `Bearer ${SERVICE_KEY}`;
  } else {
    console.warn('[chat-assistant] SERVICE_KEY is missing/undefined!');
  }

  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) {
      headers[k] = String(v);
    }
  }

  return headers;
}

// ── Error reply shape ─────────────────────────────────────────────────────────
function errorReply(now: string) {
  return {
    reply: `Sorry, I couldn't process your message. Please try again or reach us on WhatsApp at ${WHATSAPP}.`,
    topic: 'error',
    suggested_actions: [{ label: 'WhatsApp Us', action: 'whatsapp', phone: WHATSAPP }],
    timestamp: now,
  };
}

// ── Intent detection ──────────────────────────────────────────────────────────
function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (/price|cost|how much|charge|fee|rate/.test(m))              return 'pricing';
  if (/track|status|where is|lau-\d/i.test(msg))                  return 'tracking';
  if (/pickup|book|request|schedule|collect/.test(m))             return 'order';
  if (/deliver|area|location|cover|address/.test(m))              return 'delivery';
  if (/hour|open|time|when/.test(m))                              return 'hours';
  if (/cancel|refund|reschedule/.test(m))                         return 'cancellation';
  if (/pay|transfer|cash|bank|account/.test(m))                   return 'payment';
  if (/service|dry.?clean|iron|wash|suit|duvet|bedsheet/.test(m)) return 'services';
  return 'general';
}

function extractOrderId(msg: string): string | null {
  const m = msg.match(/LAU-\d{6}/i);
  return m ? m[0].toUpperCase() : null;
}

// ── Pricing summary builder ───────────────────────────────────────────────────
function buildPricingSummary(rows: any[]): string {
  if (!rows || rows.length === 0) {
    return `Pricing data temporarily unavailable. Please visit ${SITE_URL}/pricing or ask via WhatsApp: ${WHATSAPP}`;
  }
  const cats: Record<string, string[]> = {};
  for (const r of rows) {
    const cat = r.category || 'Other';
    if (!cats[cat]) cats[cat] = [];
    const price = r.price != null ? `₦${Number(r.price).toLocaleString()}` : 'POA';
    const unit  = r.unit  ? ` per ${r.unit}` : '';
    cats[cat].push(`  - ${r.service_name}: ${price}${unit}`);
  }
  return Object.entries(cats).map(([cat, lines]) => `${cat}:\n${lines.join('\n')}`).join('\n\n');
}

// ── Company info builder ──────────────────────────────────────────────────────
function buildCompanyInfo(row: any | null): string {
  if (!row) return `WhatsApp: ${WHATSAPP} | Email: hello@freshpress.ng | Address: Lagos, Nigeria | Minimum Order: ₦3,000`;
  const parts: string[] = [];
  if (row.whatsapp || row.phone) parts.push(`WhatsApp: ${row.whatsapp || row.phone}`);
  if (row.email)                 parts.push(`Email: ${row.email}`);
  if (row.address)               parts.push(`Address: ${row.address}`);
  if (row.minimum_order)         parts.push(`Minimum Order: ₦${Number(row.minimum_order).toLocaleString()}`);
  if (row.hours)                 parts.push(`Hours: ${row.hours}`);
  return parts.length ? parts.join(' | ') : `WhatsApp: ${WHATSAPP} | Lagos, Nigeria`;
}

// ── Order tracking info builder ───────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending - awaiting pickup',
  picked_up: 'Picked up - on the way to our facility',
  processing:'Processing - your clothes are being cleaned',
  invoiced:  'Invoiced - awaiting your payment confirmation',
  ready:     'Ready - your clothes are clean and ready for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const PAYMENT_LABELS: Record<string, string> = {
  unpaid:   'Unpaid',
  pending:  'Payment pending',
  paid:     'Paid',
  partial:  'Partially paid',
  refunded: 'Refunded',
};

function formatTimestampNG(isoString?: string | null): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  try {
    return date.toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    // Manual fallback to West Africa Time (UTC+1)
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const ngDate = new Date(utc + 3600000); // UTC + 1 hour
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = ngDate.getDay();
    const d = ngDate.getDate();
    const m = ngDate.getMonth();
    let hrs = ngDate.getHours();
    const mins = ngDate.getMinutes().toString().padStart(2, '0');
    const ampm = hrs >= 12 ? 'pm' : 'am';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    return `${days[day]}, ${d} ${months[m]}, ${hrs}:${mins} ${ampm}`;
  }
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'Morning (9AM-12PM)',
  afternoon: 'Afternoon (1PM-4PM)',
  evening: 'Evening (4PM-7PM)',
};

function buildOrderInfo(orderRow: any | null, orderId: string | null, fetchError: string | null): string {
  if (!orderId) return JSON.stringify({ found: null, order_id: null });
  if (fetchError) {
    return JSON.stringify({
      found: null, fetchError: true,
      message: `Order lookup failed: ${fetchError}. Direct customer to: ${SITE_URL}/track or WhatsApp: ${WHATSAPP}`,
    });
  }
  if (!orderRow) {
    return JSON.stringify({ found: false, order_id: orderId, track_url: `${SITE_URL}/track` });
  }
  const amount = orderRow.total_amount != null
    ? `₦${Number(orderRow.total_amount).toLocaleString()}`
    : 'Not yet invoiced';
  // Reschedule note & pickup details are only relevant while the order is still pending.
  // Once picked up, the delay and scheduled pickup are in the past — don't surface them to the customer.
  const isPending = orderRow.status === 'pending';
  const delayReason = isPending ? (orderRow.delay_reason ?? null) : null;
  const pickupDate = isPending ? (orderRow.pickup_date ?? null) : null;
  const timeSlotLabel = isPending && orderRow.pickup_time_slot ? (TIME_SLOT_LABELS[orderRow.pickup_time_slot] ?? orderRow.pickup_time_slot) : null;

  const timeline = [
    { key: 'pending', label: 'Order Placed', time: formatTimestampNG(orderRow.pending_at || orderRow.created_at) },
    { key: 'picked_up', label: 'Picked Up', time: formatTimestampNG(orderRow.picked_up_at) },
    { key: 'processing', label: 'Processing', time: formatTimestampNG(orderRow.processing_at) },
    { key: 'invoiced', label: 'Invoice Sent', time: formatTimestampNG(orderRow.invoiced_at) },
    { key: 'ready', label: 'Ready', time: formatTimestampNG(orderRow.ready_at) },
    { key: 'delivered', label: 'Delivered', time: formatTimestampNG(orderRow.delivered_at || orderRow.completed_at) },
  ];

  // Check if order is stuck in "picked_up" for more than 24 hours
  let is_picked_up_long_time = false;
  let picked_up_formatted_time = '';
  if (orderRow.status === 'picked_up' && orderRow.picked_up_at) {
    const pickedUpDate = new Date(orderRow.picked_up_at);
    const now = new Date();
    const diffMs = now.getTime() - pickedUpDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 24) {
      is_picked_up_long_time = true;
      picked_up_formatted_time = formatTimestampNG(orderRow.picked_up_at) || '';
    }
  }

  return JSON.stringify({
    found:          true,
    order_id:       orderRow.order_id,
    customer_name:  orderRow.customer_name,
    status:         STATUS_LABELS[orderRow.status]  ?? orderRow.status,
    status_key:     orderRow.status,
    payment_status: PAYMENT_LABELS[orderRow.payment_status] ?? orderRow.payment_status,
    pickup_date:    pickupDate,
    pickup_time_slot: timeSlotLabel,
    delivery_date:  orderRow.delivery_date ?? null,
    total_amount:   amount,
    delay_reason:   delayReason,
    timeline:       timeline,
    is_picked_up_long_time,
    picked_up_formatted_time,
  });
}

// ── System prompt ─────────────────────────────────────────────────────────────
// ── System prompt builder ─────────────────────────────────────────────────────
function getSystemPrompt(companyRow: any | null): string {
  const minOrder = companyRow?.minimum_order != null 
    ? `₦${Number(companyRow.minimum_order).toLocaleString()}` 
    : '₦3,000';
  const whatsappNum = companyRow?.company_whatsapp || WHATSAPP;

  return `You are Pressy, FreshPress Laundry's friendly AI assistant. FreshPress is a premium laundry service based in Lagos, Nigeria - fast, reliable, and eco-friendly.
**Key rules:**
- Always use LIVE PRICING DATA in the prompt - never guess prices
- Always use ORDER TRACKING INFO for order status - never guess
- Minimum order: ${minOrder}
- Hours: Monday-Saturday 7AM-8PM, closed Sundays
- Free pickup and delivery within Lagos
- Turnaround: 24-48 hours
- Payment: Bank transfer, cash on delivery, or POS
- Order IDs: LAU-XXXXXX format
- Pickup requests: ${SITE_URL}/request-pickup
- Order tracking: ${SITE_URL}/track
- When unsure: direct to WhatsApp ${whatsappNum}
- Always be warm, clear, and professional
- Always respond with valid JSON only - no extra text before or after
**Formatting rules - order tracking:**
When responding about an order, always structure the reply EXACTLY like this:
Hi {customer_name}

Order: {order_id}
Status: {status}
Payment: {payment_status}

[If is_picked_up_long_time is true, append this warm note:]
Note: I see your order was picked up on {picked_up_formatted_time}. Please rest assured that your clothes have safely arrived at our main cleaning facility and are already in our sorting/cleaning queue! We apologize that our online status tracker is still showing "Picked up". Your clothes are NOT still on the road - they are safe and being worked on by our team.

[If the status_key is 'pending' (awaiting pickup), show scheduled pickup details if available:]
Pickup Date: {pickup_date} ({pickup_time_slot})
[If delay_reason is not null and status_key is 'pending', include this line:]
Note: Your pickup was rescheduled - {delay_reason}

Track your order here:
${SITE_URL}/track

Need help? WhatsApp us: ${WHATSAPP}
**Formatting rules - pricing (full list):**
Never dump all 28 items. Show the most popular items per category and direct to the pricing page for the full list.
**Formatting rules - single item pricing:**
When a customer asks for the price of one specific item, respond with just that item.
**General formatting rules:**
- Never use emojis - plain text only, like a human would write
- Keep replies short, structured, and scannable
- Use line breaks between each piece of information
- Avoid long paragraph blocks
- Write naturally and warmly, like a helpful human customer service agent
- Use dashes for lists like pricing or order details only - not for conversational replies
- Never show raw data, IDs, or technical fields to the customer
**Formatting rules - order not found:**
If the ORDER TRACKING INFO says the order was NOT found or orderInfo.found is false or null, never invent or guess any order details.
**Hallucination prevention rules:**
- If order data is not in the ORDER TRACKING INFO provided, do not make up any order details
- If pricing data is not in the LIVE PRICING DATA provided, do not guess any price
- If you are not sure about something, always say so honestly and direct the customer to WhatsApp or the website
- Never assume, infer, or fill in missing data from your training knowledge`;
}

// ── JSON parse helper ─────────────────────────────────────────────────────────
function parseAIResponse(raw: string): any {
  const fallback = {
    reply: `I'm having a little trouble right now. Please reach us on WhatsApp: ${WHATSAPP}.`,
    topic: 'general',
    confidence: 0.5,
    suggested_actions: [{ label: 'WhatsApp Us', type: 'whatsapp', phone: WHATSAPP }],
    requires_human: false,
  };
  try {
    let text = raw.trim();
    // Strip ```json ... ``` or ``` ... ``` wrappers
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ── Brevo email helper ────────────────────────────────────────────────────────
function sendBrevo(to: string, subject: string, html: string): void {
  if (!BREVO_KEY) return;
  fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'FreshPress AI', email: BREVO_SENDER },
      to:     [{ email: to }],
      subject, htmlContent: html,
    }),
  }).catch(e => console.warn('[chat-assistant] Brevo error:', e));
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });

  const now = new Date().toISOString();

  try {
    // ── Step 1 — Validate ───────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const sessionId = (body.session_id ?? '').trim();
    let   message   = (body.message   ?? '').trim().slice(0, 2000);

    if (!sessionId || !message) {
      return Response.json(errorReply(now), { status: 400, headers: CORS });
    }

    const conversationHistory: any[] = Array.isArray(body.conversation_history)
      ? body.conversation_history : [];

    // ── Step 2 — Load chat history ──────────────────────────────────────────
    let chatHistory: any[] = [];
    try {
      const histRes = await fetch(
        `${SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=role,content,created_at&order=created_at.desc&limit=10`,
        { headers: dbH() },
      );
      if (histRes.ok) {
        const rows: any[] = await histRes.json();
        chatHistory = [...rows].reverse(); // oldest first
      }
    } catch (e) { console.warn('[chat-assistant] history fetch failed:', e); }

    // ── Steps 3 & 4 — Fetch pricing + company info in parallel ─────────────
    const [pricingRes, companyRes] = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit,description&order=display_order.asc`, { headers: dbH() }),
      fetch(`${SUPABASE_URL}/rest/v1/company_info?select=*&limit=1`, { headers: dbH() }),
    ]);

    const pricingRows = pricingRes.status === 'fulfilled' && pricingRes.value.ok
      ? await pricingRes.value.json() : null;
    const companyRows = companyRes.status === 'fulfilled' && companyRes.value.ok
      ? await companyRes.value.json() : null;

    const pricingSummary = buildPricingSummary(pricingRows);
    const companyInfo    = buildCompanyInfo(Array.isArray(companyRows) ? companyRows[0] : companyRows);

    // ── Step 5 — Build context ──────────────────────────────────────────────
    const detectedIntent  = detectIntent(message);
    const mentionedOrderId = extractOrderId(message);
    const messageCount    = chatHistory.length + conversationHistory.length;

    // ── Step 6 — Fetch order by ID (tracking intent only) ──────────────────
    let orderRow: any = null;
    let orderFetchError: string | null = null;

    if (detectedIntent === 'tracking' && mentionedOrderId) {
      try {
        const orderRes = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(mentionedOrderId)}&select=order_id,customer_name,status,payment_status,pickup_date,delivery_date,total_amount,created_at,delay_reason,picked_up_at,processing_at,invoiced_at,ready_at,delivered_at,completed_at,pickup_time_slot`,
          { headers: dbH() },
        );
        if (orderRes.ok) {
          const rows: any[] = await orderRes.json();
          orderRow = rows[0] ?? null;
        } else {
          const errText = await orderRes.text();
          console.error('[chat-assistant] order fetch non-ok status:', orderRes.status, errText);
          orderFetchError = `HTTP ${orderRes.status}: ${errText}`;
        }
      } catch (e) {
        console.error('[chat-assistant] order fetch exception:', e);
        orderFetchError = `Exception: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const orderInfo = buildOrderInfo(orderRow, mentionedOrderId, orderFetchError);

    // Build last-6 messages for the prompt
    const last6 = [...chatHistory, ...conversationHistory]
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .slice(-6);

    // ── Step 7 — Call OpenAI GPT-4o-mini ───────────────────────────────────────
    const userPrompt = `# FreshPress Laundry — AI Chat Assistant

## USER MESSAGE
${message}

## SESSION
Session ID: ${sessionId}
Detected Intent: ${detectedIntent}
Message Count: ${messageCount}

## LIVE PRICING (fetched right now from Supabase)
${pricingSummary}

## COMPANY CONTACT
${companyInfo}

## ORDER TRACKING INFO
${orderInfo}

## CONVERSATION HISTORY
${JSON.stringify(last6, null, 2)}

## YOUR TASK
You are Pressy, FreshPress Laundry's helpful AI assistant. Read the user's message carefully, use the live pricing data and order tracking info provided above, and respond helpfully and accurately. Never guess or make up information that isn't in the data above.

## RESPONSE FORMAT (strict JSON only, no markdown wrapper):
{
  "reply": "Your warm, helpful response here",
  "topic": "pricing|tracking|order|delivery|hours|services|payment|cancellation|general",
  "confidence": 0.0,
  "suggested_actions": [],
  "requires_human": false
}

Now respond.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: getSystemPrompt(Array.isArray(companyRows) ? companyRows[0] : companyRows) },
          { role: 'user',   content: userPrompt    },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('[chat-assistant] OpenAI error:', err);
      return Response.json({ ...errorReply(now) }, { status: 200, headers: CORS });
    }

    const openaiData = await openaiRes.json();
    const rawText    = openaiData.choices?.[0]?.message?.content ?? '';

    // ── Step 8 — Parse AI response ──────────────────────────────────────────
    const parsed = parseAIResponse(rawText);
    let   reply  = (parsed.reply ?? '').toString().trim()
                    || `I'm having a little trouble right now. Please reach us on WhatsApp: ${WHATSAPP}.`;
    const topic          = parsed.topic          ?? detectedIntent;
    const confidence     = parsed.confidence     ?? 0.8;
    const requiresHuman  = parsed.requires_human ?? false;
    let   suggestedActions: any[] = Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [];

    // Strict suggested actions policy:
    // 1. Always include Request Pickup for every message
    if (!suggestedActions.some((a: any) => (a.url || '').includes('/request-pickup'))) {
      suggestedActions.push({ label: 'Request Pickup', type: 'link', url: `${SITE_URL}/request-pickup` });
    }
    // 2. For tracking questions, also include Track Order
    if (detectedIntent === 'tracking' && !suggestedActions.some((a: any) => (a.url || '').includes('/track'))) {
      suggestedActions.push({ label: 'Track Order', type: 'link', url: `${SITE_URL}/track` });
    }
    // 3. For pricing/services questions, also include View Pricing
    if (['pricing', 'services'].includes(detectedIntent) && !suggestedActions.some((a: any) => (a.url || '').includes('/pricing'))) {
      suggestedActions.push({ label: 'View Pricing', type: 'link', url: `${SITE_URL}/pricing` });
    }

    // ── Step 9 — Save session, messages, and escalate (blocking to ensure save) ────────
    // Upsert session
    await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?on_conflict=session_id`, {
      method:  'POST',
      headers: dbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        session_id:       sessionId,
        last_activity_at: now,
        messages_count:   messageCount + 2,
      }),
    }).catch(e => console.warn('[chat-assistant] session upsert failed:', e));

    // Save messages
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method:  'POST',
      headers: dbH({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify([
        { session_id: sessionId, role: 'user',      content: message },
        { session_id: sessionId, role: 'assistant', content: reply   },
      ]),
    }).catch(e => console.warn('[chat-assistant] message save failed:', e));

    // Escalate if needed
    if (requiresHuman && BREVO_KEY) {
      await sendBrevo(
        ADMIN_EMAIL,
        `[FreshPress Chat] Human escalation required — Session ${sessionId.slice(-8)}`,
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#fff1f2;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #fca5a5;border-radius:12px;padding:24px;">
  <h2 style="color:#dc2626;margin-top:0;">Chat Escalation Required</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px;color:#64748b;width:140px;">Session ID</td><td style="padding:6px;font-weight:600;">${sessionId}</td></tr>
    <tr><td style="padding:6px;color:#64748b;">Topic</td><td style="padding:6px;font-weight:600;">${topic}</td></tr>
    <tr><td style="padding:6px;color:#64748b;">Customer Message</td><td style="padding:6px;">${message}</td></tr>
    <tr><td style="padding:6px;color:#64748b;">Pressy's Reply</td><td style="padding:6px;">${reply}</td></tr>
    <tr><td style="padding:6px;color:#64748b;">Timestamp</td><td style="padding:6px;">${now}</td></tr>
  </table>
  <p style="margin-top:16px;color:#7f1d1d;font-weight:600;">Please follow up via WhatsApp: ${WHATSAPP} as soon as possible.</p>
</div></body></html>`
      ).catch(e => console.warn('[chat-assistant] brevo escalation failed:', e));
    }

    // ── Step 12 — Return response ───────────────────────────────────────────
    return Response.json({
      reply:             reply,
      suggested_actions: suggestedActions,
      topic,
      confidence,
      timestamp: now,
      debug_info: { orderInfo }
    }, { status: 200, headers: CORS });

  } catch (err: any) {
    console.error('[chat-assistant] unhandled error:', err);
    return Response.json(errorReply(now), { status: 200, headers: CORS });
  }
});
