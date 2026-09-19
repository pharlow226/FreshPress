import re

filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''*NOTE on create_order_payload*: ONLY include an object here with { "customer_name":"", "phone":"", "email":"", "address":"", "pickup_date":"", "pickup_time_slot":"morning|afternoon|evening" } if you have collected ALL 6 details.'''

new_format = r'''*NOTE on create_order_payload*: ONLY include an object here with { "customer_name":"", "phone":"", "email":"", "address":"", "pickup_date":"", "pickup_time_slot":"morning|afternoon|evening", "special_instructions":"" } if you have collected ALL 6 details. "special_instructions" is OPTIONAL and should capture things like 'use cold water' or 'fragile'.'''

content = content.replace(old_format, new_format)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
    f.write(content)
