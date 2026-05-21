/**
 * AccountantDashboard — updated for merged app
 * Changes from original:
 *   - Imports corrected to new paths
 *   - Logout uses clearStaffUser + staffSignOut from operations
 *   - Redirect → /staff
 *   - Profile edit modal added (name + phone self-service)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AccountantSidebar }    from '@/routes/accountant/components/AccountantSidebar';
import { PendingPaymentsPage }  from '@/routes/accountant/components/PendingPaymentsPage';
import { PaymentHistoryPage }   from '@/routes/accountant/components/PaymentHistoryPage';
import { getStaffUser, clearStaffUser, setStaffUser } from '@/lib/supabase';
import { staffSignOut } from '@/lib/operations';
import { ProfileEditModal } from '@/components/shared/ProfileEditModal';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

export default function AccountantDashboard() {
  const navigate  = useNavigate();
  const [activePage,      setActivePage]      = useState('pending');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const staffUser = getStaffUser();

  useEffect(() => {
    if (!staffUser || staffUser.role !== 'accountant') {
      navigate('/staff');
    }
  }, [staffUser, navigate]);

  if (!staffUser || staffUser.role !== 'accountant') return null;

  const handleLogout = async () => {
    clearStaffUser();
    await staffSignOut();
    navigate('/staff');
  };

  return (
    <SidebarProvider>
      <Toaster />

      {showProfileEdit && (
        <ProfileEditModal
          staffId={staffUser.id}
          currentName={staffUser.name || staffUser.full_name || ''}
          currentPhone={staffUser.phone || ''}
          onClose={() => setShowProfileEdit(false)}
          onSuccess={(newName, newPhone) => {
            setStaffUser({ ...staffUser, name: newName, full_name: newName, phone: newPhone });
            toast({ title: 'Profile updated', description: 'Your name and phone have been saved.' });
          }}
        />
      )}

      <div className="min-h-screen flex w-full">
        <AccountantSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
          userName={staffUser.name || staffUser.full_name || 'Accountant'}
        />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-4 sticky top-0 z-50">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-bold text-foreground flex-1">
              {activePage === 'pending' ? 'Pending Payments' : 'Payment History'}
            </h1>
            {/* Self-service profile edit */}
            <button
              onClick={() => setShowProfileEdit(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
              title="Edit my profile"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-medium">{staffUser.name || staffUser.full_name}</span>
            </button>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 bg-muted/30 overflow-auto">
            {activePage === 'pending' ? <PendingPaymentsPage /> : <PaymentHistoryPage />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
