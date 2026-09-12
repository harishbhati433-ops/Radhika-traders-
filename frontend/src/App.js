import "@/App.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import api from "./lib/api";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WhatsAppFloat } from "./components/WhatsAppFloat";
import { InstallPrompt } from "./components/InstallPrompt";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ShutdownGate } from "./components/ShutdownGate";
import { CelebrationLayer } from "./components/Celebration";
import MaintenancePage from "./pages/MaintenancePage";

import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import LeadForm from "./pages/LeadForm";
import OfferEnded from "./pages/OfferEnded";
import CustomerDashboard from "./pages/customer/CustomerDashboard";

const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Contact = lazy(() => import("./pages/Contact"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Partners = lazy(() => import("./pages/Partners"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const AdminLogin = lazy(() => import("./pages/auth/AdminLogin"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ForgotEmail = lazy(() => import("./pages/auth/ForgotEmail"));

const Wallet = lazy(() => import("./pages/customer/Wallet"));
const Withdrawals = lazy(() => import("./pages/customer/Withdrawals"));
const Profile = lazy(() => import("./pages/customer/Profile"));
const WelcomeLetter = lazy(() => import("./pages/customer/WelcomeLetter"));
const Statements = lazy(() => import("./pages/customer/Statements"));
const CustomerCampaigns = lazy(() => import("./pages/customer/CustomerCampaigns"));
const MyLeads = lazy(() => import("./pages/customer/MyLeads"));
const Reports = lazy(() => import("./pages/customer/Reports"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminKyc = lazy(() => import("./pages/admin/AdminKyc"));
const AdminBroadcast = lazy(() => import("./pages/admin/AdminBroadcast"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminDedicatedReferrals = lazy(() => import("./pages/admin/AdminDedicatedReferrals"));

const Fallback = () => (
  <div className="flex min-h-screen items-center justify-center" data-testid="route-loading">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
  </div>
);

// Warm all route chunks while the browser is idle so the first click on any menu item is instant.
const CUSTOMER_CHUNKS = [() => import("./pages/customer/Wallet"), () => import("./pages/customer/Withdrawals"), () => import("./pages/customer/Profile"), () => import("./pages/customer/CustomerCampaigns"), () => import("./pages/customer/MyLeads"), () => import("./pages/customer/Statements"), () => import("./pages/customer/Reports"), () => import("./pages/customer/WelcomeLetter"), () => import("./pages/CampaignDetail")];
const ADMIN_CHUNKS = [() => import("./pages/admin/AdminDashboard"), () => import("./pages/admin/AdminCampaigns"), () => import("./pages/admin/AdminCustomers"), () => import("./pages/admin/AdminLeads"), () => import("./pages/admin/AdminKyc"), () => import("./pages/admin/AdminWithdrawals"), () => import("./pages/admin/AdminBanners"), () => import("./pages/admin/AdminBroadcast"), () => import("./pages/admin/AdminReports"), () => import("./pages/admin/AdminSecurity"), () => import("./pages/admin/AdminCategories"), () => import("./pages/admin/AdminDedicatedReferrals")];
function ChunkPrefetcher() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const list = user.role === "admin" ? ADMIN_CHUNKS : CUSTOMER_CHUNKS;
    const run = () => list.forEach((l) => l().catch(() => {}));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const id = idle(run);
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const C = (el) => <ProtectedRoute role="customer">{el}</ProtectedRoute>;
const A = (el) => <ProtectedRoute role="admin">{el}</ProtectedRoute>;

function MaintenanceRoute() {
  const [state, setState] = useState(null);
  const check = () => api.get("/status/public").then(({ data }) => setState(data)).catch(() => {});
  useEffect(() => { check(); }, []);
  if (state && !state.active) return <Navigate to="/" replace />;
  return <MaintenancePage state={state || { message: "" }} onRecheck={check} />;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <ShutdownGate>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/maintenance" element={<MaintenanceRoute />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaign/:slug" element={<CampaignDetail />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/offer-ended" element={<OfferEnded />} />
            <Route path="/join/:slug" element={<LeadForm />} />

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/forgot-email" element={<ForgotEmail />} />

            <Route path="/dashboard" element={C(<CustomerDashboard />)} />
            <Route path="/my-campaigns" element={C(<CustomerCampaigns />)} />
            <Route path="/wallet" element={C(<Wallet />)} />
            <Route path="/withdrawals" element={C(<Withdrawals />)} />
            <Route path="/statements" element={C(<Statements />)} />
            <Route path="/profile" element={C(<Profile />)} />
            <Route path="/welcome-letter" element={C(<WelcomeLetter />)} />
            <Route path="/my-leads" element={C(<MyLeads />)} />
            <Route path="/reports" element={C(<Reports />)} />

            <Route path="/admin" element={A(<AdminDashboard />)} />
            <Route path="/admin/campaigns" element={A(<AdminCampaigns />)} />
            <Route path="/admin/categories" element={A(<AdminCategories />)} />
            <Route path="/admin/customers" element={A(<AdminCustomers />)} />
            <Route path="/admin/withdrawals" element={A(<AdminWithdrawals />)} />
            <Route path="/admin/banners" element={A(<AdminBanners />)} />
            <Route path="/admin/kyc" element={A(<AdminKyc />)} />
            <Route path="/admin/broadcast" element={A(<AdminBroadcast />)} />
            <Route path="/admin/leads" element={A(<AdminLeads />)} />
            <Route path="/admin/security" element={A(<AdminSecurity />)} />
            <Route path="/admin/reports" element={A(<AdminReports />)} />
            <Route path="/admin/dedicated-referrals" element={A(<AdminDedicatedReferrals />)} />
          </Routes>
        </Suspense>
        </ShutdownGate>
        <WhatsAppFloat />
        <InstallPrompt />
        <CelebrationLayer />
        <ChunkPrefetcher />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
