import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock, RefreshCw, FileText, AlertTriangle, ShieldAlert, ShieldCheck, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ChatSession {
  id: string;
  session_id: string;
  started_at: string;
  last_activity_at: string;
  messages_count: number;
  last_intent: string | null;
  order_id: string | null;
  requires_human: boolean;
  ai_summary: string | null;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|prior\s+|above\s+|system\s+)?instructions/i,
  /you\s+are\s+(now\s+)?(no\s+longer|codebot|dan|developer\s+mode|jailbroken)/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions|system\s+rules|api\s+key|prompt)/i,
  /repeat\s+(everything|the\s+prompt|all\s+words)\s+(above|before)/i,
  /\b(def|class|import|function|linear_search)\s+[\w_]+\s*(\(|:)/i,
  /<script[\s\S]*?>/i,
  /act\s+as\s+(a\s+)?(developer|programmer|python\s+bot|software\s+engineer|hacker)/i,
  /write\s+(a\s+)?(python|javascript|typescript|c\+\+|java|php|sql|bash|shell)\s+(code|script|algorithm|function|program)/i,
  /base64\s*(decode|string|encoded)/i,
];

function isInjectionPayload(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some(regex => regex.test(text));
}

function isSecuritySession(session: ChatSession): boolean {
  const intent = (session.last_intent || '').toLowerCase();
  const summary = (session.ai_summary || '').toLowerCase();
  return (
    intent === 'security_deflection' ||
    intent.includes('injection') ||
    intent.includes('jailbreak') ||
    summary.includes('security') ||
    summary.includes('injection') ||
    summary.includes('jailbreak')
  );
}

