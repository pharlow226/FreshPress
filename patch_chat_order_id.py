filepath = r"supabase\functions\chat-assistant\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add existingOrderId variable
old_init = """    let chatHistory: any[] = [];
    let previousSummary = "";"""
new_init = """    let chatHistory: any[] = [];
    let previousSummary = "";
    let existingOrderId: string | null = null;"""
content = content.replace(old_init, new_init)

# 2. Update the sessionRes fetch to include order_id
old_fetch = "fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=ai_summary&limit=1`, { headers: dbH() })"
new_fetch = "fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=ai_summary,order_id&limit=1`, { headers: dbH() })"
content = content.replace(old_fetch, new_fetch)

# 3. Extract existingOrderId
old_extract = """      if (sessionRes.ok) {
        const sRows: any[] = await sessionRes.json();
        if (sRows.length > 0 && sRows[0].ai_summary) previousSummary = sRows[0].ai_summary;
      }"""
new_extract = """      if (sessionRes.ok) {
        const sRows: any[] = await sessionRes.json();
        if (sRows.length > 0) {
          if (sRows[0].ai_summary) previousSummary = sRows[0].ai_summary;
          if (sRows[0].order_id) existingOrderId = sRows[0].order_id;
        }
      }"""
content = content.replace(old_extract, new_extract)

# 4. Update the upsert logic
old_upsert = "order_id:         parsed.created_order_id || mentionedOrderId || null,"
new_upsert = "order_id:         parsed.created_order_id || mentionedOrderId || existingOrderId || null,"
content = content.replace(old_upsert, new_upsert)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
with open(r"supabase\functions\chat-assistant-standalone.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Patched chat-assistant to preserve order_id")
