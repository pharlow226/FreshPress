/**
 * LoginPage — Staff authentication entry point.
 *
 * Flow:
 *  1. signInWithPassword (Supabase Auth)
 *  2. Fetch staff_members row → get role + force_password_change
 *  3. Store minimal user in localStorage (setStaffUser)
 *  4. If force_password_change → /change-password
 *  5. Else route by role:
 *     admin       → /admin
 *     accountant  → /accountant
 *     pickup      → /staff/dashboard
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle, LogIn, Shirt } from 'lucide-react';
import { supabase, setStaffUser } from '@/lib/supabase';
import { staffSignIn } from '@/lib/operations';
import type { StaffUser } from '@/types';

const ROLE_REDIRECT: Record<string, string> = {
  admin:      '/admin',
  accountant: '/accountant',
  pickup:     '/staff/dashboard',
};

export default function LoginPage() {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [adminExists, setAdminExists] = useState<boolean | null>(null); // null = loading

  // Hide setup link once any admin account exists
  useEffect(() => {
    supabase
      .from('staff_members')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .then(({ count }) => setAdminExists((count ?? 0) > 0));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Supabase Auth sign-in
      const { user } = await staffSignIn(email.trim(), password);
      if (!user?.id) throw new Error('Login failed. No user returned.');

      // 2. Fetch staff_members profile
      const { data: staffRow, error: dbErr } = await supabase
        .from('staff_members')
        .select('id, full_name, email, role, active, force_password_change')
        .eq('id', user.id)
        .single();

      if (dbErr || !staffRow) {
        await supabase.auth.signOut();
        throw new Error('Staff profile not found. Contact your administrator.');
      }

      if (!staffRow.active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been deactivated. Contact your administrator.');
      }

      // 3. Persist minimal display-only session
      const staffUser: StaffUser = {
        id:                    staffRow.id,
        name:                  staffRow.full_name || staffRow.email,
        full_name:             staffRow.full_name,
        email:                 staffRow.email,
        role:                  staffRow.role,
        active:                staffRow.active,
        force_password_change: staffRow.force_password_change,
      };
      setStaffUser(staffUser);

      // 4. Route decision
      if (staffRow.force_password_change) {
        navigate('/change-password');
        return;
      }

      navigate(ROLE_REDIRECT[staffRow.role] ?? '/staff/dashboard');

    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[hsl(230,70%,25%)] via-[hsl(250,60%,30%)] to-[hsl(270,50%,25%)]">

      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Shirt className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight">FreshPress</span>
        </div>

        <div>
          <h1 className="text-5xl font-black leading-tight mb-6">
            Staff<br />Portal
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-xs">
            Manage pickups, track orders, and keep Lagos fresh — all in one place.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Real-time order tracking', sub: 'Updates the moment status changes' },
            { label: 'Role-based access',         sub: 'Pickup, accountant, and admin views' },
            { label: 'Activity logging',           sub: 'Every action tracked and audited' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-white/40 mt-2 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-white/50 text-xs">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Shirt className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-white">FreshPress Staff</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
              <p className="text-sm text-gray-500 mt-1">Sign in to your staff account to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@freshpress.ng"
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                  : <><LogIn className="w-4 h-4" /> Sign In</>
                }
              </button>
            </form>

            {/* Setup link — only shown when NO admin exists yet */}
            {adminExists === false && (
              <p className="text-center text-xs text-gray-400 mt-6">
                First time here?{' '}
                <Link to="/setup" className="text-blue-600 hover:underline font-medium">
                  Set up admin account
                </Link>
              </p>
            )}
          </div>

          <p className="text-center text-white/40 text-xs mt-6">
            FreshPress Laundry Services &mdash; Lagos, Nigeria
          </p>
        </div>
      </div>
    </div>
  );
}
