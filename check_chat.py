with open(r"src\routes\customer\components\ChatWidget.tsx", "r", encoding="utf-8") as f:
    text = f.read()
    start = text.rfind("isLoadingHistory")
    if start != -1:
        print(text[max(0, start-400):start+200])
