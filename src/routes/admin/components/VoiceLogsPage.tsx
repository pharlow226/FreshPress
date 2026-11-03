import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  PhoneCall, 
  Clock, 
  DollarSign, 
  PlayCircle, 
  FileText, 
  RefreshCw, 
  Calendar, 
  FileAudio, 
  Search,
  CheckCircle2,
  PhoneOff,
  WifiOff,
  VolumeX,
  AlertTriangle,
  Voicemail,
  PhoneMissed
} from 'lucide-react';
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

function toStoragePath(value: string, callId?: string): string {
  if (!value && !callId) return '';
  if (value) {
    const marker = '/recordings/';
    const i = value.indexOf(marker);
    if (i >= 0) return value.slice(i + marker.length).split('?')[0];
    if (!value.startsWith('http')) return value.split('?')[0];
  }
  return callId ? `${callId}.wav` : '';
}

export function RecordingPlayer({ recording, callId, durationSeconds }: { recording: string; callId: string; durationSeconds?: number }) {
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!recording || durationSeconds === 0) {
      setPlayUrl(null);
      setLoading(false);
      return;
    }

    const isR2Url = recording.includes('.r2.cloudflarestorage.com');
    const path = toStoragePath(recording, callId);

    setLoading(true);
    setFailed(false);
    setIsExpired(false);

    (async () => {
      try {
        const bucket = supabase.storage.from('recordings');
        let play = await bucket.createSignedUrl(path, 3600);
        let dl = await bucket.createSignedUrl(path, 3600, { download: `call-${callId}.wav` });

        if ((play.error || !play.data?.signedUrl) && callId && path !== `${callId}.wav`) {
          play = await bucket.createSignedUrl(`${callId}.wav`, 3600);
          dl = await bucket.createSignedUrl(`${callId}.wav`, 3600, { download: `call-${callId}.wav` });
        }

        if (cancelled) return;

        if (play.data?.signedUrl) {
          setPlayUrl(play.data.signedUrl);
          setDownloadUrl(dl.data?.signedUrl || play.data.signedUrl);
          return;
        }

        // Not in Supabase bucket — fallback to external URL if valid
        if (recording.startsWith('http') && !isR2Url) {
          setPlayUrl(recording);
          setDownloadUrl(recording);
        } else if (isR2Url) {
          // Cloudflare R2 links from Vapi expire after the 14-day retention window
          setIsExpired(true);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) {
          if (isR2Url) {
            setIsExpired(true);
          } else if (recording.startsWith('http')) {
            setPlayUrl(recording);
            setDownloadUrl(recording);
          } else {
            setFailed(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [recording, callId, durationSeconds]);

  if (!recording || durationSeconds === 0) {
    return <p className="text-xs text-slate-400 italic">No audio recorded for this call (0s duration).</p>;
  }

  if (isExpired) {
    return (
      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" /> Audio Archive Unavailable
        </p>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          External audio link has expired (Vapi 14-day retention window). The full call transcript is preserved below.
        </p>
      </div>
    );
  }

  if (failed) {
    return <p className="text-xs text-rose-500">Recording could not be loaded.</p>;
  }

  if (loading || !playUrl) {
    return <p className="text-xs text-slate-400 animate-pulse">Loading secure recording...</p>;
  }

  return (
    <div className="space-y-2">
      <audio 
        key={playUrl} 
        controls 
        preload="metadata"
        src={playUrl} 
        className="w-full h-10 rounded-lg"
        onError={() => setIsExpired(true)}
      >
        Your browser does not support the audio element.
      </audio>
      <div className="flex justify-between items-center text-xs">
        <a 
          href={downloadUrl ?? playUrl} 
          download={`call-${callId}.wav`}
          target="_blank" 
          rel="noreferrer" 
          className="text-indigo-600 hover:text-indigo-800 font-medium underline"
        >
          Download recording
        </a>
      </div>
    </div>
  );
}

function FormattedSummary({ text }: { text: string }) {
  if (!text) return null;

  // Clean raw markdown headers and preamble if present
  const cleanText = text
    .replace(/^Here is a detailed,?\s*chronological summary[^\n]*\n+/i, '')
    .replace(/^\*\*Call Summary for QA[^\n]*\*\*\n+/i, '')
    .trim();

  const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

  return (
    <div className="space-y-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 text-xs sm:text-sm leading-relaxed shadow-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Check if line is a numbered major section like **1. ...** or ###
        const isSectionHeader = /^\*\*\d+\.\s+[^*]+\*\*:?$/.test(trimmed) || /^###?\s+/.test(trimmed);
        if (isSectionHeader) {
          const title = trimmed.replace(/^\*\*|\*\*:?$|^###?\s+/g, '').trim();
          return (
            <div key={idx} className="pt-2 pb-0.5 border-b border-slate-200/70 first:pt-0">
              <span className="font-bold text-xs uppercase tracking-wide text-indigo-700">{title}</span>
            </div>
          );
        }

        // Check if line is a bullet item like * **Key:** Value
        const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-');
        const content = isBullet ? trimmed.replace(/^[\*\-]\s+/, '') : trimmed;

        // Split on bold markdown **...**
        const parts = content.split(/(\*\*[^*]+\*\*)/g);

        return (
          <div key={idx} className={`flex items-start gap-1.5 ${isBullet ? 'pl-2' : ''}`}>
            {isBullet && <span className="text-indigo-500 font-bold mt-0.5">•</span>}
            <p className="text-slate-700 flex-1 leading-relaxed">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const boldText = part.slice(2, -2);
                  return <strong key={pIdx} className="font-semibold text-slate-900">{boldText}</strong>;
                }
                return part;
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function isVoiceSecurityAlert(log: VapiLog): boolean {
  const summary = (log.summary || '').toLowerCase();
  const transcript = (log.transcript || '').toLowerCase();
  return (
    summary.includes('spoken injection') ||
    summary.includes('security alert') ||
    summary.includes('security deflection') ||
    summary.includes('injection') ||
    summary.includes('jailbreak') ||
    summary.includes('guardrail') ||
    transcript.includes('ignore all instructions') ||
    transcript.includes('system prompt')
  );
}

function isConnectionDropped(log: VapiLog): boolean {
  const r = (log.ended_reason || '').toLowerCase();
  return (
    r.includes('audio') ||
    r.includes('did not receive') ||
    r.includes('silence') ||
    r.includes('disconnect') ||
    log.duration_seconds === 0
  );
}

interface StatusConfig {
  label: string;
  tone: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function getStatusConfig(reasonRaw?: string): StatusConfig {
  const reason = (reasonRaw || '').toLowerCase().trim();

  // 1. Connection dropped / no audio packet received from customer (WebRTC / network drop)
  if (
    reason.includes('audio') || 
    reason.includes('did not receive') ||
    reason.includes('network') ||
    reason.includes('transport') ||
    reason.includes('connection')
  ) {
    return {
      label: 'Connection dropped',
      tone: 'amber',
      icon: WifiOff,
      tooltip: reasonRaw || 'No customer audio received (browser mic permission or network drop)',
    };
  }

  // 2. Silence timeout
  if (reason.includes('silence')) {
    return {
      label: 'Silence timeout',
      tone: 'amber',
      icon: VolumeX,
      tooltip: reasonRaw || 'Call timed out due to prolonged silence',
    };
  }

  // 3. Caller hung up
  if (reason.includes('customer-ended') || reason.includes('customer ended') || reason.includes('customer hung up')) {
    return {
      label: 'Caller hung up',
      tone: 'blue',
      icon: PhoneOff,
      tooltip: reasonRaw || 'Customer ended the call',
    };
  }

  // 4. Completed normally by assistant
  if (
    reason.includes('assistant-ended') || 
    reason.includes('assistant ended') ||
    reason.includes('end-call-phrase') ||
    reason.includes('end call phrase') ||
    reason.includes('completed')
  ) {
    return {
      label: 'Completed',
      tone: 'emerald',
      icon: CheckCircle2,
      tooltip: reasonRaw || 'Call concluded normally by assistant',
    };
  }

  // 5. Voicemail
  if (reason.includes('voicemail')) {
    return {
      label: 'Voicemail',
      tone: 'slate',
      icon: Voicemail,
      tooltip: reasonRaw || 'Reached voicemail greeting',
    };
  }

  // 6. No answer / Busy
  if (reason.includes('did not answer') || reason.includes('no-answer') || reason.includes('busy')) {
    return {
      label: reason.includes('busy') ? 'Line busy' : 'No answer',
      tone: 'slate',
      icon: PhoneMissed,
      tooltip: reasonRaw || 'Customer did not answer or line busy',
    };
  }

  // 7. System error
  if (reason.includes('error') || reason.includes('failed')) {
    return {
      label: 'System error',
      tone: 'rose',
      icon: AlertTriangle,
      tooltip: reasonRaw || 'System or LLM pipeline error encountered',
    };
  }

  // Fallback: clean raw string
  const cleanLabel = reasonRaw
    ? reasonRaw.replace(/[-_.]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
    : 'Unknown';

  return {
    label: cleanLabel || 'Unknown',
    tone: 'slate',
    icon: PhoneCall,
    tooltip: reasonRaw || 'Status unknown',
  };
}

const statusToneClasses: Record<StatusConfig['tone'], { badge: string; icon: string }> = {
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    icon: 'text-emerald-600',
  },
  blue: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
    icon: 'text-blue-600',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    icon: 'text-amber-600',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    icon: 'text-rose-600',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'text-slate-500',
  },
};

export function StatusBadge({ reason, size = 'sm' }: { reason: string; size?: 'sm' | 'md' }) {
  const config = getStatusConfig(reason);
  const Icon = config.icon;
  const isMd = size === 'md';
  const styling = statusToneClasses[config.tone];

  return (
    <span
      title={config.tooltip}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border whitespace-nowrap select-none transition-colors ${
        isMd ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${styling.badge}`}
    >
      <Icon className={`${isMd ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${styling.icon} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
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
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vapi_call_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const now = new Date();
      if (timeFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfToday);
      } else if (timeFilter === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', startOfMonth);
      } else if (timeFilter === 'custom' && startDate && endDate) {
        const endDay = new Date(endDate);
        endDay.setDate(endDay.getDate() + 1);
        query = query.gte('created_at', new Date(startDate).toISOString())
                     .lt('created_at', endDay.toISOString());
      }

      if (filterType === 'security') {
        query = query.or('summary.ilike.%Security%,summary.ilike.%injection%,summary.ilike.%jailbreak%,transcript.ilike.%ignore all instructions%,transcript.ilike.%system prompt%');
      } else if (filterType === 'orders') {
        query = query.not('order_id', 'is', null);
      } else if (filterType === 'dropped') {
        query = query.or('ended_reason.ilike.%audio%,ended_reason.ilike.%silence%,duration_seconds.eq.0');
      }

      query = query.limit(100);
        
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
      const { data, error } = await supabase.functions.invoke('get-voice-quota');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setElevenLabsQuota(data);
    } catch (err: any) {
      setQuotaError(err?.message || 'ElevenLabs quota could not be loaded.');
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType, timeFilter, startDate, endDate]);

  useEffect(() => {
    fetchElevenLabsQuota();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterType === 'security' && !isVoiceSecurityAlert(log)) return false;
    if (filterType === 'orders' && !log.order_id) return false;
    if (filterType === 'dropped' && !isConnectionDropped(log)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.phone_number && log.phone_number.toLowerCase().includes(q)) ||
      (log.call_id && log.call_id.toLowerCase().includes(q)) ||
      (log.summary && log.summary.toLowerCase().includes(q)) ||
      (log.transcript && log.transcript.toLowerCase().includes(q)) ||
      (log.order_id && log.order_id.toLowerCase().includes(q))
    );
  });

  const totalMinutes = filteredLogs.reduce((acc, log) => acc + (log.duration_seconds / 60), 0);
  const totalCost = filteredLogs.reduce((acc, log) => acc + Number(log.cost), 0);

  const quotaPercent = elevenLabsQuota
    ? Math.round((elevenLabsQuota.character_count / elevenLabsQuota.character_limit) * 100)
    : 0;
  const charsRemaining = elevenLabsQuota
    ? elevenLabsQuota.character_limit - elevenLabsQuota.character_count
    : 0;
  const minsRemaining = Math.round(charsRemaining / 1000);
  const quotaBarColor = quotaPercent >= 90 ? 'bg-rose-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">AI Voice Telemetry & Logs</h1>
          <p className="text-slate-500 mt-1">Monitor voicebot interactions, call transcripts, security deflections, and usage metrics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border-slate-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-3 pr-8 border bg-white shadow-sm"
          >
            <option value="all">All Time (Recent 100)</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-200 rounded-lg text-sm p-1.5 border bg-white shadow-sm"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-200 rounded-lg text-sm p-1.5 border bg-white shadow-sm"
              />
            </div>
          )}

          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">Total AI Calls</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full"><PhoneCall className="h-4 w-4 text-indigo-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{filteredLogs.length}</div>
            <p className="text-xs text-slate-500 font-medium">in current view</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">Total AI Minutes</CardTitle>
            <div className="p-2 bg-slate-50 rounded-full"><Clock className="h-4 w-4 text-slate-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{totalMinutes.toFixed(1)} min</div>
            <p className="text-xs text-slate-500 font-medium">cumulative talk time</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">Credits Consumed</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-full"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700">${totalCost.toFixed(3)}</div>
            <p className="text-xs text-emerald-600 font-medium">Vapi API usage cost</p>
          </CardContent>
        </Card>

        {/* ElevenLabs Live Voice Quota Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">Voice Quota</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full"><FileAudio className="h-4 w-4 text-indigo-600" /></div>
          </CardHeader>
          <CardContent>
            {quotaLoading ? (
              <div className="text-sm text-slate-400 animate-pulse">Loading...</div>
            ) : quotaError ? (
              <div className="text-xs text-slate-500 leading-relaxed">{quotaError}</div>
            ) : elevenLabsQuota ? (
              <div className="space-y-2">
                <div className="text-2xl font-black text-slate-900">
                  {elevenLabsQuota.character_count.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400"> / {elevenLabsQuota.character_limit.toLocaleString()} used</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${quotaBarColor}`}
                    style={{ width: `${Math.max(Math.min(quotaPercent, 100), 2)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {charsRemaining.toLocaleString()} chars left (~{minsRemaining} min) | <span className="capitalize">{elevenLabsQuota.tier}</span>
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200/50' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            All Calls
          </button>
          <button 
            onClick={() => setFilterType('security')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'security' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Security Deflections
          </button>
          <button 
            onClick={() => setFilterType('orders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'orders' ? 'bg-green-50 text-green-700 shadow-sm border border-green-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            With Orders
          </button>
          <button 
            onClick={() => setFilterType('dropped')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filterType === 'dropped' ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            Connection Dropped
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by phone, call ID, summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logs Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-indigo-600" />
              Call Logs ({filteredLogs.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Caller</th>
                  <th className="px-5 py-3 font-semibold">Duration</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <PhoneCall className="w-8 h-8 text-slate-300 mb-3" />
                        <p>No call logs found matching filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isZeroDuration = log.duration_seconds === 0;
                    return (
                      <tr 
                        key={log.id} 
                        className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                          isZeroDuration ? 'opacity-75 bg-slate-50/40' : ''
                        } ${selectedLog?.id === log.id ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-900 text-xs sm:text-sm">
                              {new Date(log.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                          {log.phone_number || (
                            <span className="inline-flex items-center text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-xs font-medium">
                              Website Visitor
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-xs sm:text-sm whitespace-nowrap">
                          {isZeroDuration ? (
                            <span className="text-slate-400 italic font-mono text-xs">0s (dropped)</span>
                          ) : (
                            `${Math.floor(log.duration_seconds / 60)}m ${Math.floor(log.duration_seconds % 60)}s`
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge reason={log.ended_reason} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedLog ? (
            <Card className="sticky top-20 shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="border-b bg-slate-50/80 pb-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Call Details
                  </CardTitle>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    ${Number(selectedLog.cost).toFixed(3)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge reason={selectedLog.ended_reason} size="md" />
                  <span className="text-xs text-slate-500 font-medium">
                    • {selectedLog.duration_seconds === 0 ? '0s (dropped)' : `${Math.floor(selectedLog.duration_seconds / 60)}m ${Math.floor(selectedLog.duration_seconds % 60)}s`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-mono select-all truncate" title={selectedLog.call_id}>
                  Call ID: {selectedLog.call_id}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-5 space-y-6 overflow-y-auto max-h-[600px]">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileAudio className="w-3.5 h-3.5 text-indigo-600" /> Audio Recording
                    </h4>
                    <RecordingPlayer 
                      recording={selectedLog.recording_url} 
                      callId={selectedLog.call_id} 
                      durationSeconds={selectedLog.duration_seconds} 
                    />
                  </div>

                  {selectedLog.summary && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" /> AI Summary
                      </h4>
                      <FormattedSummary text={selectedLog.summary} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-600" /> Full Transcript
                    </h4>
                    <div className="text-xs text-slate-700 bg-slate-50/60 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                      {selectedLog.transcript || 'No transcript available.'}
                    </div>
                  </div>

                  {(selectedLog.order_id || selectedLog.customer_id) && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Linked Entities</h4>
                      <div className="space-y-2">
                        {selectedLog.order_id && (
                          <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <span className="text-slate-500">Order ID:</span>
                            <span className="font-semibold text-slate-900">{selectedLog.order_id}</span>
                          </div>
                        )}
                        {selectedLog.customer_id && (
                          <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <span className="text-slate-500">Customer ID:</span>
                            <span className="font-mono text-slate-700">{selectedLog.customer_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[500px] flex items-center justify-center border-dashed border-2 bg-slate-50/50">
              <CardContent className="text-center text-slate-400 p-8">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                  <PhoneCall className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-2">No Call Selected</h3>
                <p className="text-xs text-slate-400">Click on a call log from the table to view its full transcript and play the audio recording.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
