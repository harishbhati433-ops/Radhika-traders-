import { PublicLayout } from "../components/PublicLayout";
import { CheckCircle2 } from "lucide-react";

export default function About() {
  const areas = ["Demat Accounts", "Savings A/C", "Credit Cards", "Insurance", "Loan Assistance", "Financial Products", "Affiliate Campaigns", "Digital Marketing"];
  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="rt-fade-up">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">About Us</span>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Radhika Traders</h1>
            <p className="mt-5 text-base text-slate-600 sm:text-lg">
              Founded on <strong>15 June 2023</strong>, Radhika Traders is a growing affiliate marketing & financial services company. We help individuals access the right financial products while empowering partners to earn through genuine campaigns.
            </p>
            <p className="mt-4 text-base text-slate-600">
              Our team brings <strong>3+ years of individual experience</strong> and <strong>6+ years of combined expertise</strong> in the financial and digital marketing space.
            </p>
            <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-500/5 p-5" data-testid="about-owner-card">
              <div className="flex items-center gap-4">
                <img src="/images/harish-bhati.jpeg" alt="Harish Bhati" className="h-16 w-16 rounded-full border-2 border-amber-400 object-cover" style={{ objectPosition: "50% 38%" }} data-testid="about-owner-avatar" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Owner & Founder</div>
                  <div className="mt-1 font-display text-xl font-bold text-slate-900">Harish Bhati</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Harish Bhati has been working in the financial & affiliate marketing market for <strong>7 years</strong>. With deep hands-on experience across demat accounts, banking products, insurance and digital campaigns, he leads Radhika Traders with a vision to help partners earn genuinely and customers choose the right financial products.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-xl bg-red-600 px-3 py-2 text-center text-white">
                  <div className="font-display text-2xl font-extrabold leading-none">7+</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">Years</div>
                </div>
                <div className="text-xs text-slate-500">Market experience in financial services & affiliate marketing</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4 rt-fade-up" data-testid="about-owner-photos">
            <div className="col-span-3 relative overflow-hidden rounded-3xl shadow-xl" style={{ height: 560 }}>
              <img src="/images/harish-bhati.jpeg" alt="Harish Bhati — Owner & Founder, Radhika Traders"
                className="h-full w-full object-cover object-top" data-testid="about-owner-photo-main" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Owner & Founder</div>
                <div className="font-display text-xl font-bold">Harish Bhati</div>
              </div>
            </div>
            <div className="col-span-2 flex flex-col gap-4">
              <div className="relative flex-1 overflow-hidden rounded-3xl shadow-xl">
                <img src="/images/harish-bhati-2.jpeg" alt="Harish Bhati" className="h-full w-full object-cover object-top" data-testid="about-owner-photo-2" />
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-red-700 to-[#0B0F17] p-5 text-white">
                <div className="font-display text-4xl font-extrabold text-amber-300">7+</div>
                <div className="text-xs font-semibold uppercase tracking-wider">Years in the Market</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">What we work with</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <div key={a} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
