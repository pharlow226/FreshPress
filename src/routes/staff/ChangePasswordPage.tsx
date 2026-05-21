/**
 * ChangePasswordPage — Forced on first login when force_password_change = true.
 * Blocks all navigation until completed.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase, getStaffUser, setStaffUser } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLogger';

function validatePassword(pw: string): string | null {
  if (pw.length < 8)                      return 'Password must be at least 8 characters.';
  if (!/\d/.test(pw))                     return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Password must contain at least one special character.';
  return null;
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const staffUser = getStaffUser();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const requirements = [
    { label: 'At least 8 characters',      met: form.newPassword.length >= 8 },
    { label: 'Contains a number',           met: /\d/.test(form.newPassword) },
    { label: 'Contains a special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.newPassword) },
    { label: 'Passwords match',             met: form.newPassword === form.confirmPassword && form.confirmPassword.length > 0 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(form.newPassword);
    if (pwError) { setError(pwError); return; }
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    try {
      // 1. Update Supabase Auth password
      const { error: authError } = await supabase.auth.updateUser({ password: form.newPassword });
      if (authError) throw new Error(authError.message);

      // 2. Set force_password_change = false in staff_members
      const { error: dbError } = await supabase
        .from('staff_members')
        .update({ force_password_change: false, updated_at: new Date().toISOString() })
        .eq('id', staffUser?.id);
      if (dbError) throw new Error(dbError.message);

      // 3. Log activity
      if (staffUser?.id && staffUser?.name) {
        await logActivity({
          staffId:      staffUser.id,
          staffName:    staffUser.name || staffUser.full_name || '',
          activityType: 'status_changed',
          description:  'Password changed on first login',
        });
      }

      // 4. Update local session so force_password_change = false
      if (staffUser) {
        setStaffUser({ ...staffUser, force_password_change: false });
      }

      setDone(true);
      setTimeout(() => {
        const role = staffUser?.role;
        if (role === 'admin')       navigate('/admin');
        else if (role === 'accountant') navigate('/accountant');
        else                        navigate('/staff/dashboard');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-emerald-700 p-4">
        <div className="bg-white rounded-2xl p-10 text-center max-w-sm shadow-2xl">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-900 mb-2">Password Updated</h2>
          <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
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
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Set New Password</h1>
          <p className="text-white/70 mt-2 text-sm max-w-xs mx-auto">
            Your account requires a password change before you can continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-800 text-xs leading-relaxed">
              You are using a temporary password. You must set a new password to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={form.newPassword}
                  onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Requirements */}
            {form.newPassword.length > 0 && (
              <div className="space-y-1.5 bg-gray-50 rounded-xl p-3">
                {requirements.map(req => (
                  <div key={req.label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${req.met ? 'bg-green-500' : 'bg-gray-200'}`}>
                      {req.met && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-xs ${req.met ? 'text-green-700' : 'text-gray-500'}`}>{req.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || requirements.some(r => !r.met)}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Updating Password...</>
              ) : (
                <><Lock className="w-4 h-4" /> Update Password</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
