/**
 * ResetPasswordPage — Staff uses emailed link to set a new password.
 * Route: /reset-password?token=...&staff_id=...
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const RESET_URL = import.meta.env.VITE_RESET_PASSWORD_URL as string;
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY  as string;

// ── Password requirements matching the edge function ─────────────────────────
function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8)  return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))     return 'Password must contain at least one uppercase letter.';
  if (!/\d/.test(pw))        return 'Password must contain at least one number.';
  return null;
}

const REQUIREMENTS = [
  { label: 'At least 8 characters',       test: (pw: string) => pw.length >= 8 },
  { label: 'At least one uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'At least one number',          test: (pw: string) => /\d/.test(pw) },
];

export default function ResetPasswordPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();

  const token    = params.get('token')    ?? '';
  const staffId  = params.get('staff_id') ?? '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [done,            setDone]            = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Guard: if token or staff_id are missing, show invalid link state immediately
  const missingParams = !token || !staffId;

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => navigate('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [done, navigate]);

  const allMet = REQUIREMENTS.every(r => r.test(newPassword)) && newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(newPassword);
    if (pwError) { setError(pwError); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    if (!RESET_URL || RESET_URL.includes('undefined')) {
      setError('Password reset is not configured. Contact your administrator.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(RESET_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          staff_id:     staffId,
          reset_token:  token,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.status === 410) throw new Error('This reset link has expired. Please request a new one.');
      if (!data.success)      throw new Error(data.message || 'Failed to reset password. Please try again.');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Invalid / missing params ────────────────────────────────────────────────
  if (missingParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-9 h-9 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Invalid Reset Link</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            This password reset link is invalid or has already been used. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-xl font-bold text-sm text-center hover:shadow-lg transition-all"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Password Updated</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            Your password has been successfully reset. You can now log in.
          </p>
          <p className="text-xs text-gray-400 mb-6">Redirecting to login in 3 seconds...</p>
          <Link
            to="/login"
            className="inline-block w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-xl font-bold text-sm text-center hover:shadow-lg transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-gradient-from))] to-[hsl(var(--brand-gradient-to))] p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Set New Password</h1>
          <p className="text-white/70 mt-2 text-sm max-w-xs mx-auto">
            Choose a strong password for your FreshPress staff account.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* New password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); if (error) setError(null); }}
                  placeholder="Enter new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live requirements */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5 bg-gray-50 rounded-xl p-3">
                {REQUIREMENTS.map(req => {
                  const met = req.test(newPassword);
                  return (
                    <div key={req.label} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${met ? 'bg-green-500' : 'bg-gray-200'}`}>
                        {met && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs ${met ? 'text-green-700 font-medium' : 'text-gray-500'}`}>{req.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (error) setError(null); }}
                  placeholder="Repeat new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">Passwords do not match.</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              id="reset-submit"
              type="submit"
              disabled={submitting || !allMet}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating Password...</>
                : <><Lock className="w-4 h-4" /> Update Password</>}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-gray-100 mt-5">
            <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
