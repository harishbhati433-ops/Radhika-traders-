import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { CampaignCard } from "../components/CampaignCard";
import api from "../lib/api";
import { ArrowRight, ShieldCheck, Wallet, Users, TrendingUp, Zap, BadgeCheck, IndianRupee, Megaphone, MousePointerClick, Target, Link2, ClipboardList, BarChart3, Handshake } from "lucide-react";

const AGENCY_SERVICES = [
  [Megaphone, "Digital Advertising", "Paid ads across Google, Meta & YouTube for finance brands."],
  [MousePointerClick, "Digital Marketing", "Social, content & funnel marketing that converts."],
  [Target, "Performance Marketing", "CPA / CPL campaigns — you pay only for results."],
  [Link2, "Affiliate Marketing", "Publisher network promoting Demat, cards, loans & insurance."],
  [ClipboardList, "Campaign Management", "End-to-end setup, creatives, payouts & compliance."],
  [BarChart3, "Campaign Tracking & Reporting", "Click, lead & conversion tracking with live reports."],
  [Handshake, "Publisher / Partner Management", "Onboarding, KYC, wallets & payouts for every partner."],
  [Wallet, "Manual, Verified Payouts", "UPI / bank transfers with proof emailed on every payment."],
];

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
      <section className="relative overflow-hidden bg-[#0B0F17] text-white" data-testid="home-hero">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-red-700/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="rt-fade-up">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                <BadgeCheck className="h-3.5 w-3.5" /> Advertising & Digital Marketing Agency
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white" data-testid="hero-zero-investment-badge">
                <IndianRupee className="h-3.5 w-3.5" /> ₹0 Investment for Partners
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Performance-driven <span className="text-red-500">Digital</span> & <span className="text-amber-400">Affiliate</span> Marketing that pays
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg" data-testid="hero-agency-line">
              <strong className="text-white">Radhika Traders</strong> is an Advertising & Digital Marketing Agency working in <strong className="text-white">Digital Marketing, Performance Marketing and Affiliate Marketing</strong> — running campaigns for India's leading brokers, banks and insurers, and paying publishers on every conversion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/services" data-testid="hero-explore-services" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">
                Explore Services <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/partners" data-testid="hero-partner-with-us" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:brightness-110">
                Partner With Us
              </Link>
              <Link to="/campaigns" data-testid="hero-view-campaigns" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">
                Live Campaigns
              </Link>
            </div>
            <div className="mt-8 text-sm text-slate-400" data-testid="hero-brand-line">
              <span className="font-display font-bold text-white">Radhika Traders</span> <span className="text-slate-500">|</span> Harish Bhati <span className="mx-1 text-slate-600">·</span> <span className="text-amber-400">Trusted Partner for Financial Growth</span>
            </div>
            <div className="mt-8 flex gap-8">
              {[["₹0", "Investment Needed"], ["₹2,200", "Max Payout"], ["7+", "Years in Market"]].map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-2xl font-extrabold text-white">{v}</div>
                  <div className="text-xs font-medium text-slate-400">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rt-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="grid grid-cols-3 gap-3">
              <img src="/images/hero-team.jpg" alt="Radhika Traders style team working together on laptops"
                className="col-span-2 h-[420px] w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/10" data-testid="hero-visual-main" />
              <div className="flex flex-col gap-3">
                <img src="/images/hero-wfh.jpg" alt="Partner working from home on laptop"
                  className="h-[200px] w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/10" data-testid="hero-visual-2" />
                <div className="flex flex-1 flex-col justify-center rounded-3xl bg-gradient-to-br from-red-600 to-red-800 p-4 text-white shadow-2xl">
                  <div className="font-display text-3xl font-extrabold text-amber-300">₹300+</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider">Per Demat A/C</div>
                  <div className="mt-2 text-[11px] text-red-100">Demat · Cards · Loans · Insurance · SIP</div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white p-4 shadow-xl rt-gold-card">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <div className="font-mono text-lg font-bold text-emerald-600">₹1,42,500</div>
                  <div className="text-[11px] text-slate-500">Paid to partners</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 right-4 rounded-full bg-[#0B0F17]/80 px-4 py-2 text-xs font-bold text-amber-300 ring-1 ring-amber-400/40 backdrop-blur">Performance · Affiliate · Digital Marketing</div>
          </div>
        </div>
      </section>

      {/* Agency services */}
      <section className="mx-auto max-w-7xl px-6 py-16" data-testid="home-services">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">What we do</span>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Full-stack advertising & affiliate services</h2>
          </div>
          <Link to="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-red-700">All services <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENCY_SERVICES.map(([Icon, t, d], i) => (
            <Link to="/services" key={t} className="rt-fade-up group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:rt-gold-card" style={{ animationDelay: `${i * 50}ms` }} data-testid={`service-tile-${i}`}>
              <div className="mb-3 inline-flex rounded-xl bg-[#0B0F17] p-2.5 text-amber-400 group-hover:bg-red-600 group-hover:text-white"><Icon className="h-5 w-5" /></div>
              <div className="font-display font-bold text-slate-900">{t}</div>
              <p className="mt-1 text-xs text-slate-500">{d}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Zero investment strip */}
      <section className="bg-emerald-600 text-white" data-testid="zero-investment-strip">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="font-display text-xl font-extrabold sm:text-2xl">Zero Investment. Real Earnings.</div>
            <div className="text-sm text-emerald-100">आपको एक भी रुपया लगाने की ज़रूरत नहीं — बस link share करें और हर conversion पर payout पाएँ।</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {["No joining fee", "No deposit", "No hidden charges", "Withdraw to UPI / Bank"].map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-3 py-1.5">{t}</span>
            ))}
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
      <section id="team" className="mx-auto max-w-7xl px-6 py-16" data-testid="team-section">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Our People</span>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Radhika Traders Team</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">The team behind every campaign, payout and celebration at our Agar (M.P.) office.</p>
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
