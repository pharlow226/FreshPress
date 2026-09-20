filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_rule = r"- Minimum order: ${minOrder} (ONLY mention this if explicitly asked, or if they are placing an order. Do NOT mention it for general pricing questions)"
new_rule = r"- Minimum order: ${minOrder} (You MUST politely enforce this minimum order policy if a user tries to place an order, mentions a specific budget, or asks to wash a small amount of items that total under ${minOrder})"

if old_rule in content:
    content = content.replace(old_rule, new_rule)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Rule not found")
