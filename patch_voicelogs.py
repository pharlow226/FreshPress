import re

filepath = r'src\routes\admin\components\VoiceLogsPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_format = 'Web SDK Caller'
new_format = 'Website Visitor'

content = content.replace(old_format, new_format)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched VoiceLogsPage successfully")
