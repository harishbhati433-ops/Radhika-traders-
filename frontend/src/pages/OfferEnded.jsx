import { Link, useSearchParams } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { PauseCircle, XCircle, ArrowRight } from "lucide-react";

export default function OfferEnded() {
  const [params] = useSearchParams();
  const paused = params.get("s") === "paused";
  return (
    <PublicLayout>
      <section className="mx-auto max-w-2xl px-6 py-24 text-center" data-testid="offer-ended-page">
        <div className={`mx-auto inline-flex rounded-2xl p-4 ${paused ? "bg-amber-50" : "bg-rose-50"}`}>
          {paused ? <PauseCircle className="h-10 w-10 text-amber-600" /> : <XCircle className="h-10 w-10 text-rose-600" />}
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold text-slate-950 sm:text-4xl" data-testid="offer-ended-title">
          {paused ? "Offer Currently Inactive" : "Offer Ended"}
        </h1>
        <p className="mt-3 text-slate-600">
          {paused ? "This campaign is temporarily paused by Radhika Traders. Please check back soon or explore other live offers." : "This campaign is no longer available. Explore our other live campaigns and keep earning."}
        </p>
        <Link to="/campaigns" data-testid="offer-ended-browse" className="rt-gradient-btn mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">
          View Live Campaigns <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicLayout>
  );
}