export function ChatLogsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterType, setFilterType] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('chat_sessions')
        .select('*')
        .order('last_activity_at', { ascending: false });

      if (filterType === 'escalated') {
        query = query.eq('requires_human', true);
      } else if (filterType === 'orders') {
        query = query.not('order_id', 'is', null);
      } else if (filterType === 'security') {
        query = query.or('last_intent.eq.security_deflection,ai_summary.ilike.%Security%,ai_summary.ilike.%injection%');
      }

      const { data, error } = await query;
      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [filterType, timeFilter]);

  const loadMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session);
    loadMessages(session.session_id);
  };

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      session.session_id.toLowerCase().includes(q) ||
      (session.ai_summary && session.ai_summary.toLowerCase().includes(q)) ||
      (session.last_intent && session.last_intent.toLowerCase().includes(q)) ||
      (session.order_id && session.order_id.toLowerCase().includes(q))
    );
  });

  const securitySessionCount = sessions.filter(isSecuritySession).length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Chat Telemetry & Guardrails
            {securitySessionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                <ShieldAlert className="w-3.5 h-3.5" />
                {securitySessionCount} Injection Attempt{securitySessionCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Monitor web chat sessions, adversarial prompt injection attempts, AI summaries, and human escalations.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border-slate-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-3 pr-8 border bg-white shadow-sm"
          >
            <option value="all">All Time (Recent 100)</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
          </select>
          <button 
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200/50' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            All Sessions
          </button>
          <button 
            onClick={() => setFilterType('security')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filterType === 'security' ? 'bg-red-50 text-red-700 shadow-sm border border-red-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            Jailbreak / Injections
            {securitySessionCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold">{securitySessionCount}</span>
            )}
          </button>
          <button 
            onClick={() => setFilterType('escalated')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'escalated' ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Human Escalation
          </button>
          <button 
            onClick={() => setFilterType('orders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'orders' ? 'bg-green-50 text-green-700 shadow-sm border border-green-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            With Orders
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by session ID or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="lg:col-span-1 border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800 text-sm">
              Sessions ({filteredSessions.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="text-center p-8 text-slate-400 text-sm">Loading sessions...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-sm">No sessions found matching filters.</div>
            ) : (
              filteredSessions.map(session => {
                const isSec = isSecuritySession(session);
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedSession?.id === session.id 
                        ? (isSec ? 'bg-red-50/60 border-red-300 ring-1 ring-red-300' : 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200')
                        : (isSec ? 'bg-red-50/20 border-red-200 hover:border-red-300 hover:bg-red-50/40' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm')
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {isSec ? (
                          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                        ) : (
                          <MessageSquare className={`w-4 h-4 flex-shrink-0 ${session.requires_human ? 'text-amber-500' : 'text-indigo-500'}`} />
                        )}
                        <span className="font-bold text-slate-900 text-sm">{session.session_id.substring(0, 14)}...</span>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        {isSec && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded text-[10px] font-bold tracking-wider flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> INJECTION ATTEMPT
                          </span>
                        )}
                        {session.requires_human && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">ESCALATED</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(session.last_activity_at).toLocaleDateString()}</span>
                      <span>{session.messages_count} msgs</span>
                    </div>

                    {session.last_intent && (
                      <div className={`text-[11px] px-2 py-0.5 rounded font-medium inline-block mb-2 ${
                        isSec ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Intent: {session.last_intent}
                      </div>
                    )}

                    {session.ai_summary && (
                      <p className={`text-xs line-clamp-2 ${isSec ? 'text-red-900 font-medium' : 'text-slate-600'}`}>
                        {session.ai_summary}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Session Transcript & Security Telemetry */}
        <div className="lg:col-span-2 h-[700px] flex flex-col">
          {selectedSession ? (
            <Card className="flex-1 flex flex-col shadow-sm border-slate-200 h-full overflow-hidden">
              <CardHeader className="bg-slate-50/80 border-b pb-4 shrink-0">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                      <span>Session Details</span>
                      {isSecuritySession(selectedSession) && (
                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-red-600 text-white rounded-full font-bold shadow-sm">
                          <ShieldAlert className="w-3.5 h-3.5" /> PROMPT INJECTION FLAGGED
                        </span>
                      )}
                      {selectedSession.requires_human && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-bold">
                          <AlertTriangle className="w-3 h-3" /> HUMAN ESCALATION
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono mt-1 select-all">Session ID: {selectedSession.session_id}</p>
                  </div>
                  {selectedSession.order_id && (
                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold flex-shrink-0">
                      Order: {selectedSession.order_id}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                {/* Security Alert Banner if session was flagged */}
                {isSecuritySession(selectedSession) && (
                  <div className="p-4 bg-red-50 border-b border-red-200 shrink-0 flex items-start gap-3 text-red-900">
                    <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold text-red-950">Adversarial Prompt Injection Attempt Detected</p>
                      <p className="text-red-800 mt-0.5">
                        The user in this session sent instructions attempting to bypass Pressy's system rules. 
                        The Edge Security Guardrail intercepted the payload and returned a deflection without calling downstream LLM tokens.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-indigo-50/40 border-b shrink-0">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> AI Telemetry & Guardrail Summary
                  </h3>
                  <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border shadow-sm leading-relaxed">
                    {selectedSession.ai_summary || "No automated summary captured for this session."}
                  </p>
                </div>
                
                {/* Transcript Message Stream */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/70">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-4 border-b border-slate-200 pb-2">
                    Conversation Transcript
                  </h3>
                  
                  {loadingMessages ? (
                    <div className="text-center text-slate-400 py-4 text-sm">Loading transcript...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-4 text-sm">No messages stored for this session.</div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      const isAttack = isUser && isInjectionPayload(msg.content);
                      const isDeflectionReply = !isUser && (
                        msg.content.includes('spin cycle') ||
                        msg.content.includes('strictly limited') ||
                        msg.content.includes('outside my laundry')
                      );

                      return (
                        <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-2`}>
                          {isAttack && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-red-600 mb-1 px-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                              <span>MALICIOUS PROMPT INJECTION PAYLOAD FLAGGED</span>
                            </div>
                          )}

                          {isDeflectionReply && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mb-1 px-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>SAFELY DEFLECTED AT EDGE (0 TOKENS)</span>
                            </div>
                          )}

                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                            isAttack
                              ? 'bg-gradient-to-r from-red-900 to-rose-950 text-red-100 border-2 border-red-500 rounded-br-none shadow-red-200'
                              : isUser 
                                ? 'bg-slate-800 text-white rounded-br-none' 
                                : isDeflectionReply
                                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-bl-none'
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                          }`}>
                            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-normal">
                              {msg.content}
                            </p>
                            <span className={`text-[10px] mt-2 block ${isUser ? (isAttack ? 'text-red-300' : 'text-slate-400') : 'text-slate-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex-1 border rounded-xl bg-slate-50 border-dashed flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center">
              <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No session selected</p>
              <p className="text-xs text-slate-400 mt-1">Select a chat session from the list to review transcript and security guardrails telemetry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
