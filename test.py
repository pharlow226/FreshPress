import sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r"supabase\functions\create-order\index.ts", 'r', encoding='utf-16') as f:
    text = f.read()
    start = text.find("interface")
    print(text[start:start+1000])
