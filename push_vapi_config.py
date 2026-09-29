import json
import urllib.request
import urllib.error

# Load vapi_config.json
with open('vapi_config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)

# Assistant ID to patch
assistant_id = cfg.get("id", "4fea51b0-d6b7-4e9a-8a4a-8cb59ad6cc1b")

# Build the payload to patch Vapi
# Vapi patch schema allows model, firstMessage, transcriber, messagePlan, etc.
patch_payload = {
    "model": cfg.get("model"),
    "firstMessage": cfg.get("firstMessage"),
    "voicemailMessage": cfg.get("voicemailMessage"),
    "endCallMessage": cfg.get("endCallMessage"),
    "transcriber": cfg.get("transcriber"),
    "messagePlan": cfg.get("messagePlan"),
    "summaryPrompt": cfg.get("summaryPrompt"),
    "analysisPlan": cfg.get("analysisPlan")
}

# The service role key or internal secret used to authorize with Supabase edge function
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og"
EDGE_FUNCTION_URL = "https://pofiytkpduprbkmgunbg.supabase.co/functions/v1/vapi-webhook"

req_data = {
    "action": "sync_vapi_assistant",
    "assistant_id": assistant_id,
    "patch_payload": patch_payload
}

req_bytes = json.dumps(req_data).encode('utf-8')
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
}

req = urllib.request.Request(EDGE_FUNCTION_URL, data=req_bytes, headers=headers, method="POST")

print(f"Pushing configuration to Vapi Assistant ({assistant_id}) via Supabase Edge Function...")
try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Success! Response from Vapi:")
        print(f"Status: {res_data.get('status')}")
        vapi_assistant = res_data.get("data", {})
        print(f"Assistant Name: {vapi_assistant.get('name')}")
        print(f"Updated At: {vapi_assistant.get('updatedAt')}")
        print(f"First Message: {vapi_assistant.get('firstMessage')}")
        print(f"Keywords: {vapi_assistant.get('transcriber', {}).get('keywords')}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
