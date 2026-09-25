with open(r"supabase\functions\chat-assistant\index.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines[375:395]):
        print(f"{376+i}: {line.strip('\n')}")
