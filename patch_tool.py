import urllib.request
import json

assistant_id = "4fea51b0-d6b7-4e9a-8a4a-8cb59ad6cc1b"
api_key = "3bb845e1-6d1e-44d5-8850-f5081cab2bb9"

req = urllib.request.Request(f"https://api.vapi.ai/assistant/{assistant_id}", headers={"Authorization": f"Bearer {api_key}"})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

# Find the create_pickup_order tool
for tool in data["model"]["tools"]:
    if "function" in tool and tool["function"]["name"] == "create_pickup_order":
        tool["function"]["parameters"]["properties"]["special_instructions"] = {
            "type": "string",
            "description": "Optional instructions from the customer (e.g. 'Use cold water', 'Fragile items', etc.)"
        }
        # it is optional, so we DO NOT add it to "required" array

patch_data = { "model": data["model"] }
req_patch = urllib.request.Request(
    f"https://api.vapi.ai/assistant/{assistant_id}", 
    data=json.dumps(patch_data).encode(), 
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    method="PATCH"
)
try:
    with urllib.request.urlopen(req_patch) as response:
        print("Successfully updated Vapi assistant!")
except urllib.error.HTTPError as e:
    print(f"Error: {e.code} - {e.read().decode()}")
