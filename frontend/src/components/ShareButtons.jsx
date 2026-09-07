import { toast } from "sonner";
import { MessageCircle, Send, Copy, Instagram, Facebook } from "lucide-react";

export function ShareButtons({ link, message, copyText, testPrefix = "share" }) {
  const text = message || "Check out this offer on Radhika Traders!";
  const encoded = encodeURIComponent(`${text} ${link}`);

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

  const btn = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95";

  return (
    <div className="flex flex-wrap gap-2">
      <a data-testid={`${testPrefix}-whatsapp`} href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer"
        className={`${btn} bg-emerald-500 text-white hover:brightness-110`}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>
      <a data-testid={`${testPrefix}-telegram`} href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
        className={`${btn} bg-sky-500 text-white hover:brightness-110`}>
        <Send className="h-3.5 w-3.5" /> Telegram
      </a>
      <button data-testid={`${testPrefix}-copy`} onClick={copy} className={`${btn} bg-slate-900 text-white hover:brightness-125`}>
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
      <button data-testid={`${testPrefix}-instagram`} onClick={nativeShare} className={`${btn} bg-gradient-to-r from-pink-500 to-purple-500 text-white`}>
        <Instagram className="h-3.5 w-3.5" /> Instagram
      </button>
      <button data-testid={`${testPrefix}-facebook`} onClick={nativeShare} className={`${btn} bg-blue-600 text-white`}>
        <Facebook className="h-3.5 w-3.5" /> Facebook
      </button>
    </div>
  );
}
