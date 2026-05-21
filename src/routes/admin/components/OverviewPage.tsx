import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, AlertTriangle, UserCircle, TrendingUp, Users, Zap } from 'lucide-react';
import { supabase, formatCurrency, formatDateTime, getActivityColor, getStatusColor } from '@/lib/supabase';
import { groupByUnionFind } from '@/lib/customers';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart
} from 'recharts';

export function OverviewPage() {
  const [loading, setLoading]       = useState(true);
  const [orders, setOrders]         = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [ordersRes, activitiesRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_activities').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('invoice_items').select('*'),
    ]);
    if (ordersRes.data)     setOrders(ordersRes.data);
    if (activitiesRes.data) setActivities(activitiesRes.data);
    if (itemsRes.data)      setInvoiceItems(itemsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_activities' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayOrders = orders.filter(o => o.created_at?.startsWith(todayStr));
  const weekOrders = orders.filter(o => new Date(o.created_at) >= startOfWeek);
  const monthOrders = orders.filter(o => new Date(o.created_at) >= startOfMonth);

  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const pendingPayment = orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'unpaid');
  const revenueCollected = paidOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const revenuePending = pendingPayment.reduce((s, o) => s + (o.total_amount || 0), 0);

  const overdueOrders = orders.filter(o => {
    if (o.status !== 'pending') return false;
    const d = new Date(o.pickup_date);
    d.setHours(19);
    return now > d;
  });

  // ── Derive unique customers from orders (same logic as CustomersPage) ────────
  const derivedCustomers = groupByUnionFind(orders);
  const newCustomers = derivedCustomers.filter(c => c.customer_type === 'new');
  const returning    = derivedCustomers.filter(c => c.customer_type === 'returning');
  const vip          = derivedCustomers.filter(c => c.customer_type === 'vip');

  const statusCounts: Record<string, number> = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  const completedToday = orders.filter(o => o.status === 'completed' && o.created_at?.startsWith(todayStr)).length;
  const completedWeek = orders.filter(o => o.status === 'completed' && new Date(o.created_at) >= startOfWeek).length;
  const completedMonth = orders.filter(o => o.status === 'completed' && new Date(o.created_at) >= startOfMonth).length;
  const completedYear = orders.filter(o => o.status === 'completed' && new Date(o.created_at).getFullYear() === now.getFullYear()).length;

  // Top staff
  const staffMap: Record<string, { count: number; name: string }> = {};
  (activities || []).forEach(a => {
    if (!staffMap[a.staff_name]) staffMap[a.staff_name] = { count: 0, name: a.staff_name };
    staffMap[a.staff_name].count++;
  });
  const topStaff = Object.values(staffMap).sort((a, b) => b.count - a.count).slice(0, 3);

  // Revenue chart data
  const getRevenueChartData = () => {
    const grouped: Record<string, { revenue: number; orders: number }> = {};
    orders.forEach(o => {
      let key: string;
      const d = new Date(o.created_at);
      if (chartPeriod === 'daily') key = d.toISOString().split('T')[0];
      else if (chartPeriod === 'weekly') {
        const w = new Date(d); w.setDate(d.getDate() - d.getDay());
        key = w.toISOString().split('T')[0];
      } else if (chartPeriod === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      else key = `${d.getFullYear()}`;
      if (!grouped[key]) grouped[key] = { revenue: 0, orders: 0 };
      grouped[key].orders++;
      if (o.payment_status === 'paid') grouped[key].revenue += o.total_amount || 0;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, data]) => ({ date, ...data }));
  };

  // Status pie data
  const statusPieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: getStatusColor(status),
  }));

  // Top services
  const serviceMap: Record<string, number> = {};
  invoiceItems.forEach(i => {
    serviceMap[i.service_name] = (serviceMap[i.service_name] || 0) + (i.quantity || 1);
  });
  const topServices = Object.entries(serviceMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, qty]) => ({ name, quantity: qty }));

  // Customer trend (last 6 months)
  const customerTrend = () => {
    const months: { month: string; new: number; returning: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      // Use first_order_date (when the customer first appeared) for the trend
      const newC = derivedCustomers.filter(c =>
        c.customer_type === 'new' &&
        c.first_order_date &&
        new Date(c.first_order_date) >= d &&
        new Date(c.first_order_date) < nextMonth
      ).length;
      const retC = derivedCustomers.filter(c =>
        c.customer_type === 'returning' &&
        c.first_order_date &&
        new Date(c.first_order_date) >= d &&
        new Date(c.first_order_date) < nextMonth
      ).length;
      months.push({ month: label, new: newC, returning: retC });
    }
    return months;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Today: {todayOrders.length} · This Week: {weekOrders.length} · This Month: {monthOrders.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(revenueCollected)}</div>
            <div className="text-xs text-muted-foreground mt-1">Pending: {formatCurrency(revenuePending)}</div>
          </CardContent>
        </Card>

        <Card className={overdueOrders.length > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Orders</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${overdueOrders.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueOrders.length > 0 ? 'text-destructive' : ''}`}>
              {overdueOrders.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Past pickup deadline</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <UserCircle className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{derivedCustomers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              New: {newCustomers.length} · Returning: {returning.length} · VIP: {vip.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {['pending', 'picked_up', 'processing', 'invoiced', 'ready', 'delivered', 'completed'].map(s => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(s) }} />
                    <span className="capitalize">{s.replace('_', ' ')}</span>
                  </div>
                  <span className="font-semibold">{statusCounts[s] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Today</span><span className="font-semibold">{completedToday}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This Week</span><span className="font-semibold">{completedWeek}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This Month</span><span className="font-semibold">{completedMonth}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This Year</span><span className="font-semibold">{completedYear}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Staff</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            {topStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {topStaff.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{s.name}</span>
                    <Badge variant="secondary" className="text-xs">{s.count} actions</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
            <Zap className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left text-sm px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition">
              View Overdue ({overdueOrders.length})
            </button>
            <button className="w-full text-left text-sm px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
              Export Orders (soon)
            </button>
            <button
              onClick={() => window.open('https://your-n8n-instance.app.n8n.cloud', '_blank')}
              className="w-full text-left text-sm px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
            >
              Add Staff
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Revenue Trend</CardTitle>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-2 py-1 text-xs rounded ${chartPeriod === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={getRevenueChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="right" dataKey="orders" fill="hsl(217, 91%, 60%)" opacity={0.3} name="Orders" />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="Revenue (₦)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {topServices.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No invoice data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topServices} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New vs Returning Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customerTrend()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="new" stroke="hsl(217, 91%, 60%)" strokeWidth={2} name="New" />
                  <Line type="monotone" dataKey="returning" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="Returning" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getActivityColor(a.activity_type)}`}>
                    {a.activity_type?.replace('_', ' ')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{a.staff_name}</span>
                    <span className="text-muted-foreground"> — {a.description || a.activity_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
