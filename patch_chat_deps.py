filepath = r"src\routes\admin\components\ChatLogsPage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("  useEffect(() => {\n    fetchSessions();\n  }, [filterType]);", "  useEffect(() => {\n    fetchSessions();\n  }, [filterType, timeFilter]);")
content = content.replace("onChange={(e) => { setTimeFilter(e.target.value); fetchSessions(); }}", "onChange={(e) => setTimeFilter(e.target.value)}")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed useEffect deps")
