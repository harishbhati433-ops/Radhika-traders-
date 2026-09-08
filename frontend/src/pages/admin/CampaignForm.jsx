import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ImageUpload } from "../../components/ImageUpload";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star } from "lucide-react";

const EMPTY = {
  offer_name: "", company: "", category: "", payout_amount: 0, payout_type: "Fixed",
  benefits: "", customer_benefit: "", affiliate_payout: "", investment: "", campaign_type: "First Trade",
  description: "", requirements: "", important_notes: "", min_requirement: "", max_payout: "",
  special_bonus: "", payment_timeline: "", validity: "", important_conditions: "",
  start_date: "", end_date: "", budget: "", report_frequency: "", payment_terms: "",
  logo_url: "", banner_url: "", show_in_slider: true, status: "live", offer_enabled: true, affiliate_links: [], lead_fields: [],
};
const LEAD_FIELDS = [["name", "Full Name"], ["mobile", "Mobile Number"], ["email", "Gmail / Email ID"], ["pan", "PAN Number"], ["dob", "Date of Birth"], ["aadhaar", "Aadhaar Number"], ["bank_account", "Bank Account Number"], ["ifsc", "IFSC Code"], ["upi", "UPI ID"], ["address", "Address"]];
const TYPES = ["First Trade", "Trade", "Non-Trade", "Turnover", "SIP", "Lump Sum", "Account Opening", "Fund Add", "KYC Complete", "Card Activation", "Loan Disbursal", "Policy Issued", "App Install", "Lead / Form Fill"];

