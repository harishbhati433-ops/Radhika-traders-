import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Award, Printer, Mail, Loader2 } from "lucide-react";
import { useContact, fmtWa } from "../../lib/contact";

export default function WelcomeLetter() {
  const contact = useContact();
  const [l, setL] = useState(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { api.get("/me/welcome-letter").then(({ data }) => setL(data)); }, []);

  const resend = async () => {
    setSending(true);
    try { const { data } = await api.post("/me/welcome-letter/resend"); toast.success(data.message); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSending(false); }
  };
  const date = l ? new Date(l.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <DashboardLayout nav={customerNav} title="Welcome Letter">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <button onClick={() => window.print()} data-testid="welcome-print" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Print / Save PDF</button>
        <button onClick={resend} disabled={sending} data-testid="welcome-resend" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email me a copy</button>
      </div>
      {l && (
        <div id="welcome-letter" data-testid="welcome-letter" className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
          <div className="border-b-4 border-amber-400 bg-[#991B1B] px-8 py-6 text-white">
            <div className="font-display text-2xl font-extrabold tracking-wide">RADHIKA <span className="text-amber-300">TRADERS</span></div>
            <div className="mt-0.5 text-[11px] font-bold tracking-[0.2em] text-amber-200">TRUSTED PARTNER FOR FINANCIAL GROWTH</div>
          </div>
          <div className="px-8 py-8 sm:px-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold tracking-[0.2em] text-amber-700">WELCOME LETTER</div>
                <h1 className="mt-1 font-display text-3xl font-extrabold text-slate-900">Congratulations, {l.name?.split(" ")[0]}!</h1>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Date: <b className="text-slate-800">{date}</b></div>
                <div className="mt-1">Partner ID: <b className="font-mono text-slate-800" data-testid="welcome-ref-code">{l.referral_code}</b></div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <Award className="h-8 w-8 text-amber-600" />
              <div className="text-sm text-amber-900"><b>Certified Partner</b> — Radhika Traders Affiliate Network</div>
            </div>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700">
              {l.paragraphs.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
            </div>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-slate-200 pt-6">
              <div>
                <div className="font-display text-xl font-bold italic text-[#991B1B]">Harish Bhati</div>
                <div className="text-sm font-semibold text-slate-800">Harish Bhati</div>
                <div className="text-xs text-slate-500">Founder, Radhika Traders</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Agar, Madhya Pradesh</div>
                <div>WhatsApp: {fmtWa(contact.whatsapp_number)}</div>
                <div>{contact.support_email}</div>
                <div>www.radhikatraders.net</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden; } #welcome-letter, #welcome-letter * { visibility: visible; } #welcome-letter { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
    </DashboardLayout>
  );
}
