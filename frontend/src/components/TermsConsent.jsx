import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { PartnerTermsBody, PARTNER_TERMS_VERSION } from "./PartnerTerms";

// Signup consent: a compact scrollable terms box + one checkbox. Nothing is required beyond ticking the box.
export function TermsConsent({ checked, onChange }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="terms-consent">
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} data-testid="terms-toggle" className="flex w-full items-center gap-2 text-left text-xs font-bold text-slate-800">
        <FileText className="h-4 w-4 text-red-600" /> <span className="flex-1">Radhika Traders – Partner Declaration &amp; Terms</span>
        <span className="text-[11px] font-semibold text-red-700">{expanded ? "Hide" : "Read"}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 [scrollbar-width:thin]" data-testid="terms-scroll">
          <PartnerTermsBody compact />
        </div>
      )}
      <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid="terms-checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-red-600" />
        <span>मैंने <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-red-700 underline" data-testid="terms-link">Partner Declaration &amp; Terms</a> पढ़ और समझ लिए हैं और मैं इन्हें स्वीकार करता/करती हूँ। <span className="text-slate-400">(v{PARTNER_TERMS_VERSION})</span></span>
      </label>
    </div>
  );
}
