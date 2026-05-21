import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import { supabase, formatCurrency, formatDate, getStaffUser } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

export function PendingPaymentsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'invoiced')
      .in('payment_status', ['pending', 'unpaid'])
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const ch = supabase.channel('accountant-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const totalPending = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

  const openPaymentModal = (order: any) => {
    setSelectedOrder(order);
    setPaymentMethod('transfer');
    setAmountReceived(String(order.total_amount || 0));
  };

  const totalDue = selectedOrder?.total_amount || 0;
  const amountNum = parseFloat(amountReceived) || 0;
  const isFullPayment = amountNum >= totalDue && totalDue > 0;
  const validationError = !isFullPayment
    ? `Only full payment is accepted. Amount must be ${formatCurrency(totalDue)}.`
    : '';

  const confirmPayment = async () => {
    if (!selectedOrder) return;
    if (!isFullPayment) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: validationError });
      return;
    }
    setConfirming(true);
    const staffUser = getStaffUser();

    try {
      // Get live auth UUID — never rely on stale localStorage id
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const realStaffId = authUser?.id ?? staffUser?.id ?? null;

      const ANON_KEY    = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const CONFIRM_URL = import.meta.env.VITE_CONFIRM_PAYMENT_URL as string;
      const res = await fetch(CONFIRM_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          orderId:       selectedOrder.order_id,
          staffId:       realStaffId,
          staffName:     staffUser?.name || staffUser?.full_name || 'Accountant',
          amountPaid:    parseFloat(amountReceived),
          paymentMethod: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Failed to confirm payment');

      toast({ variant: 'success', title: 'Payment confirmed!', description: 'Order is now ready for delivery.' });
      setSelectedOrder(null);
      fetchOrders();
    } catch {
      toast({ title: 'Error', description: 'Payment could not be confirmed. Please try again or contact support.', variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };


  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Pending Payments</h2>

      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-yellow-800">Total Pending Amount</CardTitle>
          <DollarSign className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-yellow-800">{formatCurrency(totalPending)}</div>
          <div className="text-xs text-yellow-600 mt-1">{orders.length} invoiced orders awaiting payment</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pending payments</TableCell></TableRow>
              ) : orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell className="text-sm">{o.phone}</TableCell>
                  <TableCell className="text-sm">{o.invoice_number || '—'}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(o.total_amount || 0)}</TableCell>
                  <TableCell className="text-sm">{o.invoiced_at ? formatDate(o.invoiced_at) : formatDate(o.created_at)}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => openPaymentModal(o)} className="bg-green-600 hover:bg-green-700 text-white">
                      Mark as Paid
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Payment</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-1 text-sm">
                <div><span className="text-muted-foreground">Order:</span> <span className="font-mono">{selectedOrder.order_id}</span></div>
                <div><span className="text-muted-foreground">Customer:</span> {selectedOrder.customer_name}</div>
                <div><span className="text-muted-foreground">Total Due:</span> <span className="font-bold text-lg">{formatCurrency(selectedOrder.total_amount || 0)}</span></div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="pos">POS Terminal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount Received (₦)</label>
                <Input
                  type="number"
                  value={amountReceived}
                  onChange={e => setAmountReceived(e.target.value)}
                  min={totalDue}
                />
                {validationError && (
                  <p className="text-sm text-red-600 font-medium">{validationError}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Button>
            <Button onClick={confirmPayment} disabled={confirming || !isFullPayment} className="bg-green-600 hover:bg-green-700">
              {confirming ? 'Confirming...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
