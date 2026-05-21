/**
 * ProfileEditModal — Self-service profile edit for staff members.
 * Staff can update their own Full Name and Phone number.
 * Email is intentionally excluded (only admin can change email via update-staff).
 *
 * Usage:
 *   <ProfileEditModal
 *     staffId="uuid"
 *     currentName="John Thomas"
 *     currentPhone="+234 811 000 0000"
 *     onClose={() => setShow(false)}
 *     onSuccess={(name, phone) => { setStaffUser({ ...user, name }); }}
 *   />
 */
import { useState } from 'react';
import { User, Phone, Pencil, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const UPDATE_STAFF_URL = import.meta.env.VITE_UPDATE_STAFF_URL  as string;
const ANON_KEY         = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Props {
  staffId:      string;
  currentName:  string;
  currentPhone: string;
  onClose:      () => void;
  /** Called with the new name and phone on successful save */
  onSuccess:    (newName: string, newPhone: string) => void;
}

export function ProfileEditModal({ staffId, currentName, currentPhone, onClose, onSuccess }: Props) {
  const [name,       setName]       = useState(currentName);
  const [phone,      setPhone]      = useState(currentPhone);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!UPDATE_STAFF_URL || UPDATE_STAFF_URL.includes('undefined')) {
      setError('Profile update is not configured. Contact your administrator.');
      return;
    }

    // Build patch — only send fields that actually changed
    const patch: Record<string, string | null> = {};
    if (name.trim()  !== currentName)  patch.full_name = name.trim();
    if (phone.trim() !== currentPhone) patch.phone     = phone.trim() || null;

    if (Object.keys(patch).length === 0) { onClose(); return; }

    setSubmitting(true);
    try {
      const res  = await fetch(UPDATE_STAFF_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ staffId, ...patch }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update profile.');
      setDone(true);
      setTimeout(() => {
        onSuccess(name.trim(), phone.trim());
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Edit My Profile</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-1">Profile Updated</h3>
            <p className="text-sm text-gray-400">Your changes have been saved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => { setName(e.target.value); if (error) setError(null); }}
                  placeholder="Your full name"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+234 811 000 0000"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Any international format — stored exactly as entered.</p>
            </div>

            {/* Note: email not editable */}
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              To change your email address, contact your administrator.
            </p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} disabled={submitting}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <><Pencil className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
