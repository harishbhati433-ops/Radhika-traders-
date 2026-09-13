import { useEffect, useState } from "react";
import api from "../lib/api";
import { IFSC_RE } from "../lib/validators";
import { Landmark, Loader2, Info } from "lucide-react";

export function useIfscLookup(ifsc) {
  const [state, setState] = useState({ status: "idle" });
  useEffect(() => {
    const code = String(ifsc || "").toUpperCase();
    if (!IFSC_RE.test(code)) { setState({ status: "idle" }); return; }
    let active = true;
    setState({ status: "loading" });
    const t = setTimeout(() => {
      api.get(`/ifsc/${code}`).then(({ data }) => { if (active) setState(data.available ? { status: "ok", ...data } : { status: "miss", reason: data.reason }); })
        .catch(() => { if (active) setState({ status: "miss", reason: "lookup_unavailable" }); });
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [ifsc]);
  return state;
}

export function IfscBankInfo({ ifsc, testId = "ifsc-bank-info" }) {
  const s = useIfscLookup(ifsc);
  if (s.status === "idle") return null;
  if (s.status === "loading") return <div className="mt-1 flex items-center gap-1 text-xs text-slate-500" data-testid={`${testId}-loading`}><Loader2 className="h-3 w-3 animate-spin" /> Checking bank…</div>;
  if (s.status === "ok") return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900" data-testid={testId}>
      <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <div><b data-testid={`${testId}-bank`}>{s.bank}</b>{s.branch && <span data-testid={`${testId}-branch`}> · {s.branch}</span>}{(s.city || s.state) && <div className="text-[11px] text-emerald-700">{[s.city, s.state].filter(Boolean).join(", ")}</div>}</div>
    </div>
  );
  if (s.reason === "not_found" || s.reason === "invalid_format") return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700" data-testid={`${testId}-invalid`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Invalid IFSC — this code does not belong to any bank branch. Please check your passbook / cheque and enter the correct IFSC.</span>
    </div>
  );
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900" data-testid={`${testId}-miss`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Bank name could not be verified right now. You can still continue.</span>
    </div>
  );
}
