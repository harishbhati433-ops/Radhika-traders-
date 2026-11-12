import { useEffect, useState } from "react";
import { ChevronDown, Users, Gift } from "lucide-react";
import api from "../lib/api";
import { useT } from "../lib/i18n";
import { ReferEarnCard } from "./ReferEarnCard";

const KEY = "rt_collapse_cust-refer";

export function ReferEarnSection({ code }) {
  const t = useT();
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) === "1");
  const [s, setS] = useState(null);
  const [ded, setDed] = useState(null);
  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setS(data)).catch(() => {});
    api.get("/my-referrals").then(({ data }) => setDed(data?.dedicated || null)).catch(() => {});
  }, []);
  const toggle = () => { const v = !open; setOpen(v); localStorage.setItem(KEY, v ? "1" : "0"); };
  const bonus = ded ? Number(ded.payout) || 0 : Number(s?.referral_bonus || 0), signup = Number(s?.signup_bonus || 0);
  return (
    <div className="refer-gold overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 shadow-sm" data-testid="refer-collapsible">
      <button type="button" onClick={toggle} aria-expanded={open} data-testid="refer-collapsible-toggle" className="flex w-full items-center gap-3 px-3.5 py-3 text-left sm:px-4">
        <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-md sm:h-12 sm:w-12">
          <Users className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-amber-50"><Gift className="h-2.5 w-2.5" /></span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-extrabold leading-tight text-slate-900 sm:text-lg">{t("Refer & Earn")}</span>
          <span className="mt-0.5 block text-xs leading-snug text-slate-700 sm:text-sm" data-testid="refer-earn-subline">
            {s ? (
              <>
                {t("Earn")} <b className="font-mono text-sm font-extrabold text-emerald-700 sm:text-base">₹{bonus}</b> {t("per Eligible Referral")}
                {signup > 0 && <> + <b className="font-mono text-sm font-extrabold text-emerald-700 sm:text-base">₹{signup}</b> {t("Signup Bonus")}</>}
              </>
            ) : t("Invite friends with your link — poster, QR code & share buttons")}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-200/80 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 sm:text-sm" data-testid="refer-collapsible-cta">
          {open ? t("Hide") : t("Show")} <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="border-t border-amber-200/70 bg-white/70 p-3 sm:p-4">{s && (
        <div className="mb-3 grid grid-cols-2 gap-2" data-testid="refer-earn-highlights">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{t("You get")}</div><div className="font-mono text-lg font-extrabold text-emerald-700">₹{bonus} <span className="text-xs font-semibold text-emerald-700/80">/ {t("referral")}</span></div></div>
          {signup > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">{t("Friend gets")}</div><div className="font-mono text-lg font-extrabold text-amber-800">₹{signup} <span className="text-xs font-semibold text-amber-800/80">{t("Signup Bonus")}</span></div></div>}
        </div>
      )}<ReferEarnCard code={code} /></div>}
    </div>
  );
}
