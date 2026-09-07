import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { StatusBadge } from "../components/StatusBadge";
import { ShareButtons } from "../components/ShareButtons";
import api, { fileUrl } from "../lib/api";
import { useLivePoll } from "../lib/useLivePoll";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Copy, ArrowLeft, TrendingUp, Wallet, FileText, ListChecks, AlertTriangle, Calendar, MousePointerClick } from "lucide-react";

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

export default function CampaignDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [clicks, setClicks] = useState(null);

  useLivePoll(() => {
    api.get(`/campaigns/slug/${slug}`).then(({ data }) => setC(data)).catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (user) api.get("/my-clicks").then(({ data }) => setClicks(data)).catch(() => {});
  }, [user]);

  if (notFound) return <PublicLayout><div className="mx-auto max-w-2xl px-6 py-24 text-center"><h1 className="font-display text-2xl font-bold">Campaign not found</h1><Link to="/campaigns" className="mt-4 inline-block text-red-600">← Back to campaigns</Link></div></PublicLayout>;
  if (!c) return <PublicLayout><div className="flex justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" /></div></PublicLayout>;

  const origin = window.location.origin;
  const refCode = user?.referral_code;
  const primaryLink = (c.affiliate_links || []).find((l) => l.is_primary && l.is_active) || (c.affiliate_links || []).find((l) => l.is_active);
  const referralLink = refCode ? `${origin}/api/go/${c.slug}?ref=${refCode}` : `${origin}/campaign/${c.slug}`;
  const applyLink = `${origin}/api/go/${c.slug}${refCode ? `?ref=${refCode}` : ""}`;
  const myClicks = clicks?.by_campaign?.[c.id] || 0;

  const copyRef = () => { navigator.clipboard.writeText(applyMessage); toast.success("Message with your referral link copied!"); };
  const applyMessage =
    `Hello,\n\n${user?.name ? `I am ${user.name}, a partner with Radhika Traders.` : "Greetings from Radhika Traders."} I would like to share an opportunity with ${c.company || c.offer_name}.\n\n` +
    `${c.offer_name}${c.customer_benefit ? ` — ${c.customer_benefit}` : ""}\n` +
    `${c.requirements ? `Requirements: ${String(c.requirements).slice(0, 160)}\n` : ""}` +
    `\nApply using my link: ${referralLink}\n\nRadhika Traders · Trusted Partner for Financial Growth`;

  return (
    <PublicLayout>
      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-red-700 via-red-800 to-[#0B0F17] sm:h-60">
        {c.banner_url && <img src={fileUrl(c.banner_url)} alt="" className="h-full w-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <Link to="/campaigns" className="mb-4 mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-600">
          <ArrowLeft className="h-4 w-4" /> All Campaigns
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="-mt-16 flex items-end gap-4">
              {c.logo_url ? (
                <img src={fileUrl(c.logo_url)} alt={c.company} className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-red-600 to-red-900 font-display text-2xl font-black text-white shadow-lg">
                  {(c.company || c.offer_name).charAt(0)}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950">{c.offer_name}</h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">{c.company} · {c.category}</p>
            {c.status !== "live" && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" data-testid="campaign-inactive-notice">
                {c.status === "paused" ? "Offer Currently Inactive — this campaign is temporarily paused. Referral links will not redirect until it is live again." : "Offer Ended — this campaign is closed. Referral links no longer work."}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700"><TrendingUp className="h-3 w-3" /> Payout</div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-700">₹{c.payout_amount}</div>
              </div>
              <Field label="Payout Type" value={c.payout_type} />
              <Field label="Campaign Type" value={c.campaign_type} />
              <Field label="Investment" value={c.investment} />
            </div>

            {c.description && <div className="mt-8"><h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-slate-900"><FileText className="h-5 w-5 text-red-600" /> Description</h2><p className="text-sm leading-relaxed text-slate-600">{c.description}</p></div>}
            {c.benefits && <div className="mt-6"><h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Wallet className="h-5 w-5 text-red-600" /> Benefits</h2><p className="text-sm leading-relaxed text-slate-600">{c.benefits}</p></div>}
            {c.customer_benefit && <div className="mt-6"><h3 className="mb-1 font-display font-bold text-slate-900">Customer Benefit</h3><p className="text-sm text-slate-600">{c.customer_benefit}</p></div>}
            {c.requirements && <div className="mt-6"><h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-slate-900"><ListChecks className="h-5 w-5 text-red-600" /> Requirements</h2><p className="text-sm leading-relaxed text-slate-600">{c.requirements}</p></div>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Field label="Min Requirement" value={c.min_requirement} />
              <Field label="Max Payout" value={c.max_payout} />
              <Field label="Special Bonus" value={c.special_bonus} />
              <Field label="Payment Timeline" value={c.payment_timeline} />
              <Field label="Validity" value={c.validity} />
              <Field label="Affiliate Payout" value={c.affiliate_payout} />
            </div>

            {c.important_notes && (
              <div className="mt-6 rounded-xl border border-amber-300/40 bg-amber-50 p-4">
                <h3 className="mb-1 flex items-center gap-2 font-display font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> Important Notes</h3>
                <p className="text-sm text-amber-800">{c.important_notes}</p>
              </div>
            )}
            {(c.start_date || c.end_date) && (
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" /> {c.start_date} {c.end_date && `— ${c.end_date}`}</p>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 rt-gold-card">
              <h3 className="font-display text-lg font-bold text-slate-900">Your Referral Link</h3>
              {user ? (
                <>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                    <input data-testid="referral-link-input" readOnly value={referralLink} className="flex-1 bg-transparent text-xs text-slate-600 outline-none" />
                    <button data-testid="referral-copy-btn" onClick={copyRef} className="rounded-md bg-slate-900 p-1.5 text-white"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-4"><ShareButtons link={referralLink} message={applyMessage.replace(`\n\nApply using my link: ${referralLink}`, "\n\nApply using my link:")} copyText={applyMessage} testPrefix="detail-share" /></div>
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-800"><MousePointerClick className="h-3.5 w-3.5" /> Clicks on your link</span>
                    <span className="font-mono font-bold text-emerald-700" data-testid="referral-clicks">{myClicks}</span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    {primaryLink ? "Customers who open your link go straight to the partner's signup page. Every click is tracked to your account." : "No partner link added yet — your link opens this campaign page."}
                  </p>
                </>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-sm text-slate-600">Login to get your unique referral link and start earning.</p>
                  <Link to="/login" className="rt-gradient-btn mt-3 inline-block rounded-full px-5 py-2 text-sm font-bold">Login</Link>
                </div>
              )}

              {primaryLink && c.status === "live" && (
                <a href={applyLink} target="_blank" rel="noreferrer" data-testid="campaign-apply-btn"
                  className="rt-gradient-btn mt-5 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold">
                  Join / Apply Now
                </a>
              )}
              {primaryLink && c.status !== "live" && (
                <button disabled data-testid="campaign-apply-disabled"
                  className="mt-5 flex w-full cursor-not-allowed items-center justify-center rounded-full bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500">
                  {c.status === "paused" ? "Offer Currently Inactive" : "Offer Ended"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
