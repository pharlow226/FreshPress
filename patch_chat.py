import re

filepath = r'supabase\functions\chat-assistant-standalone.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update System Prompt
new_system_rules = r'''
**ORDER COLLECTION STATE MACHINE:**
If the user wants to place an order, you MUST collect these 6 pieces of information sequentially: Full Name, Phone Number, Email Address, Pickup Address, Pickup Date, and Time Slot (morning/afternoon/evening).
If you have all 6 pieces of information, you MUST output them in the "create_order_payload" JSON field.

**LOCAL CURRENCY & SLANG DICTIONARY:**
Callers will often use Nigerian colloquialisms for money. You MUST translate these into standard integers.
- "two five" or "two-five" = 2500
- "one five" or "one-five" = 1500
- "five K" = 5000
Example: If a customer says "I thought the duvet was two five", interpret it as 2500 Naira.

**Formatting rules - order tracking:**'''

content = content.replace('**Formatting rules - order tracking:**', new_system_rules)

# 2. Update Response Format
old_format = r'''## RESPONSE FORMAT (strict JSON only, no markdown wrapper):
{
  "reply": "Your warm, helpful response here",
  "topic": "pricing|tracking|order|delivery|hours|services|payment|cancellation|general",
  "confidence": 0.0,
  "suggested_actions": [],
  "requires_human": false
}'''

new_format = r'''## RESPONSE FORMAT (strict JSON only, no markdown wrapper):
{
  "reply": "Your warm, helpful response here",
  "topic": "pricing|tracking|order|delivery|hours|services|payment|cancellation|general",
  "confidence": 0.0,
  "suggested_actions": [],
  "requires_human": false,
  "create_order_payload": null
}
*NOTE on create_order_payload*: ONLY include an object here with { "customer_name":"", "phone":"", "email":"", "address":"", "pickup_date":"", "pickup_time_slot":"morning|afternoon|evening" } if you have collected ALL 6 details. Otherwise, keep it null.'''

content = content.replace(old_format, new_format)

# 3. Update execution block
old_execution = r'''    let   suggestedActions: any[] = Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [];'''

new_execution = r'''    let   suggestedActions: any[] = Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [];

    // 🔥 NEW: DECOUPLED ARCHITECTURE EXECUTION 🔥
    if (parsed.create_order_payload) {
      try {
        const payload = parsed.create_order_payload;
        payload.source = 'website'; // Tag it as a chat order
        
        const createRes = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (createRes.ok) {
          const orderData = await createRes.json();
          reply += `\n\n🎉 Perfect! Your order has been created successfully. Your Order ID is **${orderData.orderId}**. Our team will arrive on ${orderData.pickupDate}.`;
        } else {
          reply += `\n\nI apologize, but I encountered an error saving your order. Please reach out on WhatsApp.`;
        }
      } catch (e) {
        console.error('[chat-assistant] Create order failed:', e);
      }
    }'''

content = content.replace(old_execution, new_execution)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