function Row({ children, cols = 2 }) {
  return <div className={`grid gap-3 ${cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>{children}</div>;
}

export function CampaignForm({ open, onClose, editing, cats, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) setF({ ...EMPTY, ...editing });
    else setF(EMPTY);
  }, [editing, open]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const addLink = () => setF({ ...f, affiliate_links: [...f.affiliate_links, { id: Math.random().toString(36).slice(2), label: "Link", url: "", is_primary: f.affiliate_links.length === 0, is_active: true }] });
  const updLink = (i, k, v) => { const a = [...f.affiliate_links]; a[i] = { ...a[i], [k]: v }; setF({ ...f, affiliate_links: a }); };
  const setPrimary = (i) => setF({ ...f, affiliate_links: f.affiliate_links.map((l, j) => ({ ...l, is_primary: j === i })) });
  const rmLink = (i) => setF({ ...f, affiliate_links: f.affiliate_links.filter((_, j) => j !== i) });
  const leadField = (key) => (f.lead_fields || []).find((x) => x.key === key) || { key, enabled: false, required: false };
  const setLead = (key, patch) => {
    const others = (f.lead_fields || []).filter((x) => x.key !== key);
    const cur = { ...leadField(key), ...patch };
    if (!cur.enabled) cur.required = false;
    setF({ ...f, lead_fields: [...others, cur] });
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const payload = { ...f, payout_amount: parseFloat(f.payout_amount) || 0 };
    try {
      if (editing) await api.put(`/campaigns/${editing.id}`, payload);
      else await api.post("/campaigns", payload);
      toast.success(editing ? "Campaign updated" : "Campaign created");
      onSaved(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rt-scroll" data-testid="campaign-form-modal">
        <DialogHeader><DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Row>
            <div><Label>Offer Name *</Label><Input data-testid="cf-offer-name" required value={f.offer_name} onChange={set("offer_name")} className="mt-1.5" /></div>
            <div><Label>Company / Brand</Label><Input data-testid="cf-company" value={f.company} onChange={set("company")} className="mt-1.5" /></div>
          </Row>
          <Row cols={3}>
            <div><Label>Category</Label>
              <select data-testid="cf-category" value={f.category} onChange={set("category")} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select</option>{cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>Campaign Type</Label>
              <select data-testid="cf-type" value={f.campaign_type} onChange={set("campaign_type")} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select data-testid="cf-status" value={f.status} onChange={set("status")} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="live">Live</option><option value="paused">Paused</option><option value="closed">Closed</option>
              </select>
            </div>
          </Row>
          <Row cols={3}>
            <div><Label>Payout Amount (₹)</Label><Input data-testid="cf-payout" type="number" value={f.payout_amount} onChange={set("payout_amount")} className="mt-1.5" /></div>
            <div><Label>Payout Type</Label><Input value={f.payout_type} onChange={set("payout_type")} className="mt-1.5" placeholder="Fixed / Per Account" /></div>
            <div><Label>Investment / Fund</Label><Input value={f.investment} onChange={set("investment")} className="mt-1.5" /></div>
          </Row>
          <div><Label>Benefits</Label><Textarea value={f.benefits} onChange={set("benefits")} className="mt-1.5" rows={2} /></div>
          <Row>
            <div><Label>Customer Benefit</Label><Input value={f.customer_benefit} onChange={set("customer_benefit")} className="mt-1.5" /></div>
            <div><Label>Affiliate / Partner Payout</Label><Input value={f.affiliate_payout} onChange={set("affiliate_payout")} className="mt-1.5" /></div>
          </Row>
          <div><Label>Description</Label><Textarea value={f.description} onChange={set("description")} className="mt-1.5" rows={3} /></div>
          <div><Label>Requirements</Label><Textarea value={f.requirements} onChange={set("requirements")} className="mt-1.5" rows={2} /></div>
          <div><Label>Important Notes</Label><Textarea value={f.important_notes} onChange={set("important_notes")} className="mt-1.5" rows={2} /></div>
          <Row cols={3}>
            <div><Label>Min Requirement</Label><Input value={f.min_requirement} onChange={set("min_requirement")} className="mt-1.5" /></div>
            <div><Label>Max Payout</Label><Input value={f.max_payout} onChange={set("max_payout")} className="mt-1.5" /></div>
            <div><Label>Special Bonus</Label><Input value={f.special_bonus} onChange={set("special_bonus")} className="mt-1.5" /></div>
            <div><Label>Payment Timeline</Label><Input value={f.payment_timeline} onChange={set("payment_timeline")} className="mt-1.5" /></div>
            <div><Label>Validity</Label><Input value={f.validity} onChange={set("validity")} className="mt-1.5" /></div>
            <div><Label>Payment Terms</Label><Input value={f.payment_terms} onChange={set("payment_terms")} className="mt-1.5" /></div>
          </Row>
          <Row cols={3}>
            <div><Label>Start Date</Label><Input type="date" value={f.start_date} onChange={set("start_date")} className="mt-1.5" /></div>
            <div><Label>End Date</Label><Input type="date" value={f.end_date} onChange={set("end_date")} className="mt-1.5" /></div>
            <div><Label>Budget</Label><Input value={f.budget} onChange={set("budget")} className="mt-1.5" /></div>
          </Row>
          <div><Label>Important Conditions</Label><Textarea value={f.important_conditions} onChange={set("important_conditions")} className="mt-1.5" rows={2} /></div>

          <Row>
            <ImageUpload label="Logo" value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} testId="cf-upload-logo" />
            <div>
              <ImageUpload label="Banner — 1200×400 px (3:1). Auto-shows in the customer dashboard slider while the campaign is live." value={f.banner_url} onChange={(v) => setF({ ...f, banner_url: v })} testId="cf-upload-banner" />
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={f.show_in_slider !== false} onChange={(e) => setF({ ...f, show_in_slider: e.target.checked })} data-testid="cf-show-in-slider" />
                Show this banner in customer dashboard slider
              </label>
            </div>
          </Row>

          <div className="rounded-xl border border-slate-200 p-4" data-testid="cf-lead-fields">
            <Label>Customer Details Form (Lead capture)</Label>
            <p className="mb-3 mt-1 text-xs text-slate-500">Turn ON the fields customers must fill before being redirected to the affiliate link. Tick "Required" to make a field mandatory. If nothing is ON, the link redirects directly.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEAD_FIELDS.map(([key, label]) => { const lf = leadField(key); return (
                <div key={key} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${lf.enabled ? "border-red-200 bg-red-50/50" : "border-slate-200"}`}>
                  <label className="flex items-center gap-2 font-medium text-slate-800"><input type="checkbox" data-testid={`cf-lead-enabled-${key}`} checked={lf.enabled} onChange={(e) => setLead(key, { enabled: e.target.checked })} /> {label}</label>
                  <label className={`flex items-center gap-1 text-xs font-bold ${lf.enabled ? "text-red-700" : "text-slate-300"}`}><input type="checkbox" data-testid={`cf-lead-required-${key}`} disabled={!lf.enabled} checked={lf.required} onChange={(e) => setLead(key, { required: e.target.checked })} /> Required</label>
                </div>
              ); })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Affiliate Links</Label>
              <button type="button" onClick={addLink} data-testid="cf-add-link" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white"><Plus className="h-3 w-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {f.affiliate_links.map((l, i) => (
                <div key={l.id} className="flex items-center gap-2">
                  <Input value={l.label} onChange={(e) => updLink(i, "label", e.target.value)} placeholder="Label" className="w-28" />
                  <Input value={l.url} onChange={(e) => updLink(i, "url", e.target.value)} placeholder="https://..." className="flex-1" />
                  <button type="button" onClick={() => setPrimary(i)} title="Primary" className={`rounded-lg p-2 ${l.is_primary ? "text-amber-500" : "text-slate-300"}`}><Star className="h-4 w-4" fill={l.is_primary ? "currentColor" : "none"} /></button>
                  <button type="button" onClick={() => updLink(i, "is_active", !l.is_active)} className={`rounded-full px-2 py-1 text-[10px] font-bold ${l.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{l.is_active ? "Active" : "Off"}</button>
                  <button type="button" onClick={() => rmLink(i)} className="rounded-lg p-2 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" data-testid="cf-offer-enabled" checked={f.offer_enabled} onChange={(e) => setF({ ...f, offer_enabled: e.target.checked })} className="h-4 w-4 rounded" /> Offer Enabled (visible to customers)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" data-testid="cf-submit" disabled={busy} className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Update" : "Create"} Campaign
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
