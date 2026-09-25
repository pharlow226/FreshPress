with open(r"supabase\functions\vapi-webhook\index.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "vapi_call_logs" in line:
            for j in range(max(0, i-5), min(len(lines), i+15)):
                print(f"{j}: {lines[j].strip('\n')}")
            break
