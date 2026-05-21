import { Link } from "react-router-dom";
import {
  Truck,
  Sparkles,
  Leaf,
  Clock,
  ShieldCheck,
  Star,
  ArrowRight,
  ClipboardList,
  WashingMachine,
  PackageCheck,
} from "lucide-react";
import heroLaundry from "@/assets/hero-laundry.jpg";
import featurePressing from "@/assets/feature-pressing.jpg";
import featureDelivery from "@/assets/feature-delivery.jpg";
import featureEco from "@/assets/feature-eco.jpg";

const Landing = () => {
  return (
    <div className="space-y-16 md:space-y-24 pb-8">
      {/* Intro split */}
      <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div className="order-2 md:order-1">
          <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] mb-4">
            Lagos' Premium Laundry Service
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-4">
            Laundry, done the way it should be.
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6">
            At FreshPress, we treat every garment like it's our own. From everyday wear
            to delicate fabrics, our team blends modern equipment, expert care, and
            eco-friendly detergents to deliver clothes that look, feel, and smell
            extraordinary, picked up and returned right to your door.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/request-pickup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white px-6 py-3 rounded-xl font-bold hover:shadow-xl transition-all"
            >
              Request a Pickup <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 border-2 border-[hsl(var(--brand))] text-[hsl(var(--brand))] px-6 py-3 rounded-xl font-bold hover:bg-[hsl(var(--brand-accent-light))] transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
        <div className="order-1 md:order-2 relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-[hsl(var(--brand-gradient-via))]/20 to-[hsl(var(--brand-gradient-to))]/20 rounded-3xl blur-2xl" />
          <img
            src={heroLaundry}
            alt="Crisp white shirts neatly pressed and folded by FreshPress"
            width={1536}
            height={1024}
            className="relative rounded-3xl shadow-2xl w-full h-auto object-cover"
          />
        </div>
      </section>

      {/* Why FreshPress */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-foreground mb-3">
            Why Lagos chooses FreshPress
          </h2>
          <p className="text-muted-foreground">
            Built for busy professionals, families, and businesses who refuse to
            compromise on quality or convenience.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: Truck,
              title: "Free Pickup & Delivery",
              desc: "We come to you across Lagos, no traffic, no hassle, no extra fees.",
            },
            {
              icon: Clock,
              title: "Turnaround in 48 Hours",
              desc: "Standard orders returned in two days. Same-day option available.",
            },
            {
              icon: Leaf,
              title: "Eco-Friendly Care",
              desc: "Plant-based detergents that protect your fabrics and the planet.",
            },
            {
              icon: ShieldCheck,
              title: "Quality Guarantee",
              desc: "Not happy with something? We'll re-clean it free, no questions asked.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:border-[hsl(var(--brand))]/30 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services showcase */}
      <section className="space-y-12">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <img
            src={featurePressing}
            alt="FreshPress technician steam-pressing a shirt"
            width={1024}
            height={1024}
            loading="lazy"
            className="rounded-3xl shadow-xl w-full h-auto object-cover"
          />
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] mb-4">
              Expert Care
            </span>
            <h3 className="text-2xl md:text-4xl font-black text-foreground mb-3">
              Master craftsmanship on every garment
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our trained team handles your laundry the way couture houses handle theirs:
              sorting by fabric, treating stains by hand, and finishing with
              professional-grade steam presses for a crisp, polished look every time.
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--brand))] shrink-0" />
                Wash, dry &amp; fold for everyday wardrobes
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--brand))] shrink-0" />
                Dry cleaning for suits, dresses &amp; delicates
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--brand))] shrink-0" />
                Ironing &amp; pressing for that boardroom finish
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--brand))] shrink-0" />
                Bedding, curtains &amp; household linens
              </li>
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="md:order-2">
            <img
              src={featureDelivery}
              alt="FreshPress courier delivering freshly laundered clothes to a Lagos doorstep"
              width={1024}
              height={1024}
              loading="lazy"
              className="rounded-3xl shadow-xl w-full h-auto object-cover"
            />
          </div>
          <div className="md:order-1">
            <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] mb-4">
              Door-to-Door
            </span>
            <h3 className="text-2xl md:text-4xl font-black text-foreground mb-3">
              Pickup and delivery built around your schedule
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Book a pickup window in seconds. Our couriers arrive on time, in
              FreshPress-branded uniforms, with sealed garment bags. Track every step
              from collection to delivery, no guessing, no follow-up calls.
            </p>
            <Link
              to="/track"
              className="inline-flex items-center gap-2 text-[hsl(var(--brand))] font-bold hover:underline"
            >
              Track an existing order <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <img
            src={featureEco}
            alt="Eco-friendly detergents and freshly laundered towels"
            width={1024}
            height={1024}
            loading="lazy"
            className="rounded-3xl shadow-xl w-full h-auto object-cover"
          />
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand))] mb-4">
              Sustainable
            </span>
            <h3 className="text-2xl md:text-4xl font-black text-foreground mb-3">
              Gentle on fabrics. Gentler on the planet.
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              We use biodegradable, hypoallergenic detergents and energy-efficient
              machines that cut water and power use without sacrificing performance.
              Cleaner clothes, lighter footprint, that's the FreshPress standard.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gradient-to-br from-[hsl(var(--brand-accent-light))] to-background rounded-3xl p-8 md:p-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-foreground mb-3">
            Three simple steps
          </h2>
          <p className="text-muted-foreground">
            From a tap to fresh-folded laundry at your door, here's how it works.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: ClipboardList,
              step: "01",
              title: "Schedule a pickup",
              desc: "Choose a date and time slot that works for you in under a minute.",
            },
            {
              icon: WashingMachine,
              step: "02",
              title: "We clean with care",
              desc: "Our team sorts, washes, presses, and packages your garments with precision.",
            },
            {
              icon: PackageCheck,
              step: "03",
              title: "Delivered fresh",
              desc: "Receive your laundry, neatly folded, sealed, and ready to wear.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="bg-card rounded-2xl p-6 border border-border relative overflow-hidden"
            >
              <span className="absolute top-3 right-4 text-5xl font-black text-[hsl(var(--brand))]/10">
                {step}
              </span>
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--brand))] flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-foreground mb-3">
            Loved by Lagos
          </h2>
          <p className="text-muted-foreground">
            Real words from real customers across the city.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              quote:
                "FreshPress turned my Sunday around. Picked up in the morning, delivered next day folded perfectly. My shirts have never looked better.",
              name: "Adaeze O.",
              role: "Lekki",
            },
            {
              quote:
                "I run a small office and we use FreshPress for our uniforms. Reliable, professional, and the finish is sharp every single time.",
              name: "Tunde A.",
              role: "Victoria Island",
            },
            {
              quote:
                "Finally a laundry service that actually cares about delicate fabrics. My silk scarves came back better than the day I bought them.",
              name: "Ngozi M.",
              role: "Ikoyi",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all"
            >
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-[hsl(var(--brand))] text-[hsl(var(--brand))]"
                  />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-4 text-sm">"{t.quote}"</p>
              <div>
                <p className="font-bold text-foreground text-sm">{t.name}</p>
                <p className="text-muted-foreground text-xs">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white p-8 md:p-14 text-center">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl md:text-4xl font-black mb-3">
            Ready for laundry day to disappear?
          </h2>
          <p className="opacity-90 max-w-xl mx-auto mb-6">
            Book your first pickup in under a minute. We'll handle the rest.
          </p>
          <Link
            to="/request-pickup"
            className="inline-flex items-center gap-2 bg-white text-[hsl(var(--brand))] px-7 py-3.5 rounded-xl font-bold hover:shadow-2xl transition-all"
          >
            Request a Pickup <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Landing;
