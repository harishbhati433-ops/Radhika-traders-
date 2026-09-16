import { PublicLayout } from "../components/PublicLayout";
import { Phone, Mail, MapPin, MessageCircle, Instagram, Facebook, Youtube } from "lucide-react";
import { useContact, telLink, waLink, WA_GREETING } from "../lib/contact";

export default function Contact() {
  const contact = useContact();
  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Get in Touch</span>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Contact Radhika Traders</h1>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {[
              [Phone, "Phone", contact.support_mobile, telLink(contact.support_mobile)],
              [MessageCircle, "WhatsApp", contact.whatsapp_number, waLink(contact.whatsapp_number, WA_GREETING)],
              [Mail, "Email", contact.support_email, `mailto:${contact.support_email}`],
              [MapPin, "Address", "Bada Gawali Pura Rd, nearby Pitambara Hospital, Chhawani Naka, Chhawani, Agar, Madhya Pradesh 465441", "https://www.google.com/maps/search/?api=1&query=Radhika+Traders+Bada+Gawali+Pura+Rd+Chhawani+Naka+Agar+Madhya+Pradesh+465441"],
            ].map(([Icon, label, val, href]) => (
              <div key={label} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="rounded-xl bg-red-50 p-3"><Icon className="h-5 w-5 text-red-600" /></div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  {href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" data-testid={`contact-${label.toLowerCase()}-link`} className="text-sm font-semibold text-slate-800 hover:text-red-600">{val}{label === "Phone" && <span className="ml-2 text-xs font-bold text-red-600">Tap to call</span>}{label === "Address" && <span className="ml-2 text-xs font-bold text-red-600">Open in Maps</span>}</a>
                    : <div className="text-sm font-semibold text-slate-800">{val}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-red-700 to-[#0B0F17] p-8 text-white">
            <div>
              <div className="flex items-center gap-4">
                <img src="/images/harish-bhati-face.jpeg" alt="Harish Bhati" className="h-24 w-24 rounded-full border-2 border-amber-300 object-cover shadow-lg" data-testid="contact-owner-photo" />
                <div>
                  <h3 className="font-display text-2xl font-bold">Owner & Founder</h3>
                  <p className="mt-1 text-lg text-amber-300">Harish Bhati</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-red-100">Have questions about campaigns, payouts or partnership? Reach out — we usually respond within a few hours.</p>
            </div>
            <div className="mt-8 space-y-3">
              <a href={telLink(contact.owner_mobile)} data-testid="contact-call-now"
                className="flex items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:brightness-110">
                <Phone className="h-4 w-4" /> Call Now · {contact.owner_mobile}
              </a>
              <a href={waLink(contact.whatsapp_number, WA_GREETING)} target="_blank" rel="noreferrer" data-testid="contact-whatsapp"
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold hover:brightness-110">
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </a>
              <div className="flex justify-center gap-2">
                <a href="https://www.instagram.com/growthwithharishbhati" target="_blank" rel="noreferrer" data-testid="contact-instagram" className="rounded-lg bg-white/10 p-3 hover:bg-pink-600"><Instagram className="h-5 w-5" /></a>
                <a href="https://www.facebook.com/share/1BadZkWMoV/" target="_blank" rel="noreferrer" data-testid="contact-facebook" className="rounded-lg bg-white/10 p-3 hover:bg-blue-600"><Facebook className="h-5 w-5" /></a>
                <a href="https://youtube.com/@radhikatradersofficial" target="_blank" rel="noreferrer" data-testid="contact-youtube" className="rounded-lg bg-white/10 p-3 hover:bg-red-600"><Youtube className="h-5 w-5" /></a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
