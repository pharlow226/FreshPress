/**
 * AdminDashboard — updated for merged app
 * Changes from original stafffreshpress-main/src/pages/AdminDashboard.tsx:
 *   - getStaffUser import → @/lib/supabase
 *   - clearStaffUser + staffSignOut from @/lib/operations (instead of raw localStorage)
 *   - Redirect target → /staff (new login route)
 *   - All sub-component imports corrected to new paths
 *   - All other UI/JSX: unchanged
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar }          from '@/routes/admin/components/AdminSidebar';
import { OverviewPage }          from '@/routes/admin/components/OverviewPage';
import { AllOrdersPage }         from '@/routes/admin/components/AllOrdersPage';
import { StaffManagementPage }   from '@/routes/admin/components/StaffManagementPage';
import { PricingManagementPage } from '@/routes/admin/components/PricingManagementPage';
import { CustomersPage }         from '@/routes/admin/components/CustomersPage';
import { ActivityLogPage }       from '@/routes/admin/components/ActivityLogPage';
import { CompanySettingsPage }   from '@/routes/admin/components/CompanySettingsPage';
import { getStaffUser, clearStaffUser } from '@/lib/supabase';
import { staffSignOut } from '@/lib/operations';

export default function AdminDashboard() {
  const navigate  = useNavigate();
  const [activePage, setActivePage] = useState('overview');
  const staffUser = getStaffUser();

  useEffect(() => {
    if (!staffUser || staffUser.role !== 'admin') {
      navigate('/staff');
    }
  }, [staffUser, navigate]);

  if (!staffUser || staffUser.role !== 'admin') return null;

  const handleLogout = async () => {
    clearStaffUser();
    await staffSignOut();
    navigate('/staff');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'overview':  return <OverviewPage />;
      case 'orders':    return <AllOrdersPage />;
      case 'staff':     return <StaffManagementPage />;
      case 'pricing':   return <PricingManagementPage />;
      case 'customers': return <CustomersPage />;
      case 'activity':  return <ActivityLogPage />;
      case 'settings':  return <CompanySettingsPage />;
      default:          return <OverviewPage />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
          userName={staffUser.name || staffUser.full_name || 'Admin'}
          userRole={staffUser.role}
        />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-4 sticky top-0 z-50">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-bold text-foreground capitalize">{activePage.replace('_', ' ')}</h1>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 bg-muted/30 overflow-auto">
            {renderPage()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
