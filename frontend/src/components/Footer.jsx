import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Instagram, Facebook, Youtube, MessageCircle, Send } from "lucide-react";
import { useContact, telLink, waLink } from "../lib/contact";

export function Footer() {
  const contact = useContact();
  return (
    <footer className="mt-20 bg-[#0B0F17] text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <img src="/images/logo-full.jpeg" alt="Radhika Traders" className="w-44 rounded-2xl" data-testid="footer-logo-full" />
          <p className="mt-4 text-sm text-slate-400">Affiliate marketing & financial services partner since 15 June 2023. Demat, savings, credit cards, insurance, loans & more.</p>
        </div>
        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-amber-400">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/campaigns" className="hover:text-white">Campaigns</Link></li>
            <li><Link to="/services" className="hover:text-white">Services</Link></li>
            <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            <li><Link to="/partners" className="hover:text-white">Partner With Us</Link></li>
            <li><Link to="/#team" className="hover:text-white">Our Team</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-amber-400">Contact</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><a href={telLink(contact.support_mobile)} data-testid="footer-phone" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4 text-red-500" /> {contact.support_mobile}</a></li>
            <li><a href={`mailto:${contact.support_email}`} data-testid="footer-email" className="flex items-center gap-2 break-all hover:text-white"><Mail className="h-4 w-4 shrink-0 text-red-500" /> {contact.support_email}</a></li>
            <li><a href="https://www.google.com/maps/search/?api=1&query=Radhika+Traders+Bada+Gawali+Pura+Rd+Chhawani+Naka+Agar+Madhya+Pradesh+465441" target="_blank" rel="noreferrer" data-testid="footer-address" className="flex items-start gap-2 hover:text-white"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> Bada Gawali Pura Rd, nearby Pitambara Hospital, Chhawani Naka, Chhawani, Agar, Madhya Pradesh 465441</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-amber-400">Follow Us</h4>
          <div className="flex flex-wrap gap-2.5" data-testid="footer-social">
            {[
              ["whatsapp", waLink(contact.whatsapp_number), MessageCircle, "from-emerald-500 to-green-600 shadow-emerald-500/40", "WhatsApp"],
              ["instagram", contact.instagram_url, Instagram, "from-amber-400 via-pink-500 to-purple-600 shadow-pink-500/40", "Instagram"],
              ["facebook", contact.facebook_url, Facebook, "from-blue-500 to-blue-700 shadow-blue-500/40", "Facebook"],
              ["youtube", contact.youtube_url, Youtube, "from-red-500 to-red-700 shadow-red-500/40", "YouTube"],
              ["telegram", contact.telegram_url, Send, "from-sky-400 to-sky-600 shadow-sky-500/40", "Telegram"],
            ].filter(([, href]) => !!href).map(([k, href, Icon, grad, label]) => (
              <a key={k} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} data-testid={`footer-${k}`}
                className={`group flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-lg ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-1 hover:scale-110`}>
                <Icon className="h-5 w-5 drop-shadow" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Radhika Traders · Owner & Founder: Harish Bhati · All rights reserved.
      </div>
    </footer>
  );
}
