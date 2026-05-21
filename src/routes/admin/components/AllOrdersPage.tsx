/**
 * AllOrdersPage — Full order management with:
 * - Date filtering: Today / This Week / This Month / This Year / Custom range
 * - Status + payment filters
 * - Search
 * - Reassign order to any pickup staff
 * - Full order detail dialog with timestamps
 * - CSV export
 * - Pagination
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, UserCog, X, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { supabase, formatCurrency, formatDate, formatDateTime, getStatusBadgeClass, getStaffUser } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const REASSIGN_URL = import.meta.env.VITE_REASSIGN_ORDER_URL as string;

// ── Date filter helpers ───────────────────────────────────────────────────────

type DateRange = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

function getDateBounds(range: DateRange, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'today') return { from: today, to: now };

  if (range === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    return { from: mon, to: now };
  }

  if (range === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }

  if (range === 'year') {
    return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }

  if (range === 'custom' && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo + 'T23:59:59') };
  }

  return { from: null, to: null };
}

// ── Reassign Modal ────────────────────────────────────────────────────────────

function ReassignModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const [staffList, setStaffList]     = useState<any[]>([]);
  const [selectedId, setSelectedId]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const currentAdmin                  = getStaffUser();

  useEffect(() => {
    supabase.from('staff_members')
      .select('id, full_name, email, role, active, availability_status')
      .eq('active', true)
      .eq('role', 'pickup')
      .order('full_name')
      .then(({ data }) => { if (data) setStaffList(data); });
  }, []);

  const [confirming, setConfirming] = useState(false);
  const selectedStaff = staffList.find(s => s.id === selectedId);

  const handleReassign = async () => {
    if (!selectedId) { setError('Please select a staff member.'); return; }
    if (!confirming) { setConfirming(true); return; }   // first click → show confirm
    setError(null);
    setSubmitting(true);
    try {
      if (REASSIGN_URL && !REASSIGN_URL.includes('undefined')) {
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res  = await fetch(REASSIGN_URL, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ orderId: order.order_id, newStaffId: selectedId, reassignedByName: currentAdmin?.name || 'Admin' }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Reassignment failed');
      } else {
        // Fallback: direct DB update (no email sent)
        const staff = staffList.find(s => s.id === selectedId);
        const { error: dbErr } = await supabase.from('orders').update({
          assigned_staff_id:  selectedId,
          assigned_to_name:   staff?.full_name,
          reassigned_at:      new Date().toISOString(),
          reassigned_by_name: currentAdmin?.name || 'Admin',
          updated_at:         new Date().toISOString(),
        }).eq('order_id', order.order_id);
        if (dbErr) throw new Error(dbErr.message);
        toast({ title: 'Note', description: 'Assigned (no email — VITE_REASSIGN_ORDER_URL not configured).' });
      }
      const staff = staffList.find(s => s.id === selectedId);
      toast({ title: 'Order Reassigned', description: `${order.order_id} assigned to ${staff?.full_name}` });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reassign order.');
    } finally {
      setSubmitting(false);
    }
  };

  const AVAIL_BADGE: Record<string, string> = {
    available: 'text-emerald-700', on_leave: 'text-amber-600', sick: 'text-red-600',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Reassign Order</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Assign <span className="font-mono font-bold text-gray-900">{order.order_id}</span> to:</p>
        <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
          {staffList.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">Loading staff...</p>
            : staffList.map(s => (
              <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="staff" value={s.id} checked={selectedId === s.id} onChange={() => setSelectedId(s.id)} className="text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{s.full_name}</p>
                  <p className={`text-xs ${AVAIL_BADGE[s.availability_status || 'available']}`}>
                    {(s.availability_status || 'available').replace('_', ' ')} · {s.role}
                  </p>
                </div>
              </label>
            ))}
        </div>
        {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
        {confirming && selectedStaff && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-sm text-amber-800">
            Assign <strong>{order.order_id}</strong> to <strong>{selectedStaff.full_name}</strong>? They will receive an email notification.
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => confirming ? setConfirming(false) : onClose()} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">
            {confirming ? 'Back' : 'Cancel'}
          </button>
          <button onClick={handleReassign} disabled={submitting || !selectedId}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</> : confirming ? 'Confirm Assign' : <><UserCog className="w-4 h-4" /> Assign</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DATE_PRESETS: { label: string; value: DateRange }[] = [
  { label: 'All Time',   value: 'all'   },
  { label: 'Today',      value: 'today' },
  { label: 'This Week',  value: 'week'  },
  { label: 'This Month', value: 'month' },
  { label: 'This Year',  value: 'year'  },
  { label: 'Custom',     value: 'custom'},
];

export function AllOrdersPage() {
  const [orders, setOrders]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateRange, setDateRange]     = useState<DateRange>('all');
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo, setCustomTo]       = useState('');
  const [page, setPage]               = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [reassignOrder, setReassignOrder] = useState<any>(null);
  const perPage = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    const ch = supabase.channel('admin-orders-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  // Filter
  const { from: dateFrom, to: dateTo } = getDateBounds(dateRange, customFrom, customTo);
  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch  = !q || o.order_id?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) || o.phone?.includes(q);
    const matchStatus  = statusFilter === 'all'  || o.status === statusFilter;
    const matchPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    let   matchDate    = true;
    if (dateFrom && dateTo) {
      const d = new Date(o.created_at);
      matchDate = d >= dateFrom && d <= dateTo;
    }
    return matchSearch && matchStatus && matchPayment && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // CSV export
  const exportCSV = () => {
    const headers = ['Order ID','Customer','Phone','Email','Address','Pickup Date','Time Slot','Status','Payment','Total','Assigned To','Picked Up By','Delivered By','Created At'];
    const rows    = filtered.map(o => [
      o.order_id, o.customer_name, o.phone, o.email, o.address, o.pickup_date,
      o.pickup_time_slot, o.status, o.payment_status, o.total_amount || '',
      o.assigned_to_name || '', o.picked_up_by_name || '', o.delivered_by_name || '',
      o.created_at,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `freshpress-orders-${dateRange}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <>
      {reassignOrder && (
        <ReassignModal
          order={reassignOrder}
          onClose={() => setReassignOrder(null)}
          onSuccess={fetchOrders}
        />
      )}

      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Orders</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {filtered.length} of {orders.length} orders
            </p>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80 min-h-[44px]">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Date range preset buttons */}
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.value} onClick={() => { setDateRange(p.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${dateRange === p.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              <Calendar className="w-3 h-3" />{p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {dateRange === 'custom' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-700 shrink-0">From:</span>
              <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-700 shrink-0">To:</span>
              <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]" />
            </div>
          </div>
        )}

        {/* Search + Status + Payment filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by order ID, name, email, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 min-h-[44px]" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {['pending','picked_up','processing','invoiced','ready','delivered','completed'].map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]"><SelectValue placeholder="Payment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status / Tracking</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No orders found</TableCell></TableRow>
                ) : paged.map(o => (
                  <TableRow key={o.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(o.created_at)}</TableCell>
                    <TableCell className="font-medium">{o.customer_name}</TableCell>
                    <TableCell className="text-sm">{o.phone}</TableCell>
                    <TableCell className="text-sm">
                      {o.assigned_to_name
                        ? <span className="text-emerald-700 font-medium">{o.assigned_to_name}</span>
                        : <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(o.status)}`}>{o.status?.replace(/_/g, ' ')}</span>
                        {o.picked_up_by_name && <p className="text-xs text-muted-foreground">↑ {o.picked_up_by_name} · {formatDate(o.picked_up_at)}</p>}
                        {o.delivered_by_name  && <p className="text-xs text-muted-foreground">✓ {o.delivered_by_name} · {formatDate(o.delivered_at)}</p>}
                      </div>
                    </TableCell>
                    <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(o.payment_status)}`}>{o.payment_status}</span></TableCell>
                    <TableCell className="font-semibold">{o.total_amount ? formatCurrency(o.total_amount) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedOrder(o)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View details">
                          <Search className="w-4 h-4" />
                        </button>
                        <button onClick={() => setReassignOrder(o)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Reassign order">
                          <UserCog className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-mono">{selectedOrder?.order_id}</DialogTitle></DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Customer',    selectedOrder.customer_name],
                    ['Phone',       selectedOrder.phone],
                    ['Email',       selectedOrder.email],
                    ['Status',      selectedOrder.status?.replace(/_/g, ' ')],
                    ['Payment',     selectedOrder.payment_status],
                    ['Total',       selectedOrder.total_amount ? formatCurrency(selectedOrder.total_amount) : '—'],
                    ['Pickup Date', formatDate(selectedOrder.pickup_date)],
                    ['Time Slot',   selectedOrder.pickup_time_slot || '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className="font-semibold mt-0.5 capitalize">{val}</p>
                    </div>
                  ))}
                </div>
                {selectedOrder.address && <div className="bg-muted/30 rounded-lg p-2.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Address</p><p className="font-semibold mt-0.5">{selectedOrder.address}</p></div>}

                {/* Staff tracking */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Staff Tracking</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Assigned To',  selectedOrder.assigned_to_name || '—'],
                      ['Picked Up By', selectedOrder.picked_up_by_name || '—'],
                      ['Delivered By', selectedOrder.delivered_by_name  || '—'],
                      ['Reassigned By', selectedOrder.reassigned_by_name || '—'],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="font-semibold mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="border-t pt-3 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Timestamps</p>
                  {[
                    ['Created',    selectedOrder.created_at],
                    ['Picked Up',  selectedOrder.picked_up_at],
                    ['Delivered',  selectedOrder.delivered_at],
                    ['Reassigned', selectedOrder.reassigned_at],
                    ['Updated',    selectedOrder.updated_at],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{formatDateTime(val as string)}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => { setSelectedOrder(null); setReassignOrder(selectedOrder); }}
                  className="w-full flex items-center justify-center gap-2 border border-indigo-200 text-indigo-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors">
                  <UserCog className="w-4 h-4" /> Reassign This Order
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
