/**
 * Staff Dashboard — Pickup staff view
 *
 * Shows orders assigned to the logged-in pickup staff member.
 * Actions: Mark as Picked Up, Mark as Delivered.
 * Also shows availability status toggle and recent activity.
 *
 * Auth guard: redirects to /login if no session,
 *             redirects to /admin if role is admin,
 *             redirects to /accountant if role is accountant.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, CheckCircle2, Truck, LogOut, Loader2,
  AlertCircle, Shirt, Clock, MapPin, Phone, Mail,
  RefreshCw, Activity, ChevronDown, ChevronUp,
  Plus, Trash2, FileText, Receipt, X, Pencil
} from 'lucide-react';
import { supabase, getStaffUser, clearStaffUser, setStaffUser, formatDateTime, formatDate, getStatusBadgeClass } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ProfileEditModal } from '@/components/shared/ProfileEditModal';

const DELAY_EDGE_URL     = import.meta.env.VITE_MARK_ORDER_DELAYED_URL as string;
const PICKUP_EDGE_URL    = import.meta.env.VITE_MARK_PICKED_UP_URL     as string;
const INVOICE_EDGE_URL   = import.meta.env.VITE_GENERATE_INVOICE_URL   as string;
const DELIVERED_EDGE_URL = import.meta.env.VITE_MARK_DELIVERED_URL     as string;
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY      as string;

/**
 * Headers required by Supabase Edge Function gateway.
 * Without apikey + Authorization the gateway returns 401 with NO CORS headers,
 * causing the browser to throw a network TypeError instead of a readable error.
 */
function edgeFetchHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  serviceCode:  string;
  name:         string;
  quantity:     number;
  unit:         string;
  pricePerUnit: number;
}

type AvailStatus = 'available' | 'on_leave' | 'sick';

const AVAIL_STYLES: Record<AvailStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  on_leave:  'bg-amber-100 text-amber-800',
  sick:      'bg-red-100 text-red-800',
};
const AVAIL_LABELS: Record<AvailStatus, string> = {
  available: 'Available',
  on_leave:  'On Leave',
  sick:      'Sick',
};

const SLOT_LABELS: Record<string, string> = {
  morning:   'Morning (9AM–12PM)',
  afternoon: 'Afternoon (1PM–4PM)',
  evening:   'Evening (4PM–7PM)',
};

// Slot end hours (24h) — order is overdue after this time on pickup_date
const SLOT_END_HOUR: Record<string, number> = {
  morning:   12,
  afternoon: 16,
  evening:   19,
};

/** Returns true if the pickup window has already passed */
function isOrderOverdue(order: any): boolean {
  if (!order.pickup_date) return false;
  const slotEnd = SLOT_END_HOUR[order.pickup_time_slot] ?? 19;
  const deadline = new Date(order.pickup_date);
  deadline.setHours(slotEnd, 0, 0, 0);
  return new Date() > deadline;
}

// ── Reschedule / Delay form modal ────────────────────────────────────────────

// ── Generate Invoice modal ────────────────────────────────────────────────────

