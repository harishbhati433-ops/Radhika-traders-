import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { ArrowRight, IndianRupee, Link2, Wallet, BarChart3, ShieldCheck, Headphones } from "lucide-react";

const perks = [
  [IndianRupee, "Zero Investment", "No joining fee, no deposit. Start earning from day one."],
  [Link2, "Unique Tracking Links", "Every campaign gives you a personal link — every click is tracked to you."],
  [BarChart3, "Transparent Reporting", "Live dashboard with clicks, leads, earnings and statements."],
  [Wallet, "Fast Manual Payouts", "Withdraw to UPI or bank; proof of every payment emailed to you."],
  [ShieldCheck, "Verified Campaigns", "Only trusted brokers, banks and insurers — RBI/SEBI regulated products."],
  [Headphones, "Direct Support", "Talk to Harish Bhati and the Radhika Traders team on WhatsApp."],
];

export default function Partners() {
  return (
    <PublicLayout>
      <section className="bg-[#0B0F17] text-white" data-testid="partners-hero">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Publisher / Partner Program</span>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">Partner With <span className="text-red-500">Radhika Traders</span> and monetise your network</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">Influencers, agents, students, sub-brokers, telecallers — anyone with an audience can promote our financial campaigns and earn a payout on every eligible conversion.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" data-testid="partners-register" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">Register as Partner <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/campaigns" data-testid="partners-campaigns" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">See Live Campaigns</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">Why publishers choose us</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {perks.map(([I, t, d], i) => (
            <div key={t} className="rt-fade-up rounded-2xl border border-slate-200 bg-white p-6 hover:rt-gold-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-4 inline-flex rounded-xl bg-red-50 p-3"><I className="h-6 w-6 text-red-600" /></div>
              <h3 className="font-display text-lg font-bold text-slate-900">{t}</h3><p className="mt-1.5 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-red-700 to-[#0B0F17] p-8 text-white sm:p-12">
          <h3 className="font-display text-2xl font-bold sm:text-3xl">How it works</h3>
          <ol className="mt-6 grid gap-6 sm:grid-cols-4">
            {["Create your free partner account", "Pick a live campaign & copy your link", "Share on WhatsApp, Instagram, YouTube", "Earn payout on every approved conversion"].map((s, i) => (
              <li key={s} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 font-mono text-sm font-bold text-slate-950">{i + 1}</span><span className="text-sm text-slate-200">{s}</span></li>
            ))}
          </ol>
          <Link to="/signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:brightness-110">Partner With Us <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </PublicLayout>
  );
}
