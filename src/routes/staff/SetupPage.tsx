/**
 * SetupPage — Bootstrap first admin account.
 * Only accessible when zero rows exist in staff_members.
 * Redirects to /staff if any admin already exists.
 * Uses the create-staff Edge Function to create the first admin.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CREATE_STAFF_URL = import.meta.env.VITE_CREATE_STAFF_URL as string;

export default function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', setupSecret: '',
  });

  // Check if any admin exists
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('staff_members')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if ((count ?? 0) > 0) {
        setAlreadySetup(true);
        setTimeout(() => navigate('/staff'), 1500);
      }
      setChecking(false);
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Full name and email are required.');
      return;
    }

    // Setup secret is validated SERVER-SIDE in the create-staff edge function.
    // We no longer check it here — checking in the browser exposes it in the JS bundle.

    setSubmitting(true);
    try {
      const res = await fetch(CREATE_STAFF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:   form.full_name.trim(),
          email:       form.email.trim(),
          phone:       form.phone.trim() || undefined,
          role:        'admin',
          setupSecret: form.setupSecret, // validated server-side in create-staff edge function
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create admin account');
      setDone(true);
      setTimeout(() => navigate('/staff'), 3000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (alreadySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))]">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Already Configured</h2>
          <p className="text-sm text-gray-500">Admin account exists. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))]">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Created</h2>
          <p className="text-sm text-gray-600 mb-1">A welcome email with your temporary password has been sent.</p>
          <p className="text-sm text-gray-500">Redirecting to login in 3 seconds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">System Setup</h1>
          <p className="text-white/70 mt-1 text-sm">Create the first admin account to get started</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Samuel Faloye"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@freshpress.ng"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone (optional)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+234 811 314 3272"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Setup Secret
                <button type="button" onClick={() => setShowHelp(v => !v)} className="ml-2 text-blue-500 text-xs font-normal underline">
                  {showHelp ? 'hide' : 'what is this?'}
                </button>
              </label>
              {showHelp && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-2">
                  Set <code className="bg-gray-200 px-1 rounded">VITE_SETUP_SECRET</code> in your .env file. This prevents unauthorized use of the setup page. Leave blank if not configured.
                </p>
              )}
              <input
                type="password"
                value={form.setupSecret}
                onChange={e => setForm(f => ({ ...f, setupSecret: e.target.value }))}
                placeholder="Enter setup secret"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating Admin Account...</>
              ) : (
                <><Shield className="w-4 h-4" /> Create Admin Account</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          This page is only accessible before the first admin is created.
        </p>
      </div>
    </div>
  );
}
