import re

filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''- If a customer asks about overall business information (e.g., minimum orders, prices, operational phone numbers), call get_company_info.'''

new_format = r'''- If a customer asks about overall business information, OR if they mention a specific budget, OR try to place a small order, YOU MUST proactively call get_company_info to check the minimum order amount. You must politely enforce the minimum order policy if their budget is too low.'''

content = content.replace(old_format, new_format)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
    f.write(content)
