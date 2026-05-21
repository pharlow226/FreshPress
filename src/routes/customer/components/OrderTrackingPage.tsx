/**
 * OrderTrackingPage — updated for merged app
 * Changes: raw fetch → Supabase SDK, shared status lib, shared types
 *          invoice section with conditional display + company bank details
 */
import { useState } from 'react';
import { Search, Loader2, FileText, Package, Download, CheckCircle } from 'lucide-react';
import { supabase, formatTimestamp } from '@/lib/supabase';
import { STATUS_STEPS, STATUS_ORDER, TIME_SLOT_LABELS, getStepTimestamp } from '@/lib/status';
import LoadingMessage from '@/components/shared/LoadingMessage';
import type { Order } from '@/types';

const MSGS = ['Looking up your order...', 'Fetching latest status...', 'Almost there...'];

interface CompanyInfo {
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  company_whatsapp?: string | null;
}

const OrderTrackingPage = () => {
  const [orderId,  setOrderId]  = useState('');
  const [order,    setOrder]    = useState<Order | null>(null);
  const [company,  setCompany]  = useState<CompanyInfo | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const trackOrder = async () => {
    if (!orderId.trim()) return;
    setLoading(true); setError(''); setOrder(null); setCompany(null);
    try {
      const [{ data, error: dbError }, { data: companyRows }] = await Promise.all([
        supabase.from('orders').select('*').eq('order_id', orderId.trim().toUpperCase()).single(),
        supabase.from('company_info').select('account_name,account_number,bank_name,company_whatsapp').limit(1),
      ]);
      if (dbError || !data) { setError('Order not found. Please check your Order ID.'); return; }
      setOrder(data as Order);
      if (companyRows?.length) setCompany(companyRows[0] as CompanyInfo);
    } catch {
      setError('Unable to track order. Please try again or call us at +234 811 314 3272');
    } finally { setLoading(false); }
  };

  const getStepIndex = (s: string) => STATUS_ORDER.indexOf(s as any);
  const currentIdx  = order ? getStepIndex(order.status) : -1;

  /* ── Invoice section logic ─────────────────────────────────── */
  const renderInvoiceSection = () => {
    if (!order) return null;
    const isPaid      = order.payment_status === 'paid';
    const { status }  = order;

    // Hide: still being processed
    if (['pending', 'picked_up', 'processing'].includes(status)) return null;
    // Hide: paid but still in early progress stages (edge-case guard)
    if (isPaid && ['pending', 'picked_up', 'processing'].includes(status)) return null;

    // Summary only: delivered/completed + paid
    if (['delivered', 'completed'].includes(status) && isPaid) {
      return (
        <div className="bg-success/10 border-2 border-success/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          <p className="text-success font-semibold text-sm">
            {order.invoice_number ? <>Invoice: <span className="font-black">{order.invoice_number}</span> — Paid ✓</> : 'Invoice — Paid ✓'}
          </p>
        </div>
      );
    }

    // Full invoice section: invoiced or ready + unpaid
    if (['invoiced', 'ready'].includes(status) && !isPaid) {
      const hasBank = company?.account_number || company?.account_name;
      return (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 space-y-4">

          {/* Header */}
          <div className="flex items-center gap-2 border-b border-blue-200 pb-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h4 className="font-bold text-blue-800">Invoice Ready — Payment Required</h4>
          </div>

          {/* Invoice number + total */}
          <div className="space-y-1">
            {order.invoice_number && (
              <p className="text-sm text-blue-700">
                Invoice: <span className="font-semibold">{order.invoice_number}</span>
              </p>
            )}
            {order.total_amount != null && (
              <p className="text-2xl font-black text-blue-900">
                ₦{order.total_amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                <span className="text-sm font-normal text-blue-600 ml-1">Total Due</span>
              </p>
            )}
          </div>

          {/* Payment instructions */}
          {hasBank && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">
                How to Pay
              </p>
              <p className="text-sm text-gray-600">Transfer the exact amount above to:</p>
              {company?.account_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-semibold text-gray-800">{company.account_name}</span>
                </div>
              )}
              {company?.account_number && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account Number</span>
                  <span className="font-bold font-mono text-gray-900 tracking-wider">{company.account_number}</span>
                </div>
              )}
              {company?.bank_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-semibold text-gray-800">{company.bank_name}</span>
                </div>
              )}
              {company?.company_whatsapp && (
                <p className="text-sm text-gray-600 border-t border-blue-100 pt-2 mt-2">
                  After payment, send your receipt to WhatsApp:{' '}
                  <a
                    href={`https://wa.me/${company.company_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-green-700 hover:underline"
                  >
                    {company.company_whatsapp}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Download button */}
          {order.invoice_pdf_url && (
            <a
              href={order.invoice_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 hover:shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Download Invoice PDF
            </a>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6 md:mb-8">
        <h2 className="text-3xl md:text-4xl font-black text-brand mb-2 md:mb-3">Track Your Order</h2>
        <p className="text-muted-foreground text-base md:text-lg">Enter your Order ID to see real-time status updates</p>
      </div>

      <div className="bg-card rounded-2xl md:rounded-3xl shadow-2xl p-5 md:p-8 border-2 border-brand-accent-light mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" value={orderId} onChange={e => { setOrderId(e.target.value); if (error) setError(''); }}
            placeholder="Enter Order ID (e.g., LAU-384921)"
            className="flex-1 px-4 py-3 border-2 border-border rounded-xl focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent-light transition-all bg-card text-sm md:text-base"
            onKeyDown={e => e.key === 'Enter' && trackOrder()} disabled={loading} />
          <button onClick={trackOrder} disabled={loading || !orderId.trim()}
            className="bg-gradient-to-r from-brand-accent to-[hsl(240,50%,50%)] text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Searching...' : 'Track'}
          </button>
        </div>
        {loading && <LoadingMessage messages={MSGS} />}
        {error && <div className="bg-destructive/10 border-2 border-destructive/30 text-destructive px-4 py-3 rounded-xl mt-4"><p>{error}</p></div>}
      </div>

      {order && (
        <div className="bg-card rounded-3xl shadow-2xl border-2 border-brand-accent-light overflow-hidden">
          <div className="bg-gradient-to-r from-[hsl(var(--brand-gradient-from))] via-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-primary-foreground p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm opacity-70">Order Details</p><p className="text-2xl font-black">{order.order_id}</p></div>
              <Package className="w-10 h-10 opacity-50" />
            </div>
          </div>
          <div className="p-6 space-y-6">
            {order.delay_reason && order.status === 'pending' && (
              <div className="bg-[hsl(45,100%,95%)] border-2 border-[hsl(45,100%,60%)] rounded-xl p-4">
                <h4 className="text-[hsl(45,80%,30%)] font-bold">Pickup Rescheduled</h4>
                <p className="text-[hsl(45,60%,30%)] mt-1"><strong>Reason:</strong> {order.delay_reason}</p>
                <p className="text-[hsl(45,60%,30%)] mt-1"><strong>New Date:</strong> {order.pickup_date}</p>
                <p className="text-[hsl(45,60%,30%)] mt-1"><strong>Time Slot:</strong> {TIME_SLOT_LABELS[order.pickup_time_slot || ''] || order.pickup_time_slot}</p>
              </div>
            )}

            {/* Order Progress */}
            <div>
              <h4 className="font-bold text-brand mb-4">Order Progress</h4>
              <div className="relative">
                {STATUS_STEPS.map((step, i) => {
                  const stepIdx     = getStepIndex(step.key);
                  const isCompleted = stepIdx < currentIdx;
                  const isCurrent   = step.key === order.status || (order.status === 'completed' && step.key === 'delivered');
                  const isReached   = isCompleted || isCurrent;
                  const ts          = formatTimestamp(getStepTimestamp(order, step.key));
                  const isLast      = i === STATUS_STEPS.length - 1;
                  return (
                    <div key={step.key} className="flex gap-3 relative">
                      {!isLast && <div className={`absolute left-[14px] top-8 w-0.5 h-full -z-0 ${isCompleted ? 'bg-success' : 'bg-border'}`} />}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 ${isCompleted ? 'bg-success text-success-foreground' : isCurrent ? 'bg-brand-accent text-white ring-4 ring-brand-accent-light' : 'bg-muted text-muted-foreground border-2 border-border'}`}>
                        {isCompleted ? '✓' : i + 1}
                      </div>
                      <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-semibold text-sm ${isCurrent ? 'text-brand-accent' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>{step.label}</p>
                          {isCurrent && <span className="text-[10px] bg-brand-accent text-white px-2 py-0.5 rounded-full font-bold">Current</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{ts || (isReached ? 'Completed' : 'Pending')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Information */}
            <div className="border-t border-border pt-5">
              <h4 className="font-bold text-brand mb-3 text-sm">Order Information</h4>
              <dl className="divide-y divide-border rounded-xl bg-muted/30 overflow-hidden">
                <div className="flex justify-between gap-4 px-4 py-2.5 text-sm"><dt className="text-muted-foreground">Customer</dt><dd className="font-semibold text-foreground text-right">{order.customer_name}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">Pickup</dt>
                  <dd className="font-semibold text-foreground text-right">{order.pickup_date}
                    {order.pickup_time_slot && <span className="block text-xs text-muted-foreground font-normal">{TIME_SLOT_LABELS[order.pickup_time_slot] || order.pickup_time_slot}</span>}
                  </dd>
                </div>
                {order.delivery_date && <div className="flex justify-between gap-4 px-4 py-2.5 text-sm"><dt className="text-muted-foreground">Delivery</dt><dd className="font-semibold text-foreground text-right">{order.delivery_date}</dd></div>}
                <div className="flex justify-between items-center gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${order.payment_status === 'paid' ? 'bg-success-light text-success' : 'bg-amber-light text-amber'}`}>{order.payment_status?.toUpperCase() || 'UNPAID'}</span></dd>
                </div>
                {order.total_amount != null && <div className="flex justify-between gap-4 px-4 py-2.5 text-sm"><dt className="text-muted-foreground">Total</dt><dd className="font-bold text-brand text-right">₦{order.total_amount.toLocaleString()}</dd></div>}
                {order.special_instructions && <div className="px-4 py-2.5 text-sm"><dt className="text-muted-foreground mb-1">Special Instructions</dt><dd className="text-foreground italic">"{order.special_instructions}"</dd></div>}
              </dl>
            </div>

            {/* Invoice Section */}
            {renderInvoiceSection()}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTrackingPage;
