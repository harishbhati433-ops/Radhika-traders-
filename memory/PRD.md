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

## 2026-06 — Referral limits + Withdrawal schedule
- settings.referral_daily_limit (2) / referral_monthly_limit (10), 0=unlimited. Enforced in POST /auth/register (counts verified users with referred_by_code in IST day/month window; invalid code -> 400). GET /my-referrals returns today/month/limits. Admin ReferralLimitSetting.jsx (referral-daily-*, referral-monthly-*). ReferEarnCard shows usage chips (refer-limits).
- settings.withdrawal_days [0-6, 0=Sun] / withdrawal_dates [1-31]; empty = no restriction. withdrawals_open(s) -> (open, reason) using IST; /settings/public + PUT /admin/settings return withdrawals_open & withdrawals_closed_reason; POST /withdrawals 403 with reason. WithdrawalToggleSetting.jsx: master switch + weekday/date chips + Save schedule (withdrawal-day-{i}, withdrawal-date-{d}, withdrawal-schedule-save). Customer page uses withdrawals_open.

## 2026-06 — Email deliverability (Primary tab)
- email_service.py: removed promo signals (emoji subjects, "Good News/Grab", colored hero blocks, big buttons). Plain personal layout, personal sign-off (Harish Bhati), OTP subject "<code> is your Radhika Traders verification code". EMAIL_FROM_NAME="Harish Bhati - Radhika Traders". Test send -> 202.

## 2026-06 — Professional invite/share messages + promo email deliverability
- ReferEarnCard: inviteMessage (name, agency intro, zero investment, dynamic signup bonus line from settings, link, tagline); preview box (refer-message-preview) + "Copy message" (refer-copy-message); link-only copy (refer-copy). ShareButtons accepts copyText. CampaignDetail copy/share also sends professional applyMessage.
- Campaign-live/broadcast emails: plain personal style, first-name subject, per-user personal referral link (/api/go/{slug}?ref=), reply invitation, no boxes/buttons/emoji. Test broadcast -> 202.

## 2026-06 — Light-branded emails
- _wrap: red-left-border brand header "RADHIKA TRADERS / TRUSTED PARTNER FOR FINANCIAL GROWTH" (text only, no image). _campaign_block: amber-left-border card with payout/company/fund/requirement rows + small red "Open my referral link" button + plain link. _signature: Harish Bhati / Founder + WhatsApp +91 63765 41191 + www.radhikatraders.net. _first() capitalizes. Real test sent to harishbhati4581@gmail.com (202).

## 2026-06 — Branded email v3 (user confirmed Primary delivery)
- _wrap: solid red header band (RADHIKA TRADERS + tagline, amber underline), dark footer (address, WhatsApp, site). From name back to "Radhika Traders"; signature "Team Radhika Traders / Harish Bhati, Founder".

## 2026-06 — Welcome letter
- email_service.welcome_letter_paragraphs() + send_welcome_email(). verify-otp (signup) stores user.welcome {issued_at, signup_bonus} and background-sends welcome email (customers only). GET /me/welcome-letter (dynamic, works for old users), POST /me/welcome-letter/resend.
- Frontend: /welcome-letter page (WelcomeLetter.jsx: branded letter, Partner ID, date, print/save PDF, email copy; testids welcome-letter, welcome-ref-code, welcome-print, welcome-resend). Profile page card link (profile-welcome-letter).
- Real welcome email sent to harishbhati4581@gmail.com (id d02d0712...).
- Customer sidebar: added "Welcome Letter" nav item (/welcome-letter) between Statements and Profile.

## 2026-06 — Account controls, duplicate block, password eye, OTP robustness
- users.account_status: active|deactivated(Paused)|disabled|deleted (+reason, history). PATCH /admin/customers/{uid}/status {status, reason} (reason required unless active; "purge" = hard delete user+txns+withdrawals+notifications). Login + get_current_user block deactivated/disabled (403 message) and deleted (401). Referral links/leads ignore disabled/deleted partners. /admin/customers?include_deleted=true; default hides deleted and unverified. AccountStatusControl.jsx in AdminCustomers (acct-{status}-{id}, acct-reason, acct-confirm, customer-status-{id}, customer-show-deleted).
- Register: mobile normalized to 10 digits; duplicate verified mobile or email (incl. deleted) -> 400. Profile mobile update also checked.
- PasswordInput.jsx (eye toggle) replaces all type=password inputs (Login, AdminLogin, Signup, ForgotPassword, SecuritySettings, Withdrawals PIN). testid `${id}-toggle`.
- OTP: send_email retries on 429/5xx (3x). register/resend-otp return 502 with message if email fails; register removes the unverified doc it just created. Signup resend shows server detail. Admin customers/dashboard/KYC exclude unverified users.
- Test credentials: bhatiharish276@gmail.com / Radhika@2023 (admin, portal=admin), testcust@example.com / Test@1234 (PIN 5678).
- iteration_6/7 testing: all pass (signup OTP, dup block, unverified hidden, password toggles, account controls full flow). NOTE: email provider returned 429 during heavy QA sends — likely cause of user-reported live OTP failures; register now surfaces 502 error instead of false "OTP sent".

