/**
 * ForgotPasswordPage — Sends a password reset email to staff.
 * Route: /forgot-password
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle, Shirt } from 'lucide-react';

const FORGOT_URL = import.meta.env.VITE_FORGOT_PASSWORD_URL as string;
const ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY   as string;

export default function ForgotPasswordPage() {
  const [email,       setEmail]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!FORGOT_URL || FORGOT_URL.includes('undefined')) {
      setError('Password reset is not configured. Contact your administrator.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(FORGOT_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to send reset email.');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Check Your Email</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            If <span className="font-semibold text-gray-700">{email}</span> is registered, you will receive a password reset link shortly.
            The link expires in <strong>1 hour</strong>.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Did not receive it? Check your spam folder or request a new link.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
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
            <Shirt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Forgot Password?</h1>
          <p className="text-white/70 mt-2 text-sm max-w-xs mx-auto">
            Enter your staff email address and we will send you a reset link.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError(null); }}
                  placeholder="john@freshpress.ng"
                  autoComplete="email"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              id="forgot-submit"
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link...</>
                : <><Mail className="w-4 h-4" /> Send Reset Link</>}
            </button>
          </form>

          <div className="text-center pt-1">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
