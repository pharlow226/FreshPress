import urllib.request
import json

url = "https://pofiytkpduprbkmgunbg.supabase.co/rest/v1/chat_sessions?select=id,session_id,order_id&limit=1"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og", 
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og"
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    print(response.read().decode("utf-8"))
