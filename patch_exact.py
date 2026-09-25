import re
filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_rule = r"""- If a customer asks a broad category (e.g., "shirt"), concisely list all matching variants from the LIVE PRICING DATA."""
new_rule = r"""- If a customer asks about a specific item or service (e.g., "Dry Cleaning", "Suit"), you MUST explicitly provide the price for that exact item from the LIVE PRICING DATA.
- If a customer asks a broad category (e.g., "shirt"), concisely list all matching variants from the LIVE PRICING DATA."""

if old_rule in content:
    content = content.replace(old_rule, new_rule)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Exact item pricing rule patched")
else:
    print("Pattern not found")