## 2026-06 — KYC confirm account + welcome modal
- Profile KYC: Confirm Account Number field (kyc-account-confirm; paste disabled) with live match/mismatch text (kyc-account-match / kyc-account-mismatch); submit blocked on mismatch. Backend KycIn.bank_account_confirm optional -> 400 if differs.
- WelcomeModal.jsx on CustomerDashboard: shows once after signup (sessionStorage rt_just_signed_up set in Signup verify step; localStorage rt_welcome_seen_{id}). Branded header, Partner ID, 3 steps, CTA to KYC / welcome letter. testids welcome-modal, welcome-modal-code, welcome-modal-kyc, welcome-modal-letter, welcome-modal-close.
- iteration_8: KYC confirm + welcome modal all pass (3 pytest + 17 UI assertions).

## 2026-06 — Banner display fix
- OfferBanners + AdminBanners: image container aspect-[3/1] with object-contain on dark bg (was fixed h-44/h-56 + object-cover which cropped top/bottom of 1200x400 uploads). Full image always visible.

## 2026-06 — Auto campaign banners in slider
- GET /banners (customer view) appends auto entries for every live+offer_enabled campaign with banner_url and show_in_slider!=False (id "auto-<cid>", auto:true, subtitle "Earn ₹X per approved account", links via campaign_slug). Manual banner for same campaign_id takes precedence. CampaignIn.show_in_slider (default true) + checkbox in CampaignForm (cf-show-in-slider). AdminBanners shows info note (banners-auto-note).

## 2026-06 — PAN/Aadhaar validation + Lead export
- lib/validators.js (formatPan uppercase+alnum max10, formatAadhaar digits max12, panError/aadhaarError). Applied in LeadForm (lead-pan-error / lead-aadhaar-error) and Profile KYC (kyc-pan-error / kyc-aadhaar-error); submit blocked on error. Backend: /leads uppercases PAN, validates PAN + 12-digit Aadhaar; /profile/kyc Aadhaar msg.
- GET /admin/leads/export?format=xlsx|csv&date_from&date_to&campaign_id&status&account_status&ref&search -> file (columns: Lead ID, Date, Time, Campaign, statuses, partner, ref, all lead field labels, reject reason, updated). AdminLeads: date presets (lead-preset-today/yesterday/last7/this_month/last_month/custom/all) + custom From/To + LeadExport buttons (lead-export-xlsx / lead-export-csv). Verified xlsx (10 rows) + csv via curl.

## 2026-06 — Reports (admin -> publishers, 7-day expiry)
- db.reports {title, note, file_path, file_name, content_type, size, audience all|selected, recipients[], created_at, expires_at(+7d), downloaded_by[]}. POST /admin/reports (multipart: file, title, note, audience, user_ids csv, send_email) -> stores via put_object under {APP}/reports/, notifications + background send_report_email (link /reports). GET/DELETE /admin/reports. GET /reports (customer, access by audience/recipients, unexpired), GET /reports/{id}/download (marks downloaded_by). _purge_expired_reports() runs on list calls + startup; marks db.files is_deleted. Max 25MB.
- UI: /admin/reports (AdminReports.jsx: report-title, report-file, report-note, report-audience-all/selected, report-recipient-{id}, report-send-email, report-send, report-row-{id}, report-delete-{id}); /reports (Reports.jsx: report-item-{id}, report-download-{id}, report-days-{id}). Nav: admin "Send Reports", customer "Reports & Files".
- iteration_10 (PAN/Aadhaar + export) and iteration_11 (Reports feature): all pass (15 pytest + UI).

## 2026-06 — Campaign live: auto banner + one-time email; report delete cleanup
- POST /api/campaigns with status=live now announces (in-app + email) once; `live_announced_at` flag guards re-sends (pause→live never re-emails).
- GET /api/banners auto-includes live campaigns even without banner_url; OfferBanners.jsx renders generated slide (offer-banner-generated) using logo/company.
- DELETE /api/admin/reports/{id} also removes customers' report notifications (notifications now store report_id).
- Campaign-live email made personal (plain link, no button, throttled 0.6s) for Primary-tab deliverability.
- iteration_12: all pass (6 pytest + UI).

