import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-red-700 via-red-800 to-[#0B0F17] lg:block">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #F59E0B 0, transparent 40%)" }} />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/"><img src="/images/logo-full.jpeg" alt="Radhika Traders" className="w-52 rounded-2xl shadow-2xl" data-testid="auth-logo-full" /></Link>
          <div>
            <h2 className="font-display text-4xl font-extrabold leading-tight">Turn your network into <span className="text-amber-300">income.</span></h2>
            <p className="mt-4 max-w-md text-red-100">Share trusted financial campaigns, track your wallet in real time, and withdraw your earnings securely.</p>
          </div>
          <p className="text-sm text-red-200">Owner & Founder: Harish Bhati · Since 2023</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
