import { ClipboardList, Send, FileCheck2, BadgeCheck, Activity, Lock, Zap, MessageCircle, Building2, Tag, Gift } from "lucide-react";
import { fileUrl } from "../lib/api";

const STEPS = [["Fill Details", ClipboardList], ["Submit Lead", Send], ["Complete Application", FileCheck2], ["Verification", BadgeCheck], ["Track Status", Activity]];
const HIGHLIGHTS = [[Lock, "Your Data is Secure"], [Zap, "Fast & Simple Process"], [MessageCircle, "Support When You Need It"]];

export function UserFlowSection({ campaign }) {
  const c = campaign || {};
  return (
    <section className="border-t border-slate-200 bg-slate-50" data-testid="user-flow-section">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {c.offer_name && (
          <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-6" data-testid="user-flow-campaign">
            <div className="flex items-center gap-3">
              {c.logo_url ? <img src={fileUrl(c.logo_url)} alt={c.company} className="h-11 w-11 rounded-xl border border-slate-100 object-contain p-1" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 font-display text-lg font-bold text-white">{c.offer_name[0]}</div>}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-600">About this offer</div>
                <div className="font-display text-base font-extrabold text-slate-950 md:text-lg">{c.offer_name}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-slate-600">
              {c.company && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /> {c.company}</span>}
              {c.category && <span className="inline-flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-slate-400" /> {c.category}</span>}
            </div>
            {(c.customer_benefit || c.description) && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <Gift className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What you get</div>
                  <p className="mt-0.5 leading-relaxed">{c.customer_benefit || c.description}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-600">User Flow</div>
        <h2 className="mt-1 font-display text-base font-extrabold text-slate-950 md:text-lg">How it works — 5 simple steps</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-5" data-testid="user-flow-steps">
          {STEPS.map(([label, Icon], i) => (
            <li key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-col sm:items-start" data-testid={`user-flow-step-${i + 1}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><Icon className="h-5 w-5" /></div>
              <div><div className="text-[11px] font-bold text-slate-400">STEP {i + 1}</div><div className="text-sm font-bold text-slate-900">{label}</div></div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2" data-testid="user-flow-highlights">
          {HIGHLIGHTS.map(([Icon, t]) => <div key={t} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon className="h-4 w-4 text-red-600" /> {t}</div>)}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-500" data-testid="user-flow-privacy">
          Your data is collected only for lead processing and application support. We respect your privacy and do not misuse or share your personal information for unauthorized purposes.
        </p>
        <p className="mt-6 border-t border-slate-200 pt-4 text-[11px] text-slate-400">© {new Date().getFullYear()} Radhika Traders · Trusted Partner for Financial Growth</p>
      </div>
    </section>
  );
}
