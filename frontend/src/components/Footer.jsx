import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Instagram, Facebook, Youtube, MessageCircle } from "lucide-react";

export function Footer() {
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
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-amber-400">Contact</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><a href="tel:+916376541191" data-testid="footer-phone" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4 text-red-500" /> 6376541191</a></li>
            <li><a href="mailto:radhikatradersofficial@gmail.com" data-testid="footer-email" className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4 text-red-500" /> radhikatradersofficial@gmail.com</a></li>
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> Bada Gaulipura Road, Chhawani Naka, Near Maa Pitambara Hospital, Agar Malwa, M.P.</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-amber-400">Follow Us</h4>
          <div className="flex gap-2">
            <a href="https://wa.me/916376541191" target="_blank" rel="noreferrer" data-testid="footer-whatsapp" className="rounded-lg bg-white/5 p-2.5 hover:bg-emerald-600"><MessageCircle className="h-4 w-4" /></a>
            <a href="https://www.instagram.com/growthwithharishbhati" target="_blank" rel="noreferrer" data-testid="footer-instagram" className="rounded-lg bg-white/5 p-2.5 hover:bg-pink-600"><Instagram className="h-4 w-4" /></a>
            <a href="https://www.facebook.com/share/1BadZkWMoV/" target="_blank" rel="noreferrer" data-testid="footer-facebook" className="rounded-lg bg-white/5 p-2.5 hover:bg-blue-600"><Facebook className="h-4 w-4" /></a>
            <a href="https://youtube.com/@radhikatradersofficial" target="_blank" rel="noreferrer" data-testid="footer-youtube" className="rounded-lg bg-white/5 p-2.5 hover:bg-red-600"><Youtube className="h-4 w-4" /></a>
          </div>
          <Link to="/admin/login" className="mt-6 inline-block text-xs text-slate-500 hover:text-amber-400" data-testid="footer-admin-link">Admin Login →</Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Radhika Traders · Owner & Founder: Harish Bhati · All rights reserved.
      </div>
    </footer>
  );
}
