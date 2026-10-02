import { useRef, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Upload, Loader2, X } from "lucide-react";
import { fileUrl } from "../lib/api";

export function ImageUpload({ label, value, onChange, testId }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success(`${label} uploaded`);
    } catch { toast.error("Upload failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1.5 flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={fileUrl(value)} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            <button type="button" onClick={() => onChange("")} className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 p-0.5 text-white"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300"><Upload className="h-5 w-5" /></div>
        )}
        <button type="button" data-testid={testId} onClick={() => ref.current.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}
