/**
 * ActivityLogPage — Full audit trail with filters:
 *  - Date: Today / This Week / This Month / This Year
 *  - Staff role: All / Pickup / Accountant / Admin
 *  - Action type: All / picked_up / delivered / status_changed / etc.
 *  - Staff name search
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Calendar, Activity } from 'lucide-react';
import { supabase, formatDateTime, getActivityColor } from '@/lib/supabase';

type DateRange = 'all' | 'today' | 'week' | 'month' | 'year';

function getDateBounds(range: DateRange): { from: Date | null; to: Date | null } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'today') return { from: today, to: now };
  if (range === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    return { from: mon, to: now };
  }
  if (range === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (range === 'year')  return { from: new Date(now.getFullYear(), 0, 1), to: now };
  return { from: null, to: null };
}

const DATE_PRESETS: { label: string; value: DateRange }[] = [
  { label: 'All Time',   value: 'all'   },
  { label: 'Today',      value: 'today' },
  { label: 'This Week',  value: 'week'  },
  { label: 'This Month', value: 'month' },
  { label: 'This Year',  value: 'year'  },
];

const ROLE_MAP: Record<string, string[]> = {
  pickup:     ['pickup'],
  accountant: ['accountant'],
  admin:      ['admin'],
};

const ACTION_LABELS: Record<string, string> = {
  all:               'All Actions',
  picked_up:         'Picked Up',
  delivered:         'Delivered',
  status_changed:    'Status Changed',
  reassigned:        'Reassigned',
  order_created:     'Order Created',
  invoice_generated: 'Invoice Generated',
  payment_confirmed: 'Payment Confirmed',
  order_cancelled:   'Order Cancelled',
};

const PER_PAGE = 50;

export function ActivityLogPage() {
  const [activities,  setActivities]  = useState<any[]>([]);
  const [staffRows,   setStaffRows]   = useState<any[]>([]);   // for role lookup
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [dateRange,   setDateRange]   = useState<DateRange>('all');
  const [roleFilter,  setRoleFilter]  = useState('all');       // all | pickup | accountant | admin
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [page,       setPage]       = useState(1);
  const [fetchError,  setFetchError]  = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    const [actsResult, staffResult] = await Promise.all([
      supabase.from('staff_activities').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_members').select('id, full_name, role'),
    ]);
    if (actsResult.error)  {
      console.error('[ActivityLog] staff_activities error:', actsResult.error);
      setFetchError(`Could not load activity log: ${actsResult.error.message}`);
    } else {
      setActivities(actsResult.data ?? []);
    }
    if (staffResult.data) setStaffRows(staffResult.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase.channel('admin-activities-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_activities' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  // Build staffId → role lookup
  const roleById = new Map<string, string>(staffRows.map(s => [s.id, s.role]));

  // Unique activity types from real data + known ones
  const knownTypes = Object.keys(ACTION_LABELS).filter(k => k !== 'all');
  const seenTypes  = [...new Set(activities.map(a => a.activity_type).filter(Boolean))];
  const allTypes   = [...new Set([...knownTypes, ...seenTypes])];

  // Filter
  const { from: dateFrom, to: dateTo } = getDateBounds(dateRange);

  const filtered = activities.filter(a => {
    const q = search.toLowerCase();

    const matchSearch = !q
      || a.staff_name?.toLowerCase().includes(q)
      || a.order_id?.toLowerCase().includes(q)
      || a.description?.toLowerCase().includes(q);

    const matchType = typeFilter === 'all' || a.activity_type === typeFilter;

    let matchRole = true;
    if (roleFilter !== 'all') {
      const staffRole = roleById.get(a.staff_id ?? '') ?? '';
      matchRole = staffRole === roleFilter;
    }

    let matchDate = true;
    if (dateFrom && dateTo) {
      const d = new Date(a.created_at);
      matchDate = d >= dateFrom && d <= dateTo;
    }

    return matchSearch && matchType && matchRole && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Activity Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {activities.length} entries
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
          <Activity className="w-3.5 h-3.5" />
          Live feed
        </div>
      </div>

      {/* RLS / fetch error banner */}
      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm font-medium">
          ⚠️ {fetchError} — Run the RLS fix SQL in Supabase SQL Editor.
        </div>
      )}

      {/* Date preset buttons */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => { setDateRange(p.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              dateRange === p.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Calendar className="w-3 h-3" />{p.label}
          </button>
        ))}
      </div>

      {/* Search + role + type filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staff name, order ID, description..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 min-h-[44px]"
          />
        </div>

        {/* Staff role filter */}
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]"><SelectValue placeholder="Staff Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="pickup">Pickup Staff</SelectItem>
            <SelectItem value="accountant">Accountant</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        {/* Action type filter */}
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[190px] min-h-[44px]"><SelectValue placeholder="Action Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {allTypes.map(t => (
              <SelectItem key={t} value={t}>
                {ACTION_LABELS[t] ?? t.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>From → To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No activity found for this filter
                  </TableCell>
                </TableRow>
              ) : paged.map((a, i) => {
                const role = roleById.get(a.staff_id ?? '') ?? '—';
                return (
                  <TableRow key={a.id ?? i}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(a.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{a.staff_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        role === 'admin'      ? 'bg-purple-100 text-purple-800' :
                        role === 'accountant' ? 'bg-green-100 text-green-800'  :
                        role === 'pickup'     ? 'bg-blue-100 text-blue-800'    :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActivityColor(a.activity_type)}`}>
                        {ACTION_LABELS[a.activity_type] ?? a.activity_type?.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.order_id || '—'}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{a.description || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.old_value || a.new_value
                        ? <>{a.old_value || '—'}{' → '}<span className="text-foreground font-medium">{a.new_value || '—'}</span></>
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm bg-muted rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm bg-muted rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
