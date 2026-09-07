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
- Home page: "Radhika Traders Team" section with 4 real team photos (/images/team-1..4.jpeg), faces untouched, camera watermark cropped.
- Phone number clickable (tel:+916376541191) in Footer + Contact; Contact has "Call Now" button.
- Official logo added: /images/logo-mark.jpeg (RT monogram, used in Logo.jsx navbar/dashboard), /images/logo-full.jpeg (Footer + AuthShell left panel), favicon.png + title updated in index.html.
- Floating WhatsApp bubble (components/WhatsAppFloat.jsx) rendered globally in App.js, bottom-right, links to wa.me/916376541191.
- Statement download (PDF/Excel/CSV) verified end-to-end via UI + curl (Sep 2026).
- Email OTP (signup + forgot-password) verified: real OTP delivered to owner Gmail via Emergent email (Resend), Sep 2026. Note: example.com test addresses get 422 from email service; OTP still logged in backend logs for testing.
- Earnings Leaderboard: GET /api/leaderboard (current-month credit sums, customers only, names masked "First L."), shown on customer dashboard (components/Leaderboard.jsx) with my rank.
- Address updated (Sep 2026): "Bada Gawali Pura Rd, nearby Pitambara Hospital, Chhawani Naka, Chhawani, Agar, Madhya Pradesh 465441" in Footer + Contact (both open Google Maps). Home ticker (fake earnings notifications) intentionally KEPT per user for motivation.
- Go-live prep (Sep 2026): demo campaign seeding removed from server.py; all 8 demo campaigns + 10 test customers (+their txns/withdrawals/otps) deleted. Only admin remains. Categories seeding kept.
- Fixed N+1 in /admin/customers (batched txns/withdrawals). Deployment readiness check passed (Sep 2026).
- Affiliate redirect (Sep 2026): GET /api/go/{slug}?ref=CODE logs click in `clicks` collection and 302-redirects to campaign primary active affiliate URL (fallback: campaign page). Customer referral link on CampaignDetail now uses /api/go/. GET /api/my-clicks returns per-campaign click counts. Affiliate URLs auto-prefixed with https:// on save.
- Login bug on live: user connected custom domain radhikatraders.net; build baked that as API URL so opening via radhika-connect.emergent.host failed CORS. api.js now falls back to window.location.origin when env host != current host. Needs re-publish.
- Withdrawal payout details (Sep 2026): request snapshots payout_info (holder, A/C, IFSC, UPI, PAN) + user_mobile; customer form auto-fills UPI/A/C from KYC; admin Withdrawals shows "Pay to" card (components/PayoutDetails.jsx) with copy buttons + tel link.
- Payment proof (Sep 2026): PATCH /admin/withdrawals/{id} accepts proof_url + utr; on "paid" sends email (send_payment_email) with proof link to customer; customer Withdrawals shows UTR + "View payment proof". Admin uses MarkPaidDialog (upload screenshot + UTR).
- Offer banners: db.banners; GET /api/banners (enabled; all=true for admin), POST/PUT/DELETE /api/admin/banners. Admin page /admin/banners (AdminBanners.jsx). Customer dashboard shows OfferBanners carousel (auto-rotate 4.5s).
- Refer & Earn (Sep 2026): settings.referral_bonus (admin PUT /api/admin/settings, presets 0/10/20/50 on Admin Dashboard). Signup captures ?ref=CODE -> referred_by; on OTP verify referrer gets credit txn REF-xxxx if bonus>0. GET /api/my-referrals. Customer dashboard ReferEarnCard with /signup?ref=CODE link.
- Category tiles (CategoryTiles.jsx) on public Campaigns + customer Campaigns pages; categories seeded idempotently incl. Mutual Fund.
- Home hero: zero-investment messaging + green strip.
- Iteration 2 testing (Sep 2026): 37/37 backend tests pass + UI smoke pass for affiliate redirect, payout details, mark-paid proof, banners, refer&earn, category tiles, home zero-investment. All NEED RE-PUBLISH to reach live radhikatraders.net.
- Login separation (Sep 2026): /api/auth/login takes portal ("customer"|"admin"); admin accounts rejected (403) on customer /login, customers rejected on /admin/login. Tests updated to pass portal=admin.
- UPI QR (Sep 2026): KYC has upi_qr_url (customer uploads via /api/upload — now allowed for customers, images only); stored in bank.upi_qr_url, snapshotted into withdrawal payout_info; admin PayoutDetails shows QR thumbnail (wd-qr-<id>).
- Iteration 3 final pre-publish regression (Sep 2026): 45/45 backend tests pass, all UI flows + 8 public pages clean. Cleared for Re-publish.
- PHASE 1 (Sep 2026): campaigns public list = live only; /api/go non-live -> /offer-ended?c=slug&s=status; OfferEnded page; CampaignDetail inactive notice. Notifications: db.notifications per-user, GET /api/notifications, POST /api/notifications/read; NotificationBell in DashboardLayout (customer). Campaign set live -> announce_campaign_live (in-app + email to all verified customers, logged in db.broadcasts). Admin KYC mgmt: GET /api/admin/kyc, PATCH /api/admin/kyc/{uid} (pending/verified/rejected/deactivated) + AdminKyc page; withdrawals now require kyc verified. Admin Broadcast page: POST /api/admin/broadcast (email+in_app, all/selected, campaign attach), GET /api/admin/broadcasts. Payout email redesigned per spec. Logout fix: 401 interceptor + rt:logout event, logout -> /login replace. WhatsApp bubble icon-only, hidden on auth pages. Home hero agency positioning + 8 service tiles + CTAs Explore Services/Partner With Us; Partners page /partners; Services page rewritten; nav Partners; footer Our Team (#team). ContactLinks (tel/mailto) in Customers + KYC.
- WhatsApp/SMS API: user chose EMAIL instead (paid APIs declined). Phase 2 pending: Leads system, transaction password, forgot-email.
- LEADS (Sep 2026): campaign.lead_fields (10 fields name/mobile/email/pan/dob/aadhaar/bank_account/ifsc/upi/address, each enabled+required; configured in CampaignForm). /api/go -> /join/{slug}?ref if any field enabled. GET /api/join/{slug}, POST /api/leads/{slug} -> db.leads (lead_id LD-xxxx, partner, status pending/approved/rejected, account_status pending/account_opened/rejected). Admin: GET /api/admin/leads (filters campaign_id,status,account_status,ref,search,date_from,date_to), /admin/leads/summary, PATCH /admin/leads/{id}. Customer: GET /api/my-leads, page /my-leads. Pages: LeadForm.jsx (/join/:slug), AdminLeads.jsx (/admin/leads), MyLeads.jsx. Partner notified in-app on new lead / status change.
- Campaign types expanded (First Trade, Trade, Non-Trade, Turnover, SIP, Lump Sum, Account Opening, Fund Add, KYC Complete, Card Activation, Loan Disbursal, Policy Issued, App Install, Lead/Form Fill). Refer&Earn card lists joined people (full name, date, KYC status) via /api/my-referrals recent[50].
- Iteration 4 testing: 59/59 backend + full UI pass for Phase 1+2 (status sync, notifications, KYC mgmt, broadcast, leads, logout, whatsapp, home/partners/services).
- Home hero visual: replaced owner photo with stock finance/marketing collage (/images/hero-team.jpg (team working), hero-wfh.jpg (woman working from home on laptop, top view); hero-money/hero-marketing kept as spares) per user request; owner photo stays on About page.
- PHASE 3 (Sep 2026): KYC auto-verifies on submit (PAN/IFSC/acct/aadhaar/UPI format validation + duplicate PAN check); admin can still reject/deactivate. Transaction password (4-6 digit PIN, bcrypt): POST /api/security/transaction-password (set via login password; reset via email OTP purpose txn from /security/transaction-password/otp), 5 wrong attempts -> 30 min lock; required on POST /api/withdrawals (transaction_password). POST /api/security/change-password. GET /api/security/status (has_txn_password + last 10 security_logs). Forgot email: POST /api/auth/recover-email {mobile, pan|dob} -> masked email, 5/hour rate limit, logged. Profile has dob field + Security section (SecuritySettings.jsx); /forgot-email page; Login has Forgot Email link.
- Live sync (Sep 2026): lib/useLivePoll.js polls every 10s + on tab focus; used in CustomerCampaigns, CustomerDashboard, public Campaigns, CampaignDetail. NotificationBell polls 15s. Admin status changes reflect on customer panel without refresh.
- Iteration 5: 67/67 backend tests + UI pass for Phase 3 (KYC auto-verify, txn PIN, change password, forgot email).

## 2026-06 — Deployment readiness check (pre-republish)
- deployment_agent: PASS (no blockers). Only perf warnings.
- Fixed: /api/admin/customers wallet totals now computed via Mongo aggregation ($group/$sum) instead of loading up to 100k txns/withdrawals in memory. Verified values match /api/wallet.
- Remaining perf backlog (P2): pagination/projection for /admin/leads, /leads, /campaigns list.

## 2026-06 — Login brute-force lockout
- POST /api/auth/login: per ip:email counter in db.login_attempts (unique index on identifier). 5 failed -> 429, locked 30 min. Correct password rejected while locked. Counter cleared on success / after lock expiry. security_logs event "login_locked". Verified via curl (401x4 with attempts-left msg -> 429 -> unlock -> 200).

## 2026-06 — Join/Apply fix + My Leads details
- CampaignDetail "Join / Apply Now" now routes via /api/go/{slug}?ref= (was direct partner URL, bypassing lead form + offer-stop check). Disabled grey button when paused/closed.
- GET /my-leads returns `details` [{key,label,value}] with all form fields (labels from campaign lead_fields); MyLeads.jsx shows them per lead, mobile is tel: link.
- Verified: paused -> /api/go 302 to /offer-ended, /api/join 404; live -> /join form. UI screenshot OK.

## 2026-06 — Admin Security page
- New /admin/security (nav: "Security / Password") using SecuritySettings showTxn={false}. Admin can change login password.
- Startup seed no longer overwrites existing admin password_hash with ADMIN_PASSWORD env (only creates admin if missing; ensures role=admin). Verified: change pw -> restart -> new pw persists.
- Admin forgot-password works via /admin/login -> Forgot Password (email OTP).

## 2026-06 — PWA support
- public/manifest.json (standalone, theme #B91C1C, shortcuts), public/sw.js (network-first navigation, cache-first hashed static/images, skips /api), icons in public/icons/ (192/512/maskable/apple-touch) generated from logo-mark.jpeg.
- index.html: manifest link + apple meta tags. index.js registers /sw.js. InstallPrompt.jsx (global in App.js): beforeinstallprompt banner (Android/Chrome), iOS Share->Add to Home Screen hint, dismiss remembered 7 days, hidden when already standalone.
- Verified: SW registered+controlling, manifest served, banner renders (data-testid pwa-install-banner).

## 2026-06 — Campaign highlight chip
- components/CampaignChip.jsx: colored pill (color hashed from campaign name, consistent per campaign) with megaphone icon. Used in customer MyLeads (my-lead-campaign-{id}), admin AdminLeads table (lead-campaign-{id}) and lead detail modal.

## 2026-06 — Lead search
- Customer MyLeads: client-side search (name/mobile/email/lead id/campaign/any form field; whitespace-insensitive) + campaign & status dropdowns + result count + no-match state. testids: my-leads-search, my-leads-filter-campaign, my-leads-filter-status, my-leads-result-count, my-leads-no-match.
- Admin /admin/leads search now also matches ref_code and data.pan.

## 2026-06 — Offer banners: 2s auto-slide + campaign link
- BannerIn.campaign_id; GET /banners enriches campaign_slug/campaign_name/campaign_live (also derives from legacy link "/campaign/{slug}").
- OfferBanners.jsx: slides every 2000ms with translateX transition, pause on hover, dot nav. Campaign banners link to /api/go/{slug}?ref={referral_code} (new tab) -> lead form -> partner site. testids: offer-banner-link/title/image.
- AdminBanners: campaign dropdown (banner-campaign); custom link disabled when campaign chosen.
- Preview test banners created (Choice Trade -> choice-trade-test, All Campaigns -> /campaigns).

## 2026-06 — Install prompt UX
- Compact single-row bar; mobile bottom (inset-x-2 bottom-2), desktop bottom-LEFT (no overlap with WhatsApp float). Adds body padding-bottom 96px while visible so nothing is hidden behind it. Auto-hides after 20s (no dismiss stored); X = 7-day dismiss. Deferred prompt stored on window.__rtInstallPrompt; "Install App" button in DashboardLayout sidebar (sidebar-install-app) when available and not standalone.

## 2026-06 — Admin-controlled minimum withdrawal
- settings.app.min_withdrawal (fallback env MIN_WITHDRAWAL=100). GET /settings/public returns it; PUT /admin/settings accepts partial {min_withdrawal} or {referral_bonus} (>=1 validation). POST /withdrawals enforces dynamic minimum.
- Admin Dashboard: MinWithdrawalSetting.jsx (presets 100-500 + custom; testids min-withdrawal-preset-{n}, min-withdrawal-custom, min-withdrawal-save, min-withdrawal-current). Customer Withdrawals shows live min (withdraw-min) and input min.

## 2026-06 — Signup bonus with locked Bonus Wallet
- settings.signup_bonus (default 50; admin PUT /admin/settings {signup_bonus}, 0 = OFF; AdminDashboard SignupBonusSetting presets 0/10/20/50/100/200 + custom).
- On verified signup via referral (pay_referral_bonus): txn {type:"bonus", status:"locked"} for NEW user + notification. compute_wallet returns bonus_locked (excluded from balance). Referrer bonus unchanged.
- unlock_signup_bonus(partner_id) called in PATCH /admin/leads when status=approved or account_status=account_opened -> bonus txns become type credit/completed + notification.
- UI: Signup page banner (signup-bonus-banner) when ref present; ReferEarnCard share message mentions signup bonus (refer-signup-bonus-note); Wallet page Bonus Wallet card (bonus-wallet-card, wallet-bonus-locked) + LOCKED tag on txns; Dashboard strip (dash-bonus-locked).
- Verified e2e via API: set 75 -> signup -> bonus_locked 75 -> lead approved -> balance 75.

## 2026-06 — Admin withdrawal ON/OFF switch
- settings.withdrawals_enabled (default true) + withdrawals_paused_message. PUT /admin/settings partial. POST /withdrawals -> 403 with message when paused (checked before KYC/PIN).
- AdminDashboard: WithdrawalToggleSetting.jsx (withdrawal-toggle-btn, withdrawal-toggle-current, withdrawal-paused-message[-save]). Customer Withdrawals page hides form and shows withdraw-paused-notice when paused.
