import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Copy, Instagram, Facebook, ImageIcon, Link2, Loader2, Share2 } from "lucide-react";

const dl = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };

export function ShareButtons({ link, message, copyText, testPrefix = "share", posterUrl = "", posterName = "poster.png" }) {
  const text = message || "Check out this offer on Radhika Traders!";
  // Keep the link where the message puts it (e.g. after "Apply using my link:"); only append when the message has no link.
  const full = text.includes(link) ? text : `${text} ${link}`;
  const encoded = encodeURIComponent(full);
  const tgText = text.includes(link) ? text.replace(link, "").replace(/[ \t]+\n/g, "\n") : text;
  const [withPoster, setWithPoster] = useState(true);
  const [busy, setBusy] = useState("");
  const posterMode = !!posterUrl && withPoster;

  const copy = () => {
    navigator.clipboard.writeText(copyText || link);
    toast.success(copyText ? "Message with your link copied — paste it anywhere" : "Link copied to clipboard");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Radhika Traders", text, url: link }); } catch {}
    } else {
      copy();
      toast.info("Link copied — paste it in Instagram/Facebook");
    }
  };

  // Poster + message go together: native share sheet on mobile; on desktop download poster, copy message and open the app.
  const shareWithPoster = async (platform) => {
    setBusy(platform);
    try {
      const blob = await (await fetch(posterUrl)).blob();
      const file = new File([blob], posterName, { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: full }); } catch {}
        return;
      }
      dl(posterUrl, posterName);
      await navigator.clipboard.writeText(full);
      toast.success("Poster downloaded + message copied — attach the poster and paste the message");
      if (platform === "whatsapp") window.open(`https://wa.me/?text=${encoded}`, "_blank", "noreferrer");
      if (platform === "telegram") window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(tgText)}`, "_blank", "noreferrer");
    } catch { toast.error("Could not load the poster — try again"); }
    finally { setBusy(""); }
  };

  const btn = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-60";
  const Spin = ({ k, Icon }) => busy === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-2">
      {posterUrl && (
        <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px] font-bold" data-testid={`${testPrefix}-mode`}>
          <button type="button" onClick={() => setWithPoster(true)} data-testid={`${testPrefix}-mode-poster`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${withPoster ? "bg-slate-900 text-white" : "text-slate-600"}`}><ImageIcon className="h-3 w-3" /> With Poster</button>
          <button type="button" onClick={() => setWithPoster(false)} data-testid={`${testPrefix}-mode-link`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${!withPoster ? "bg-slate-900 text-white" : "text-slate-600"}`}><Link2 className="h-3 w-3" /> Normal Link</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {posterMode ? (
          <>
            <button type="button" data-testid={`${testPrefix}-whatsapp`} disabled={!!busy} onClick={() => shareWithPoster("whatsapp")} className={`${btn} bg-emerald-500 text-white hover:brightness-110`}><Spin k="whatsapp" Icon={MessageCircle} /> WhatsApp</button>
            <button type="button" data-testid={`${testPrefix}-telegram`} disabled={!!busy} onClick={() => shareWithPoster("telegram")} className={`${btn} bg-sky-500 text-white hover:brightness-110`}><Spin k="telegram" Icon={Send} /> Telegram</button>
            <button type="button" data-testid={`${testPrefix}-copy`} onClick={copy} className={`${btn} bg-slate-900 text-white hover:brightness-125`}><Copy className="h-3.5 w-3.5" /> Copy</button>
            <button type="button" data-testid={`${testPrefix}-instagram`} disabled={!!busy} onClick={() => shareWithPoster("instagram")} className={`${btn} bg-gradient-to-r from-pink-500 to-purple-500 text-white`}><Spin k="instagram" Icon={Instagram} /> Instagram</button>
            <button type="button" data-testid={`${testPrefix}-facebook`} disabled={!!busy} onClick={() => shareWithPoster("facebook")} className={`${btn} bg-blue-600 text-white`}><Spin k="facebook" Icon={Facebook} /> Facebook</button>
            <button type="button" data-testid={`${testPrefix}-more`} disabled={!!busy} onClick={() => shareWithPoster("more")} className={`${btn} border border-slate-300 bg-white text-slate-700`}><Spin k="more" Icon={Share2} /> More</button>
          </>
        ) : (
          <>
            <a data-testid={`${testPrefix}-whatsapp`} href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-500 text-white hover:brightness-110`}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
            <a data-testid={`${testPrefix}-telegram`} href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(tgText)}`} target="_blank" rel="noreferrer" className={`${btn} bg-sky-500 text-white hover:brightness-110`}><Send className="h-3.5 w-3.5" /> Telegram</a>
            <button type="button" data-testid={`${testPrefix}-copy`} onClick={copy} className={`${btn} bg-slate-900 text-white hover:brightness-125`}><Copy className="h-3.5 w-3.5" /> Copy</button>
            <button type="button" data-testid={`${testPrefix}-instagram`} onClick={nativeShare} className={`${btn} bg-gradient-to-r from-pink-500 to-purple-500 text-white`}><Instagram className="h-3.5 w-3.5" /> Instagram</button>
            <button type="button" data-testid={`${testPrefix}-facebook`} onClick={nativeShare} className={`${btn} bg-blue-600 text-white`}><Facebook className="h-3.5 w-3.5" /> Facebook</button>
          </>
        )}
      </div>
      {posterMode && <p className="text-[11px] text-slate-500" data-testid={`${testPrefix}-poster-note`}>Poster + your message (with link) go together. On desktop the poster downloads and the message is copied for you.</p>}
    </div>
  );
}
