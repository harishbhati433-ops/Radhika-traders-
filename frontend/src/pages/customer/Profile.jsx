import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ImageUpload } from "../../components/ImageUpload";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

export default function Profile() {
  const { user, setUser, refresh } = useAuth();
  const [p, setP] = useState({ name: user?.name || "", mobile: user?.mobile || "", address: user?.address || "" });
  const [kyc, setKyc] = useState({
    account_holder: user?.bank?.account_holder || user?.name || "", pan: user?.kyc?.pan || "",
    aadhaar: user?.kyc?.aadhaar || "", bank_account: user?.bank?.bank_account || "",
    ifsc: user?.bank?.ifsc || "", upi: user?.bank?.upi || "", upi_qr_url: user?.bank?.upi_qr_url || "",
  });
  const [savingP, setSavingP] = useState(false);
  const [savingK, setSavingK] = useState(false);

  const status = user?.kyc?.status || "not_submitted";
  const statusMap = {
    verified: [ShieldCheck, "text-emerald-600 bg-emerald-50", "Verified"],
    pending: [ShieldQuestion, "text-amber-600 bg-amber-50", "Under Review"],
    rejected: [ShieldAlert, "text-rose-600 bg-rose-50", "Rejected"],
    deactivated: [ShieldAlert, "text-slate-600 bg-slate-100", "Deactivated"],
    not_submitted: [ShieldAlert, "text-rose-600 bg-rose-50", "Not Submitted"],
  };
  const [SIcon, scls, slabel] = statusMap[status] || statusMap.not_submitted;

  const saveProfile = async (e) => {
    e.preventDefault(); setSavingP(true);
    try { const { data } = await api.put("/profile", p); setUser(data); toast.success("Profile updated"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSavingP(false); }
  };

  const saveKyc = async (e) => {
    e.preventDefault(); setSavingK(true);
    try { const { data } = await api.put("/profile/kyc", kyc); setUser(data); toast.success("KYC submitted for review"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSavingK(false); }
  };

  const setK = (k) => (e) => setKyc({ ...kyc, [k]: e.target.value });

  return (
    <DashboardLayout nav={customerNav} title="Profile & KYC">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Personal Details</h2>
          <div className="mt-4 space-y-4">
            <div><Label>Full Name</Label><Input data-testid="profile-name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Email</Label><Input value={user?.email} disabled className="mt-1.5 bg-slate-50" /></div>
            <div><Label>Mobile</Label><Input data-testid="profile-mobile" value={p.mobile} onChange={(e) => setP({ ...p, mobile: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Address</Label><Input data-testid="profile-address" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} className="mt-1.5" /></div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Referral Code: <span className="font-mono font-bold text-slate-800">{user?.referral_code}</span></div>
            <button type="submit" data-testid="profile-save" disabled={savingP} className="rt-gradient-btn flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
              {savingP && <Loader2 className="h-4 w-4 animate-spin" />} Save Profile
            </button>
          </div>
        </form>

        <form onSubmit={saveKyc} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">KYC & Bank Details</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${scls}`} data-testid="kyc-status"><SIcon className="h-3.5 w-3.5" /> {slabel}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Required before withdrawals. Kept secure & private.</p>
          <div className="mt-4 space-y-4">
            <div><Label>Account Holder Name</Label><Input data-testid="kyc-holder" required value={kyc.account_holder} onChange={setK("account_holder")} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PAN</Label><Input data-testid="kyc-pan" required value={kyc.pan} onChange={setK("pan")} className="mt-1.5" placeholder="ABCDE1234F" /></div>
              <div><Label>Aadhaar</Label><Input data-testid="kyc-aadhaar" value={kyc.aadhaar} onChange={setK("aadhaar")} className="mt-1.5" placeholder="Optional" /></div>
            </div>
            <div><Label>Bank Account Number</Label><Input data-testid="kyc-account" required value={kyc.bank_account} onChange={setK("bank_account")} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IFSC</Label><Input data-testid="kyc-ifsc" required value={kyc.ifsc} onChange={setK("ifsc")} className="mt-1.5" /></div>
              <div><Label>UPI ID</Label><Input data-testid="kyc-upi" value={kyc.upi} onChange={setK("upi")} className="mt-1.5" placeholder="name@upi" /></div>
            </div>
            <ImageUpload label="UPI QR code (optional — PhonePe / GPay / Paytm QR screenshot)" value={kyc.upi_qr_url} onChange={(v) => setKyc({ ...kyc, upi_qr_url: v })} testId="kyc-upi-qr" />
            <button type="submit" data-testid="kyc-save" disabled={savingK} className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:brightness-125 disabled:opacity-60">
              {savingK && <Loader2 className="h-4 w-4 animate-spin" />} Submit KYC
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
