import { useRef, useState } from "react";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";

export function UserAvatar({ user, size = 40, className = "" }) {
  const initial = (user?.name || "?").trim()[0]?.toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.4) };
  if (user?.avatar_url) {
    return <img src={fileUrl(user.avatar_url)} alt={user?.name || ""} style={style} data-testid="user-avatar-img" className={`shrink-0 rounded-full object-cover ring-2 ring-white/70 ${className}`} />;
  }
  return <div style={style} data-testid="user-avatar-initial" className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-red-600 font-display font-bold text-white ring-2 ring-white/70 ${className}`}>{initial}</div>;
}

export function AvatarUpload() {
  const { user, setUser } = useAuth();
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const save = async (avatar_url) => {
    const { data } = await api.put("/profile", { avatar_url });
    setUser(data);
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Photo is too large (max 8 MB)");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await save(data.url);
      toast.success("Profile photo updated");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Upload failed"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await save(""); toast.success("Profile photo removed"); }
    catch { toast.error("Could not remove photo"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-5" data-testid="avatar-upload">
      <div className="relative">
        <div className="rounded-full bg-gradient-to-br from-amber-400 via-red-500 to-red-900 p-[3px] shadow-lg">
          <div className="rounded-full bg-white p-[3px]"><UserAvatar user={user} size={96} className="ring-0" /></div>
        </div>
        <button type="button" onClick={() => ref.current.click()} disabled={busy} data-testid="avatar-upload-btn" aria-label="Change profile photo"
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} data-testid="avatar-file-input" />
      </div>
      <div>
        <div className="font-display font-bold text-slate-900">{user?.name}</div>
        <div className="text-xs text-slate-500">Partner ID {user?.referral_code}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => ref.current.click()} disabled={busy} data-testid="avatar-change-btn" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{user?.avatar_url ? "Change photo" : "Upload photo"}</button>
          {user?.avatar_url && <button type="button" onClick={remove} disabled={busy} data-testid="avatar-remove-btn" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">JPG, PNG, HEIC · pick from gallery, files or camera</p>
      </div>
    </div>
  );
}
