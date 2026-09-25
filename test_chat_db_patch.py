import urllib.request
import json

url = "https://pofiytkpduprbkmgunbg.supabase.co/rest/v1/chat_sessions?session_id=eq.FP-SESSION-1779336045003-9ED935Z7"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og", 
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}
body = json.dumps({"order_id": "LAU-614671"}).encode('utf-8')
req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
with urllib.request.urlopen(req) as response:
    print(f"Status: {response.getcode()}")
