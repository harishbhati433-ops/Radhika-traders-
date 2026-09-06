# Radhika Traders — Affiliate Campaign Management Platform

## Original Problem Statement
Professional, secure, fully-dynamic affiliate campaign platform for Radhika Traders (Owner/Founder: Harish Bhati). Admin manages campaigns/offers, categories, referral links, customer wallets and withdrawals; customers view campaigns, get referral links, track earnings/wallet, request withdrawals and download statements. Branding: RADHIKA TRADERS · Trusted Partner for Financial Growth. Red + Gold + Black on white premium theme.

## Architecture
- **Frontend:** React (JS/JSX) + react-router + Tailwind + shadcn/ui + sonner + lucide-react. Auth via JWT Bearer token in localStorage (`rt_token`).
- **Backend:** FastAPI (`/app/backend/server.py`), modular helpers: `auth_utils.py`, `email_service.py` (Resend), `storage_service.py` (object storage). All routes under `/api`.
- **DB:** MongoDB — collections: users, otp_codes, categories, campaigns, transactions, withdrawals, files.
- **Integrations:** JWT auth (bcrypt), Resend managed email for OTP (signup + reset), Emergent object storage for logos/banners.

## User Personas
- **Admin (Harish Bhati):** full control of campaigns, categories, customers, wallet credits, withdrawals, dashboard.
- **Customer:** signup w/ email OTP, browse campaigns, referral links + share, wallet, withdrawals (KYC gated), statements, profile.

## Core Requirements (static)
- Strict role separation & data isolation (customers see only own data).
- Campaign CRUD with Live/Pause/Close + offer enable/disable; Delete = Archive (restorable).
- Wallet: admin manual credit; balance/earnings/withdrawn/pending computed from ledger.
- Withdrawal: KYC mandatory, min Rs.100, statuses pending/approved/paid/rejected.
- Statements: PDF/Excel/CSV.
- SEO slug campaign detail pages, search/filter, category & image management.

## Implemented (2026-06)
- ✅ Auth: register+email OTP verify, login (admin+customer), forgot/reset via OTP, JWT.
- ✅ Public site: Home (ticker+hero), About, Services, Contact, Campaigns list (search/filter), Campaign detail w/ referral link + WhatsApp/Telegram/Copy/native share.
- ✅ Admin: dashboard KPIs, campaign manager (full form, image upload, affiliate links, status/offer toggles, archive/restore), category CRUD, customers list + wallet credit modal, withdrawals approve/reject/paid.
- ✅ Customer: dashboard, campaigns, wallet + transactions, withdrawals (KYC gated), statements (PDF/Excel/CSV), profile + KYC/bank.
- ✅ Object storage image upload/serve; demo campaigns & categories seeded.
- ✅ Backend tested: 27/27 pass. Fixed wallet double-debit bug.

## Credentials
- Admin: bhatiharish276@gmail.com / Radhika@2023 (see /app/memory/test_credentials.md)

## Backlog (prioritized)
- **P1:** SMS OTP (DLT), automatic click/lead/conversion tracking, admin KYC verify/approve action, email statements/reports.
- **P2:** Multiple referral link management per customer, QR code on campaign detail, brute-force lockout on login, analytics charts.
- **P3:** Migrate startup event to FastAPI lifespan; split server.py into routers.

## Notes
- OTP emails send via Resend AND are logged to backend logs (`[OTP ...]`) for testing.
- Admin KYC approval currently: customer KYC submits as "pending" which already unlocks withdrawal; a formal admin verify toggle is backlog P1.


## Update (June 2026)
- Contact page: WhatsApp 'Chat on WhatsApp' button linked to wa.me/916376541191 with pre-filled message. Footer: WhatsApp + Social links set: Instagram https://www.instagram.com/growthwithharishbhati, Facebook https://www.facebook.com/share/1BadZkWMoV/, YouTube https://youtube.com/@radhikatradersofficial.
- Backlog: P1 Email OTP (signup/reset), P1 statement PDF/Excel/CSV download; P2 WhatsApp/SMS OTP, P2 automated click/lead tracking.

- About page: Owner & Founder Harish Bhati bio added — 7 years market experience (user explicitly said 7, not 6).
- Owner real photos added (/frontend/public/images/harish-bhati.jpeg, harish-bhati-2.jpeg) on About page (hero + avatar) and Contact owner card. Faces untouched; only camera watermark strip cropped.
- Avatar uses face-centered crop /images/harish-bhati-face.jpeg (user asked face clearly visible). Team photos: user will upload; add a "Radhika Traders Team" section (NOT on About page — put on Home or a separate Team section). No names/roles needed, just photos.
