import re
filepath = r"supabase\functions\vapi-webhook\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old_summary = "const summary = message.summary || '';"
new_summary = "const summary = message.analysis?.summary || message.summary || '';"

if old_summary in content:
    content = content.replace(old_summary, new_summary)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched vapi webhook summary extraction")
else:
    print("Could not find summary extraction")
