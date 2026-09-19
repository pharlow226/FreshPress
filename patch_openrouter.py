import re

filepath = r'supabase\functions\chat-assistant-standalone.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update API Key logic
content = content.replace(
    "const OPENAI_KEY   = Deno.env.get('OPENAI_API_KEY')!;",
    "const OPENAI_KEY   = Deno.env.get('OPENROUTER_API_KEY') ?? Deno.env.get('OPENAI_API_KEY')!;"
)

# 2. Update Fetch URL
content = content.replace(
    "'https://api.openai.com/v1/chat/completions'",
    "'https://openrouter.ai/api/v1/chat/completions'"
)

# 3. Update Model string
content = content.replace(
    "model:      'gpt-4o-mini',",
    "model:      'openai/gpt-4o-mini',"
)

# 4. Add OpenRouter headers
old_headers = """      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },"""
new_headers = """      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'FreshPress Chatbot',
      },"""
content = content.replace(old_headers, new_headers)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
