import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { PhoneLink, EmailLink } from "../../components/ContactLinks";
import { Search, Wallet, ShieldCheck, ShieldAlert, ShieldQuestion, Plus, Loader2 } from "lucide-react";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("Affiliate earning credit");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/customers").then(({ data }) => setCustomers(data));
  useEffect(() => { load(); }, []);

  const credit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/admin/credit", { user_id: active.id, amount: parseFloat(amount), description: desc });
      toast.success(`₹${amount} credited to ${active.name}`);
      setActive(null); setAmount(""); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const kycIcon = (s) => s === "verified" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : s === "pending" ? <ShieldQuestion className="h-3.5 w-3.5 text-amber-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />;

  const filtered = customers.filter((c) => (c.name + c.email + c.mobile).toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout nav={adminNav} title="Customers">
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input data-testid="customer-search" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white rt-scroll">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="p-4">Customer</th><th className="p-4">Mobile</th><th className="p-4">KYC</th><th className="p-4">Balance</th><th className="p-4">Earnings</th><th className="p-4">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id} data-testid={`customer-row-${c.id}`}>
                <td className="p-4"><div className="font-semibold text-slate-800">{c.name}</div><div className="mt-1"><EmailLink value={c.email} testId={`customer-email-${c.id}`} /></div><div className="mt-1 font-mono text-[10px] text-slate-400">{c.referral_code}</div></td>
                <td className="p-4"><PhoneLink value={c.mobile} testId={`customer-phone-${c.id}`} /></td>
                <td className="p-4"><span className="inline-flex items-center gap-1 text-xs font-semibold capitalize">{kycIcon(c.kyc?.status)} {c.kyc?.status?.replace("_", " ")}</span></td>
                <td className="p-4 font-mono font-bold text-emerald-600">₹{c.wallet?.balance}</td>
                <td className="p-4 font-mono text-slate-700">₹{c.wallet?.total_earnings}</td>
                <td className="p-4">
                  <button onClick={() => setActive(c)} data-testid={`credit-btn-${c.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:brightness-125">
                    <Plus className="h-3.5 w-3.5" /> Credit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent data-testid="credit-modal">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-red-600" /> Credit Wallet — {active?.name}</DialogTitle></DialogHeader>
          <form onSubmit={credit} className="space-y-4">
            <div><Label>Amount (₹)</Label><Input data-testid="credit-amount" type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Description</Label><Input data-testid="credit-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1.5" /></div>
            <button type="submit" data-testid="credit-submit" disabled={busy} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Credit Wallet
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
