/**
 * ChatWidget — updated for merged app
 * Changes: @/lib/config + createClient replaced by @/lib/supabase + @/lib/webhooks
 * All other UI/logic unchanged from original.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronDown, ChevronUp, Trash2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { WEBHOOKS } from "@/lib/webhooks";

const N8N_CHAT_WEBHOOK = WEBHOOKS.CHAT;

// Small "FP" avatar used in header & assistant bubbles
const PressyAvatar = ({ size = "md" }: { size?: "sm" | "md" }) => {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-black text-white bg-[hsl(var(--brand))] shadow-sm flex-shrink-0`}>
      FP
    </div>
  );
};

type SuggestedAction = {
  type: "navigate" | "whatsapp" | "call" | "link" | string;
  label: string; url?: string; href?: string; link?: string; target?: string; phone?: string;
};

type ChatMessage = {
  id: string; role: "user" | "assistant" | "system";
  content: string; timestamp: string; suggested_actions?: SuggestedAction[];
};

const getSessionId = (): string => {
  let sessionId = localStorage.getItem("freshpress_session_id");
  if (!sessionId) {
    sessionId = "FP-SESSION-" + Date.now() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem("freshpress_session_id", sessionId);
  }
  return sessionId;
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const normalizeNewlines = (text: string): string => text.replace(/\\n/g, "\n");

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome", role: "assistant",
  content: "Hi! I'm Pressy, your FreshPress laundry assistant. I can help you with:\n\n- Pricing & services\n- Place an order\n- Track your order\n- General questions\n\nHow can I assist you today?",
  timestamp: new Date().toISOString(),
};

const QUICK_REPLIES = ["Pricing & Services", "Request Pickup", "Track My Order", "Contact Us"];

const ChatWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<string>(getSessionId);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen && !hasLoadedHistory) loadChatHistory();
    if (isOpen) { setUnreadCount(0); setTimeout(() => inputRef.current?.focus(), 300); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadChatHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("chat_messages").select("role, content, created_at")
        .eq("session_id", sessionId).order("created_at", { ascending: true }).limit(50);
      if (data && data.length > 0) {
        setMessages(data.map((msg: any) => ({ id: msg.created_at, role: msg.role, content: msg.content, timestamp: msg.created_at })));
      } else { setMessages([WELCOME_MESSAGE]); }
      setHasLoadedHistory(true);
    } catch {
      setMessages([WELCOME_MESSAGE]); setHasLoadedHistory(true);
    } finally { setIsLoadingHistory(false); }
  };

  const ensureSession = async () => {
    try {
      const { data } = await supabase.from("chat_sessions").select("session_id").eq("session_id", sessionId).single();
      if (!data) {
        await supabase.from("chat_sessions").insert({ session_id: sessionId, started_at: new Date().toISOString(), last_activity_at: new Date().toISOString() });
      } else {
        await supabase.from("chat_sessions").update({ last_activity_at: new Date().toISOString() }).eq("session_id", sessionId);
      }
    } catch { /* non-fatal */ }
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? inputValue).trim();
    if (!trimmed || isLoading) return;
    const userMessage: ChatMessage = { id: Date.now().toString(), role: "user", content: trimmed, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    try {
      await ensureSession();
      const recentHistory = messages.filter(m => m.role !== "system").slice(-10).map(m => ({ role: m.role, content: m.content }));
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (!SUPABASE_ANON_KEY) throw new Error('VITE_SUPABASE_ANON_KEY is not set');
      const response = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ session_id: sessionId, message: trimmed, conversation_history: recentHistory, timestamp: new Date().toISOString() }),
      });
      if (!response.ok) {
        setMessages(prev => [...prev, { id: Date.now() + "-err", role: "assistant", content: "Something went wrong. Please try again or contact us on WhatsApp at +234 811 314 3272.", timestamp: new Date().toISOString() }]);
        return;
      }
      const raw = await response.json();
      const data = Array.isArray(raw) ? raw[0] ?? {} : raw ?? {};
      const replyText = (data.reply || "").toString().trim();
      if (!replyText) {
        setMessages(prev => [...prev, { id: Date.now() + "-empty", role: "assistant", content: "I didn't get a response. Please try again or reach us on WhatsApp at +234 811 314 3272.", timestamp: new Date().toISOString() }]);
        return;
      }
      setMessages(prev => [...prev, { id: Date.now() + "-reply", role: "assistant", content: replyText, timestamp: new Date().toISOString(), suggested_actions: Array.isArray(data.suggested_actions) ? data.suggested_actions : undefined }]);
      if (!isOpen) setUnreadCount(prev => prev + 1);

      // Persist session update only (Edge Function handles saving messages server-side)
      try { await supabase.from("chat_sessions").update({ messages_count: messages.length + 2, last_activity_at: new Date().toISOString() }).eq("session_id", sessionId); } catch { /* ignore */ }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + "-error", role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again or reach us on WhatsApp at +234 811 314 3272.", timestamp: new Date().toISOString() }]);
    } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const confirmClearHistory = () => { localStorage.removeItem("freshpress_session_id"); window.location.reload(); };

  const handleAction = (action: SuggestedAction) => {
    const rawUrl = action.url || action.href || action.link || action.target || "";
    const type = (action.type || "").toLowerCase();
    if (type === "whatsapp" || /wa\.me|whatsapp/i.test(rawUrl)) {
      const phone = (action.phone || rawUrl.replace(/[^0-9]/g, "")) || "2348113143272";
      window.open(`https://wa.me/${phone.replace(/^\+/, "")}`, "_blank", "noopener,noreferrer"); return;
    }
    if (type === "call" || type === "tel" || rawUrl.startsWith("tel:")) {
      const phone = action.phone || rawUrl.replace(/^tel:/, ""); if (phone) window.location.href = `tel:${phone}`; return;
    }
    if (!rawUrl) return;
    if (rawUrl.startsWith("#")) { document.querySelector(rawUrl)?.scrollIntoView({ behavior: "smooth" }); setIsOpen(false); return; }
    if (/^https?:\/\//i.test(rawUrl)) {
      try { const u = new URL(rawUrl); if (u.origin === window.location.origin) { navigate(u.pathname + u.search + u.hash); setIsOpen(false); return; } } catch { /* ignore */ }
      window.open(rawUrl, "_blank", "noopener,noreferrer"); return;
    }
    navigate(rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`); setIsOpen(false);
  };

  const MessageBubble = ({ message }: { message: ChatMessage }) => {
    const isUser = message.role === "user";
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
        {!isUser && <div className="mr-2 mt-1"><PressyAvatar size="sm" /></div>}
        <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isUser ? "bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white font-medium rounded-2xl rounded-br-sm" : "bg-secondary text-foreground rounded-2xl rounded-bl-sm"}`}>
            {normalizeNewlines(message.content)}
          </div>
          {!isUser && message.suggested_actions && message.suggested_actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {message.suggested_actions.map((action, idx) => (
                <button key={idx} onClick={() => handleAction(action)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/20">
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <span className="text-muted-foreground text-[10px] mt-1 px-1">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        {unreadCount > 0 && !isOpen && <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-xs font-bold text-white z-10 bg-destructive">{unreadCount}</div>}
        {!isOpen && <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-[hsl(var(--brand-gradient-via))]" />}
        <button onClick={() => setIsOpen(prev => !prev)} aria-label={isOpen ? "Close chat" : "Open chat"}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? "bg-card border border-border" : "bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))]"}`}
          style={{ boxShadow: isOpen ? undefined : "0 8px 32px hsl(var(--brand-gradient-via) / 0.4)" }}>
          {isOpen ? <X className="w-6 h-6 text-foreground" /> : <span className="text-white text-base font-black tracking-tight">FP</span>}
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
          style={{ width: "min(360px, calc(100vw - 2rem))", height: isMinimized ? "60px" : "min(520px, calc(100vh - 8rem))", transition: "height 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-[hsl(var(--brand))]">
            <div className="flex items-center gap-3">
              <PressyAvatar />
              <div>
                <p className="text-white text-sm font-bold leading-none">Pressy – FreshPress Assistant</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-white/90 text-xs">Online — typically replies instantly</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowClearConfirm(true)} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10" title="Clear history" aria-label="Clear history"><Trash2 className="w-4 h-4" /></button>
              <button onClick={() => setIsMinimized(prev => !prev)} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10" aria-label={isMinimized ? "Expand chat" : "Minimize chat"}>
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-background">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full border-2 border-[hsl(var(--brand-gradient-via))]/30 border-t-[hsl(var(--brand-gradient-via))] animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground text-xs">Loading your conversation...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-4"><span className="text-muted-foreground text-[10px] px-3 py-1 rounded-full bg-secondary border border-border">Session: {sessionId.slice(-8)}</span></div>
                    {messages.map(message => <MessageBubble key={message.id} message={message} />)}
                    {isLoading && (
                      <div className="flex justify-start mb-3">
                        <div className="mr-2 mt-1"><PressyAvatar size="sm" /></div>
                        <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-secondary">
                          <div className="flex gap-1 items-center h-4">
                            {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce bg-[hsl(var(--brand))]" style={{ animationDelay: `${i * 0.15}s` }} />)}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {messages.length <= 1 && !isLoading && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto bg-background">
                  {QUICK_REPLIES.map(suggestion => (
                    <button key={suggestion} onClick={() => sendMessage(suggestion)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/20">{suggestion}</button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 px-3 py-3 flex-shrink-0 border-t border-border bg-card">
                <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Type your message..." rows={1}
                  className="flex-1 resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none rounded-xl px-4 py-2.5 bg-secondary border border-border focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand))]/20 transition"
                  style={{ maxHeight: "100px", lineHeight: "1.5" }}
                  onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 100) + "px"; }} />
                <button onClick={() => sendMessage()} disabled={isLoading || !inputValue.trim()} aria-label="Send message"
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white shadow-lg">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {showClearConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
              <div className="w-full max-w-[280px] rounded-2xl bg-card border border-border shadow-2xl p-5 text-center">
                <div className="w-11 h-11 rounded-full mx-auto mb-3 flex items-center justify-center bg-destructive/10"><Trash2 className="w-5 h-5 text-destructive" /></div>
                <h3 className="text-sm font-bold text-foreground mb-1">Clear chat history?</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">This will start a new conversation with Pressy. Your previous messages will be removed from this device.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowClearConfirm(false)} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition">Cancel</button>
                  <button onClick={confirmClearHistory} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition">Clear</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;
