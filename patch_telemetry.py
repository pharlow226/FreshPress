import re

filepath = r'supabase\functions\chat-assistant-standalone.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Capture the created order ID
old_execution = r'''        if (createRes.ok) {
          const orderData = await createRes.json();
          reply += `\n\n🎉 Perfect! Your order has been created successfully. Your Order ID is **${orderData.orderId}**. Our team will arrive on ${orderData.pickupDate}.`;
        } else {'''

new_execution = r'''        if (createRes.ok) {
          const orderData = await createRes.json();
          parsed.created_order_id = orderData.orderId; // Save for telemetry
          reply += `\n\n🎉 Perfect! Your order has been created successfully. Your Order ID is **${orderData.orderId}**. Our team will arrive on ${orderData.pickupDate}.`;
        } else {'''

# 2. Update the Upsert Session block to include Telemetry
old_upsert = r'''    // Upsert session
    await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?on_conflict=session_id`, {
      method:  'POST',
      headers: dbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        session_id:       sessionId,
        last_activity_at: now,
        messages_count:   messageCount + 2,
      }),
    }).catch(e => console.warn('[chat-assistant] session upsert failed:', e));'''

new_upsert = r'''    // Upsert session (TELEMETRY ADDED)
    await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?on_conflict=session_id`, {
      method:  'POST',
      headers: dbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        session_id:       sessionId,
        last_activity_at: now,
        messages_count:   messageCount + 2,
        last_intent:      topic,
        requires_human:   requiresHuman,
        order_id:         parsed.created_order_id || mentionedOrderId || null
      }),
    }).catch(e => console.warn('[chat-assistant] session upsert failed:', e));'''

content = content.replace(old_execution, new_execution)
content = content.replace(old_upsert, new_upsert)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
