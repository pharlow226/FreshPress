with open(r"supabase\functions\chat-assistant\index.ts", "r", encoding="utf-8") as f:
    text = f.read()
    start = text.find("You are Pressy")
    if start != -1:
        print(text[start:start+3000])
    else:
        print("You are Pressy not found")
