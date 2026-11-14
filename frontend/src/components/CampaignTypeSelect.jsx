import { useEffect, useState } from "react";
import { Plus, X, Check, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "../lib/api";

export const FALLBACK_TYPES = ["First Trade", "Trade", "F&O Trade", "Non-Trade", "Turnover", "SIP", "Lump Sum", "Account Opening", "Fund Add", "KYC Complete", "Card Activation", "Loan Disbursal", "Policy Issued", "App Install", "Lead / Form Fill"];

export function useCampaignTypes() {
  const [types, setTypes] = useState(FALLBACK_TYPES);
  useEffect(() => { api.get("/settings/public").then(({ data }) => { if (data.campaign_types?.length) setTypes(data.campaign_types); }).catch(() => {}); }, []);
  return [types, setTypes];
}

// Admin-only: the Campaign Type dropdown with "+ Add new type" and a manage list, saved to settings so it applies everywhere.
export function CampaignTypeSelect({ value, onChange }) {
  const [types, setTypes] = useCampaignTypes();
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const options = types.includes(value) || !value ? types : [value, ...types];

  const save = async (next, msg) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", { campaign_types: next });
      setTypes(data.campaign_types);
      toast.success(msg);
      return true;
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not save"); return false; }
    finally { setBusy(false); }
  };
  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    if (types.some((x) => x.toLowerCase() === t.toLowerCase())) { onChange(types.find((x) => x.toLowerCase() === t.toLowerCase())); setAdding(false); setDraft(""); return; }
    if (await save([...types, t], `"${t}" added to campaign types`)) { onChange(t); setAdding(false); setDraft(""); }
  };
  const remove = async (t) => {
    if (!window.confirm(`Remove "${t}" from the type list? Existing campaigns keep their type.`)) return;
    const next = types.filter((x) => x !== t);
    if (await save(next, `"${t}" removed`) && value === t) onChange(next[0] || "");
  };

  return (
    <div>
      {adding ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }}
            placeholder="e.g. F&O Trade" maxLength={40} data-testid="cf-type-new" className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-500" />
          <button type="button" onClick={add} disabled={busy || !draft.trim()} data-testid="cf-type-new-save" className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
          <button type="button" onClick={() => { setAdding(false); setDraft(""); }} data-testid="cf-type-new-cancel" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <select data-testid="cf-type" value={value} onChange={(e) => { if (e.target.value === "__add__") setAdding(true); else if (e.target.value === "__manage__") setManage(true); else onChange(e.target.value); }}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {options.map((t) => <option key={t} value={t}>{t}</option>)}
          <option disabled>──────────</option>
          <option value="__add__">＋ Add new type…</option>
          <option value="__manage__">⚙ Manage types…</option>
        </select>
      )}
      {manage && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="cf-type-manage">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" /> Campaign types ({types.length})</span><button type="button" onClick={() => setManage(false)} data-testid="cf-type-manage-close" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700" data-testid={`cf-type-chip-${t.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
                {t}<button type="button" onClick={() => remove(t)} disabled={busy} aria-label={`Remove ${t}`} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button type="button" onClick={() => { setManage(false); setAdding(true); }} data-testid="cf-type-manage-add" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"><Plus className="h-3 w-3" /> Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
