import re

filepath = r'src\routes\customer\components\ChatWidget.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_div = '<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-background">'
new_div = '<div id="freshpress-chat-history" tabIndex={0} className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-background focus:outline-none">'

content = content.replace(old_div, new_div)

hook_code = """
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
          return;
        }
        e.preventDefault();
        const selection = window.getSelection();
        const range = document.createRange();
        const chatNode = document.getElementById('freshpress-chat-history');
        if (chatNode) {
          range.selectNodeContents(chatNode);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  return (
"""

content = content.replace("  return (\n    <>", hook_code + "    <>")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched ChatWidget")
