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
            <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-500/5 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Owner & Founder</div>
              <div className="mt-1 font-display text-xl font-bold text-slate-900">Harish Bhati</div>
            </div>
          </div>
          <img src="https://images.pexels.com/photos/8068654/pexels-photo-8068654.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Radhika Traders team" className="w-full rounded-3xl object-cover shadow-xl rt-fade-up" style={{ maxHeight: 460 }} />
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
