import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { LineChart, CreditCard, PiggyBank, Shield, Landmark, Megaphone, ArrowRight } from "lucide-react";

const services = [
  [LineChart, "Demat & Trading", "Open Demat accounts with leading brokers like Angel One, Zerodha & Upstox.", "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"],
  [CreditCard, "Credit Cards", "Premium reward cards from HDFC, SBI, Axis & more with high payouts.", "https://images.unsplash.com/photo-1563013544-824ae1b704d3?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"],
  [PiggyBank, "Savings Accounts", "High-interest digital savings accounts with instant video KYC.", null],
  [Shield, "Insurance", "Term & health insurance plans to protect what matters most.", null],
  [Landmark, "Loan Assistance", "Personal, business & home loan guidance and referrals.", null],
  [Megaphone, "Digital Marketing", "Grow your affiliate reach with our marketing expertise.", null],
];

export default function Services() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Our Services</span>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Financial products that pay</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">From Demat accounts to insurance — promote trusted financial products and earn on every conversion.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(([Icon, t, d, img], i) => (
            <div key={t} className="rt-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:rt-gold-card" style={{ animationDelay: `${i * 60}ms` }}>
              {img && <img src={img} alt={t} className="h-40 w-full object-cover" />}
              <div className="p-6">
                <div className="mb-3 inline-flex rounded-xl bg-red-50 p-3"><Icon className="h-6 w-6 text-red-600" /></div>
                <h3 className="font-display text-lg font-bold text-slate-900">{t}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to="/campaigns" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">
            Explore Campaigns <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
