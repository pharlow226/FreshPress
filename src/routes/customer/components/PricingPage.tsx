/**
 * PricingPage — fetches from Supabase, falls back to static data.
 * No emojis. Category icons use Lucide React.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Loader2, RefreshCw, Shirt, BedDouble,
  Layers, Sparkles, ArrowRight,
} from 'lucide-react';
import PriceCard from '@/routes/customer/components/PriceCard';
import { supabase } from '@/lib/supabase';
import type { PricingItem } from '@/types';

// ── Static fallback pricing ───────────────────────────────────────────────────
const STATIC_PRICING: Record<string, { name: string; price: string }[]> = {
  Clothing: [
    { name: 'T-Shirt',              price: '500' },
    { name: 'Polo Shirt',           price: '600' },
    { name: 'Long Sleeve Shirt',    price: '800' },
    { name: 'Short Sleeve Shirt',   price: '700' },
    { name: 'Trouser',              price: '700' },
    { name: 'Jeans',                price: '800' },
    { name: 'Skirt',                price: '600' },
    { name: 'Blouse',               price: '700' },
    { name: 'Suit (2-piece)',        price: '2,500' },
    { name: 'Suit (3-piece)',        price: '3,500' },
    { name: 'Native Wear',          price: '2,000' },
    { name: 'Gown / Dress',         price: '1,500' },
  ],
  Bedding: [
    { name: 'Bedsheet (Single)',    price: '1,200' },
    { name: 'Bedsheet (Double)',    price: '1,500' },
    { name: 'Pillowcase',          price: '300' },
    { name: 'Duvet (Small)',        price: '2,500' },
    { name: 'Duvet (Large)',        price: '3,000' },
    { name: 'Blanket',             price: '2,000' },
  ],
  'Heavy Items': [
    { name: 'Curtain (per panel)', price: '1,500' },
    { name: 'Rug / Small Carpet',  price: '3,000' },
    { name: 'Jacket / Hoodie',     price: '1,200' },
    { name: 'Coat',                price: '1,500' },
  ],
  Others: [
    { name: 'Towel',               price: '500' },
    { name: 'Face Towel',          price: '300' },
    { name: 'Cap / Hat',           price: '400' },
  ],
};

const CATEGORY_ORDER = ['Clothing', 'Bedding', 'Heavy Items', 'Others'];

const CATEGORY_CONFIG: Record<string, {
  Icon: React.ElementType; subtitle: string;
  gradient: string; iconBg: string;
}> = {
  Clothing:      { Icon: Shirt,      subtitle: 'Professional garment care',      gradient: 'from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))]', iconBg: 'bg-white/20' },
  Bedding:       { Icon: BedDouble,  subtitle: 'Fresh and clean bedding',         gradient: 'from-emerald to-[hsl(160,60%,18%)]',                                       iconBg: 'bg-white/20' },
  'Heavy Items': { Icon: Layers,     subtitle: 'Special care for heavy fabrics',  gradient: 'from-purple to-[hsl(270,50%,20%)]',                                        iconBg: 'bg-white/20' },
  Others:        { Icon: Sparkles,   subtitle: 'Additional services',             gradient: 'from-amber to-amber-dark',                                                  iconBg: 'bg-white/20' },
};

// ── Component ─────────────────────────────────────────────────────────────────
const PricingPage = () => {
  const navigate = useNavigate();
  const [grouped, setGrouped] = useState<Record<string, { name: string; price: string }[]>>(STATIC_PRICING);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [minimumOrder, setMinimumOrder] = useState<number>(3000);

  useEffect(() => { fetchPricing(); }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true); setError(null);
      
      // Fetch minimum order value dynamically from company_info
      const { data: companyData } = await supabase
        .from('company_info')
        .select('minimum_order')
        .limit(1)
        .single();
      if (companyData?.minimum_order) {
        setMinimumOrder(Number(companyData.minimum_order));
      }

      const { data, error: dbError } = await supabase
        .from('pricing').select('*').eq('active', true)
        .order('category').order('display_order');
      if (dbError) throw dbError;
      if (!data?.length) return; // keep static fallback
      const g = (data as PricingItem[]).reduce<Record<string, { name: string; price: string }[]>>(
        (acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push({ name: item.service_name, price: item.price.toLocaleString() });
          return acc;
        }, {}
      );
      setGrouped(g);
    } catch {
      setError('Could not load live pricing — showing standard rates.');
    } finally {
      setLoading(false);
    }
  };

  const orderedCats = CATEGORY_ORDER.filter(c => grouped[c]);

  return (
    <div>
      {/* Page header */}
      <div className="text-center mb-10 md:mb-14">
        <h2 className="text-3xl md:text-5xl font-black text-foreground mb-3">Our Pricing</h2>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          Transparent pricing. No hidden charges. Quality guaranteed.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--brand))] mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading latest pricing...</p>
        </div>
      )}

      {/* Error (non-fatal — static data still shows) */}
      {error && (
        <div className="bg-[hsl(var(--amber-light))] border border-[hsl(var(--amber))]/30 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
          <p className="text-[hsl(var(--amber))] text-sm">{error}</p>
          <button onClick={fetchPricing} className="text-[hsl(var(--brand))] hover:underline text-sm flex items-center gap-1 shrink-0 ml-4">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Category blocks */}
      {!loading && orderedCats.map((cat, i) => {
        const cfg = CATEGORY_CONFIG[cat] ?? { Icon: Package, subtitle: '', gradient: 'from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))]', iconBg: 'bg-white/20' };
        const { Icon } = cfg;
        return (
          <div key={cat} className={`bg-card rounded-2xl md:rounded-3xl shadow-lg overflow-hidden border border-border ${i < orderedCats.length - 1 ? 'mb-8' : 'mb-12'}`}>
            {/* Category header */}
            <div className={`bg-gradient-to-r ${cfg.gradient} text-white px-6 py-5`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black">{cat}</h3>
                  <p className="text-xs opacity-75 mt-0.5">{cfg.subtitle}</p>
                </div>
              </div>
            </div>
            {/* Items grid */}
            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[cat].map(item => (
                  <PriceCard key={item.name} name={item.name} price={item.price} />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Notes */}
      <div className="bg-[hsl(var(--amber-light))] border border-[hsl(var(--amber))]/30 rounded-2xl p-6 mb-10">
        <h4 className="font-bold text-[hsl(var(--amber-dark))] mb-3 text-base">Important Information</h4>
        <ul className="space-y-1.5 text-[hsl(var(--amber))] text-sm">
          {[
            `Minimum order: \u20a6${minimumOrder.toLocaleString()}`,
            'Free pickup & delivery within Lekki, Ikoyi and Victoria Island',
            'Express service (24 hours): +20% surcharge',
            'Heavily stained items may attract additional charges',
          ].map(note => (
            <li key={note} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[hsl(var(--amber-dark))]">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={() => navigate('/request-pickup')}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white px-10 py-4 rounded-2xl text-lg font-black hover:shadow-2xl hover:shadow-[hsl(var(--brand-gradient-via))]/30 hover:-translate-y-1 transition-all"
        >
          <Package className="w-5 h-5" />
          Request Pickup Now
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-muted-foreground mt-4 text-sm">Fast response · Reliable service · Transparent pricing</p>
      </div>
    </div>
  );
};

export default PricingPage;
