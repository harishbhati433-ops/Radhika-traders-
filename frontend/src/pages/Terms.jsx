import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { PartnerTermsBody, PARTNER_TERMS_VERSION } from "../components/PartnerTerms";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-10" data-testid="terms-page">
        <div className="mb-6 flex items-center justify-between gap-3"><Link to="/"><Logo size="sm" /></Link><span className="text-xs text-slate-400">Version {PARTNER_TERMS_VERSION}</span></div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Radhika Traders – Partner Declaration &amp; Terms</h1>
        <p className="mt-2 text-sm text-slate-500">ये terms हर Referral Partner पर लागू होते हैं और signup के समय स्वीकार किए जाते हैं।</p>
        <div className="mt-6"><PartnerTermsBody /></div>
        <div className="mt-8 flex gap-3"><Link to="/signup" data-testid="terms-signup-link" className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">Create account</Link><Link to="/" className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Home</Link></div>
      </div>
    </div>
  );
}
