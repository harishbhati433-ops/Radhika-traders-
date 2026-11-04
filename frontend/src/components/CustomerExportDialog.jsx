import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2, CalendarRange } from "lucide-react";
import { getToken } from "../lib/portal";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const PERIODS = [["today", "Today"], ["yesterday", "Yesterday"], ["month", "Monthly"], ["year", "Yearly"], ["custom", "Custom Range"]];
const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm";

export function CustomerExportDialog({ includeDeleted }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("today");
  const [month, setMonth] = useState(todayIST().slice(0, 7));
  const [year, setYear] = useState(Number(todayIST().slice(0, 4)));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayIST());
  const [busy, setBusy] = useState("");
  const years = Array.from({ length: 6 }, (_, i) => Number(todayIST().slice(0, 4)) - i);
  const valid = period !== "custom" || (from && to && from <= to);

  const download = async (fmt) => {
    if (!valid) return toast.error("Select a valid From and To date");
    setBusy(fmt);
    try {
      const qs = new URLSearchParams({ period, format: fmt, month, year, include_deleted: includeDeleted, ...(period === "custom" ? { date_from: from, date_to: to } : {}) }).toString();
      const res = await fetch(`${API}/admin/customers/export?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Download failed");
      const count = Number(res.headers.get("X-Row-Count") || 0);
      const blob = await res.blob();
      const name = (res.headers.get("Content-Disposition") || "").split("filename=")[1] || `customers.${fmt === "excel" ? "xlsx" : "csv"}`;
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
      toast.success(count ? `${count} customer${count === 1 ? "" : "s"} downloaded (${fmt === "excel" ? "Excel" : "CSV"})` : "No customers registered in this period — empty file downloaded");
    } catch (e) { toast.error(String(e.message || "Download failed")); } finally { setBusy(""); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="customers-export-btn" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:brightness-125">
        <Download className="h-3.5 w-3.5" /> Download Data
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="customers-export-dialog" className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-red-600" /> Download Customer Data</DialogTitle></DialogHeader>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><CalendarRange className="h-3.5 w-3.5 text-red-600" /> Registered period</div>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map(([k, l]) => <button key={k} type="button" onClick={() => setPeriod(k)} data-testid={`export-period-${k}`} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${period === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{l}</button>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              {period === "month" && <label className="flex items-center gap-1.5">Month <input type="month" value={month} max={todayIST().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} data-testid="export-month" className={inp} /></label>}
              {period === "year" && <label className="flex items-center gap-1.5">Year <select value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="export-year" className={inp}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>}
              {period === "custom" && (<>
                <label className="flex items-center gap-1.5">From <input type="date" value={from} max={to || todayIST()} onChange={(e) => setFrom(e.target.value)} data-testid="export-from" className={inp} /></label>
                <label className="flex items-center gap-1.5">To <input type="date" value={to} min={from} max={todayIST()} onChange={(e) => setTo(e.target.value)} data-testid="export-to" className={inp} /></label>
                {!valid && <span className="text-rose-600" data-testid="export-hint">Select both dates</span>}
              </>)}
              {(period === "today" || period === "yesterday") && <span className="text-slate-500">Customers registered {period} (IST)</span>}
            </div>
          </div>
          <p className="text-xs text-slate-500">File includes: Name, Mobile, Email, Referral Code, Referred By, Registered On, KYC & Account Status, Wallet Balance, Earnings, Withdrawn, Pending Withdrawal{includeDeleted ? " · deleted accounts included" : ""}.</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => download("excel")} disabled={!!busy} data-testid="export-excel-btn" className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel (.xlsx)
            </button>
            <button type="button" onClick={() => download("csv")} disabled={!!busy} data-testid="export-csv-btn" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
              {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} CSV (.csv)
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
