from urllib.request import Request, urlopen
import os
import json

url = "https://pofiytkpduprbkmgunbg.supabase.co/rest/v1/chat_sessions?select=session_id"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og" 
}
# USING SERVICE ROLE KEY TO CHECK IF DATA EXISTS
req = Request(url, headers=headers)
try:
    with urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(e)
