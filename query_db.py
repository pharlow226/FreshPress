import urllib.request
import json

url = "https://pofiytkpduprbkmgunbg.supabase.co/rest/v1/pricing?select=service_name,category,price"
req = urllib.request.Request(url)
req.add_header('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE')
req.add_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE')

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
