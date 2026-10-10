import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ImageUpload } from "./ImageUpload";
import { ImageIcon } from "lucide-react";

export function ReferPosterSetting() {
  const [url, setUrl] = useState("");
  useEffect(() => { api.get("/settings/public").then(({ data }) => setUrl(data.refer_poster_url || "")).catch(() => {}); }, []);

  const save = async (v) => {
    setUrl(v);
    try { await api.put("/admin/settings", { refer_poster_url: v }); toast.success(v ? "Refer & Earn poster saved — customers' invite shares now carry it" : "Refer & Earn poster removed"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="refer-poster-setting">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-900 p-2.5 text-amber-400"><ImageIcon className="h-5 w-5" /></div>
        <div>
          <div className="font-display font-bold text-slate-900">Refer &amp; Earn Poster</div>
          <div className="text-xs text-slate-600">Upload your own poster (1080×1080 recommended). When a customer shares their invite link on WhatsApp / Telegram / Instagram / Facebook, this poster goes attached with the message automatically. Campaign-specific posters are uploaded in each campaign's form.</div>
        </div>
      </div>
      <div className="mt-4"><ImageUpload label="" value={url} onChange={save} testId="refer-poster-upload" fit="contain" /></div>
    </div>
  );
}
