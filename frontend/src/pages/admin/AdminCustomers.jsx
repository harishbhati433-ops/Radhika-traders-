import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { PhoneLink, EmailLink } from "../../components/ContactLinks";
import { Search, Wallet, ShieldCheck, ShieldAlert, ShieldQuestion, Plus, Loader2, SlidersHorizontal, UserCog, FileText } from "lucide-react";
import { CustomerStatementDialog } from "../../components/CustomerStatementDialog";
import { AccountStatusControl, ACCOUNT_TONE } from "../../components/AccountStatusControl";
import { WalletAdjustDialog } from "../../components/WalletAdjustDialog";
import { CustomerEditDialog } from "../../components/CustomerEditDialog";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [active, setActive] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const [edit, setEdit] = useState(null);
  const [stmt, setStmt] = useState(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("Affiliate earning credit");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/customers", { params: { include_deleted: showDeleted } }).then(({ data }) => setCustomers(data));
  useEffect(() => { load(); }, [showDeleted]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input data-testid="customer-search" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} data-testid="customer-show-deleted" /> Show deleted</label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white rt-scroll">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="p-4">Customer</th><th className="p-4">Mobile</th><th className="p-4">KYC</th><th className="p-4">Status</th><th className="p-4">Balance</th><th className="p-4">Earnings</th><th className="p-4">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id} data-testid={`customer-row-${c.id}`} className={c.account_status && c.account_status !== "active" ? "bg-slate-50/60" : ""}>
                <td className="p-4"><div className="font-semibold text-slate-800">{c.name}</div><div className="mt-1"><EmailLink value={c.email} testId={`customer-email-${c.id}`} /></div><div className="mt-1 font-mono text-[10px] text-slate-400">{c.referral_code}</div></td>
                <td className="p-4"><PhoneLink value={c.mobile} testId={`customer-phone-${c.id}`} /></td>
                <td className="p-4"><span className="inline-flex items-center gap-1 text-xs font-semibold capitalize">{kycIcon(c.kyc?.status)} {c.kyc?.status?.replace("_", " ")}</span></td>
                <td className="p-4">
                  <span data-testid={`customer-status-${c.id}`} className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${ACCOUNT_TONE[c.account_status || "active"]}`}>{c.account_status === "deactivated" ? "Paused" : (c.account_status || "active")}</span>
                  {c.account_status_reason && <div className="mt-1 max-w-[180px] text-[11px] text-slate-500" title={c.account_status_reason}>{c.account_status_reason}</div>}
                </td>
                <td className="p-4 font-mono font-bold text-emerald-600">₹{c.wallet?.balance}</td>
                <td className="p-4 font-mono text-slate-700">₹{c.wallet?.total_earnings}</td>
                <td className="p-4">
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => setStmt(c.id)} data-testid={`statement-btn-${c.id}`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      <FileText className="h-3.5 w-3.5" /> Statement
                    </button>
                    {c.account_status !== "deleted" && (
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setActive(c)} data-testid={`credit-btn-${c.id}`} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:brightness-125">
                          <Plus className="h-3.5 w-3.5" /> Credit
                        </button>
                        <button onClick={() => setAdjust(c)} data-testid={`adjust-btn-${c.id}`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">
                          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
                        </button>
                        <button onClick={() => setEdit(c)} data-testid={`edit-btn-${c.id}`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          <UserCog className="h-3.5 w-3.5" /> Edit
                        </button>
                      </div>
                    )}
                    <AccountStatusControl customer={c} onChanged={load} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No customers found.</td></tr>}
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
      <WalletAdjustDialog customer={adjust} open={!!adjust} onClose={() => setAdjust(null)} onDone={load} />
      <CustomerEditDialog customerId={edit?.id} open={!!edit} onClose={() => setEdit(null)} onDone={load} />
      <CustomerStatementDialog userId={stmt} onClose={() => setStmt(null)} />
    </DashboardLayout>
  );
}
