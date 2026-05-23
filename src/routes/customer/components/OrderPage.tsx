import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  Loader2, CheckCircle, Clock, Shield, Truck, Sparkles,
  User, Phone, Mail, MapPin, Calendar, AlignLeft, Package
} from 'lucide-react';
import LoadingMessage from '@/components/shared/LoadingMessage';
import { EDGE_FUNCTIONS } from '@/lib/webhooks';
import { isValidPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

interface FormData {
  customerName: string; phone: string; email: string;
  address: string; pickupDate: string; pickupTimeSlot: string; specialInstructions: string;
}
interface OrderResponse {
  orderId: string; customerName?: string; pickupDate?: string; timeSlot?: string; message: string;
}

// ── Input styling ─────────────────────────────────────────────────────────────
const fieldClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl bg-white text-foreground placeholder:text-muted-foreground/60 focus:border-[hsl(var(--brand))] focus:outline-none focus:ring-4 focus:ring-[hsl(var(--brand-accent-light))] transition-all text-sm';

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-black text-[hsl(var(--brand))] uppercase tracking-wider mb-1.5">
    {children}
  </label>
);

const Field = ({
  icon: Icon, label, children,
}: {
  icon: React.ElementType; label: string; children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      {children}
    </div>
  </div>
);

// ── Trust sidebar items ────────────────────────────────────────────────────────
const TRUST_BASE = [
  { Icon: Truck,    title: 'Free Pickup & Delivery', descTemplate: (areaList: string) => `Across ${areaList} — no extra fee.` },
  { Icon: Clock,    title: '48-Hour Turnaround',      descTemplate: () => 'Standard orders returned within two days.' },
  { Icon: Shield,   title: 'Fully Insured',           descTemplate: () => 'Every item protected from pickup to delivery.' },
  { Icon: Sparkles, title: 'Expert Finish',           descTemplate: () => 'Professional steam press and careful handling.' },
];

// ── Main component ────────────────────────────────────────────────────────────
const OrderPage = () => {
  const [formData, setFormData] = useState<FormData>({
    customerName: '', phone: '', email: '',
    address: '', pickupDate: '', pickupTimeSlot: 'morning', specialInstructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstArea, setFirstArea] = useState<string>('Lekki');
  const [areaList, setAreaList] = useState<string>('Lekki, Ikoyi & Victoria Island');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchServiceAreas = async () => {
      try {
        const { data } = await supabase
          .from('company_info')
          .select('service_areas')
          .limit(1)
          .single();
        if (data?.service_areas) {
          const parts = (data.service_areas as string).split(',').map((s: string) => s.trim());
          if (parts.length > 0 && parts[0]) setFirstArea(parts[0]);
          let formatted: string;
          if (parts.length <= 1) formatted = data.service_areas;
          else if (parts.length === 2) formatted = parts.join(' & ');
          else formatted = parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
          setAreaList(formatted);
        }
      } catch {
        // Silently keep defaults
      }
    };
    fetchServiceAreas();
  }, []);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.customerName.trim())                                        { setError('Please enter your full name');                         return false; }
    if (!formData.phone.trim())                                               { setError('Please enter your phone number');                      return false; }
    if (!isValidPhone(formData.phone))                                          { setError('Please enter a valid phone number (e.g., +234 801 234 5678)');  return false; }
    if (!formData.email.trim() || !formData.email.includes('@'))              { setError('Please enter a valid email address');                  return false; }
    if (!formData.address.trim())                                             { setError('Please enter your pickup address');                    return false; }
    if (!formData.pickupDate)                                                 { setError('Please select a pickup date');                         return false; }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;

    const edgeFnUrl = EDGE_FUNCTIONS.CREATE_ORDER;
    if (!edgeFnUrl || edgeFnUrl.includes('undefined')) {
      setError('Order system is not configured. Please call us at +234 811 314 3272');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_name:        formData.customerName,
        phone:                formData.phone,
        email:                formData.email,
        address:              formData.address,
        pickup_date:          formData.pickupDate,
        pickup_time_slot:     formData.pickupTimeSlot,
        special_instructions: formData.specialInstructions,
        timestamp:            new Date().toISOString(),
      };
      const response = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data) { setError('Something went wrong. Please try again.'); return; }
      if (data.success === true) {
        setOrderResponse({
          orderId: data.orderId, customerName: data.customerName,
          pickupDate: data.pickupDate, timeSlot: data.timeSlot,
          message: data.message || 'You will receive confirmation via WhatsApp and Email shortly.',
        });
        setFormData({ customerName: '', phone: '', email: '', address: '', pickupDate: '', pickupTimeSlot: 'morning', specialInstructions: '' });
        setTimeout(() => setOrderResponse(null), 20000);
        return;
      }
      setError(data.message || 'Something went wrong. Please try again.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Connection error: ${msg}. Please check your internet and try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ───────────────────────────────────────────────────────────
  if (orderResponse) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white rounded-3xl border-2 border-[hsl(var(--success))]/30 shadow-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--success-light))] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Order Confirmed!</h2>
          <p className="text-muted-foreground mb-6">Confirmation has been sent to your WhatsApp and email.</p>
          <div className="bg-[hsl(var(--brand-accent-light))] rounded-2xl p-5 text-left space-y-2 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[hsl(var(--brand))] uppercase tracking-wider">Order ID</span>
              <span className="font-mono font-bold text-foreground text-sm">{orderResponse.orderId}</span>
            </div>
            {orderResponse.customerName && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[hsl(var(--brand))] uppercase tracking-wider">Name</span>
                <span className="text-sm font-medium text-foreground">{orderResponse.customerName}</span>
              </div>
            )}
            {orderResponse.pickupDate && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[hsl(var(--brand))] uppercase tracking-wider">Pickup Date</span>
                <span className="text-sm font-medium text-foreground">{orderResponse.pickupDate}</span>
              </div>
            )}
            {orderResponse.timeSlot && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[hsl(var(--brand))] uppercase tracking-wider">Time Slot</span>
                <span className="text-sm font-medium text-foreground">{orderResponse.timeSlot}</span>
              </div>
            )}
          </div>
          <a href="/track"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all">
            Track My Order
          </a>
        </div>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-5 gap-8 xl:gap-12 items-start">

      {/* ── Left trust panel (2/5 columns) ──────────────────────── */}
      <aside className="lg:col-span-2 lg:sticky lg:top-24 space-y-6">

        {/* Header card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white p-8">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-black leading-tight mb-2">
              Schedule your pickup
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Fill in your details on the right and our team will be at your door at the chosen time.
            </p>
          </div>
        </div>

        {/* Trust items */}
        <div className="space-y-3">
          {TRUST_BASE.map(({ Icon, title, descTemplate }) => (
            <div key={title} className="flex gap-4 items-start bg-white rounded-2xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand-accent-light))] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[hsl(var(--brand))]" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{descTemplate(areaList)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Phone CTA */}
        <div className="bg-[hsl(var(--brand-accent-light))] rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Prefer to talk to someone?</p>
          <a href="tel:+2348113143272" className="text-[hsl(var(--brand))] font-black text-lg hover:underline block">
            +234 811 314 3272
          </a>
        </div>
      </aside>

      {/* ── Right form panel (3/5 columns) ──────────────────────── */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-3xl border border-border shadow-xl overflow-hidden">

          {/* Form header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <h3 className="text-lg font-black text-foreground">Your Details</h3>
            <p className="text-sm text-muted-foreground mt-0.5">All fields marked with an asterisk are required</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Row 1 — Name + Phone */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field icon={User} label="Full Name *">
                <input
                  type="text" name="customerName" value={formData.customerName}
                  onChange={handleInputChange} placeholder="Your full name"
                  className={`${fieldClass} pl-10`} required
                />
              </Field>
              <Field icon={Phone} label="WhatsApp Number *">
                <input
                  type="tel" name="phone" value={formData.phone}
                  onChange={handleInputChange} placeholder="0801 234 5678"
                  className={`${fieldClass} pl-10`} required
                />
              </Field>
            </div>

            {/* Email */}
            <Field icon={Mail} label="Email Address *">
              <input
                type="email" name="email" value={formData.email}
                onChange={handleInputChange} placeholder="your@email.com"
                className={`${fieldClass} pl-10`} required
              />
            </Field>

            {/* Address */}
            <Field icon={MapPin} label="Pickup Address *">
              <textarea
                name="address" value={formData.address}
                onChange={handleInputChange} rows={2}
                placeholder={`e.g., 123 Admiralty Way, ${firstArea} Phase 1, Lagos`}
                className={`${fieldClass} pl-10 pt-3 resize-none`} required
              />
            </Field>

            {/* Row — Date + Time slot */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field icon={Calendar} label="Pickup Date *">
                <input
                  type="date" name="pickupDate" value={formData.pickupDate}
                  onChange={handleInputChange} min={today}
                  className={`${fieldClass} pl-10`} required
                />
              </Field>
              <div className="space-y-1.5">
                <Label>Time Slot *</Label>
                <select
                  name="pickupTimeSlot" value={formData.pickupTimeSlot}
                  onChange={handleInputChange}
                  className={fieldClass}
                >
                  <option value="morning">Morning — 9AM to 12PM</option>
                  <option value="afternoon">Afternoon — 1PM to 4PM</option>
                  <option value="evening">Evening — 4PM to 7PM</option>
                </select>
              </div>
            </div>

            {/* Special instructions */}
            <Field icon={AlignLeft} label="Special Instructions (Optional)">
              <textarea
                name="specialInstructions" value={formData.specialInstructions}
                onChange={handleInputChange} rows={2}
                placeholder="Delicate fabrics, stain notes, allergies, extra starch..."
                className={`${fieldClass} pl-10 pt-3 resize-none`}
              />
            </Field>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit" disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white py-4 rounded-xl font-black text-base hover:shadow-xl hover:shadow-[hsl(var(--brand-gradient-via))]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Confirming your order...</>
                  : <><Package className="w-5 h-5" /> Confirm Pickup Request</>
                }
              </button>
              {isSubmitting && (
                <LoadingMessage messages={['Submitting your request...', 'Booking your pickup...', 'Sending confirmation...', 'Almost done...']} />
              )}
              <p className="text-center text-xs text-muted-foreground mt-3">
                By submitting you agree to our terms of service. Confirmation sent to WhatsApp &amp; email.
              </p>
            </div>

          </form>
        </div>
      </div>

    </div>
  );
};

export default OrderPage;
