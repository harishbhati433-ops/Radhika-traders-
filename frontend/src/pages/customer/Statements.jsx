import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import { API } from "../../lib/api";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, FileDown, Loader2 } from "lucide-react";

const formats = [
  { key: "pdf", label: "PDF Statement", desc: "Formatted wallet statement", icon: FileText, tone: "bg-rose-50 text-rose-600" },
  { key: "excel", label: "Excel (XLSX)", desc: "Spreadsheet with all transactions", icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-600" },
  { key: "csv", label: "CSV Export", desc: "Raw data for any tool", icon: FileDown, tone: "bg-sky-50 text-sky-600" },
];

export default function Statements() {
  const [busy, setBusy] = useState("");

  const download = async (fmt) => {
    setBusy(fmt);
    try {
      const token = localStorage.getItem("rt_token");
      const res = await fetch(`${API}/statement?format=${fmt}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = fmt === "excel" ? "xlsx" : fmt;
      a.href = url; a.download = `radhika_statement.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${fmt.toUpperCase()} downloaded`);
    } catch {
      toast.error("Download failed");
    } finally { setBusy(""); }
  };

  return (
    <DashboardLayout nav={customerNav} title="Statements & Reports">
      <p className="mb-6 text-sm text-slate-500">Download your wallet & transaction statement in your preferred format.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        {formats.map((f) => (
          <button key={f.key} onClick={() => download(f.key)} disabled={busy} data-testid={`statement-${f.key}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:rt-gold-card disabled:opacity-60">
            <div className={`mb-4 inline-flex rounded-xl p-3 ${f.tone}`}>
              {busy === f.key ? <Loader2 className="h-6 w-6 animate-spin" /> : <f.icon className="h-6 w-6" />}
            </div>
            <div className="font-display font-bold text-slate-900">{f.label}</div>
            <div className="mt-1 text-xs text-slate-500">{f.desc}</div>
          </button>
        ))}
      </div>
    </DashboardLayout>
  );
}
