import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const DATE_PRESETS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["last7", "Last 7 Days"], ["this_month", "This Month"], ["last_month", "Last Month"], ["custom", "Custom Range"],
];

export function presetRange(key) {
  const now = new Date(); const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
  switch (key) {
    case "today": return [iso(t), iso(t)];
    case "yesterday": return [iso(d(-1)), iso(d(-1))];
    case "last7": return [iso(d(-6)), iso(t)];
    case "this_month": return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
    case "last_month": return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
    default: return ["", ""];
  }
}

export function LeadExport({ filters, count }) {
  const [busy, setBusy] = useState("");
  const download = async (format) => {
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) return toast.error("From date cannot be after To date");
    setBusy(format);
    try {
      const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), format });
      const token = localStorage.getItem("rt_token");
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/leads/export?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Export failed");
      const blob = await res.blob();
      const name = (res.headers.get("Content-Disposition") || "").split("filename=")[1] || `leads.${format}`;
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
      toast.success(`${count} leads exported (${format.toUpperCase()})`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(""); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lead-export">
      <span className="flex items-center gap-1 text-xs font-bold text-slate-600"><Download className="h-3.5 w-3.5" /> Export {count} leads:</span>
      <button onClick={() => download("xlsx")} disabled={!!busy} data-testid="lead-export-xlsx" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
        {busy === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Excel (.xlsx)
      </button>
      <button onClick={() => download("csv")} disabled={!!busy} data-testid="lead-export-csv" className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-60">
        {busy === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} CSV (.csv)
      </button>
    </div>
  );
}
