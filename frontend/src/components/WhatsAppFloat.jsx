import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useContact, waLink, WA_GREETING } from "../lib/contact";

const HIDE_ON = ["/login", "/signup", "/admin/login", "/forgot-password", "/forgot-email"];

export function WhatsAppFloat() {
  const { pathname } = useLocation();
  const contact = useContact();
  if (HIDE_ON.includes(pathname)) return null;
  return (
    <a href={waLink(contact.whatsapp_number, WA_GREETING)} target="_blank" rel="noreferrer" data-testid="whatsapp-float" aria-label="Chat on WhatsApp" title={`Chat on WhatsApp · ${contact.whatsapp_number}`}
      className="fixed bottom-4 right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_20px_rgba(16,185,129,0.4)] transition-[transform,background-color] duration-200 hover:scale-110 hover:bg-emerald-600 sm:bottom-5 sm:right-5 sm:h-12 sm:w-12">
      <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
    </a>
  );
}
