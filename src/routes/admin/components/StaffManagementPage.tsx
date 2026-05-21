/**
 * StaffManagementPage — Full admin staff management.
 * Features: Add Staff, Delete Staff (with confirmation), availability status, force_password_change badge.
 *
 * RLS NOTE: If staff list only shows 1 row, run this SQL in Supabase SQL editor:
 * CREATE POLICY "admins_read_all_staff" ON staff_members
 *   FOR SELECT TO authenticated
 *   USING (auth.uid() IN (SELECT id FROM staff_members WHERE role = 'admin'));
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  UserPlus, Trash2, X, Loader2, CheckCircle, AlertCircle, Mail, Phone, User, Shield, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const CREATE_STAFF_URL  = import.meta.env.VITE_CREATE_STAFF_URL  as string;
const DELETE_STAFF_URL  = import.meta.env.VITE_DELETE_STAFF_URL  as string;
const UPDATE_STAFF_URL  = import.meta.env.VITE_UPDATE_STAFF_URL  as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function edgeHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  pickup:     'bg-blue-100 text-blue-800',
  accountant: 'bg-green-100 text-green-800',
  admin:      'bg-purple-100 text-purple-800',
};

const AVAIL_BADGE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  on_leave:  'bg-amber-100 text-amber-800',
  sick:      'bg-red-100 text-red-800',
};

const AVAIL_LABEL: Record<string, string> = {
  available: 'Available',
  on_leave:  'On Leave',
  sick:      'Sick',
};

// ── Add Staff Modal ───────────────────────────────────────────────────────────

function AddStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]         = useState({ full_name: '', email: '', phone: '', role: 'pickup' as 'pickup' | 'accountant' | 'admin' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim() || !form.email.trim()) { setError('Full name and email are required.'); return; }
    if (!CREATE_STAFF_URL || CREATE_STAFF_URL.includes('undefined')) { setError('Staff creation URL not configured. Set VITE_CREATE_STAFF_URL in .env'); return; }

    setSubmitting(true);
    try {
      const res  = await fetch(CREATE_STAFF_URL, { method: 'POST', headers: edgeHeaders(), body: JSON.stringify({ full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, role: form.role }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create staff account');
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Add Staff Member</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Account Created</h3>
            <p className="text-sm text-gray-500">Welcome email with temporary password sent.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {[{ label: 'Full Name', field: 'full_name', type: 'text', Icon: User, placeholder: 'Samuel Faloye' },
              { label: 'Email', field: 'email', type: 'email', Icon: Mail, placeholder: 'staff@freshpress.ng' },
              { label: 'Phone (optional)', field: 'phone', type: 'tel', Icon: Phone, placeholder: '+234 811 000 0000' }
            ].map(({ label, field, type, Icon, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={type} required={field !== 'phone'} value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="pickup">Pickup (Driver / Courier)</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Create Account</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Edit Staff Modal ─────────────────────────────────────────────────────────

function EditStaffModal({ staff, onClose, onSuccess }: { staff: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]         = useState({ full_name: staff.full_name || '', phone: staff.phone || '', email: staff.email || '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [warning, setWarning]   = useState<string | null>(null);
  const emailChanged = form.email.trim().toLowerCase() !== (staff.email || '').toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setWarning(null);
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { setError('A valid email is required.'); return; }
    if (!UPDATE_STAFF_URL || UPDATE_STAFF_URL.includes('undefined')) { setError('Update URL not configured. Set VITE_UPDATE_STAFF_URL in .env'); return; }

    setSubmitting(true);
    try {
      const patch: Record<string, string | null> = {};
      if (form.full_name.trim() !== staff.full_name) patch.full_name = form.full_name.trim();
      if (form.phone.trim() !== (staff.phone || '')) patch.phone = form.phone.trim() || null;
      if (emailChanged) patch.email = form.email.trim().toLowerCase();
      if (Object.keys(patch).length === 0) { onClose(); return; } // nothing changed

      const res  = await fetch(UPDATE_STAFF_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body:    JSON.stringify({ staffId: staff.id, ...patch }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update staff profile.');
      if (data.warning) setWarning(data.warning);
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, data.warning ? 3000 : 1500);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Edit Staff Profile</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Profile Updated</h3>
            {warning && <p className="text-sm text-amber-600 mt-1">{warning}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" required value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" value={form.phone} placeholder="+234 811 000 0000 or +44 7911 123456"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <p className="mt-1 text-xs text-gray-400">Any international format — stored exactly as entered.</p>
            </div>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {emailChanged && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Changing email will also update this staff member's login credentials.
                </p>
              )}
            </div>
            {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-700 text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Pencil className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


function DeleteDialog({ staff, onClose, onDeleted }: { staff: any; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      if (DELETE_STAFF_URL && !DELETE_STAFF_URL.includes('undefined')) {
        const res  = await fetch(DELETE_STAFF_URL, { method: 'POST', headers: edgeHeaders(), body: JSON.stringify({ staffId: staff.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to delete staff');
      } else {
        // Fallback: DB-only delete (auth user stays — admin must remove from Supabase Dashboard)
        const { error: dbErr } = await supabase.from('staff_members').delete().eq('id', staff.id);
        if (dbErr) throw new Error(dbErr.message);
        toast({ title: 'Note', description: 'DB record deleted. Remove auth user from Supabase Dashboard manually (VITE_DELETE_STAFF_URL not configured).', variant: 'destructive' });
      }
      toast({ title: 'Deleted', description: `${staff.full_name} has been removed.` });
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Remove Staff Member</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-4">
          You are about to permanently delete <strong>{staff.full_name}</strong> ({staff.email}). Their login access will also be revoked.
        </p>
        {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function StaffManagementPage() {
  const [staff, setStaff]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget,   setEditTarget]   = useState<any>(null);
  // Availability confirmation: { staffRow, newStatus }
  const [availConfirm, setAvailConfirm] = useState<{ row: any; status: string } | null>(null);
  const [availSaving,  setAvailSaving]  = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) console.error('[StaffManagement] fetch error:', error.message);
    if (data) setStaff(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    const ch = supabase.channel('admin-staff-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, () => fetchStaff())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchStaff]);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('staff_members').update({ active: !current }).eq('id', id);
    if (error) toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    else { toast({ title: 'Updated', description: `Staff member ${!current ? 'activated' : 'deactivated'}` }); fetchStaff(); }
  };

  const setAvailability = async (id: string, status: string) => {
    setAvailSaving(true);
    const { error } = await supabase.from('staff_members').update({ availability_status: status }).eq('id', id);
    setAvailSaving(false);
    setAvailConfirm(null);
    if (error) toast({ title: 'Error', description: 'Failed to update availability', variant: 'destructive' });
    else { toast({ title: 'Updated', description: `Availability set to ${AVAIL_LABEL[status]}` }); fetchStaff(); }
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>;
  }

  return (
    <>
      {showAdd      && <AddStaffModal onClose={() => setShowAdd(false)} onSuccess={fetchStaff} />}
      {deleteTarget && <DeleteDialog staff={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchStaff} />}
      {editTarget   && <EditStaffModal staff={editTarget} onClose={() => setEditTarget(null)} onSuccess={fetchStaff} />}

      {/* Availability confirmation dialog */}
      {availConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Change Availability?</h3>
            <p className="text-sm text-gray-600 mb-5">
              Set <strong>{availConfirm.row.full_name}</strong> to{' '}
              <span className={`font-semibold ${AVAIL_BADGE[availConfirm.status]}`}>
                {AVAIL_LABEL[availConfirm.status]}
              </span>?
              {availConfirm.status !== 'available' && (
                <span className="block mt-1 text-xs text-amber-600">
                  This staff member will be skipped in order assignment until marked Available again.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setAvailConfirm(null)} disabled={availSaving}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => setAvailability(availConfirm.row.id, availConfirm.status)}
                disabled={availSaving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {availSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Staff Management</h2>
            <p className="text-sm text-muted-foreground mt-1">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <UserPlus className="w-4 h-4" /> Add Staff
          </button>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Pwd Change</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No staff members found.
                    <span className="block text-xs mt-1 text-orange-500">If you expect rows here, run the RLS fix SQL in Supabase SQL Editor — see code comment at top of file.</span>
                  </TableCell></TableRow>
                ) : staff.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                    <TableCell className="text-sm">{s.phone || '—'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[s.role] || 'bg-gray-100 text-gray-800'}`}>{s.role}</span>
                    </TableCell>
                    <TableCell>
                      <select
                        value={s.availability_status || 'available'}
                        onChange={e => {
                          const newStatus = e.target.value;
                          if (newStatus !== (s.availability_status || 'available')) {
                            setAvailConfirm({ row: s, status: newStatus });
                          }
                        }}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${AVAIL_BADGE[s.availability_status || 'available']}`}
                      >
                        <option value="available">Available</option>
                        <option value="on_leave">On Leave</option>
                        <option value="sick">Sick</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      {s.force_password_change
                        ? <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending</span>
                        : <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Done</span>}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={() => toggleActive(s.id, s.active)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditTarget(s)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit staff profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete staff member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
