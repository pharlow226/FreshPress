import re

filepath = r'supabase\functions\chat-assistant-standalone.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = r'''  "session_summary": "A brief 1-sentence summary of the conversation so far (MANDATORY)"
}
*NOTE*: You MUST include "session_summary" in every single response to maintain rolling telemetry.'''

new_format = r'''  "session_summary": "A detailed QA-focused summary of the conversation so far. You MUST explicitly document the user's intent, any friction/misunderstandings, and if the user had to correct you. (MANDATORY)"
}
*NOTE*: You MUST include "session_summary" in every single response to maintain rolling telemetry for QA.'''

content = content.replace(old_format, new_format)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\chat-assistant\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
