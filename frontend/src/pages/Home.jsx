import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { CampaignCard } from "../components/CampaignCard";
import api from "../lib/api";
import { ArrowRight, ShieldCheck, Wallet, Users, TrendingUp, Zap, BadgeCheck } from "lucide-react";

const ticker = [
  "Rahul earned ₹1,200 on HDFC Credit Card campaign",
  "New Angel One Demat campaign added · ₹550 payout",
  "Priya withdrew ₹3,400 to bank successfully",
  "Zerodha account campaign now LIVE",
  "Term Insurance payout up to ₹2,200",
];

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    api.get("/campaigns").then(({ data }) => setCampaigns(data.slice(0, 6))).catch(() => {});
  }, []);

  return (
    <PublicLayout>
      {/* Ticker */}
      <div className="overflow-hidden border-b border-amber-500/20 bg-[#0B0F17] py-2">
        <div className="rt-marquee flex w-max gap-10 whitespace-nowrap">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="rt-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Trusted Partner since 2023
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Earn with India's top <span className="text-red-600">financial</span> affiliate campaigns
            </h1>
            <p className="mt-5 max-w-lg text-base text-slate-600 sm:text-lg">
              Share Demat, Credit Card, Savings & Insurance campaigns. Track your earnings, manage your wallet and withdraw seamlessly — all with Radhika Traders.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" data-testid="hero-get-started" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">
                Start Earning <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/campaigns" data-testid="hero-view-campaigns" className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200 px-6 py-3 text-sm font-bold text-slate-800 hover:border-red-300 hover:bg-red-50">
                Browse Campaigns
              </Link>
            </div>
            <div className="mt-10 flex gap-8">
              {[["50+", "Campaigns"], ["₹2,200", "Max Payout"], ["100%", "Secure"]].map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-2xl font-extrabold text-slate-900">{v}</div>
                  <div className="text-xs font-medium text-slate-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rt-fade-up" style={{ animationDelay: "120ms" }}>
            <img src="https://images.unsplash.com/photo-1526948531399-320e7e40f0ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
              alt="Financial advisory" className="w-full rounded-3xl object-cover shadow-2xl" style={{ maxHeight: 460 }} />
            <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white p-4 shadow-xl rt-gold-card">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <div className="font-mono text-lg font-bold text-emerald-600">₹1,42,500</div>
                  <div className="text-[11px] text-slate-500">Paid to partners</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-4">
          {[
            [Zap, "Instant Referral Links", "Get your unique link for every campaign & share in one click."],
            [Wallet, "Wallet & Earnings", "Track credits, earnings & withdrawals in a clean dashboard."],
            [ShieldCheck, "Safe & Legal", "Earning ledger + manual withdrawal. KYC secured, RBI-compliant."],
            [Users, "Real Support", "Direct support from Harish Bhati & the Radhika Traders team."],
          ].map(([Icon, t, d], i) => (
            <div key={t} className="rt-fade-up rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:rt-gold-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-4 inline-flex rounded-xl bg-red-50 p-3"><Icon className="h-6 w-6 text-red-600" /></div>
              <h3 className="font-display text-base font-bold text-slate-900">{t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Campaigns */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">Live Now</span>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Featured Campaigns</h2>
          </div>
          <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 hover:gap-2 transition-all">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c, i) => <CampaignCard key={c.id} c={c} index={i} />)}
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-7xl px-6 py-16" data-testid="team-section">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Our People</span>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Radhika Traders Team</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">The team behind every campaign, payout and celebration at our Agar Malwa office.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
          <img src="/images/team-1.jpeg" alt="Radhika Traders team" data-testid="team-photo-1"
            className="h-64 w-full rounded-3xl object-cover shadow-lg md:col-span-2 md:row-span-2 md:h-full" style={{ objectPosition: "50% 30%" }} />
          <img src="/images/team-2.jpeg" alt="Radhika Traders anniversary celebration" data-testid="team-photo-2"
            className="h-64 w-full rounded-3xl object-cover shadow-lg" />
          <div className="grid grid-cols-2 gap-4">
            <img src="/images/team-3.jpeg" alt="Radhika Traders team" data-testid="team-photo-3" className="h-64 w-full rounded-3xl object-cover shadow-lg" style={{ objectPosition: "50% 35%" }} />
            <img src="/images/team-4.jpeg" alt="Radhika Traders team" data-testid="team-photo-4" className="h-64 w-full rounded-3xl object-cover shadow-lg" style={{ objectPosition: "50% 35%" }} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-red-700 via-red-800 to-[#0B0F17] p-10 text-center sm:p-16">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Ready to grow your income?</h2>
          <p className="mx-auto mt-3 max-w-xl text-red-100">Join Radhika Traders today and turn your network into earnings.</p>
          <Link to="/signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-bold text-red-700 hover:bg-amber-50">
            Create Free Account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
