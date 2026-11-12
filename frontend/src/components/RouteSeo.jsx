import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BRAND = "Radhika Traders";
const DEFAULT_DESC = "Radhika Traders — Trusted Partner for Financial Growth. Affiliate campaigns for Demat, Credit Cards, Savings & Insurance.";

// Public, indexable pages → their own title/description. Everything else (staff panels, customer account pages) is noindex.
const PUBLIC = {
  "/": { title: `${BRAND} | Trusted Partner for Financial Growth`, desc: DEFAULT_DESC },
  "/about": { title: `About Us | ${BRAND}`, desc: "Who we are, our mission and the team behind Radhika Traders' affiliate campaign network." },
  "/services": { title: `Services | ${BRAND}`, desc: "Demat, credit card, savings account and insurance campaigns with transparent, on-time payouts." },
  "/contact": { title: `Contact Us | ${BRAND}`, desc: "Get in touch with Radhika Traders on WhatsApp, email or phone for campaigns and support." },
  "/campaigns": { title: `Live Campaigns | ${BRAND}`, desc: "Browse live affiliate campaigns — payout per approved lead, requirements and how to apply." },
  "/partners": { title: `Our Partners | ${BRAND}`, desc: "Banks, brokers and fintech brands Radhika Traders works with." },
  "/terms": { title: `Terms & Conditions | ${BRAND}`, desc: "Terms and conditions for Radhika Traders customers and affiliates." },
  "/app/login": { title: `Customer Login | ${BRAND}`, desc: "Sign in to your Radhika Traders customer account to track campaigns, leads, earnings and withdrawals." },
  "/app/signup": { title: `Create Account | ${BRAND}`, desc: "Join Radhika Traders for free and start earning with affiliate campaigns." },
};
const PUBLIC_PREFIX = { "/campaign/": { title: `Campaign | ${BRAND}`, desc: DEFAULT_DESC }, "/join/": { title: `Apply | ${BRAND}`, desc: DEFAULT_DESC } };
const PRIVATE_PREFIX = ["/admin", "/employee", "/app/", "/maintenance", "/offer-ended"];

const setMeta = (name, content) => {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
};
const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) { el?.remove(); return; }
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
  el.setAttribute("href", href);
};

export const seoFor = (pathname) => {
  const p = pathname.replace(/\/+$/, "") || "/";
  const pub = PUBLIC[p] || Object.entries(PUBLIC_PREFIX).find(([k]) => p.startsWith(k))?.[1];
  if (pub) return { ...pub, robots: "index, follow" };
  if (PRIVATE_PREFIX.some((k) => p === k || p.startsWith(k))) return { title: BRAND, desc: DEFAULT_DESC, robots: "noindex, nofollow" };
  // Unknown path → 404 page: never indexable
  return { title: `Page not found | ${BRAND}`, desc: DEFAULT_DESC, robots: "noindex, nofollow" };
};

export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const { title, desc, robots } = seoFor(pathname);
    document.title = title;
    setMeta("description", desc);
    setMeta("robots", robots);
    setMeta("googlebot", robots);
    setCanonical(robots.startsWith("index") ? `${window.location.origin}${pathname.replace(/\/+$/, "") || "/"}` : "");
  }, [pathname]);
  return null;
}
