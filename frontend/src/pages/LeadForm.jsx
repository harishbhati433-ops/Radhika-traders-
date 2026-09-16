import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import api, { formatApiErrorDetail, fileUrl } from "../lib/api";
import { Input } from "../components/ui/input";
import { formatPan, formatAadhaar, formatIfsc, panError, aadhaarError, ifscError } from "../lib/validators";
import { IfscBankInfo } from "../components/IfscBankInfo";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";

const TYPES = { mobile: "tel", email: "email", dob: "date" };

export default function LeadForm() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const ref = params.get("ref") || localStorage.getItem(`rt_ref_${slug}`) || "";
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (params.get("ref")) localStorage.setItem(`rt_ref_${slug}`, params.get("ref"));
    api.get(`/join/${slug}`, { params: ref ? { ref } : {} }).then(({ data }) => setInfo(data)).catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail) || "Offer not available"));
  }, [slug, ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (panError(data.pan)) return toast.error(panError(data.pan));
    if (aadhaarError(data.aadhaar)) return toast.error(aadhaarError(data.aadhaar));
    if (data.ifsc && ifscError(data.ifsc)) return toast.error(ifscError(data.ifsc)); setBusy(true);
    try {
      const { data: res } = await api.post(`/leads/${slug}`, { ref, data });
      setDone(res);
      toast.success("Details submitted! Redirecting to the offer…");
      setTimeout(() => { window.location.href = res.redirect_url; }, 900);
    } catch (e2) { toast.error(formatApiErrorDetail(e2.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (err) return <PublicLayout><section className="mx-auto max-w-lg px-6 py-24 text-center" data-testid="lead-form-error"><h1 className="font-display text-3xl font-extrabold">Offer Currently Inactive</h1><p className="mt-3 text-slate-600">{err}</p><Link to="/campaigns" className="rt-gradient-btn mt-6 inline-flex rounded-full px-6 py-3 text-sm font-bold">View Live Campaigns</Link></section></PublicLayout>;
  if (!info) return <PublicLayout><div className="flex justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" /></div></PublicLayout>;

  const c = info.campaign;
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-5" data-testid="lead-form-page">
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-[#0B0F17] p-6 text-white">
            <div className="flex items-center gap-3">
              {c.logo_url ? <img src={fileUrl(c.logo_url)} alt={c.company} className="h-12 w-12 rounded-xl bg-white object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 font-display text-xl font-bold">{c.offer_name[0]}</div>}
              <div><div className="font-display text-xl font-bold">{c.offer_name}</div><div className="text-xs text-slate-400">{c.company}</div></div>
            </div>
            {c.customer_benefit && <p className="mt-4 text-sm text-slate-300">{c.customer_benefit}</p>}
            {info.referred_by && <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300" data-testid="lead-referred-by"><UserCheck className="h-3.5 w-3.5" /> Referred By: {info.referred_by}</div>}
            <div className="mt-5 flex items-start gap-2 text-xs text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> Your details are shared only with Radhika Traders to track and support your application. We never ask for OTPs or passwords.</div>
          </div>
        </div>
        <div className="lg:col-span-3">
          {done ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center" data-testid="lead-success">
              <div className="font-display text-2xl font-bold text-emerald-800">Details submitted ✓</div>
              <p className="mt-2 text-sm text-emerald-700">Lead ID <b className="font-mono">{done.lead_id}</b>. Taking you to {c.company || "the offer"} now…</p>
              <a href={done.redirect_url} data-testid="lead-continue" className="rt-gradient-btn mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">Continue to Offer <ArrowRight className="h-4 w-4" /></a>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" data-testid="lead-form">
              <h1 className="font-display text-2xl font-extrabold text-slate-950">Fill your details to continue</h1>
              <p className="mt-1 text-sm text-slate-500">After submitting you will be redirected to the official {c.company || "partner"} page to complete your application.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {info.fields.map((f) => (
                  <div key={f.key} className={f.key === "address" ? "sm:col-span-2" : ""}>
                    <Label>{f.label}{f.required && <span className="text-red-600"> *</span>}</Label>
                    <Input data-testid={`lead-field-${f.key}`} type={TYPES[f.key] || "text"} required={f.required} value={data[f.key] || ""}
                      inputMode={f.key === "aadhaar" || f.key === "mobile" ? "numeric" : undefined} maxLength={f.key === "pan" ? 10 : f.key === "aadhaar" ? 12 : f.key === "ifsc" ? 11 : undefined}
                      onChange={(e) => setData({ ...data, [f.key]: f.key === "pan" ? formatPan(e.target.value) : f.key === "aadhaar" ? formatAadhaar(e.target.value) : f.key === "ifsc" ? formatIfsc(e.target.value) : e.target.value })}
                      className={`mt-1.5 ${(f.key === "pan" && panError(data.pan)) || (f.key === "aadhaar" && aadhaarError(data.aadhaar)) || (f.key === "ifsc" && ifscError(data.ifsc)) ? "border-rose-400" : ""} ${f.key === "pan" || f.key === "ifsc" ? "uppercase" : ""}`} />
                    {f.key === "pan" && panError(data.pan) && <div className="mt-1 text-xs font-semibold text-rose-600" data-testid="lead-pan-error">{panError(data.pan)}</div>}
                    {f.key === "aadhaar" && aadhaarError(data.aadhaar) && <div className="mt-1 text-xs font-semibold text-rose-600" data-testid="lead-aadhaar-error">{aadhaarError(data.aadhaar)}</div>}
                    {f.key === "ifsc" && ifscError(data.ifsc) && <div className="mt-1 text-xs font-semibold text-rose-600" data-testid="lead-ifsc-error">{ifscError(data.ifsc)}</div>}
                    {f.key === "ifsc" && <IfscBankInfo ifsc={data.ifsc} testId="lead-ifsc-bank" />}
                  </div>
                ))}
              </div>
              <button type="submit" disabled={busy} data-testid="lead-submit" className="rt-gradient-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Submit & Continue to Offer
              </button>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
