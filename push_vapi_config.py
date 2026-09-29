import json
import requests

# Load vapi_config.json
with open('vapi_config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)

# Assistant ID to patch
assistant_id = cfg.get("id", "4fea51b0-d6b7-4e9a-8a4a-8cb59ad6cc1b")

# Load system prompt directly from vapi_prompt.txt
with open('vapi_prompt.txt', 'r', encoding='utf-8') as f:
    prompt_text = f.read()

model_obj = cfg.get("model", {})
model_obj["systemPrompt"] = prompt_text
model_obj["messages"] = [{"role": "system", "content": prompt_text}]

# Build the payload to patch Vapi
patch_payload = {
    "voice": cfg.get("voice"),
    "model": model_obj,
    "firstMessage": cfg.get("firstMessage"),
    "voicemailMessage": cfg.get("voicemailMessage"),
    "endCallMessage": cfg.get("endCallMessage"),
    "endCallFunctionEnabled": cfg.get("endCallFunctionEnabled", True),
    "transcriber": cfg.get("transcriber"),
    "messagePlan": cfg.get("messagePlan"),
    "summaryPrompt": cfg.get("summaryPrompt"),
    "analysisPlan": cfg.get("analysisPlan"),
    "serverMessages": cfg.get("serverMessages"),
    "backgroundDenoisingEnabled": cfg.get("backgroundDenoisingEnabled", True),
    "silenceTimeoutSeconds": cfg.get("silenceTimeoutSeconds", 30),
    "maxDurationSeconds": cfg.get("maxDurationSeconds", 600)
}

# The service role key or internal secret used to authorize with Supabase edge function
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og"
EDGE_FUNCTION_URL = "https://pofiytkpduprbkmgunbg.supabase.co/functions/v1/vapi-webhook"

req_data = {
    "action": "sync_vapi_assistant",
    "assistant_id": assistant_id,
    "patch_payload": patch_payload
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
}

print(f"Pushing configuration to Vapi Assistant ({assistant_id}) via Supabase Edge Function...")
try:
    response = requests.post(EDGE_FUNCTION_URL, json=req_data, headers=headers, timeout=20)
    res_data = response.json()
    print("Success! Response from Vapi:")
    print(f"Status: {res_data.get('status')}")
    vapi_assistant = res_data.get("data", {})
    print(f"Assistant Name: {vapi_assistant.get('name')}")
    print(f"Updated At: {vapi_assistant.get('updatedAt')}")
    print(f"First Message: {vapi_assistant.get('firstMessage')}")
    print(f"Keywords: {vapi_assistant.get('transcriber', {}).get('keywords')}")
    print(f"Voice Settings: {json.dumps(vapi_assistant.get('voice', {}), indent=2)}")
    
    # Verify Prompt contains Rule 5 and Rule 6
    live_content = ""
    model_res = vapi_assistant.get("model", {})
    if "systemPrompt" in model_res and model_res["systemPrompt"]:
        live_content = model_res["systemPrompt"]
    elif "messages" in model_res and len(model_res["messages"]) > 0:
        live_content = model_res["messages"][0].get("content", "")
    
    print("\n--- Live Prompt Verification (Rules 5 & 6) ---")
    if "5. Payment and Bank Transfer Scope:" in live_content:
        print("Verified: Rule 5 (Payment & Bank Transfer Scope) is ACTIVE on Vapi.")
    else:
        print("Rule 5 is NOT found in prompt!")
        
    if "6. Ambiguous or Single-Word Utterances:" in live_content:
        print("Verified: Rule 6 (Ambiguous / Single-Word Utterances) is ACTIVE on Vapi.")
    else:
        print("Rule 6 is NOT found in prompt!")
    
    start_idx = live_content.find("**SECURITY AND SCOPE GUARDRAILS")
    if start_idx != -1:
        print("\nSecurity Section Live on Vapi:\n" + live_content[start_idx:start_idx+1200])
except Exception as e:
    print(f"Error: {e}")
