import re

filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''If you have all 6 pieces of information, you MUST output them in the "create_order_payload" JSON field.'''

new_format = r'''If you have all 6 pieces of information, you MUST output them in the "create_order_payload" JSON field. 
*CRITICAL GUARD*: If the conversation history shows that an order has ALREADY been successfully placed (i.e. you already gave the user an Order ID), DO NOT output the "create_order_payload" again unless the customer explicitly asks to create a SECOND, completely new order.'''

if old_format in content:
    content = content.replace(old_format, new_format)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched Chat Assistant Guard successfully")
else:
    print("Pattern not found")