function GenerateInvoiceModal({
  order, onClose, onSuccess,
}: {
  order: any;
  onClose: () => void; onSuccess: () => void;
}) {
  const [pricing,     setPricing]     = useState<any[]>([]);
  const [items,       setItems]       = useState<LineItem[]>([
    { serviceCode: '', name: '', quantity: 1, unit: 'piece', pricePerUnit: 0 },
  ]);
  const [discount,    setDiscount]    = useState(0);
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null); // shown inline
  const [done,        setDone]        = useState(false);

  useEffect(() => {
    // Use 'active' column — matches what admin writes via togglePricingActive()
    supabase
      .from('pricing')
      .select('*')
      .eq('active', true)
      .order('service_name')
      .then(({ data }) => { if (data?.length) setPricing(data); });
  }, []);

  const selectService = (i: number, code: string) => {
    const p = pricing.find(x => x.service_code === code);
    if (!p) return;
    setItems(prev => prev.map((item, idx) =>
      idx === i
        ? { ...item, serviceCode: p.service_code, name: p.service_name, unit: p.unit || 'piece', pricePerUnit: Number(p.price) }
        : item
    ));
  };

  const updateQty = (i: number, v: number) =>
    setItems(prev => prev.map((item, idx) =>
      idx === i ? { ...item, quantity: Math.max(1, v) } : item
    ));

  const addItem    = () => setItems(prev => [...prev, { serviceCode: '', name: '', quantity: 1, unit: 'piece', pricePerUnit: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const subtotal      = items.reduce((s, it) => s + it.quantity * it.pricePerUnit, 0);
  const discountAmt   = Math.min(discount, subtotal);
  const taxable       = subtotal - discountAmt;
  const vat           = taxable * 0.075;
  const total         = taxable + vat;

  const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Inline validation — shown inside the scrollable area
    if (items.length === 0)               { setValidationError('Add at least one item.'); return; }
    if (items.some(it => !it.serviceCode)) { setValidationError('Select a service for every line item.'); return; }
    if (items.some(it => it.quantity < 1)) { setValidationError('Quantity must be at least 1 for all items.'); return; }

    setSubmitting(true);
    try {
      if (!INVOICE_EDGE_URL) {
        toast({ variant: 'destructive', title: 'Configuration error', description: 'Invoice function URL is not set. Contact your administrator.' });
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const realStaffId = authUser?.id;
      const staffUser = JSON.parse(localStorage.getItem('staff_user') || '{}');

      let res: Response;
      try {
        res = await fetch(INVOICE_EDGE_URL, {
          method:  'POST',
          headers: edgeFetchHeaders(),
          body: JSON.stringify({
            orderId:   order.order_id,
            staffId:   realStaffId ?? staffUser.id,
            staffName: staffUser.name,
            discount:  discountAmt,
            notes:     notes.trim(),
            items: items.map(it => ({
              service_code: it.serviceCode,
              service:      it.name,
              quantity:     it.quantity,
              unit:         it.unit,
              unit_price:   it.pricePerUnit,
              subtotal:     it.quantity * it.pricePerUnit,
            })),
          }),
        });
      } catch {
        toast({
          variant:     'destructive',
          title:       'Cannot reach invoice service',
          description: 'The edge function is not deployed or unreachable. Deploy it in Supabase and try again.',
        });
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({
          variant:     'destructive',
          title:       'Invoice failed',
          description: data.message ?? 'Invoice generation failed. Please try again.',
        });
        return;
      }

      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch (err: any) {
      toast({
        variant:     'destructive',
        title:       'Unexpected error',
        description: err.message ?? 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" /> Generate Invoice
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {order.order_id} &middot; {order.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="font-bold text-lg text-emerald-700">Invoice Sent!</p>
            <p className="text-sm text-gray-500">Customer has been notified via WhatsApp and email.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">

              {/* Inline validation error — shown above items, in the scrollable zone */}
              {validationError && (
                <ErrorBanner
                  message={validationError}
                  onDismiss={() => setValidationError(null)}
                />
              )}

              {items.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={item.serviceCode}
                    onChange={e => selectService(i, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[40px]"
                  >
                    <option value="">Select service...</option>
                    {pricing.length === 0 && <option disabled>Loading services...</option>}
                    {pricing.map(p => (
                      <option key={p.service_code} value={p.service_code}>
                        {p.service_name} — {fmt(Number(p.price))} / {p.unit || 'piece'}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                      <input
                        type="number" min={1} value={item.quantity}
                        onChange={e => updateQty(i, parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Unit price</label>
                      <p className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium min-h-[40px] flex items-center">
                        {fmt(item.pricePerUnit)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Subtotal</label>
                      <p className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm font-bold text-blue-700 min-h-[40px] flex items-center">
                        {fmt(item.quantity * item.pricePerUnit)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addItem}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:border-blue-300 hover:text-blue-600 transition">
                <Plus className="w-4 h-4" /> Add Item
              </button>

              {/* Discount & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Discount (optional)</label>
                  <input
                    type="number" min={0} value={discount || ''}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optional)</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Handle silk with care"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Totals + footer */}
            <div className="border-t border-gray-100 p-5 space-y-3 shrink-0 bg-gray-50 rounded-b-2xl">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount</span><span className="font-medium">-{fmt(discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>VAT (7.5%)</span><span className="font-medium">{fmt(vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
                  <span>Total</span><span>{fmt(total)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 disabled:opacity-60">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || total === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    : <><FileText className="w-4 h-4" /> Generate & Send Invoice</>}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RescheduleModal({
  order, staffUser, mode, onClose, onSuccess,
}: {
  order: any; staffUser: any; mode: 'delay' | 'reschedule';
  onClose: () => void; onSuccess: () => void;
}) {
  const PRESET_REASONS = [
    'Vehicle breakdown',
    'Traffic delay',
    'Staff unavailable',
    'Weather conditions',
    'Customer unavailable',
    'Other',
  ];

  const [presetReason, setPresetReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [slot,    setSlot]    = useState('morning');
  const [saving,  setSaving]  = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null); // inline only

  const today = new Date().toISOString().split('T')[0];
  const isOther = presetReason === 'Other';
  const finalReason = isOther ? customReason.trim() : presetReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!presetReason)  { setValidationError('Please select a reason.'); return; }
    if (!finalReason)   { setValidationError('Please describe the reason.'); return; }
    if (!newDate)       { setValidationError('Please select a new pickup date.'); return; }

    setSaving(true);
    try {
      let res: Response;
      try {
      res = await fetch(DELAY_EDGE_URL, {
          method:  'POST',
          headers: edgeFetchHeaders(),
          body: JSON.stringify({
            orderId:       order.order_id,
            staffId:       staffUser.id,
            staffName:     staffUser.name,
            delayReason:   finalReason,
            newPickupDate: newDate,
            newTimeSlot:   slot,
          }),
        });
      } catch {
        toast({ variant: 'destructive', title: 'Connection failed', description: 'Could not reach the server. Check your internet connection and try again.' });
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ variant: 'destructive', title: 'Action failed', description: data.message ?? 'Failed to reschedule. Please try again.' });
        return;
      }
      toast({
        variant:     'success',
        title:       mode === 'delay' ? 'Marked as Delayed' : 'Rescheduled',
        description: `Order ${order.order_id} — customer has been notified.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Unexpected error', description: err.message ?? 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`p-5 rounded-t-2xl ${ mode === 'reschedule' ? 'bg-red-50' : 'bg-amber-50' }`}>
          <h3 className={`font-bold text-lg ${ mode === 'reschedule' ? 'text-red-800' : 'text-amber-800' }`}>
            {mode === 'reschedule' ? 'Reschedule Pickup' : 'Mark as Delayed'}
          </h3>
          <p className={`text-sm mt-1 ${ mode === 'reschedule' ? 'text-red-600' : 'text-amber-600' }`}>
            Order <strong>{order.order_id}</strong> · {order.customer_name}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Reason for {mode === 'delay' ? 'delay' : 'rescheduling'} *
            </label>
            <select
              value={presetReason}
              onChange={e => { setPresetReason(e.target.value); setCustomReason(''); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="">Select reason...</option>
              {PRESET_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Free-text shown only when Other is selected */}
            {isOther && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Describe the reason..."
                className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Pickup Date *</label>
            <input
              type="date"
              min={today}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Time Slot *</label>
            <select
              value={slot}
              onChange={e => setSlot(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="morning">Morning (9AM–12PM)</option>
              <option value="afternoon">Afternoon (1PM–4PM)</option>
              <option value="evening">Evening (4PM–7PM)</option>
            </select>
          </div>
          {validationError && (
            <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2 ${
                mode === 'reschedule' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Confirm & Notify Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, body, confirmLabel, onConfirm, onCancel, danger,
}: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:shadow-lg'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order, staffUser, onRefresh,
}: { order: any; staffUser: any; onRefresh: () => void }) {
  const [confirm,     setConfirm]     = useState<ActionKey | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // For delay/reschedule we open the RescheduleModal instead of a plain confirm
  const [rescheduleMode, setRescheduleMode] = useState<'delay' | 'reschedule' | null>(null);

  const canPickup     = order.status === 'pending';
  const canDeliver    = order.status === 'ready';
  const overdue       = canPickup && isOrderOverdue(order);
  // Mark as Delayed shows for ALL pending orders (overdue ones are still pending in DB)
  const canDelay      = canPickup;
  // Reschedule = pending AND already past pickup window (overdue)
  const canReschedule = canPickup && overdue;

  const doStatusUpdate = async (newStatus: string, label: string, note?: string) => {
    setConfirm(null);
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('orders').update({
        status: newStatus,
        updated_at: now,
        ...(note ? { delay_reason: note } : {}),
      }).eq('order_id', order.order_id);
      if (error) throw new Error(error.message);

      // Log activity
      await supabase.from('staff_activities').insert({
        staff_id:      staffUser.id,
        staff_name:    staffUser.name,
        activity_type: 'status_changed',
        order_id:      order.order_id,
        description:   `Order ${order.order_id} marked as ${label} by ${staffUser.name}`,
        old_value:     order.status,
        new_value:     newStatus,
        created_at:    now,
      });

      toast({ title: label, description: `Order ${order.order_id} marked as ${label.toLowerCase()}` });
      setActionError(null);
      onRefresh();
    } catch (err: any) {
      setActionError('Something went wrong. Please try again.');
      setExpanded(true); // keep card open so user sees error
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (action: 'pickup' | 'deliver') => {
    setConfirm(null);
    setLoading(true);
    try {
      // Always get the real auth UUID from the live session —
      // never rely on localStorage (staffUser.id) which is a display cache.
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authUser?.id) {
        setActionError('Could not verify your session. Please log out and log back in.');
        setExpanded(true);
        setLoading(false);
        return;
      }
      const realStaffId = authUser.id;

      console.debug('[FreshPress] doAction:', {
        action,
        orderId:   order.order_id,
        staffId:   realStaffId,
        staffName: staffUser.name,
      });

      const url  = action === 'pickup' ? PICKUP_EDGE_URL : DELIVERED_EDGE_URL;
      const res  = await fetch(url, {
        method:  'POST',
        headers: edgeFetchHeaders(),
        body:    JSON.stringify({
          orderId:   order.order_id,
          staffId:   realStaffId,
          staffName: staffUser.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? `Failed to mark as ${action === 'pickup' ? 'picked up' : 'delivered'}`);

      toast({
        variant:     'success',
        title:       action === 'pickup' ? 'Picked Up' : 'Delivered',
        description: `Order ${order.order_id} marked as ${action === 'pickup' ? 'picked up' : 'delivered'}`,
      });
      setActionError(null);
      onRefresh();
    } catch (err: any) {
      const raw = err.message ?? '';
      // Only show "session expired" for genuine auth errors — not DB/validation errors
      const isAuthError = raw.toLowerCase().includes('jwt') ||
                          raw.toLowerCase().includes('not authenticated') ||
                          raw.toLowerCase().includes('invalid token');
      setActionError(
        isAuthError
          ? 'Your session has expired. Please log out and log back in.'
          : (raw || 'Action failed. Please try again.')
      );
      console.error('[FreshPress] doAction error:', raw);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const canInvoice = order.status === 'picked_up';

  return (
    <>
      {showInvoice && (
        <GenerateInvoiceModal
          order={order} staffUser={staffUser}
          onClose={() => setShowInvoice(false)}
          onSuccess={() => { setShowInvoice(false); onRefresh(); }}
        />
      )}
      {confirm === 'pickup' && (
        <ConfirmDialog
          title="Confirm Pickup"
          body={`Mark order ${order.order_id} as picked up from ${order.customer_name}?`}
          confirmLabel="Yes, Picked Up"
          onConfirm={() => doAction('pickup')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'deliver' && (
        <ConfirmDialog
          title="Confirm Delivery"
          body={`Mark order ${order.order_id} as delivered to ${order.customer_name}?`}
          confirmLabel="Yes, Delivered"
          onConfirm={() => doAction('deliver')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delay' && (
        <RescheduleModal
          order={order} staffUser={staffUser} mode="delay"
          onClose={() => setConfirm(null)} onSuccess={onRefresh}
        />
      )}
      {confirm === 'reschedule' && (
        <RescheduleModal
          order={order} staffUser={staffUser} mode="reschedule"
          onClose={() => setConfirm(null)} onSuccess={onRefresh}
        />
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">

        {/* Always-visible header — tap to expand */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-bold text-gray-400">{order.order_id}</span>
              {order.reassigned_at && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">Reassigned</span>
              )}
              {overdue && order.status === 'pending' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Overdue</span>
              )}
            </div>
            <p className="font-bold text-gray-900 truncate">{order.customer_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(order.pickup_date)} &middot; {SLOT_LABELS[order.pickup_time_slot] ?? order.pickup_time_slot ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(order.status)}`}>
              {order.status?.replace(/_/g, ' ')}
            </span>
            {expanded
              ? <ChevronUp  className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {/* Expandable details */}
        {expanded && (
          <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-4">

            {/* Contact & location */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a href={`tel:${order.phone}`} className="hover:text-blue-600 font-medium">{order.phone}</a>
              </div>
              {order.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <a href={`mailto:${order.email}`} className="hover:text-blue-600 truncate">{order.email}</a>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span>{order.address || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{formatDate(order.pickup_date)} &middot; {SLOT_LABELS[order.pickup_time_slot] ?? order.pickup_time_slot ?? '—'}</span>
              </div>
            </div>

            {/* Special instructions */}
            {order.special_instructions && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{order.special_instructions}</span>
              </div>
            )}

            {/* Tracking info */}
            {(order.picked_up_by_name || order.delivered_by_name) && (
              <div className="border-t border-gray-50 pt-3 space-y-1 text-xs text-gray-500">
                {order.picked_up_by_name  && <p>Picked up by <strong>{order.picked_up_by_name}</strong> &middot; {formatDateTime(order.picked_up_at)}</p>}
                {order.delivered_by_name  && <p>Delivered by <strong>{order.delivered_by_name}</strong> &middot; {formatDateTime(order.delivered_at)}</p>}
              </div>
            )}

            {/* Inline error banner */}
            {actionError && (
              <ErrorBanner
                message={actionError}
                onDismiss={() => setActionError(null)}
              />
            )}

            {/* Generate Invoice — only for picked_up orders */}
            {canInvoice && (
              <button
                onClick={() => setShowInvoice(true)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition"
              >
                <Receipt className="w-4 h-4" /> Generate Invoice
              </button>
            )}

            {/* Action buttons */}
            {(canPickup || canDeliver || canDelay || canReschedule) && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {canPickup && (
                    <button
                      onClick={() => setConfirm('pickup')}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                      Mark Picked Up
                    </button>
                  )}
                  {canDeliver && (
                    <button
                      onClick={() => setConfirm('deliver')}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                      Mark Delivered
                    </button>
                  )}
                </div>
                {/* Delay / Reschedule row */}
                <div className="flex gap-2">
                  {canDelay && (
                    <button
                      onClick={() => setConfirm('delay')}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 border border-amber-300 text-amber-700 bg-amber-50 py-2 rounded-xl text-xs font-semibold hover:bg-amber-100 disabled:opacity-60 transition"
                    >
                      <Clock className="w-3.5 h-3.5" /> Mark as Delayed
                    </button>
                  )}
                  {canReschedule && (
                    <button
                      onClick={() => setConfirm('reschedule')}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-700 bg-red-50 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 disabled:opacity-60 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Mark as Rescheduled
                    </button>
                  )}
                </div>
              </div>
            )}

            {(order.status === 'delivered' || order.status === 'completed') && (
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-700 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Order complete
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function StaffIndex() {
  const navigate = useNavigate();
  const staffUser = getStaffUser();

  const [orders,        setOrders]        = useState<any[]>([]);
  const [activities,    setActivities]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [avail,         setAvail]         = useState<AvailStatus>('available');
  const [availConfirm,  setAvailConfirm]  = useState<AvailStatus | null>(null);
  const [tab,           setTab]           = useState<'active' | 'completed'>('active');
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!staffUser) { navigate('/login'); return; }
    if (staffUser.role === 'admin')      { navigate('/admin');      return; }
    if (staffUser.role === 'accountant') { navigate('/accountant'); return; }
  }, [staffUser, navigate]);

  const fetchData = useCallback(async () => {
    if (!staffUser?.id) return;
    setLoading(true);
    const [ordersRes, actRes, staffRes] = await Promise.all([
      supabase.from('orders')
        .select('*')
        .eq('assigned_staff_id', staffUser.id)
        .order('created_at', { ascending: false }),
      supabase.from('staff_activities')
        .select('*')
        .eq('staff_id', staffUser.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('staff_members')
        .select('availability_status')
        .eq('id', staffUser.id)
        .single(),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (actRes.data)    setActivities(actRes.data);
    if (staffRes.data)  setAvail((staffRes.data.availability_status as AvailStatus) || 'available');
    setLoading(false);
  }, [staffUser?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!staffUser?.id) return;
    const ch = supabase.channel('staff-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, staffUser?.id]);

  const handleAvailChange = async (newStatus: AvailStatus) => {
    setAvailConfirm(null);
    await supabase.from('staff_members').update({ availability_status: newStatus }).eq('id', staffUser!.id);
    setAvail(newStatus);
    toast({ variant: 'success', title: 'Availability updated', description: `You are now ${AVAIL_LABELS[newStatus]}` });
    if (newStatus !== 'available') {
      toast({ variant: 'warning', description: 'You will be skipped in new order assignments until you set yourself to Available.' });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearStaffUser();
    navigate('/login');
  };

  if (!staffUser) return null;

  const activeOrders    = orders.filter(o => !['delivered', 'completed'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status));
  const today           = new Date().toISOString().split('T')[0];
  const deliveredToday  = completedOrders.filter(o => o.delivered_at?.startsWith(today)).length;

  return (
    <>
      <Toaster />

      {showProfileEdit && staffUser && (
        <ProfileEditModal
          staffId={staffUser.id}
          currentName={staffUser.name || staffUser.full_name || ''}
          currentPhone={staffUser.phone || ''}
          onClose={() => setShowProfileEdit(false)}
          onSuccess={(newName, newPhone) => {
            setStaffUser({ ...staffUser, name: newName, full_name: newName, phone: newPhone });
            toast({ title: 'Profile updated', description: 'Your name and phone have been saved.' });
          }}
        />
      )}

      {/* Availability confirm */}
      {availConfirm && (
        <ConfirmDialog
          title="Change Availability?"
          body={availConfirm === 'available'
            ? 'Set yourself as Available? You will receive new order assignments.'
            : `Set yourself as ${AVAIL_LABELS[availConfirm]}? You will be skipped in new order assignments.`}
          confirmLabel="Confirm"
          onConfirm={() => handleAvailChange(availConfirm)}
          onCancel={() => setAvailConfirm(null)}
          danger={availConfirm !== 'available'}
        />
      )}

      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shrink-0">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">{staffUser.name}</p>
                <p className="text-xs text-gray-400 capitalize">{staffUser.role} staff</p>
              </div>
              <button
                onClick={() => setShowProfileEdit(true)}
                className="ml-1 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Edit my profile"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Availability — read-only badge (only admin can change) */}
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${AVAIL_STYLES[avail]}`}>
                {AVAIL_LABELS[avail]}
              </span>

              {/* Refresh */}
              <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active Orders',    value: activeOrders.length,    icon: Package,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { label: 'Delivered Today',  value: deliveredToday,          icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Assigned',   value: orders.length,           icon: Truck,        color: 'text-indigo-600', bg: 'bg-indigo-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['active', 'completed'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'active' ? `Active (${activeOrders.length})` : `Completed (${completedOrders.length})`}
              </button>
            ))}
          </div>

          {/* Orders list */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-44 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(tab === 'active' ? activeOrders : completedOrders).length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">
                    {tab === 'active' ? 'No active orders assigned to you' : 'No completed orders yet'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {tab === 'active' ? 'New orders will appear here when assigned by admin' : ''}
                  </p>
                </div>
              ) : (
                (tab === 'active' ? activeOrders : completedOrders).map(o => (
                  <OrderCard key={o.id} order={o} staffUser={staffUser} onRefresh={fetchData} />
                ))
              )}
            </div>
          )}

          {/* Recent activity */}
          {activities.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-gray-400" />
                <h3 className="font-bold text-sm text-gray-900">Your Recent Activity</h3>
              </div>
              <div className="space-y-3">
                {activities.map((a, i) => (
                  <div key={a.id ?? i} className="flex items-start gap-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                      a.activity_type === 'picked_up' ? 'bg-blue-100 text-blue-700' :
                      a.activity_type === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {a.activity_type?.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 text-xs">{a.description || a.order_id || '—'}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{formatDateTime(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
