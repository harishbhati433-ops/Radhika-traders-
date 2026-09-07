import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { WhatsAppFloat } from "./components/WhatsAppFloat";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import AdminLogin from "./pages/auth/AdminLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";

import CustomerDashboard from "./pages/customer/CustomerDashboard";
import Wallet from "./pages/customer/Wallet";
import Withdrawals from "./pages/customer/Withdrawals";
import Profile from "./pages/customer/Profile";
import Statements from "./pages/customer/Statements";
import CustomerCampaigns from "./pages/customer/CustomerCampaigns";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminKyc from "./pages/admin/AdminKyc";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import OfferEnded from "./pages/OfferEnded";
import Partners from "./pages/Partners";
import LeadForm from "./pages/LeadForm";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminSecurity from "./pages/admin/AdminSecurity";
import MyLeads from "./pages/customer/MyLeads";
import ForgotEmail from "./pages/auth/ForgotEmail";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaign/:slug" element={<CampaignDetail />} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/dashboard" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/my-campaigns" element={<ProtectedRoute role="customer"><CustomerCampaigns /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute role="customer"><Wallet /></ProtectedRoute>} />
          <Route path="/withdrawals" element={<ProtectedRoute role="customer"><Withdrawals /></ProtectedRoute>} />
          <Route path="/statements" element={<ProtectedRoute role="customer"><Statements /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute role="customer"><Profile /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/campaigns" element={<ProtectedRoute role="admin"><AdminCampaigns /></ProtectedRoute>} />
          <Route path="/admin/categories" element={<ProtectedRoute role="admin"><AdminCategories /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute role="admin"><AdminCustomers /></ProtectedRoute>} />
          <Route path="/admin/withdrawals" element={<ProtectedRoute role="admin"><AdminWithdrawals /></ProtectedRoute>} />
          <Route path="/admin/banners" element={<ProtectedRoute role="admin"><AdminBanners /></ProtectedRoute>} />
          <Route path="/admin/kyc" element={<ProtectedRoute role="admin"><AdminKyc /></ProtectedRoute>} />
          <Route path="/admin/broadcast" element={<ProtectedRoute role="admin"><AdminBroadcast /></ProtectedRoute>} />
          <Route path="/offer-ended" element={<OfferEnded />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/join/:slug" element={<LeadForm />} />
          <Route path="/forgot-email" element={<ForgotEmail />} />
          <Route path="/my-leads" element={<ProtectedRoute role="customer"><MyLeads /></ProtectedRoute>} />
          <Route path="/admin/leads" element={<ProtectedRoute role="admin"><AdminLeads /></ProtectedRoute>} />
          <Route path="/admin/security" element={<ProtectedRoute role="admin"><AdminSecurity /></ProtectedRoute>} />
        </Routes>
        <WhatsAppFloat />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
