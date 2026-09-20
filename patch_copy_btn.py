import re

filepath = r'src\routes\customer\components\ChatWidget.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Copy icon to lucide-react import
import_old = "import { MessageSquare, X, ChevronDown, ChevronUp, Send, Trash2, Phone, FileText } from 'lucide-react';"
import_new = "import { MessageSquare, X, ChevronDown, ChevronUp, Send, Trash2, Phone, FileText, Copy, Check } from 'lucide-react';"
if import_old in content:
    content = content.replace(import_old, import_new)
else:
    # Just in case the imports are slightly different
    content = content.replace("Trash2", "Trash2, Copy, Check")

# 2. Add copy state
state_old = "const [showClearConfirm, setShowClearConfirm] = useState(false);"
state_new = "const [showClearConfirm, setShowClearConfirm] = useState(false);\n  const [copied, setCopied] = useState(false);"
content = content.replace(state_old, state_new)

# 3. Add copy function
func_old = "const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: \"smooth\" }); };"
func_new = """const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  const handleCopyChat = () => {
    const text = messages.map(m => `${m.role === 'user' ? 'User' : 'FP'}: ${m.content}`).join('\\n\\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };"""
content = content.replace(func_old, func_new)

# 4. Add button to header
btn_old = """<button onClick={() => setShowClearConfirm(true)} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10" title="Clear history" aria-label="Clear history"><Trash2 className="w-4 h-4" /></button>"""
btn_new = """<button onClick={handleCopyChat} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10" title="Copy transcript" aria-label="Copy transcript">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
              <button onClick={() => setShowClearConfirm(true)} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10" title="Clear history" aria-label="Clear history"><Trash2 className="w-4 h-4" /></button>"""
content = content.replace(btn_old, btn_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched ChatWidget with Copy button")
