filepath = r"supabase\functions\vapi-webhook\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add aggressive summary extraction and a debug log
old_line = "const summary = message.analysis?.summary || message.summary || '';"
new_line = """
    console.log('[vapi-webhook] end-of-call payload keys:', Object.keys(message));
    if (message.analysis) console.log('[vapi-webhook] analysis keys:', Object.keys(message.analysis));
    if (message.call && message.call.analysis) console.log('[vapi-webhook] call.analysis keys:', Object.keys(message.call.analysis));
    
    const summary = message.analysis?.summary || message.call?.analysis?.summary || message.summary || '';
    console.log('[vapi-webhook] extracted summary:', summary ? 'YES' : 'NO');
"""

if old_line in content:
    content = content.replace(old_line, new_line)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched webhook summary logic")
else:
    print("Could not find line")
