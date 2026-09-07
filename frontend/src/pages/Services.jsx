import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { Megaphone, MousePointerClick, Target, Link2, ClipboardList, BarChart3, Handshake, ArrowRight, LineChart, CreditCard, PiggyBank, Shield, Landmark } from "lucide-react";

const services = [
  [Megaphone, "Digital Advertising", "Google, Meta, YouTube and display campaigns planned and optimised for finance & fintech brands."],
  [MousePointerClick, "Digital Marketing", "Social media, content, WhatsApp and email marketing funnels that build trust and convert."],
  [Target, "Performance Marketing", "Pay-for-results CPA / CPL / account-opening campaigns with transparent tracking."],
  [Link2, "Affiliate Marketing", "A growing publisher network promoting Demat, Mutual Fund, Credit Card, Loan & Insurance offers."],
  [ClipboardList, "Campaign Management", "Offer setup, creatives, payout structures, compliance checks and daily monitoring."],
  [BarChart3, "Campaign Tracking & Reporting", "Every click, lead and conversion tracked to the partner — with downloadable statements."],
  [Handshake, "Publisher / Partner Management", "Onboarding, KYC verification, wallets, manual verified payouts and dedicated support."],
];

const products = [
  [LineChart, "Demat & Trading"], [PiggyBank, "Mutual Fund / SIP"], [CreditCard, "Credit Cards"], [Landmark, "Loans"], [Shield, "Insurance"],
];

export default function Services() {
  return (
    <PublicLayout>
      <section className="bg-[#0B0F17] text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Our Services</span>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Advertising, Performance & Affiliate Marketing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">Radhika Traders is an Advertising & Digital Marketing Agency. We run and track campaigns for financial brands and pay our publisher partners on every conversion.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(([Icon, t, d], i) => (
            <div key={t} data-testid={`service-card-${i}`} className="rt-fade-up rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:rt-gold-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-3 inline-flex rounded-xl bg-[#0B0F17] p-3 text-amber-400"><Icon className="h-6 w-6" /></div>
              <h3 className="font-display text-lg font-bold text-slate-900">{t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14">
          <h2 className="font-display text-2xl font-bold text-slate-950">Financial products we promote</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {products.map(([I, t]) => <span key={t} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><I className="h-4 w-4 text-red-600" /> {t}</span>)}
          </div>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link to="/campaigns" data-testid="services-explore-campaigns" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">Explore Live Campaigns <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/partners" data-testid="services-partner" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950">Partner With Us</Link>
          <Link to="/contact" data-testid="services-contact" className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200 px-6 py-3 text-sm font-bold text-slate-800">Talk to Us</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