## 2026-06 — Final dev batch: copy, dates, wallet, KYC/profile edit, speed
- Per-field copy (CopyValue.jsx) on admin leads rows/modal, customer My Leads, admin KYC list/modal (PAN/A-C/IFSC/UPI). One value per click.
- Admin Leads "Custom Range" chip opens inline From/To panel (lead-custom-range) — filters instantly; presets untouched.
- Lead "Add Fund" (POST /api/admin/leads/{id}/fund) credits referring publisher; fund_history/fund_total on lead; separate from approval.
- Wallet Adjust (POST /api/admin/wallet/adjust add/deduct/zero, reason required, confirm step) → wallet_adjustments log + txn + notification.
- Admin edit customer profile/KYC (PUT /api/admin/customers/{id}/profile|kyc, GET .../detail with profile_history/kyc_history). Customer edits log by='self'.
- Strict IFSC (11 chars, 4 letters+0+6) + UPI format validation on customer Profile and admin edit dialog (backend already strict).
- Speed: React.lazy route splitting, /go parallel lookups + background click log, LeadForm redirect 900ms.
- iteration_13: 17 pytest + all UI flows pass.

## 2026-06 — Share Kit, emoji messages, auto campaign banners v2
- Share Kit (ShareKit.jsx) on campaign detail for customers: 1080x1080 poster (share_kit.py, PIL + qrcode, bundled Liberation fonts in backend/assets), QR (GET /api/share/qr), poster (GET /api/share/poster/{slug}), 3 WhatsApp captions (Hindi/English/Short). Refer & Earn card shows invite QR.
- Invite + campaign apply messages: emojis, WhatsApp *bold*, Title-cased partner name.
- Auto banners v2: /api/banners auto entries carry type/payout/investment/requirement/benefit/company; GeneratedSlide with LIVE badge when no image; admin GET /api/banners?all=true → {manual, auto}; PATCH /api/admin/campaigns/{id}/slider (show_in_slider, slider_order, banner_headline, banner_tagline); AdminBanners "Automatic campaign banners" section (hide/reorder/edit headline, link to campaign edit via /admin/campaigns?edit=id). Slider aspect 16/9 mobile, 3/1 desktop.
- iteration_14 (share kit/IFSC/copy) + iteration_15 (auto banners): pass.

## 2026-06 — IFSC bank lookup
- GET /api/ifsc/{code} (auth) → Razorpay public IFSC API (all RBI banks incl. RRB/Payments/SFB/co-op), Mongo cache `ifsc_cache` (30d, ISO strings), non-blocking. IfscBankInfo.jsx shows bank/branch under IFSC on customer Profile + admin edit dialog; bank_name/branch stored in users.bank on KYC save; shown in Admin KYC list/modal.

## 2026-06 — Login/redirect speed
- Login: parallel DB lookups, bcrypt verify in thread, bcrypt rounds 12→10 with transparent rehash on successful login (auth_utils.needs_rehash). ~370ms→~190ms; 10 concurrent logins 2.7s→1.06s.
- Added Mongo indexes (users.referral_code/mobile, leads.*, transactions/withdrawals/notifications/clicks user_id, etc.).

## 2026-06 — Bank name in payouts
- Withdrawal payout_info now stores bank_name/branch at request time; GET /api/admin/withdrawals backfills older rows from IFSC lookup cache (persisted). PayoutDetails.jsx shows "Verified from IFSC" bank chip (wd-bank-{id}) for bank transfers and bank name in Alt A/C line for UPI payouts.

## 2026-06 — Website Shutdown Switch (maintenance mode)
- settings.app: shutdown_enabled/message/reopen_at/by/at. shutdown_state() auto-reopens when reopen_at passes. GET /api/status/public; GET/PUT /api/admin/shutdown (admin password required, security log).
- When active: customer get_current_user → 503 {code:shutdown}, customer login → 503, register/lead POST → 503, /api/go → /maintenance. Admin untouched.
- Frontend: ShutdownGate (polls 45s, listens rt:shutdown → logs customer out) renders MaintenancePage (message, reopen time IST + countdown, WhatsApp, admin link) for all non-/admin routes; /maintenance route. ShutdownControl on Admin Security page (message, reopen datetime, confirm + password).

## 2026-06 — Bugfix: Add Fund dialog hidden
- LeadFundDialog opened at z-50 behind lead detail modal (z-[70]) → looked dead on production. DialogContent now accepts overlayClassName; fund dialog uses z-[90]/overlay z-[80]. Verified via real click.

## 2026-06 — Deployment health check
- Fixed: .gitignore no longer ignores .env; removed _purge_expired_reports() from startup (runs lazily on report listing). Deployment agent: PASS.

## 2026-06 — Withdrawal celebration
- Celebration.jsx: canvas flower/confetti burst (4.2s, z-200, pointer-events none) + WebAudio chime; CelebrationLayer mounted in App.js; `celebrate(key)` once-per-key via localStorage.
- Triggers: customer submits withdrawal (congrats toast + burst); customer's withdrawal transitions to approved/paid (useWithdrawalCelebration, no retroactive fire); admin marks approved/paid. Nothing else triggers it.
