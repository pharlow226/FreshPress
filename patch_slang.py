import re

filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''**LOCAL CURRENCY & SLANG DICTIONARY:**
Callers will often use Nigerian colloquialisms for money. You MUST translate these into standard integers.
- "two five" or "two-five" = 2500
- "one five" or "one-five" = 1500
- "five K" = 5000'''

new_format = r'''**LOCAL CURRENCY & SLANG DICTIONARY:**
Callers will often use Nigerian colloquialisms for money. You MUST translate these into standard integers.
- If a user gives a raw number for a budget or price (e.g., "1500", "2k", "1k") without saying "Naira", ALWAYS assume it is in Naira.
- "two five" or "two-five" = 2500
- "one five" or "one-five" = 1500
- "five K" = 5000'''

if old_format in content:
    content = content.replace(old_format, new_format)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Chat patched successfully")
else:
    print("Chat pattern not found")
