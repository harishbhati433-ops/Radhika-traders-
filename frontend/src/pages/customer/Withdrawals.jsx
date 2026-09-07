import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";

const STATUS = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-sky-50 text-sky-700 border-sky-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Withdrawals() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [list, setList] = useState([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get("/wallet").then(({ data }) => setWallet(data));
    api.get("/withdrawals").then(({ data }) => setList(data));
  };
  useEffect(load, []);

  const kycDone = user?.kyc?.status === "verified";
  const kycState = user?.kyc?.status;
  const bank = user?.bank || {};
  const saved = method === "UPI" ? bank.upi : bank.bank_account;
  useEffect(() => { setDetails(saved || ""); }, [method, saved]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/withdrawals", { amount: parseFloat(amount), method, details });
      toast.success("Withdrawal request submitted!");
      setAmount(""); setDetails("");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Request failed");
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout nav={customerNav} title="Withdrawals">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Request Withdrawal</h2>
          <p className="mt-1 text-sm text-slate-500">Available: <span className="font-mono font-bold text-emerald-600">₹{wallet?.balance ?? "…"}</span> · Min ₹100</p>

          {!kycDone ? (
            <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800" data-testid="withdraw-kyc-warning">
              {kycState === "pending" ? "Your KYC is under review by Radhika Traders. Withdrawals will be enabled once verified."
                : kycState === "rejected" ? <>Your KYC was rejected. Please <Link to="/profile" className="font-bold underline">re-submit your KYC</Link>.</>
                : kycState === "deactivated" ? "Your KYC has been deactivated. Please contact support."
                : <>Complete your <Link to="/profile" className="font-bold underline">KYC</Link> to enable withdrawals.</>}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div><Label>Amount (₹)</Label><Input data-testid="withdraw-amount" type="number" min="100" required value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" /></div>
              <div>
                <Label>Payment Method</Label>
                <select data-testid="withdraw-method" value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option>UPI</option><option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <Label>{method === "UPI" ? "UPI ID" : "Bank Account Number"}</Label>
                <Input data-testid="withdraw-details" required value={details} onChange={(e) => setDetails(e.target.value)} className="mt-1.5" placeholder={method === "UPI" ? "yourname@upi" : "Account number"} />
                {method === "Bank Transfer" && bank.ifsc && <p className="mt-1 text-xs text-slate-500">Holder: <b>{bank.account_holder}</b> · IFSC: <b>{bank.ifsc}</b> (from your KYC)</p>}
                {method === "UPI" && !bank.upi && <p className="mt-1 text-xs text-amber-700">Tip: add your UPI ID in <Link to="/profile" className="underline">Profile & KYC</Link> to auto-fill next time.</p>}
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Payment is transferred manually by Radhika Traders to the UPI ID / bank account above, usually within 24–48 hours. You will see the status here.</p>
              <button type="submit" data-testid="withdraw-submit" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Submit Request
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">Your Requests</h2>
          {list.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="withdraw-none">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {list.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3" data-testid={`withdraw-${w.id}`}>
                  <div>
                    <div className="font-mono font-bold text-slate-900">₹{w.amount}</div>
                    <div className="text-xs text-slate-400">{w.method} · {w.details} · {(w.created_at || "").slice(0, 10)}</div>
                    {w.admin_note && <div className="text-xs text-slate-500">Note: {w.admin_note}</div>}
                    {w.status === "paid" && (w.proof_url || w.utr) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700" data-testid={`withdraw-proof-${w.id}`}>
                        <Receipt className="h-3.5 w-3.5" /> {w.utr && <span>UTR: <b>{w.utr}</b></span>}
                        {w.proof_url && <a href={fileUrl(w.proof_url)} target="_blank" rel="noreferrer" className="font-semibold underline">View payment proof</a>}
                      </div>
                    )}
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS[w.status]}`}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
