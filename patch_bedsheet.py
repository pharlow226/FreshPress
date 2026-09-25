import re
filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_rule = r"""- If a customer asks for a "Duvet" without specifying the size, explicitly ask them if they mean "Duvet (Small)" or "Duvet (Large)", and quote both prices if available."""
new_rule = r"""- If a customer asks for a "Duvet" without specifying the size, explicitly ask them if they mean "Duvet (Small)" or "Duvet (Large)", and quote both prices if available.
- If a customer asks for a "Bedsheet", explicitly ask them if they mean "Bedsheet (Single)" or "Bedsheet (Double)"."""

if old_rule in content:
    content = content.replace(old_rule, new_rule)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Bedsheet rule patched in Chatbot")
else:
    print("Pattern not found in Chatbot")
