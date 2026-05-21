/**
 * CustomersPage — Derives customer profiles from the orders table.
 *
 * GROUPING: Union-find on email OR phone.
 *   - Same email → same customer
 *   - Same phone → same customer
 *   - Transitive: A↔B (phone), B↔C (email) → A, B, C all one customer
 *
 * THRESHOLDS:
 *   new       = 1 order
 *   returning = 2–4 orders and < ₦50k spent
 *   vip       = 5+ orders OR ₦50,000+ total spent
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, TrendingUp, Star } from 'lucide-react';
import { supabase, formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/supabase';
import { groupByUnionFind, DerivedCustomer } from '@/lib/customers';

type SortKey = 'total_spent' | 'total_orders' | 'last_order_date';

const TYPE_BADGE: Record<string, string> = {
  new:       'bg-gray-100 text-gray-700',
  returning: 'bg-blue-100 text-blue-700',
  vip:       'bg-yellow-100 text-yellow-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [customers, setCustomers]               = useState<DerivedCustomer[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState('');
  const [sortBy, setSortBy]                     = useState<SortKey>('last_order_date');
  const [selected, setSelected]                 = useState<DerivedCustomer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('order_id, customer_name, email, phone, total_amount, status, payment_status, pickup_date, created_at, address')
      .order('created_at', { ascending: false });
    if (error) console.error('[Customers]', error.message);
    setCustomers(groupByUnionFind(data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const ch = supabase.channel('admin-customers-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchCustomers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCustomers]);

  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase();
      return !q
        || c.name.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q)
        || c.phone.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'last_order_date') {
        return new Date(b.last_order_date ?? 0).getTime() - new Date(a.last_order_date ?? 0).getTime();
      }
      return (b[sortBy] as number) - (a[sortBy] as number);
    });

  // Summary stats
  const totalOrders  = customers.reduce((s, c) => s + c.total_orders, 0);
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const vipCount     = customers.filter(c => c.customer_type === 'vip').length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Unique Customers', value: customers.length,             icon: Users,      color: 'text-blue-600'   },
          { label: 'Total Orders',     value: totalOrders,                  icon: TrendingUp, color: 'text-green-600'  },
          { label: 'VIP Customers',    value: vipCount,                     icon: Star,       color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          {([
            { key: 'last_order_date', label: 'Recent'  },
            { key: 'total_orders',    label: 'Orders'  },
            { key: 'total_spent',     label: 'Spent'   },
          ] as { key: SortKey; label: string }[]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-3 py-2 min-h-[40px] text-xs rounded-lg font-medium transition-all ${
                sortBy === s.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : filtered.map(c => (
                <TableRow
                  key={c.key}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                  <TableCell className="text-sm">{c.phone || '—'}</TableCell>
                  <TableCell className="font-semibold">{c.total_orders}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(c.total_spent)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${TYPE_BADGE[c.customer_type]}`}>
                      {c.customer_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.last_order_date ? formatDate(c.last_order_date) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {customers.length} unique customers · {totalOrders} total orders · grouped by email OR phone
      </p>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-2xl font-black">{selected.total_orders}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Orders</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-base font-black">{formatCurrency(selected.total_spent)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Spent</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className={`text-sm font-black px-2 py-0.5 rounded-full inline-block ${TYPE_BADGE[selected.customer_type]}`}>
                    {selected.customer_type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Type</p>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{selected.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{selected.phone || '—'}</span>
                </div>
              </div>

              {/* Order history */}
              <div>
                <p className="font-bold mb-2">Order History ({selected.orders.length})</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selected.orders.map(o => (
                    <div
                      key={o.order_id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <span className="font-mono text-xs font-bold">{o.order_id}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{formatDate(o.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(o.status)}`}>
                          {o.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="font-semibold text-xs">
                          {o.total_amount ? formatCurrency(o.total_amount) : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
