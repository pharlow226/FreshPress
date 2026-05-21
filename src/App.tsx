/**
 * FreshPress — Unified Application Router
 *
 * Route structure:
 *   /                       Customer-facing (public)
 *   /staff                  Staff login + pickup dashboard
 *   /admin                  Admin dashboard (role: admin)
 *   /accountant             Accountant dashboard (role: accountant)
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

// ── Lazy-loaded routes (each chunk independent — one bad import won't kill the page) ──
const CustomerLayout     = lazy(() => import('@/routes/customer/Layout'));
const Landing            = lazy(() => import('@/routes/customer/Landing'));
const PricingPage        = lazy(() => import('@/routes/customer/components/PricingPage'));
const OrderPage          = lazy(() => import('@/routes/customer/components/OrderPage'));
const OrderTrackingPage  = lazy(() => import('@/routes/customer/components/OrderTrackingPage'));
const StaffIndex         = lazy(() => import('@/routes/staff/Index'));
const LoginPage          = lazy(() => import('@/routes/staff/LoginPage'));
const SetupPage          = lazy(() => import('@/routes/staff/SetupPage'));
const ChangePasswordPage = lazy(() => import('@/routes/staff/ChangePasswordPage'));
const ForgotPasswordPage = lazy(() => import('@/routes/staff/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('@/routes/staff/ResetPasswordPage'));
const AdminDashboard     = lazy(() => import('@/routes/admin/AdminDashboard'));
const AccountantDashboard = lazy(() => import('@/routes/accountant/AccountantDashboard'));
const NotFound           = lazy(() => import('@/routes/NotFound'));

// ── Fallback shown while route chunk is loading ────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-brand-accent/30 border-t-brand-accent animate-spin" />
      <p className="text-muted-foreground text-sm">Loading FreshPress...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ── Customer (public) ──────────────────────────────── */}
            <Route path="/" element={<CustomerLayout />}>
              <Route index                   element={<Landing />} />
              <Route path="pricing"          element={<PricingPage />} />
              <Route path="request-pickup"   element={<OrderPage />} />
              <Route path="track"            element={<OrderTrackingPage />} />
              <Route path="order"            element={<Navigate to="/request-pickup" replace />} />
            </Route>

            {/* -- Staff login ----------------------------------------- */}
            <Route path="/login" element={<LoginPage />} />

            {/* -- Staff dashboard (pickup role) ----------------------- */}
            <Route path="/staff/*" element={<StaffIndex />} />

            {/* ── First-time setup (bootstrap) ─────────────────── */}
            <Route path="/setup" element={<SetupPage />} />

            {/* ── Forced password change ────────────────────────── */}
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* ── Admin ─────────────────────────────────────────── */}
            <Route path="/admin" element={<AdminDashboard />} />

            {/* ── Accountant ──────────────────────────────────────── */}
            <Route path="/accountant" element={<AccountantDashboard />} />

            {/* -- Legacy redirects ------------------------------------- */}
            <Route path="/staff"                element={<Navigate to="/login"      replace />} />
            <Route path="/admin-dashboard"      element={<Navigate to="/admin"      replace />} />
            <Route path="/accountant-dashboard" element={<Navigate to="/accountant" replace />} />
            {/* ── Forgot / reset password (public — staff email flow) ─── */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />

            {/* ── 404 ──────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

