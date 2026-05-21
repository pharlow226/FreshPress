/**
 * CustomerLayout — faithful restoration of the original Lovable design
 * + improvements: Evolution API WhatsApp link, smoother mobile nav,
 *   improved footer, better active state styling.
 */
import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Truck, Shield, Award, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ChatWidget from '@/routes/customer/components/ChatWidget';

const NAV_ITEMS = [
  { path: '/',               label: 'Home',           mobileLabel: 'Home' },
  { path: '/pricing',        label: 'Pricing',        mobileLabel: 'Pricing' },
  { path: '/request-pickup', label: 'Request Pickup', mobileLabel: 'Pickup' },
  { path: '/track',          label: 'Track Order',    mobileLabel: 'Track' },
] as const;

const CustomerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  const isHome   = location.pathname === '/';

  // ── Dynamic SEO sync from company_info ──────────────────────────────
  // Admin updates address / coordinates / OG image in Company Settings
  // → this function keeps ALL meta tags and JSON-LD in sync automatically.
  // No manual index.html edits ever needed after a location change.
  useEffect(() => {
    const syncSeo = async () => {
      try {
        const { data } = await supabase
          .from('company_info')
          .select('og_image_url,company_address,company_phone,latitude,longitude,service_areas')
          .limit(1)
          .single();
        if (!data) return;

        const lat = data.latitude  ? Number(data.latitude)  : null;
        const lng = data.longitude ? Number(data.longitude) : null;

        // ── OG image + Twitter card ──────────────────────────────────
        if (data.og_image_url) {
          document.querySelector('meta[property="og:image"]')?.setAttribute('content', data.og_image_url);
          document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', data.og_image_url);
        }

        // ── Geo meta tags (latitude / longitude) ─────────────────────
        if (lat !== null && lng !== null) {
          document.querySelector('meta[name="geo.position"]')?.setAttribute('content', `${lat};${lng}`);
          document.querySelector('meta[name="ICBM"]')?.setAttribute('content', `${lat}, ${lng}`);
        }
        if (data.company_address) {
          document.querySelector('meta[name="geo.placename"]')?.setAttribute('content', data.company_address);
        }

        // ── Keywords + description (service areas) ────────────────────
        if (data.service_areas) {
          const areas = data.service_areas as string;
          const kwMeta   = document.querySelector('meta[name="keywords"]');
          const descMeta = document.querySelector('meta[name="description"]');
          if (kwMeta) {
            const areaKw = areas.split(',').map((a: string) => `laundry ${a.trim()}`).join(', ');
            kwMeta.setAttribute('content',
              `laundry service Lagos, dry cleaning Lagos, laundry pickup delivery Lagos, FreshPress laundry, ${areaKw}, wash and fold Lagos`);
          }
          if (descMeta) {
            descMeta.setAttribute('content',
              `FreshPress is Lagos's premier laundry service — free pickup & delivery in ${areas} and across Lagos. 24–48 hour turnaround, eco-friendly cleaning. Book online in 60 seconds.`);
          }
        }

        // ── JSON-LD LocalBusiness schema ──────────────────────────────
        const ldScript = document.querySelector('script[type="application/ld+json"]');
        if (ldScript) {
          try {
            const json = JSON.parse(ldScript.textContent ?? '{}');
            const biz  = (json['@graph'] ?? []).find((n: any) => n['@type'] === 'LocalBusiness');
            if (biz) {
              if (data.company_address) {
                biz.address                = biz.address ?? {};
                biz.address.streetAddress  = data.company_address;
              }
              if (data.company_phone) biz.telephone     = data.company_phone;
              if (data.og_image_url)  biz.image         = data.og_image_url;
              if (lat !== null)       biz.geo            = { ...(biz.geo ?? {}), '@type': 'GeoCoordinates', latitude: lat };
              if (lng !== null)       biz.geo            = { ...(biz.geo ?? {}), '@type': 'GeoCoordinates', longitude: lng };
            }
            ldScript.textContent = JSON.stringify(json);
          } catch { /* ignore parse errors */ }
        }
      } catch { /* non-fatal — SEO sync failing should never break the UI */ }
    };
    syncSeo();
  }, []);

  return (
    <div className="customer-theme min-h-screen bg-background">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 shadow-lg">
        <div className="bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 md:py-4">

            <div className="flex items-center justify-between gap-2">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 md:w-7 md:h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black truncate">FRESHPRESS</h1>
                  <p className="text-[10px] md:text-xs opacity-70 truncate">Premium Laundry Services</p>
                </div>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden lg:flex gap-2 xl:gap-4">
                {NAV_ITEMS.map(item => (
                  <Link key={item.path} to={item.path}
                    className={`px-3 xl:px-4 py-2 rounded-lg font-semibold text-sm xl:text-base transition-all whitespace-nowrap ${
                      isActive(item.path)
                        ? 'border-2 border-white text-white bg-white/10'
                        : 'text-white hover:bg-white/10 border-2 border-transparent'
                    }`}>
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Call button */}
              <a href="tel:+2348113143272"
                className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 md:px-4 rounded-lg hover:bg-white/20 transition-all shrink-0">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-semibold">Call Us</span>
              </a>
            </div>

            {/* Mobile / Tablet pill nav */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-3 lg:hidden">
              {NAV_ITEMS.map(item => (
                <Link key={item.path} to={item.path}
                  className={`px-1.5 py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm text-center ${
                    isActive(item.path)
                      ? 'bg-white text-[hsl(var(--brand-gradient-via))] shadow-sm'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}>
                  <span className="sm:hidden">{item.mobileLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            </div>

          </div>
        </div>
      </header>

      {/* ── Hero Section — home + pricing ──────────────────────── */}
      {(isHome || isActive('/pricing')) && (
        <section className="bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white py-10 md:py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl md:text-6xl font-black mb-3 md:mb-4">Fresh Clothes, Fresh You</h2>
            <p className="text-base md:text-xl opacity-80 mb-6 md:mb-8 max-w-2xl mx-auto">
              Professional laundry services in Lagos. Fast, reliable, and eco-friendly.
            </p>

            <div className="flex flex-wrap justify-center gap-3 md:gap-6">
              {[
                { Icon: Truck,  text: 'Free Pickup & Delivery' },
                { Icon: Shield, text: '100% Satisfaction' },
                { Icon: Award,  text: '5-Star Service' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 md:px-4 py-2 rounded-full">
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-xs md:text-sm font-semibold">{text}</span>
                </div>
              ))}
            </div>

            {isHome && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button onClick={() => navigate('/pricing')}
                  className="bg-white text-[hsl(var(--brand-gradient-via))] px-6 py-3 rounded-xl font-bold hover:shadow-xl transition-all">
                  View Pricing
                </button>
                <button onClick={() => navigate('/request-pickup')}
                  className="bg-white/10 backdrop-blur-sm border-2 border-white text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all">
                  Request Pickup
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Page content ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-12">
        <Outlet />
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-footer text-footer-foreground py-8 md:py-12 px-4 mt-8 md:mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-footer-heading font-bold text-lg mb-3 md:mb-4">Contact Us</h3>
              <div className="space-y-2">
                <a href="tel:+2348113143272" className="flex items-center gap-2 hover:text-footer-heading transition">
                  <Phone className="w-4 h-4" /> +234 811 314 3272
                </a>
                <a href="mailto:hello@freshpress.ng" className="flex items-center gap-2 hover:text-footer-heading transition">
                  <Mail className="w-4 h-4" /> hello@freshpress.ng
                </a>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Lagos, Nigeria</p>
              </div>
            </div>
            <div>
              <h3 className="text-footer-heading font-bold text-lg mb-3 md:mb-4">Operating Hours</h3>
              <p>Monday - Saturday</p>
              <p className="text-footer-heading font-semibold">7:00 AM - 8:00 PM</p>
              <p className="mt-2 text-sm">Sunday: Closed</p>
            </div>
            <div>
              <h3 className="text-footer-heading font-bold text-lg mb-3 md:mb-4">Why Choose Us?</h3>
              <ul className="space-y-1 text-sm">
                <li>- Same-day service available</li>
                <li>- Eco-friendly cleaning</li>
                <li>- Expert stain removal</li>
                <li>- Free pickup &amp; delivery</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-footer-border pt-4 md:pt-6 text-center text-sm space-y-1">
            <p>© {new Date().getFullYear()} FreshPress Laundry Services. All rights reserved.</p>
            <p className="text-xs opacity-50">
              Powered by{' '}
              <a
                href="https://x.com/pharlow28?s=21&t=-kqG82ZZVX-uYVo7j5WA6w"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-100 transition underline underline-offset-2"
                aria-label="Pharlow Technology on X (Twitter)"
              >
                Pharlow Technology
              </a>
              {' · '}
              <a
                href="https://www.linkedin.com/in/faloyesamuel"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-100 transition underline underline-offset-2"
                aria-label="Pharlow Technology on LinkedIn"
              >
                LinkedIn
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Floating AI chat assistant */}
      <ChatWidget />
    </div>
  );
};

export default CustomerLayout;
