import { useRef, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Upload, Loader2, X, FolderOpen } from "lucide-react";
import { fileUrl } from "../lib/api";

// Shrink big phone screenshots (3-6 MB) to a ~1600px JPEG before upload so it finishes in ~1s.
async function compressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 300 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

export function ImageUpload({ label, value, onChange, testId }) {
  const ref = useRef();
  const filesRef = useRef();
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif|bmp|pdf)$/i.test(file.name)) return toast.error("Please choose an image file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", await compressImage(file));
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      onChange(data.url);
      toast.success(`${label || "Image"} uploaded`);
    } catch { toast.error("Upload failed — please try again"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="mt-1.5 flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={fileUrl(value)} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            <button type="button" onClick={() => onChange("")} className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 p-0.5 text-white"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300">
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Upload className="h-5 w-5" />}
          </div>
        )}
        <button type="button" data-testid={testId} onClick={() => ref.current.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> {value ? "Change" : "Upload"}</>}
        </button>
        <button type="button" data-testid={`${testId}-files`} onClick={() => filesRef.current.click()} disabled={busy} title="Browse all folders (WhatsApp, Downloads, DCIM…)"
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          <FolderOpen className="h-4 w-4" /> All files
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
        <input ref={filesRef} type="file" hidden onChange={pick} />
      </div>
    </div>
  );
}
