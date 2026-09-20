from urllib.request import Request, urlopen
import os
import json

url = "https://pofiytkpduprbkmgunbg.supabase.co/rest/v1/company_info?select=minimum_order"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE"
}
req = Request(url, headers=headers)
try:
    with urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(e)
