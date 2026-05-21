import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign } from 'lucide-react';
import { supabase, formatCurrency, formatDate, formatDateTime } from '@/lib/supabase';

export function PaymentHistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'paid')
      .order('paid_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const ch = supabase.channel('accountant-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayTotal = orders.filter(o => o.paid_at?.startsWith(todayStr)).reduce((s, o) => s + (o.total_amount || 0), 0);
  const weekTotal = orders.filter(o => new Date(o.paid_at) >= startOfWeek).reduce((s, o) => s + (o.total_amount || 0), 0);
  const monthTotal = orders.filter(o => new Date(o.paid_at) >= startOfMonth).reduce((s, o) => s + (o.total_amount || 0), 0);

  const filtered = methodFilter === 'all' ? orders : orders.filter(o => o.payment_method === methodFilter);

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Payment History</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Today', amount: todayTotal },
          { label: 'This Week', amount: weekTotal },
          { label: 'This Month', amount: monthTotal },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{formatCurrency(s.amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Payment Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="pos">POS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Paid At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payment history</TableCell></TableRow>
              ) : filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell className="font-semibold text-green-700">{formatCurrency(o.total_amount || 0)}</TableCell>
                  <TableCell className="text-sm capitalize">{o.payment_method?.replace('_', ' ') || '—'}</TableCell>
                  <TableCell className="text-sm">{o.paid_at ? formatDateTime(o.paid_at) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
