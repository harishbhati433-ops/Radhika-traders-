import { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { useContact, fmtWa, DEFAULT_CONTACT } from "../lib/contact";
import { QrCode, Download, Share2, MessageCircle, Copy, Loader2, ImageIcon, Sparkles } from "lucide-react";

const dl = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };

export function useBlobUrl(path, deps = []) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true, obj = "";
    setUrl("");
    api.get(path, { responseType: "blob" }).then(({ data }) => { if (!active) return; obj = URL.createObjectURL(data); setUrl(obj); }).catch(() => {});
    return () => { active = false; if (obj) URL.revokeObjectURL(obj); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

export function captionsFor(c, link, name, wa = DEFAULT_CONTACT.whatsapp_number) {
  const who = name ? `*${name.replace(/\b\w/g, (m) => m.toUpperCase())}* · Radhika Traders partner` : "*Radhika Traders*";
  const benefit = c.customer_benefit ? `\n🎯 ${c.customer_benefit}` : "";
  const brand = c.company ? ` (*${c.company}*)` : "";
  const phone = fmtWa(wa);
  return [
    ["Hindi", `🙏 नमस्ते!\n\n✨ *${c.offer_name}*${brand} में आज ही अपना account खोलें।${benefit}\n✅ बिलकुल free · 100% online\n\n👉 मेरे link से apply करें:\n${link}\n\n🏆 ${who}\n📞 WhatsApp: ${phone}`],
    ["English", `🙏 Hello!\n\n✨ Open your *${c.offer_name}*${brand} account today.${benefit}\n✅ Free · 100% online\n\n👉 Apply using my link:\n${link}\n\n🏆 ${who}\n📞 WhatsApp: ${phone}`],
    ["Short", `✨ *${c.offer_name}* 🔥${benefit}\n👉 Apply here: ${link}\n🏆 ${who}`],
  ];
}

export function ShareKit({ c, link, user }) {
  const poster = useBlobUrl(`/share/poster/${c.slug}`, [c.slug]);
  const qr = useBlobUrl(`/share/qr?url=${encodeURIComponent(link)}&size=600`, [link]);
  const [sharing, setSharing] = useState(false);
  const contact = useContact();
  const captions = captionsFor(c, link, user?.name, contact.whatsapp_number);
  const fname = `${c.slug}-${user?.referral_code || "share"}.png`;

  const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} caption copied — paste it with the poster`); };
  const sharePoster = async () => {
    if (!poster) return;
    setSharing(true);
    try {
      const blob = await (await fetch(poster)).blob();
      const file = new File([blob], fname, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: captions[0][1] }); }
      else { dl(poster, fname); copy(captions[0][1], "Hindi"); window.open(`https://wa.me/?text=${encodeURIComponent(captions[0][1])}`, "_blank", "noreferrer"); }
    } catch {} finally { setSharing(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="share-kit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" /> Share Kit</h2>
          <p className="mt-0.5 text-sm text-slate-500">Ready-made poster, QR code and WhatsApp captions — all carry <b>your</b> referral link, so every apply is tracked to you.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="share-kit-poster">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> Poster (1080×1080)</div>
          <div className="aspect-square overflow-hidden rounded-xl bg-[#0B0F17]">{poster ? <img src={poster} alt="Campaign poster" className="h-full w-full object-cover" data-testid="share-kit-poster-img" /> : <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => poster && dl(poster, fname)} disabled={!poster} data-testid="share-kit-poster-download" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Download</button>
            <button onClick={sharePoster} disabled={!poster || sharing} data-testid="share-kit-poster-share" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">{sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share on WhatsApp</button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="share-kit-qr">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><QrCode className="h-3.5 w-3.5" /> Your QR code</div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">{qr ? <img src={qr} alt="Referral QR" className="h-[85%] w-[85%]" data-testid="share-kit-qr-img" /> : <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}</div>
          <p className="mt-2 text-[11px] text-slate-500">Customers scan with their phone camera → land on your tracked link. Print it, show it on screen or add to a status.</p>
          <button onClick={() => qr && dl(qr, `qr-${fname}`)} disabled={!qr} data-testid="share-kit-qr-download" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Download QR</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="share-kit-captions">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp captions</div>
          <div className="space-y-2">
            {captions.map(([label, text]) => (
              <div key={label} className="rounded-xl bg-white p-3 ring-1 ring-slate-200" data-testid={`share-kit-caption-${label.toLowerCase()}`}>
                <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-red-600">{label}</span>
                  <span className="flex gap-1">
                    <button onClick={() => copy(text, label)} data-testid={`share-kit-caption-copy-${label.toLowerCase()}`} title="Copy" className="rounded-md bg-slate-100 p-1 text-slate-600 hover:bg-slate-900 hover:text-white"><Copy className="h-3 w-3" /></button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" data-testid={`share-kit-caption-wa-${label.toLowerCase()}`} title="Send on WhatsApp" className="rounded-md bg-emerald-500 p-1 text-white hover:brightness-110"><MessageCircle className="h-3 w-3" /></a>
                  </span></div>
                <pre className="line-clamp-4 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-600">{text}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
