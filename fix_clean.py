filepath = r"supabase\functions\chat-assistant\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_block = """    let chatHistory: any[] = [];
    let previousSummary = "";
    try {
      const [histRes, sessionRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=role,content,created_at&order=created_at.desc&limit=10`, { headers: dbH() }),
        fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=ai_summary&limit=1`, { headers: dbH() })
      ]);
      if (histRes.ok) {
        const rows: any[] = await histRes.json();
        chatHistory = [...rows].reverse();
      }
      if (sessionRes.ok) {
        const sRows: any[] = await sessionRes.json();
        if (sRows.length > 0 && sRows[0].ai_summary) previousSummary = sRows[0].ai_summary;
      }
    } catch (e) { console.warn('[chat-assistant] history fetch failed:', e); }
"""

# Replace lines 375 to 388 (0-indexed 374 to 387)
lines[374:388] = [new_block]

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(lines)
with open(r"supabase\functions\chat-assistant-standalone.ts", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Syntax cleanly replaced")
