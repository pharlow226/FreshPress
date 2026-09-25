import re
filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r'\"', '"')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed literal backslashes")
