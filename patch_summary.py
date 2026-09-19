import re

filepath = r'supabase\functions\chat-assistant-standalone.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''  "requires_human": false,
  "create_order_payload": null
}'''

new_format = r'''  "requires_human": false,
  "create_order_payload": null,
  "session_summary": "A brief 1-sentence summary of the conversation so far"
}'''

content = content.replace(old_format, new_format)

old_upsert = r'''        last_intent:      topic,
        requires_human:   requiresHuman,
        order_id:         parsed.created_order_id || mentionedOrderId || null
      }),'''

new_upsert = r'''        last_intent:      topic,
        requires_human:   requiresHuman,
        order_id:         parsed.created_order_id || mentionedOrderId || null,
        ai_summary:       parsed.session_summary || null
      }),'''

content = content.replace(old_upsert, new_upsert)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
