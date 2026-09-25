import re
filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_rule = "- Always be warm, clear, and professional"
new_rule = "- Always be warm, clear, and professional\n- NEVER use email-style sign-offs like \"Best regards\" or \"Sincerely\". This is a real-time chat, keep it conversational."

if old_rule in content:
    content = content.replace(old_rule, new_rule)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Chatbot conversational tone patched")
else:
    print("Pattern not found")
