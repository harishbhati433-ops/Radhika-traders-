import { MessageCircle } from "lucide-react";

const WA_URL = "https://wa.me/916376541191?text=Hello%20Radhika%20Traders%2C%20I%20want%20to%20know%20more%20about%20your%20campaigns.";

export function WhatsAppFloat() {
  return (
    <a href={WA_URL} target="_blank" rel="noreferrer" data-testid="whatsapp-float" aria-label="Chat on WhatsApp"
      className="group fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-emerald-500 py-3 pl-3 pr-3 text-white shadow-[0_8px_30px_rgba(16,185,129,0.45)] transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-emerald-600 sm:pr-4">
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400/50" style={{ animationDuration: "2.2s" }} />
      <MessageCircle className="h-6 w-6" />
      <span className="hidden text-sm font-bold sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
