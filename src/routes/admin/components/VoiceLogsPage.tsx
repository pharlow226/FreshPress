import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PhoneCall, Clock, DollarSign, PlayCircle, FileText, RefreshCw, Calendar, FileAudio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface VapiLog {
  id: string;
  call_id: string;
  phone_number: string | null;
  customer_id: string | null;
  order_id: string | null;
  transcript: string;
  summary: string;
  recording_url: string;
  ended_reason: string;
  duration_seconds: number;
  cost: number;
  created_at: string;
}

interface ElevenLabsQuota {
  character_count: number;
  character_limit: number;
  tier: string;
}

export function VoiceLogsPage() {
  const [logs, setLogs] = useState<VapiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<VapiLog | null>(null);
  const [elevenLabsQuota, setElevenLabsQuota] = useState<ElevenLabsQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  
  // Filtering states
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vapi_call_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply date filters
      const now = new Date();
      if (filterType === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfToday);
      } else if (filterType === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', startOfMonth);
      } else if (filterType === 'custom' && startDate && endDate) {
        // Add one day to end date to include the entire end day
        const endDay = new Date(endDate);
        endDay.setDate(endDay.getDate() + 1);
        query = query.gte('created_at', new Date(startDate).toISOString())
                     .lt('created_at', endDay.toISOString());
      } else {
        query = query.limit(100); // Default limit for 'all'
      }
        
      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch voice logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchElevenLabsQuota = async () => {
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/get-voice-quota`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setElevenLabsQuota(data);
    } catch (err: any) {
      setQuotaError('ElevenLabs API key not set. Ask admin to add ELEVENLABS_API_KEY to Supabase secrets.');
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType, startDate, endDate]);

  useEffect(() => {
    fetchElevenLabsQuota();
  }, []);

  const totalMinutes = logs.reduce((acc, log) => acc + (log.duration_seconds / 60), 0);
  const totalCost = logs.reduce((acc, log) => acc + Number(log.cost), 0);

  // ElevenLabs quota helpers
  const quotaPercent = elevenLabsQuota
    ? Math.round((elevenLabsQuota.character_count / elevenLabsQuota.character_limit) * 100)
    : 0;
  const charsRemaining = elevenLabsQuota
    ? elevenLabsQuota.character_limit - elevenLabsQuota.character_count
    : 0;
  const minsRemaining = Math.round(charsRemaining / 1000); // ~1000 chars ≈ 1 min audio
  const quotaBarColor = quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Voice Telemetry</h2>
          <p className="text-muted-foreground">Monitor voicebot interactions, call transcripts, and usage metrics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Time (Recent 100)</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {filterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-500">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-indigo-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Total AI Calls</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full"><PhoneCall className="h-4 w-4 text-indigo-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-700">{logs.length}</div>
            <p className="text-xs text-indigo-600/70 font-medium">in recent history</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Minutes</CardTitle>
            <div className="p-2 bg-gray-50 rounded-full"><Clock className="h-4 w-4 text-gray-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{totalMinutes.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground font-medium">cumulative talk time</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Consumed</CardTitle>
            <div className="p-2 bg-green-50 rounded-full"><DollarSign className="h-4 w-4 text-green-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-700">${totalCost.toFixed(3)}</div>
            <p className="text-xs text-green-600/70 font-medium">Vapi API usage cost</p>
          </CardContent>
        </Card>

        {/* ElevenLabs Live Voice Quota Card */}
        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Voice Quota</CardTitle>
            <div className="p-2 bg-purple-50 rounded-full"><FileAudio className="h-4 w-4 text-purple-600" /></div>
          </CardHeader>
          <CardContent>
            {quotaLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
            ) : quotaError ? (
              <div className="text-xs text-red-500 leading-relaxed">{quotaError}</div>
            ) : elevenLabsQuota ? (
              <div className="space-y-2">
                <div className="text-2xl font-black text-purple-700">
                  {elevenLabsQuota.character_count.toLocaleString()}
                  <span className="text-sm font-normal text-purple-400"> / {elevenLabsQuota.character_limit.toLocaleString()}</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${quotaBarColor}`}
                    style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-purple-600/70 font-medium">
                  {quotaPercent}% used · ~{minsRemaining} min left · <span className="capitalize">{elevenLabsQuota.tier}</span>
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logs Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Recent Call Logs
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-5 py-4 font-semibold">Date</th>
                  <th className="px-5 py-4 font-semibold">Caller</th>
                  <th className="px-5 py-4 font-semibold">Duration</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <PhoneCall className="w-8 h-8 text-gray-300 mb-3" />
                        <p>No call logs found yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {log.phone_number || <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">Website Visitor</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {Math.floor(log.duration_seconds / 60)}m {Math.floor(log.duration_seconds % 60)}s
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          log.ended_reason.includes('customer') ? 'bg-green-100 text-green-800' : 
                          log.ended_reason.includes('assistant') ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.ended_reason.replace(/-/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedLog ? (
            <Card className="sticky top-20 shadow-md border-indigo-100 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-white pb-4">
                <CardTitle className="text-base flex items-center justify-between text-indigo-950">
                  <span className="font-bold">Call Details</span>
                  <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">${Number(selectedLog.cost).toFixed(3)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-5 space-y-6 overflow-y-auto max-h-[600px]">
                  
                  {selectedLog.recording_url && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-gray-900">
                        <FileAudio className="w-4 h-4 text-indigo-500" /> Audio Recording
                      </h4>
                      <audio 
                        key={selectedLog.id} 
                        controls 
                        preload="metadata"
                        src={selectedLog.recording_url} 
                        className="w-full h-10 rounded-lg" 
                      >
                        Your browser does not support the audio element.
                      </audio>
                      <p className="text-xs text-gray-500">If the audio does not play, <a href={selectedLog.recording_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">click here to open it directly</a>.</p>
                    </div>
                  )}

                  {selectedLog.summary && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-gray-900">
                        <FileText className="w-4 h-4 text-indigo-500" /> AI Summary
                      </h4>
                      <p className="text-sm text-gray-700 bg-amber-50/50 p-4 rounded-xl border border-amber-100 leading-relaxed">
                        {selectedLog.summary}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-gray-900">
                      <PlayCircle className="w-4 h-4 text-indigo-500" /> Full Transcript
                    </h4>
                    <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200 whitespace-pre-wrap font-mono text-xs leading-loose">
                      {selectedLog.transcript || 'No transcript available.'}
                    </div>
                  </div>

                  {(selectedLog.order_id || selectedLog.customer_id) && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-bold mb-3 text-gray-900">Linked Entities</h4>
                      <div className="space-y-2">
                        {selectedLog.order_id && (
                          <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-500">Order ID:</span>
                            <span className="font-semibold">{selectedLog.order_id}</span>
                          </div>
                        )}
                        {selectedLog.customer_id && (
                          <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-500">Customer ID:</span>
                            <span className="font-mono text-xs">{selectedLog.customer_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[500px] flex items-center justify-center border-dashed border-2 bg-gray-50/50">
              <CardContent className="text-center text-muted-foreground p-8">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border">
                  <PhoneCall className="w-8 h-8 text-indigo-300" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Call Selected</h3>
                <p className="text-sm">Click on a call log from the table to view its full transcript and play the audio recording.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
