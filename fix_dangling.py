filepath = r"supabase\functions\chat-assistant\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

# find where the dangling code is
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "`${SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=role,content,created_at&order=created_at.desc&limit=10`" in line and "Promise.all" not in line:
        start_idx = i
    if start_idx != -1 and "} catch (e) { console.warn('[chat-assistant] history fetch failed:', e); }" in line:
        if i > start_idx:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx+1]
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)
    with open(r"supabase\functions\chat-assistant-standalone.ts", "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Dangling syntax fixed")
else:
    print("Could not find dangling syntax block")
