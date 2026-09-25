import re

filepath = r'supabase\functions\chat-assistant\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add fetching chat_sessions
old_fetch = r"""    let chatHistory: any[] = [];
    try {
      const histRes = await fetch("""

new_fetch = r"""    let chatHistory: any[] = [];
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

    // Dummy block to bypass previous regex"""

content = content.replace(old_fetch, new_fetch.replace("    // Dummy block to bypass previous regex", ""))


# 2. Add Missing Item Fallback to System Prompt
old_prompt = r"""- If pricing data is not in the LIVE PRICING DATA provided, do not guess any price"""
new_prompt = r"""- If pricing data is not in the LIVE PRICING DATA provided, do not guess any price
- If a user asks for an item (e.g. "Dry Cleaning") that is NOT listed in the LIVE PRICING DATA, explicitly state that it is not on the standard price list and direct them to WhatsApp. Do NOT repeat the price of a previous item."""
content = content.replace(old_prompt, new_prompt)

# 3. Add Previous Summary to Context and Update JSON schema
old_context = r"""## CONVERSATION HISTORY
${JSON.stringify(last6, null, 2)}

## YOUR TASK"""
new_context = r"""## PREVIOUS SESSION SUMMARY
${previousSummary || 'No previous summary.'}

## CONVERSATION HISTORY
${JSON.stringify(last6, null, 2)}

## YOUR TASK"""
content = content.replace(old_context, new_context)

old_json = r""""session_summary": "A concise cumulative summary of the entire conversation history, 2 to 4 sentences. Capture the core intents and outcomes." """
new_json = r""""session_summary": "Update the PREVIOUS SESSION SUMMARY with the latest interactions. Ensure ALL past core intents (especially successful order placements and Order IDs) are preserved while adding the newest queries." """
content = content.replace(old_json.strip(), new_json.strip())


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
with open(r'supabase\functions\chat-assistant-standalone.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Amnesia and Hallucination patched")
