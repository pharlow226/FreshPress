import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock, RefreshCw, Calendar, FileText, AlertTriangle } from 'lucide-react';
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

export function ChatLogsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chat Telemetry</h1>
          <p className="text-slate-500 mt-1">Monitor web chat sessions, AI summaries, and human escalations.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-3 pr-10 border"
          >
            <option value="all">All Time (Recent 100)</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
          </select>
          <button 
            onClick={fetchSessions}
            disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm inline-flex">
        <button 
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          All Sessions
        </button>
        <button 
          onClick={() => setFilterType('escalated')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'escalated' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Human Escalation
        </button>
        <button 
          onClick={() => setFilterType('orders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'orders' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          With Orders
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Sessions ({sessions.length})</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="text-center p-8 text-slate-400">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center p-8 text-slate-400">No sessions found.</div>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSession?.id === session.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`w-4 h-4 ${session.requires_human ? 'text-red-500' : 'text-indigo-500'}`} />
                      <span className="font-medium text-slate-900 text-sm">{session.session_id.substring(0, 8)}...</span>
                    </div>
                    {session.requires_human && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">ESCALATED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(session.last_activity_at).toLocaleDateString()}</span>
                    <span>{session.messages_count} msgs</span>
                  </div>
                  {session.last_intent && (
                    <div className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded inline-block mb-2">
                      Intent: {session.last_intent}
                    </div>
                  )}
                  {session.ai_summary && (
                    <p className="text-xs text-slate-600 line-clamp-2">{session.ai_summary}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 h-[700px] flex flex-col">
          {selectedSession ? (
            <Card className="flex-1 flex flex-col shadow-sm border-slate-200 h-full">
              <CardHeader className="bg-slate-50/50 border-b pb-4 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Session Details
                      {selectedSession.requires_human && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold ml-2">
                          <AlertTriangle className="w-3 h-3" /> HUMAN ESCALATION
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">ID: {selectedSession.session_id}</p>
                  </div>
                  {selectedSession.order_id && (
                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-semibold">
                      Order: {selectedSession.order_id}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                <div className="p-6 bg-indigo-50/50 border-b shrink-0">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" /> AI Telemetry Summary
                  </h3>
                  <p className="text-sm text-slate-700 bg-white p-4 rounded-lg border shadow-sm">
                    {selectedSession.ai_summary || "No summary captured for this session."}
                  </p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-500 text-center mb-4 border-b pb-2">Full Transcript</h3>
                  
                  {loadingMessages ? (
                    <div className="text-center text-slate-400 py-4">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-4">No messages stored for this session.</div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user' 
                            ? 'bg-slate-800 text-white rounded-br-none' 
                            : 'bg-white border shadow-sm text-slate-800 rounded-bl-none'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <span className={`text-[10px] mt-2 block ${msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex-1 border rounded-xl bg-slate-50 border-dashed flex flex-col items-center justify-center text-slate-400 h-full">
              <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
              <p>Select a chat session from the left to view the transcript</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
