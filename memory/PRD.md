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

## 2026-06 — KYC Search
- GET /api/admin/kyc/search?q= (admin only; 403 for customers; min 3 chars) matches PAN/Aadhaar/Client(referral) ID/Customer ID/mobile/email/name/account/UPI. Returns kyc status incl. not_submitted.
- AdminKyc: dedicated search box (paste OK, Enter/Search/Reset), status chips Pending/Approved/Rejected/Deactivated/"KYC not submitted", "Not Found" state; results reuse existing rows + actions.

## 2026-06 — Admin email alert on new withdrawal
- POST /api/withdrawals → BackgroundTask _notify_admin_withdrawal: email (send_admin_withdrawal_alert: customer, Client ID, amount, IST date/time, method, status Pending, "Open & review" link → /admin/withdrawals?highlight=<id>) to all admin users + ADMIN_EMAIL, plus admin bell notification.
- AdminWithdrawals reads ?highlight= → scrolls to and outlines that request ("From email alert").

## 2026-06 — Admin Leads filter: closed/archived campaigns
- Campaign dropdown now lists live + paused/closed (status label) + archived campaigns (via /campaigns/archived) so old leads stay filterable; labels "All campaigns (incl. closed/archived)", "All lead statuses", "All account statuses". Leads are never deleted with campaigns (soft-archive only).

## 2026-06 — Dedicated Customer Referral (admin-only, separate from standard referral)
- Collections: dedicated_referrals {user_id, payout, enabled, eligible_count, total_earned}, dedicated_referral_log (admin changes + referral_paid events).
- pay_dedicated_referral(new_user) called right after pay_referral_bonus on OTP verify; pays extra payout only if referrer enabled; once per referred user (dedicated_referral_paid flag); txn source dedicated_referral. Standard referral code untouched.
- API (admin): GET /admin/dedicated-referrals, GET .../search?q=, POST, PATCH /{uid}, GET /{uid}/log. Page /admin/dedicated-referrals (nav "Dedicated Referral"): search by name/Customer ID/mobile, quick payouts ₹5/10/15/20 + custom, enable/disable, edit payout, stats, activity log modal.
- NOTE: routes must be defined BEFORE app.include_router(api) (block placed above it).

## 2026-06 — Speed pass 2 (perceived UI lag)
- AuthContext caches user in localStorage (rt_user) → ProtectedRoute renders instantly on reload, /auth/me revalidates in background (only 401/403 clears session).
- ChunkPrefetcher in App.js warms all route chunks on idle after login (role-based) → menu clicks ~100–220ms.
- Polling reduced: useLivePoll default 10s→20s, NotificationBell 15s→30s (visible tab only).
- Measured (dev preview): login→dashboard ~1.0s, page clicks 106–220ms, reload→content ~0.8s. Backend APIs ~100–150ms (network floor).

## 2026-06 — Employee Management System (RBAC + immutable activity logs)
- Employees stored in `users` with role="employee", unique `username` (partial unique index), synthetic email `<username>@employee.radhikatraders.net`, bcrypt password, `permissions` {leads, withdrawals, campaigns, reports, clients, payments: none|view|edit}, account_status active|disabled|deleted (soft delete frees username), employee_code EMP-xxxx.
- `rbac.py`: `require_perm(module, level)` dependency (admin = all; employee = per permission; else 403) + `log_activity()` → append-only `activity_logs` {actor_id/name/role/username, action, entity_type/id/label, campaign_id/name, client_id/name, status, amount, detail, ip, created_at}. NO edit/delete endpoints for logs.
- `employee_routes.py`: POST /api/auth/employee/login (username+password, 5 fails → 429 lock 30m, disabled → 403), POST /api/employee/change-password, GET /api/employee/my-activity; super admin: GET/POST /api/admin/employees, PATCH /{id} (name/mobile/permissions/status/password), DELETE /{id}; GET /api/admin/activity-logs (filters employee_id, action, campaign_id, entity, status, date_from/to IST, role) + /meta.
- server.py: module routes switched from require_admin → require_perm (leads/withdrawals/campaigns+banners+categories/reports+broadcast/clients=customers+KYC/payments=credit+adjust+lead fund). Admin-only kept: dashboard, settings, shutdown, notifications, dedicated referrals, employees, logs. Activity logging added to all these mutating routes + leads export. /auth/login rejects employees (403 → use employee login).
- Frontend: /employee/login (EmployeeLogin.jsx), /employee workspace (EmployeeDashboard.jsx: permitted module tiles, change password, my activity), /admin/employees (AdminEmployees.jsx: create/edit/perm matrix/disable/reset pw/delete), /admin/activity-logs (AdminActivityLogs.jsx: filters + table). nav.js items carry `perm`/`adminOnly`; DashboardLayout filters sidebar per user and shows view-only-banner; ProtectedRoute role="admin" + perm allows employees; lib/perm.js useCan(). AdminWithdrawals/AdminLeads hide action buttons without edit permission (server enforces anyway). ShutdownGate treats /employee as admin area.
- iteration_18: 43/43 backend + all UI flows pass. Test employee: rahul.k / Emp@1234.

## 2026-06 — Dedicated Referral: all customers listed
- GET /admin/dedicated-referrals/search now accepts empty q → returns ALL verified, non-disabled customers (name-sorted, up to 1000) with kyc_status; non-empty q filters server-side.
- AdminDedicatedReferrals.jsx: loads full customer list on page open (ded-customer-count "x / y customers"), live client-side filter (name/ID/mobile/email), per-row "Add" button (ded-select-{uid}) → inline payout picker → enable. Already-added rows show badge.

## 2026-06 — Dedicated payout visible to customer
- GET /my-referrals now returns `dedicated: {enabled, payout, eligible_count, total_earned, since}` (null if not enabled).
- ReferEarnCard.jsx: dark "Dedicated Referral Partner · Active" banner (refer-dedicated-banner) with ₹payout, paid-referral count and dedicated earnings; headline shows combined total (₹bonus + ₹dedicated); "earned" pill includes dedicated earnings.

## 2026-06 — First-load speed pass
- index.html: Google Fonts moved from CSS @import (render-blocking) to non-blocking preload→stylesheet; unused Inter removed; weights trimmed; emergent script `defer`; inline CSS spinner shown while JS loads; system font fallbacks.
- App.js: Login / LeadForm / OfferEnded / CustomerDashboard now lazy (main bundle 548KB → 410KB); likely-next chunk prefetched immediately based on URL / stored token.
- Images recompressed & resized (logo-full 129→28KB, logo-mark 70→18KB, hero/team ~45% smaller); hero img fetchpriority=high, below-fold imgs loading=lazy. SW cache bumped to rt-pwa-v2.
- Cold-load pass 2: removed unused @tanstack/react-query provider from index.js (main 410→381KB); PWA service worker now registers on idle after load; PostHog analytics init deferred to idle after load (no longer competes with first paint). Cold home load ~0.9s on preview.

## 2026-06 — Admin Wallet Balances + Customer Statement
- GET /api/admin/wallets?show=holding|all (perm payments:view): per-customer balance, pending withdrawal, total due, earned/paid, bank/UPI, KYC, last credit/paid; summary totals (liability). Aggregation-based (no per-user loop).
- GET /api/admin/customers/{uid}/statement (JSON ledger w/ running balance + withdrawals) and /statement/download?format=pdf|excel|csv (shared `_statement_file`, PDF header now includes mobile/ID/withdrawn/pending).
- Frontend: /admin/wallets (AdminWallets.jsx: stats, search, show/sort, CSV export, Statement button) + CustomerStatementDialog.jsx (used in Wallet Balances and Customers page "Statement" button). Nav item "Wallet Balances" (perm payments).

## 2026-06 — Dark / Light mode (panels)
- lib/theme.js (localStorage rt_theme, toggles <html class="dark">, theme-color meta). ThemeToggle in DashboardLayout header (desktop: theme-toggle, mobile: theme-toggle-mobile); dark class applied only while a DashboardLayout page is mounted (customer/admin/employee panels), public site stays light.
- index.css: `.dark` overrides for the common Tailwind utilities (bg-white/slate, text-slate-*, borders, tinted badges, inputs, gradients) + shadcn dark tokens.

## 2026-06 — Strict Aadhaar + IFSC validation
- Backend `aadhaar_error()` (12 digits, cannot start 0/1, not all-same, Verhoeff checksum) used in _validate_kyc (customer + admin KYC edits) and lead form dynamic `aadhaar` field.
- IFSC now verified against Razorpay IFSC list in `_apply_kyc` and lead-form `ifsc` field: invalid_format/not_found → 400 rejected; lookup_unavailable (network) → allowed.
- Frontend validators.js aadhaarError has Verhoeff; IfscBankInfo shows red "Invalid IFSC" for not_found.

## 2026-06 — Campaign-wise duplicate leads + Account workflow
- create_lead normalizes name/mobile(+91/0 stripped → 10 digits)/email/PAN; stores `dup_keys` {pan,mobile,email,dob,name}. `find_duplicate_lead(campaign_id, keys)`: candidates in SAME campaign matching any strong key (pan/mobile/email); duplicate if ≥1 strong + ≥2 total fields match. Lead saved with status="duplicate", duplicate_of (lead_id), duplicate_of_id, duplicate_fields, duplicate_reason "Duplicate Match: PAN + Mobile + Email". Same person in another campaign = normal lead. No global uniqueness.
- Submission never blocked: response still returns redirect_url (+ `duplicate` flag). Double-click/simultaneous: unique partial index on `submit_key` (campaign:hash(keys):minute) → returns existing lead.
- Admin PATCH: status change on duplicate lead → 400 (system-controlled); account_status now pending(Not Started)|account_opened|trade_done|rejected; "Account Open" no longer auto-approves lead. Summary adds duplicate & trade_done; export adds Duplicate Of/Reason. Startup backfills dup_keys for old leads + indexes.
- UI: AdminLeads (Duplicate summary card, filters, violet badge, duplicate info box with original lead + matched fields, Approve/Reject hidden for duplicates, buttons Account Open / Trade Done / Not Started / Account Rejected); MyLeads (Duplicate + Trade Done counts/filters, duplicate notice with original lead).
- PAN validation strengthened (frontend panError + backend pan_error): format, 4th letter must be a valid PAN type (ABCFGHLJPT), rejects AAAAA…/0000 patterns. Lead form now also validates IFSC (format + live bank lookup box, red "Invalid IFSC"); admin-lead status dropdown merged: Pending/Approved/Rejected/Duplicate/Account Open/Trade Done.
- Duplicate leads now also get account_status="rejected" + reject_reason; ANY status/account change on a duplicate lead → 400 (locked); admin UI hides all action buttons for duplicates. Double-click idempotency window narrowed to 5s bucket (submit_key), so a genuine re-submission after a few seconds is recorded as a Duplicate lead.
- Duplicate rule relaxed per user: ANY single strong field match (mobile / PAN / email / Aadhaar) in the same campaign = duplicate; name only counts together with DOB. Originals exclude leads already marked duplicate.
- POST /api/admin/leads/rescan-duplicates (super admin; ?include_approved=false default) re-checks all existing leads oldest-first per campaign and marks later repeats duplicate+rejected (stores previous_status, duplicate_marked_by=rescan). Button "Re-scan old leads for duplicates" on Admin Leads (admin only).
- Re-scan now includes Approved leads by default (include_approved=True): later approved repeats in the same campaign become duplicate+rejected (previous_status kept); the oldest lead per person per campaign stays as original. Wallet credits are NOT reversed automatically.
- Referral payout fix: pay_referral_bonus skips the standard referral credit when the referrer has an ENABLED dedicated referral (dedicated payout replaces it; never both). Dedicated OFF → standard bonus. New-user signup bonus unaffected. ReferEarnCard wording updated ("replaces the standard bonus"). Sim: /app/backend/tests/sim_single_referral_payout.py
- Double referral payout cleanup tool: GET /api/admin/wallets/double-payouts (scan REF+DREF pairs for same referrer+joiner within 1h; marks already reversed via `reverses` field) and POST .../reverse (debits only available balance — pending withdrawals never touched; partial/skipped reported; logs activity + wallet_adjustments). UI: Wallet Balances → "Scan extra / double payouts" (DoublePayoutDialog.jsx, admin only).
- Admin Dashboard "Money owed to customers" section: (1) Lying in wallets (not yet requested), (2) Withdrawal requested (to be paid) with request count, (3) Total payable + paid-out so far; link to Wallet Balances. Backend /admin/dashboard now reuses `wallet_rows()` (same math as Wallet Balances page, existing customers only) and filters withdrawals to existing customers.

## 2026-06 — Signup Bonus (custom, server-side)
- Settings: `signup_bonus_enabled` (ON/OFF) + `signup_bonus` amount (admin PUT /admin/settings). /settings/public returns signup_bonus=0 when OFF so all customer-facing text adapts.
- Old flow (locked "bonus" txn at signup, only for referred users) REMOVED. New: `grant_signup_bonus(user_id, lead)` runs only when admin sets a lead status=approved (not on Account Open): feature ON, amount>0, customer, not already paid (user flag + txn check incl. legacy SB-/bonus), duplicate-identity check vs EARLIER customer accounts (same mobile/email/PAN → not_eligible, logged once), then credit txn "Signup Bonus" (ref SB-, source signup_bonus, unique partial index on signup_bonus_for). Works with or without referral link. Legacy locked bonuses still unlock via unlock_signup_bonus.
- db.signup_bonus_log: user name/ID/mobile, amount, lead, approval_status, status credited|not_eligible, wallet_credit_status, reason, referred flag. GET /admin/signup-bonus/log (payments:view).
- UI: SignupBonusSetting.jsx (Dashboard) — ON/OFF toggle, presets/custom amount, "Bonus records" table. Signup page banner now shows for all signups. Sims: tests/sim_signup_bonus.py, tests/sim_signup_bonus_e2e.py

## 2026-06 — Contact & Support Settings (Admin-only)
- New admin page `/admin/contact` (nav "Contact & Support", adminOnly). 5 fields: owner_mobile, support_mobile, whatsapp_number, support_email, owner_email. Single "Update All Contact Details" button (diff-only save, validation: 10-digit Indian mobile / email).
- Backend: `contact_settings.py` (DB `settings` key "contact", in-memory CONTACT cache loaded at startup + after save), `contact_routes.py` (GET /api/contact/public, GET/PUT /api/admin/contact, GET /api/admin/contact/history). Employees → 403.
- Every changed field → `contact_history` collection + Activity Log action `contact_details_updated` (detail "Label: old → new").
- Dynamic everywhere: Footer, Contact page, WhatsAppFloat, MaintenancePage, AuthShell help box (login/signup), ShareKit/ReferEarnCard/CampaignDetail WhatsApp messages, WelcomeLetter, emails (_wrap/_signature), poster (share_kit), deactivated-account message, owner_email added to withdrawal alert recipients.
- Frontend hook `lib/contact.js` `useContact()` (localStorage cache `rt_contact_v1`, refetch once per load, `refreshContact()` after admin save).
- Tested: iteration_19 (frontend E2E all pass) + curl backend checks. Values reverted to originals after test.
- 2026-06 FIX (on-the-spot update): `/api/contact/public` now reads DB on every call + `Cache-Control: no-store`; HTTP middleware refreshes in-memory CONTACT cache (2s TTL) so every worker/replica, emails and posters use fresh values; frontend hook refetches on every mount/focus with cache-busting param. Verified 3 consecutive fresh loads show new number instantly.
- 2026-06: Customer sidebar 'Customer Support' box removed on user request (confusing for customers). Support details remain in Footer/Contact/Login help/WhatsApp button.

## 2026-06 — Signup Bonus visible from day one (locked Bonus Wallet) + backfill
- Bug: after signup Bonus Wallet showed ₹0 (bonus only credited silently on first approval) → customers confused.
- Fix: `lock_signup_bonus(user)` on OTP verify → txn {type:"bonus", status:"locked", ref SB-…} so Bonus Wallet shows the amount (non-withdrawable). `unlock_signup_bonus(user_id, lead)` on first approved lead → converts to credit (main wallet), sets signup_bonus_paid, logs credited, notifies; duplicate account → status "cancelled" + not_eligible log. `grant_signup_bonus` stays as fallback when no locked txn exists.
- `GET /api/wallet` now returns `signup_bonus: {status: locked|credited|pending|not_eligible|off, amount, ref_id, credited_at}`.
- UI: shared `BonusWalletCard` on customer Dashboard (5th stat card, always visible) and Wallet page.
- Admin: "Give to existing customers" button (POST /api/admin/signup-bonus/backfill) — locks for verified customers without bonus, credits immediately if they already have an approved lead, skips duplicates, idempotent, activity-logged. USER MUST CLICK THIS ONCE ON PRODUCTION.
- Tested: tests/sim_locked_signup_bonus.py (lock→exists, unlock→credited→none, fallback no double credit, dup→duplicate), backfill idempotent via curl, dashboard/wallet screenshots.

## 2026-06 — Secure password reset via email OTP (admin + customers)
- New `password_reset.py` router: POST /api/auth/forgot-password {email, portal} & /api/auth/reset-password {email, code, new_password, portal}; in-panel POST /api/security/reset-password/otp & /api/security/reset-password {code,new_password} (returns fresh token).
- Rules: OTP 6-digit, HMAC-hashed at rest (`pwd_reset_otps`), 5-min TTL, resend cooldown 60s, max 5 sends/15 min → lock, 5 wrong OTPs → 15-min lock (`otp_locks`), new OTP invalidates old, single-use. portal=admin only serves admin accounts (generic response otherwise).
- All-device logout: `users.token_version` bumped on reset; JWT carries `tv`; `get_current_user_from_db` rejects mismatched tokens with 401 "session expired because the password was changed" → frontend interceptor toasts + logs out. Login/verify/employee-login tokens carry current tv.
- Password-changed confirmation email (`send_password_changed_email`). Security logs: password_reset_otp_sent / password_reset_locked / password_reset_via_otp.
- UI: /admin/forgot-password (AdminLogin "Forgot password?" link), ForgotPassword page w/ 5-min countdown + resend timer (portal prop), `OtpPasswordReset` card in SecuritySettings (admin + customer Security pages).
- Tested: tests/sim_password_reset.py (all rules), UI screenshot, real OTP delivered to admin Gmail.

## 2026-06 — Admin login alert (new device / IP)
- `login_alerts.py` `record_admin_login` runs in background on successful admin login: fingerprint = sha256(ip|browser|os) stored in `admin_devices` (per admin). First time seen → Gmail alert (`send_login_alert_email`, to admin email + Contact & Support owner_email) with time IST, device, IP, "Reset admin password" button (→ /admin/forgot-password), admin bell notification (type security), security log `admin_login_new_device`.
- `GET /api/security/status` now returns `devices` (admin only) + detail/ip on logs; Security page shows "Admin login devices" table (`sec-devices`).
- Tested via curl with 3 logins (2 same UA → one alert, 1 new UA → second alert), emails sent without error, screenshot of table.

## 2026-06 — Log out from all devices
- POST /api/security/logout-all (any logged-in user): bumps users.token_version → every other JWT 401; returns a fresh token so the current session continues. Security log `logout_all_devices`.
- Security page (admin): red "Log out from all devices" button in the Admin login devices card (confirm dialog). Tested via curl (A,B → 401, NEW → 200) + UI click.

## 2026-06 — Remove single device
- DELETE /api/security/devices/{fingerprint} (own devices only; 404 otherwise) → removes from `admin_devices`, security log `device_removed`; next login from that device triggers a fresh alert. "Remove" button per row in Security → Admin login devices (confirm). Tested via curl (delete, 404, re-login → alert count +1) + UI click.

## 2026-06 — Signup Bonus amount frozen per customer
- Bug: changing the setting (e.g. 50→100) changed what EXISTING customers saw/received. Fix: `_promised_bonus(u, s)` uses `users.welcome.signup_bonus` (frozen at OTP-verify time) for lock/grant/backfill and the wallet card; current setting applies only to new signups (and legacy accounts with no frozen value). Locked/credited txns always keep their own amount.
- Tested: tests/sim_bonus_amount_frozen.py (old pending 50, old locked 50, new 100; approval credits 50 not 100). Setting restored to 20.
- 2026-06 follow-up: Bonus Wallet no longer has a setting-dependent "pending" state — on first wallet view the customer's amount is frozen (`welcome.signup_bonus`) AND locked as an SB txn (lazy `lock_signup_bonus`), so later setting changes never alter existing customers. Startup migration freezes `welcome.signup_bonus` for customers lacking it. Duplicate accounts show "not eligible ₹0". Re-tested with sim_bonus_amount_frozen.py (legacy account frozen at 50 before change to 100).

## 2026-06 — Full regression before deploy
- iteration_20: 13/13 backend + all frontend checks PASS (contact settings, bonus wallet freeze/backfill, OTP reset rules, session revocation, devices, employee 403). Production data restored (contact defaults, signup_bonus 20/ON, OTP locks cleared, admin password unchanged). Ready to deploy.

## 2026-06 — Admin pagination & dashboard aggregation
- `/admin/dashboard` now uses count_documents + aggregations (no full transactions/withdrawals scans). `/admin/leads`, `/admin/customers` (+ server-side `search`), `/admin/withdrawals` accept `page` & `limit` (10–200, default 50) and return `{items,total,page,limit,pages}`; without `page` they keep the legacy array response.
- Frontend: shared `Pager` component (testids leads-pager / customers-pager / withdrawals-pager with -info/-prev/-next/-page) wired into AdminLeads, AdminCustomers (server search, debounced), AdminWithdrawals. Export count uses total.

## 2026-06 — Home page testimonials slider (customer website only)
- `components/Testimonials.jsx` (12 static Hinglish/English reviews, initials avatars, 4–5 stars, Verified chip) inserted in Home.jsx between Team and CTA. Auto-slides every 3s, pauses on hover/touch, prev/next arrows + dots, responsive 1/2/3 cards. NOT in admin panel, not on other pages. Verified: desktop 4 pages auto-slid after 3.4s, mobile 12 pages, absent on /campaigns.

## 2026-06 — Employee Attendance & Salary Management
- Backend `attendance_routes.py` (router wired with require_employee from employee_routes). Office 10:00–17:00 IST. Collections: `attendance` (unique employee_id+date; check_in/check_out ISO, hours, late, status present|late|half_day|absent|leave|holiday|weekly_off, leave_paid, source self|admin, edited_by, note), `salary_adjustments` (employee_id+month: bonus, incentive, advance, deduction, note, payment_status, payment_date), `users.salary.monthly`.
- Rules: check-in >10:00 → late; hours <4 → half_day; no record on past day → absent (virtual); per-day = monthly ÷ days in month; paid days = present+late+holiday+weekly_off+paid_leave+0.5·half_day; net = per_day·paid_days + bonus + incentive − advance − deduction. No weekly off by default (admin can mark). Admin chooses paid/unpaid per leave.
- Endpoints: employee POST /employee/attendance/check-in|check-out, GET /employee/attendance?month; admin GET /admin/attendance (date|month, employee_id, status), PUT /admin/attendance/{emp}/{date} (activity log `attendance_edited` old→new), GET /admin/attendance/dashboard, GET /admin/salary?month, PUT /admin/salary/{emp} (monthly, log `salary_set`), PUT /admin/salary/{emp}/{month} (adjustments + payment_status, log `salary_adjusted`), exports GET /admin/attendance/export, /admin/salary/export, /admin/salary/slip/{emp} (xlsx/csv/pdf).
- Frontend: /employee/attendance (EmployeeAttendance: live clock, Check In/Out, month summary, table) + tile on Employee workspace + nav "My Attendance" (employeeOnly nav now shown to employees); /admin/attendance (AdminAttendance: AttendanceSummary KPIs, Attendance tab with filters/edit dialog/exports, Salary Sheet tab with Set/Adjust, Mark Paid, Slip PDF, exports); AttendanceSummary (compact) also on Admin Dashboard. Nav "Attendance & Salary" adminOnly.
- Backend verified via curl (check-in/out, admin edits, salary calc, exports 200, activity log, employee 403). Frontend testing via testing agent (iteration_21).

## 2026-06 — Bug fix: wallet adjust (deduct / set ₹0) spinner
- Cause: after pagination, AdminCustomers `load(page)` received the dialog's response object via `onDone={load}` → `page=[object Object]` → 422 → list never reloaded (infinite loader). Fix: `onDone={() => load()}` for WalletAdjustDialog & CustomerEditDialog, `Number(page)||1` guard + `.catch` toast in load (same guard in AdminLeads/AdminWithdrawals). Verified via UI: deduct → zero → add restore, list reloads instantly.

## 2026-06 — Attendance punch emails
- On employee check-in AND check-out, background task `notify_punch` emails (a) every admin + Contact & Support owner_email and (b) the employee (template `send_attendance_email`: employee, date, time, status incl. Late, working hours on check-out). Email failures are logged, never block attendance.
- Employees now have a real **Email / Gmail** field (create + edit in Admin → Employees; backend validates format + uniqueness). Default placeholder `<username>@employee.radhikatraders.net` is undeliverable → admin must set a real email for employees to receive mails. rahul.k (preview) set to bhatiharish276+rahul@gmail.com.

## 2026-06 — Salary paid email with proof
- Salary Sheet "Mark Paid" now opens PayDialog (sal-pay-dialog): proof screenshot upload (ImageUpload → sal-pay-proof) + optional UTR → PUT /admin/salary/{emp}/{month} {payment_status:"paid", proof_url, utr}. On transition pending→paid, background `send_salary_paid_email` to employee: amount credited, month, monthly salary, paid days, bonus, deductions, payment date, UTR, "View payment proof" link. No duplicate mail on re-save; "proof" link shown in sheet row; proof_url/utr returned in salary rows. Marking pending again uses confirm().

## 2026-06 — Statement date range (customer + admin)
- `_statement_range(preset, date_from, date_to)`: presets today | yesterday | weekly (7d) | monthly (30d) | 3m | 6m | 1y | all | custom (both dates required → 400 otherwise), IST day bounds. `GET /api/statement` and `GET /api/admin/customers/{uid}/statement/download` accept `preset`, `date_from`, `date_to`; PDF shows "Statement Period", txn count, credits/debits in period; filename includes range tag.
- Frontend: shared `StatementRangePicker` + `useStatementRange` (testids stmt-range-<preset>, -from, -to; admin dialog uses adm-stmt-range-*). Used on customer /statements page and admin CustomerStatementDialog. Verified via curl (row counts per preset) + UI downloads.

## Update (June 2026) — Admin login link hidden
- Public "Admin Login →" link removed from Footer, Maintenance page and Employee Login page. Admin login is reachable ONLY via direct URL `/admin/login` (user mandate: no public button anywhere).
- Brute-force lockout upgraded (June 2026): LOGIN_LOCK_MINUTES 30→15, 5 attempts. Admin portal lock is ACCOUNT-WIDE (identifier `admin:{email}`, IP-independent) so IP rotation cannot bypass; customers remain per IP+email. On admin lock: security_log + in-app notification + email alert (send_login_locked_email → owner Gmail) via asyncio.create_task (BackgroundTasks don't run when HTTPException raised). Password reset (OTP) already clears login_attempts → instant unlock. AdminLogin.jsx shows `admin-lock-banner` on 429.
- Referral limit behaviour changed (June 2026, user mandate): when referrer's daily/monthly limit is full, signup via the link STILL succeeds (no error). `apply_referral_limit()` (server.py, called in verify-otp before marking verified) marks the new user `referral_limit_exceeded: "daily"|"monthly"`, sets bonus-paid flags so neither REF- nor DREF- payout is made, but keeps `referred_by_user_id` for tracking. Unknown referral code no longer errors — account created without referrer. ReferEarnCard shows "No bonus · daily/monthly limit" badge. Sim: backend/tests/sim_referral_limit.py.
- Team Photos admin module (June 2026): `backend/team_routes.py` (GET /api/team/public, GET/PUT /api/admin/team; settings key "team": visible, eyebrow, heading, description, photos[{url,caption}] max 12). Admin page /admin/team (AdminTeam.jsx) — upload/reorder/remove/caption photos, edit heading text, hide toggle. Homepage uses components/TeamSection.jsx (first photo = large). Defaults = original 4 /images/team-N.jpeg. fileUrl() now passes through "/images/" paths.
- Profile photo (June 2026): users.avatar_url (must start with /api/files/), exposed in public_user; PUT /api/profile accepts avatar_url ("" removes). components/AvatarUpload.jsx exports `UserAvatar` (circle img or gradient initial) and `AvatarUpload` (Profile page). Avatar shown in DashboardLayout sidebar (all roles) and Admin Customers list. All image inputs use accept="image/*" ONLY (no extensions, no capture) — on Android Chrome this opens the Photo Picker (gallery) directly; adding extensions like .heic makes Chrome fall back to the generic Camera/Files chooser; HEIC/HEIF added to MIME_TYPES.
- Photo Crop Tool (June 2026): `react-easy-crop` added. components/AvatarCropDialog.jsx — round crop, drag/pinch, zoom slider (1–4x), 90° rotate; outputs 512x512 JPEG blob via canvas. AvatarUpload now: pick file → FileReader dataURL → crop dialog → upload cropped blob → PUT /profile. Max original file 15 MB.
- Sidebar avatar upload (June 2026): `useAvatarPicker()` hook + `SidebarAvatarButton` in AvatarUpload.jsx; DashboardLayout sidebar card avatar is clickable (camera badge) for ALL roles (customer/admin/employee) → picker → crop → PUT /profile. Profile page AvatarUpload kept too.
- Dynamic Working Hours (June 2026, attendance_routes.py): office 10–5, REQUIRED_MINUTES=420, AUTO_CLOSE 18:00 IST. derive() computes late_minutes, worked_minutes, extra_minutes (after 5 PM), adjusted_minutes=min(late,extra), short_minutes=max(0,420-worked), paid_fraction=min(1,worked/420). status: present (=Full Day, 7h+ any arrival) | short_hours (minute-wise deduction) | checkout_missing (no manual checkout; auto_close_stale() lazily flags at/after 6 PM; paid_fraction 0 until admin enters actual checkout via PUT /admin/attendance/{emp}/{date} status=present). Old HALF_DAY_HOURS rule removed; half_day only by admin (50%). Legacy "late" status = full day. Admin table shows Check-In, Manual Check-Out, Duration, Late/Extra/Adjusted/Short min, Status, Deduction (per_day*(1-frac)). Salary row adds short_hours, short_minutes_total, short_deduction, checkout_missing, pending_review_deduction. Sim: backend/tests/sim_working_hours.py.
- Manual Status Override (June 2026): PUT /admin/attendance/{emp}/{date} — admin's status is FINAL (manual_override=True, auto_status stores what logic would give). Options: present, late, half_day, absent, leave, holiday, weekly_off, plus short_hours (= "use automatic minute-wise"). Actual check-in/out times + minute metrics kept. status_history[] {old_status,new_status,edited_by,edited_at,remark,check_in,check_out} pushed per edit; shown in Edit dialog "Change history" and table note ("Manual: X → Y · by · time"). auto_close_stale() skips manual_override records; employee check-out keeps manual status (updates times/auto_status only).
- Check-out emails (June 2026): notify_punch kinds in/out/auto. Manual check-out → email (Check-In, Manual Check-Out, Duration, Short min, Status) to admin(s)+owner+employee (deduped by email). Auto-close at 6 PM → "Checkout missing" email to admin + employee, fired from auto_close_stale via asyncio.create_task. Fixed bug: sessions started after 6 PM were instantly auto-closed; now only check_in < 18:00 (or previous dates) close.
- Bug fix (June 2026): Salary "Set / Adjust" dialog lost focus after 1 keystroke (keyboard closed on mobile) — the `F` input component was defined inside AdjustDialog, so it remounted on each render. Hoisted to module scope (SalaryTab.jsx). Rule: never define components inside components.
- Backdated attendance (June 2026): Admin → Attendance tab → "Mark / Backdate Attendance" button (att-mark-btn): pick employee + any past date (max today) → opens EditDialog (same manual-override PUT). Backend rejects future dates (400). Salary sheet for that month recalculates instantly. Only admin can mark/backdate; employees still only check-in/out for today.
- Yearly Salary Summary (June 2026): GET /api/admin/salary/yearly?year → months[] (Jan..current) with total/paid/pending/paid_days + per-employee net & status, totals, current vs previous month; export /api/admin/salary/yearly/export?year&format. Frontend: Admin Attendance → "Yearly Summary" tab (YearlyTab.jsx): year picker, KPIs, this-vs-last-month delta, 12-month × employee table with LIVE badge on current month, footer totals, XLSX/CSV/PDF.
- Multi-month Salary Statement (June 2026): GET /api/admin/salary/statement/{emp}?from_month&to_month&format=pdf|xlsx|csv — month-wise rows + TOTAL (landscape PDF, DejaVu ₹). Salary Sheet row button "3/6/12 Mo" → StatementDialog.jsx (presets Last 3/6/12 months or custom range). Validates from<=to, caps 36 months, ignores future months.
- FINAL SALARY SPEC (June 2026, attendance_routes.py): SALARY_DAYS=30 → daily rate = monthly/30 everywhere (per_day_of, salary_row). Sunday = paid weekly off (no record → weekly_off, no deduction). Worked Sunday → status sunday_worked (derive auto-sets on Sundays; admin can set) → sunday_extra = per_day × fraction (half_day on Sunday = 50%). Final = Base + sunday_extra + bonus + incentive − attendance_deduction(per_day×deduct_days: absent/unpaid leave/checkout_missing=1, half=0.5, short=minutes/420) − advance − fixed deduction − date_deductions. Salary is computed live, so old records auto-recalculate; POST /admin/salary/recalculate re-derives attendance metrics. Date-specific deductions: POST/DELETE /admin/salary/{emp}/{month}/date-deduction (salary_adjustments.date_deductions[]). Publish/finalize: PUT .../publish {published} → employee GET /employee/salary shows ONLY published months (no admin notes). Audit: salary_audit collection (types monthly_adjustment, payment, date_deduction[_post_finalize], date_deduction_removed, published, unpublished, post_finalize_change) with previous_final/new_final/admin/reason; GET /admin/salary/audit. Frontend: SalaryTab (new columns, Publish button, Recalculate, DateDeductions in AdjustDialog), MySalary.jsx on employee attendance page (published only; no running salary).
- Salary emails (June 2026): PUT .../publish → send_salary_published_email (full breakdown, "Payment pending", link to employee panel) unless already paid. Mark Paid (set_adjustments newly_paid) → auto-publishes if not published, then send_salary_paid_email (breakdown + payment date, UTR, proof link). Employee MySalary shows "✓ Paid <date>" + UTR + proof link. Both emails only to employee's own email.
- Performance pass (June 2026): GZipMiddleware (min 1KB), contact-settings refresh TTL 2s→60s (was a DB read per request), Cache-Control immutable on /api/files/*, extra Mongo indexes (users.role, leads.status/user_id, transactions.created_at, withdrawals.status/created_at, attendance.date/status, salary_audit, login_history, security_logs, files.storage_path), fewer Google font weights, GENERATE_SOURCEMAP=false + INLINE_RUNTIME_CHUNK=false in frontend/.env for smaller prod build. Measured backend APIs ~100–160ms, login ~200ms (bcrypt 10 rounds in thread). Preview uses unminified dev bundle — production build is much faster.
- Absent/joining fixes (June 2026): summarize(items, month, today, start_date): today is NOT counted absent until 6 PM IST auto-close; days before employee joining (joining_date or users.created_at) = pre_joining_days (unpaid, not "absent"); deduct_days capped at 30. salary_row: month entirely before joining → not_joined=True, all zeros. Yearly summary starts from earliest joining month and skips not_joined rows ("—"). New earned_to_date = per_day×paid_days so far + sunday_extra + bonus − manual adj → "Earned till today" column + dashboard "Pending till today" (salary_projected = month total).
- Bug fix (June 2026): Sunday Extra showed ₹0 when the Sunday session was short (e.g. 2-minute test check-in/out) because summarize() used the stored minute-wise paid_fraction. Now Sunday worked = +1 daily rate ALWAYS (half_day on Sunday = +50%), never minute-wise. Verified via curl: 2-min Sunday → +₹500 (per_day 500), half_day → +₹250.
- Attendance Reminder cron (June 2026): `.emergent/crons.yml` → "0 10 * * 1-6" Asia/Kolkata POST /api/cron/attendance-reminder (Bearer WEBHOOK_CRON_SECRET from backend/.env, constant-time compare, 401 otherwise; idempotent via `cron_runs.run_id` from X-Webhook-Id; 202 ack + BackgroundTask). run_attendance_reminder: skips Sunday; for each active employee (not deleted/disabled/inactive, has email, joined ≤ today) with no attendance record today and no reminder today (`attendance_reminders` employee_id+date) → send_attendance_reminder_email (Check In Now button → https origin /employee/attendance). Verified: 401 without/wrong token, 202 + 1 email sent (Resend id), duplicate run_id → duplicate:true, second run same day → 0 emails.
- Campaign Live email redesigned for Gmail Primary (June 2026): send_campaign_live_email now uses `_plain()` (no banner/boxes/buttons/colours, looks like a personally typed message), subject "{First}, I have added {offer} to your account" (no promo words), one link only (personal referral link), plain sign-off with WhatsApp number. Test send OK (Resend id). Broadcast/other emails unchanged.
- Publish = salary for days present till today (June 2026, user mandate): salary_row adds `payable_now` (= min(earned_to_date, final) for the running month; = final for completed months), `in_progress`, `as_of`. employee_view() maps net_payable→payable_now for GET /employee/salary, publish email, paid email, published_final/audit/activity amounts. MySalary card shows "Salary till <date> · N paid days" + amber note for running month; SalaryTab publish confirm shows payable_now vs full-month total. Admin Salary Sheet columns unchanged. Verified via curl: Oct (running) employee sees 0.00 (=500×1 + 500 bonus − 1000 advance test data), Sep (past) payable_now == net_payable 1500.
- Admin panel speed pass 2 (June 2026): frontend/src/lib/api.js custom axios adapter = 30s in-memory GET cache (revisits render instantly; any non-GET clears cache; /notifications, /auth/me, /files/, blob/export/statement/slip never cached; cleared on rt:logout; `noCache:true` per request opt-out). ADMIN_CHUNKS prefetch now includes Employees/Attendance/ActivityLogs/Wallets/Contact/Team (these were downloaded on first click before). Indexes: activity_logs.actor_role, attendance_reminders.date, cron_runs.run_id. Tested iteration_26 (backend 4/4, all UI flows pass incl. cache invalidation after edit).
- Sunday Extra fix 2 (June 2026): admin marking a NON-Sunday date as "Sunday Worked" (e.g. Saturday 3 Oct test on live) now also gets +1 daily rate extra (summarize(): non-Sunday sunday_worked → paid 1.0 + sunday_extra_days += 1). Before, only real Sundays got extra, so "Sun Worked 1 / Extra ₹0" appeared. Verified via curl (Saturday → +₹500).
- Office Timing settings (June 2026): backend/office_timing.py holds start/end/auto_close (defaults 10:00/17:00/18:00, persisted in settings key office_timing, loaded at startup). REQUIRED_MINUTES 420 & Sunday weekly-off fixed. GET/PUT /api/admin/attendance/settings (validate end ≥ start+7h, auto_close > end; activity log office_timing_changed). All late/extra/auto-close logic + emails + employee page + att-rules strip read the live values. Frontend: components/attendance/OfficeTimingCard.jsx on /admin/attendance (testids office-timing-card/-current/-save, office-start/-end/-auto-close). Tested iteration_27.
- Attendance Mode / Geofence + Selfie (June 2026): backend/attendance_policy.py — settings key attendance_policy {mode normal|gps|gps_selfie, office_lat/lng, radius_m 100, selfie_retention_days 60, office_label}; per-employee override users.attendance_mode (null=global); mode_for() falls back to normal if office not set. verify_punch() gate in check-in/out (PunchIn body {lat,lng,accuracy,selfie}; 403 outside radius / no GPS, 400 missing selfie; accuracy>300m rejected; tolerance min(acc,20m)). Stores gps_in/gps_out {lat,lng,accuracy_m,distance_m,radius_m}, selfie_url (/api/files/radhika-traders/selfies/...), verify_mode. Endpoints GET/PUT /admin/attendance/policy, PUT /admin/attendance/policy/employee/{id}, POST /cron/selfie-cleanup (crons.yml 02:30 IST daily; marks files is_deleted, deletes object, sets selfie_expired; skips checkout_missing). Employee GET /employee/attendance returns policy{}. Frontend: AttendancePolicyCard.jsx (mode picker, office location w/ "Use my current location", radius, retention, per-employee select), SelfieDialog.jsx (getUserMedia front cam → 640px JPEG) + getLivePosition(), EmployeeAttendance flow (normal → unchanged; gps → position; gps_selfie → position + selfie dialog), AttendanceTab "GPS / Selfie" column with thumbnail. Sim: backend/tests/sim_attendance_policy.py (20/20 PASS).
- iteration_28: frontend testing agent verified Attendance Mode UI end-to-end (mode picker gating, office location + save/persist, employee GPS block far/allow near with mocked geolocation, GPS column, gps_selfie chip + selfie dialog, per-employee override, restore). Policy left at normal with office lat/lng saved (preview test coords).
- Punch emails now include GPS + selfie (June 2026): notify_punch(emp, rec, kind, origin) adds "Location: N m from office (within R m · GPS ±A m)" row for gps modes and a "View check-in selfie" link (https origin + selfie_url) on check-in mails to admin + employee. Test mail sent OK.
- Attendance policy defaults (June 2026, user): radius 150 m, label "Radhika Traders, Agar", mode normal, office lat/lng NOT set (admin sets via "Use my current location" at office or Google Maps coords).
- Office location set from owner Google Maps link (June 2026): 23.721839, 76.018929 (Radhika Traders, Agar), radius 150 m — baked into attendance_policy.DEFAULT so production gets it on first load; preview settings doc updated too. Mode remains normal until admin switches.
- Employee KYC (June 2026): backend/employee_kyc_routes.py (collection employee_kyc, unique per employee_id; fields full_name/employee_code auto from user, mobile, father_name, email, dob (18–80), address, aadhaar (Verhoeff), pan (individual P), ifsc (format + Razorpay lookup → bank_name/branch), bank_account + confirm; status pending|verified|rejected, enabled, rejection_reason, verified_at/by, history[]). Employee: GET/POST /employee/kyc (locked when verified; blocked when disabled; resubmit after reject). Admin: GET /admin/employee-kyc?status (counts + not_submitted), GET/PUT /admin/employee-kyc/{id} (edit), PUT .../verify, .../reject {reason}, .../enable {enabled}, DELETE (archived to employee_kyc_deleted). Emails send_employee_kyc_email on verify/reject. Frontend: pages/employee/EmployeeKyc.jsx (KycForm with inline validation + live IFSC lookup, status card, testids kyc-*), pages/admin/AdminEmployeeKyc.jsx (tabs, table, View/Edit modals, Verify/Reject(prompt)/Enable-Disable/Delete, testids ekyc-*), nav "Employee KYC" (admin) / "My KYC" (employee), tile on employee workspace. Sim: tests/sim_employee_kyc.py 25/25 PASS.
- iteration_29/30: Employee KYC frontend fully verified (two browser contexts; note: admin & employee share localStorage rt_token, so same-context login logs the other out — expected). All flows pass; DB clean.
- Fix (Oct 4 Sunday report): admin Attendance tab virtual rows for days without a record were always "Absent" with per-day deduction — even on Sundays and for today before auto-close. absent_row() now → Sunday = Weekly Off (no deduction), today before auto-close = "Not in yet" (status not_in, no deduction), else Absent. STATUS_META.not_in added (excluded from filter). office_timing/attendance_policy now refresh from DB every 5s via middleware (multi-worker/replica safe); /employee/attendance + settings/policy excluded from frontend GET cache.
- Sunday extra now MINUTE-WISE (user decision, Oct 4): sunday_extra_days += min(1, worked/420) when check-in/out times exist (7h = full daily rate, 3.5h = 50%, 2 min ≈ ₹2.4); admin manual "Sunday Worked" without times = full; manual Half Day = 50%. Verified via curl on 2026-09-27.
- Auto Half Day (Oct 4, user): derive() marks status half_day with auto_half_day=True when worked < 210 min (HALF_DAY_MINUTES) on non-Sundays; pay stays minute-wise (paid_fraction() uses stored fraction for auto half days; manual Half Day = 50%). short_day_fraction includes auto half days. Verified: 3h → Half Day ₹285.7 deducted (of ₹500), 3h29m → Half Day, 3h30m → Short Hours ₹250, 7h → Present. Old records re-derive via Salary Sheet "Recalculate".
- GPS + Selfie mode now requires selfie on BOTH check-in and check-out (Oct 4, user): verify_punch stores selfie_url (in) + selfie_out_url (out); emails link the respective selfie; admin table shows two thumbnails (green=in, red=out), gps_label "selfie in · selfie out"; cleanup removes both. SelfieDialog takes kind prop. Sim 22/22 PASS. Policy restored to normal; office coords in preview restored by sim to pre-test values.
- Attendance nudges (Oct 4): (1) In-app banner components/AttendanceNudge.jsx on every employee page via DashboardLayout — server-computed `nudge` in GET /employee/attendance (nudge_for): checkin (no record, after office start, before auto-close, shows minutes late) / checkout (checked in, no out, after office end); CTA to /employee/attendance, dismiss = 20 min (sessionStorage), refresh every 5 min. (2) Email cron replaced: crons.yml attendance-nudges "*/15 9-19 * * 1-6" → POST /api/cron/attendance-nudges (old /cron/attendance-reminder path aliased): check-in reminder after office start, check-out reminder (send_checkout_reminder_email) after office end — one of each per employee per day (attendance_reminders.kind). Respects configurable office timing. Harness tests/sim_nudges.py 11/11 PASS (frozen Monday clock).
- Email reach safeguard (Oct 4): real_email(u) helper — placeholder username@employee.radhikatraders.net never used as recipient (punch mails, nudges, salary publish/paid). employee_out now includes email; Admin Employees list shows "⚠ No email — attendance / reminder mails won't reach" when missing. Admin side always gets punch mails (all admin users + owner_email).
- Disabled/deleted employees (Oct 4): employees(active_only=True) for dashboard headcount; virtual Absent/Not-in rows only for active employees; nudges/reminders already skipped disabled/deleted/inactive. Disabled employee cannot log in → no punch mails. Past-month salary sheets still include disabled (final settlement). Verified via PATCH /admin/employees/{id} status toggle.
- Sidebar redesign (Oct 4): nav.js items carry `group` (Campaigns / Customers / Payments / Communication / Team & HR / Website & Settings; Dashboard standalone). DashboardLayout: accordion (one group open; active route group auto-opens; testids side-group-<slug>, side-<label-slug>), compact 13px rows, desktop sticky w-60 with internal scroll, mobile = slide-in drawer (dash-drawer, dash-drawer-backdrop, dash-drawer-close) with body scroll lock; closes on route change. Customer/employee flat navs render unchanged (no groups).
- iteration_31: sidebar verified desktop+mobile (accordion, drawer, no overflow, logout). Fix: employee nav now flat (group stripped in navForUser) per spec.
- Signup Terms consent (Oct 5, customer only): components/PartnerTerms.jsx (15 clauses, PARTNER_TERMS_VERSION 2026-10), TermsConsent.jsx (collapsible scroll box + single checkbox, testids terms-consent/terms-toggle/terms-scroll/terms-checkbox/terms-link), public /terms page. Signup: Send OTP disabled until checkbox; backend /auth/register requires accepted_terms (400 otherwise) and stores users.terms_accepted {version, accepted_at}. Admin panel untouched.


## Remember Me (Login details save) — Oct 2026
- Checkbox "Login details save rakho (baar-baar na mange)" on Customer (/login), Admin (/admin/login) and Employee (/employee/login) pages.
- Ticked → identifier+password stored (base64) in localStorage key `rt_remember_<portal>`; form auto-fills next visit, checkbox stays ticked. Unticked → cleared. Logout does not clear it.
- Files: `src/lib/rememberLogin.js`, `src/components/RememberMeCheckbox.jsx`. Test IDs: login-remember / admin-remember / employee-remember.


## Speed Optimization — Oct 2026
- Root cause of 3-4s panel opens in production: ~0.6-0.9s per API round trip (India -> US origin via Cloudflare) × request waterfalls (dashboard -> 6× /settings/public second wave; customers 250ms debounce; nudge + page duplicate /employee/attendance).
- api.js: GET cache TTL 60s, in-flight dedupe, order-independent cache key, `prefetchApi`. Any write clears cache. `/employee/attendance` now cacheable.
- lib/prefetch.js: ROUTE_DATA map (url+params per panel). Background sequential warm-up 3.5s after login (ChunkPrefetcher) + sidebar pointerdown/mouseenter prefetch. Result: Customers/KYC/Wallet open in ~130-230ms with zero network after warm-up.
- AdminDashboard warms settings/attendance-dashboard/signup-bonus-log in parallel; AdminCustomers no debounce on first load.
- Backend: GET /api/admin/kyc paginated {items,page,pages,total,limit,counts}; AdminKyc.jsx uses Pager (kyc-pager*) + server counts. compute_wallet & admin_dashboard use asyncio.gather. New compound indexes (users role/email_verified/account_status/created_at; users role/kyc.status/kyc.submitted_at; transactions user_id+type / user_id+created_at; withdrawals user_id+status; notifications; leads; activity_logs).
- Tested: iteration_33 (backend 8/8, frontend all flows pass).


## One Device = One Rewarded Account (anti-referral-abuse) — Oct 2026
- Decision (user): account creation is NEVER blocked; a 2nd signup from the same device gets NO referral bonus, NO dedicated payout, NO signup bonus. Same-IP is info-only (CGNAT in India).
- Frontend: `lib/device.js` (fingerprint hash of UA/screen/timezone/canvas/WebGL + persistent `rt_device_id` in localStorage). Signup.jsx sends `device_fp`, `device_id` with /auth/register.
- Backend: `signup_device {fp,id,ip,ua,at}` stored at register. `apply_device_rule(email)` runs in verify-otp before referral payouts: sets `signup_flags {same_device, dup_of, dup_user_id, same_ip_with[]}`, and for dup → referral_bonus_paid/dedicated_referral_paid=True, referral_limit_exceeded="device". `_signup_dup` also returns (dup,"device") so signup bonus is logged not_eligible. New indexes on signup_device.fp/id/ip.
- Admin: GET /api/admin/suspicious-signups → {device_groups, ip_groups, blocked_count, tracked}; page /admin/suspicious-signups (nav: Customers → Suspicious Signups). Customers table shows "Dup device" badge (customer-dup-device-<id>). ReferEarnCard shows "No bonus · same device".
- Sim: backend/tests/sim_device_rule.py (verified: 2nd account flagged, no REF credit, admin group count 2).


## App Lock (PIN + Fingerprint) — Oct 2026
- All panels (customer/employee/admin). Mandatory 4-digit PIN setup on first login; lock screen on every fresh app open (sessionStorage `rt_unlocked_<uid>`) and after 5 min in background (`rt_hidden_at`). Weak PINs (1234/0000/4321/same digits) rejected. 5 wrong -> 30 min lock; Forgot PIN -> email OTP (10 min) -> new PIN. Settings: Change PIN, Enable/Remove fingerprint (per device/domain), Lock now, Turn off/on (PIN required).
- Fingerprint/Face: WebAuthn platform authenticator (py_webauthn 3.0.1). RP ID = request host; origin must be https & match. Credentials in `webauthn_credentials` (user_id, credential_id, rp_id), challenges in `webauthn_challenges` (TTL), matched by clientDataJSON challenge (StrictMode-safe).
- Backend: `app_lock_routes.py` (/api/app-lock/status, pin/set, pin/unlock, forgot, reset, disable, enable, biometric/register|unlock options|finish, DELETE biometric). Wrong PIN = HTTP 400 (401 would log out via axios interceptor). `public_user` exposes app_lock {configured, enabled}.
- Frontend: components/applock/{AppLockGate,AppLockSettings,PinPad}.jsx, lib/{webauthn,appLockState}.js; gate mounted in ProtectedRoute; settings in Profile, /admin/security, /employee.
- Test PINs: admin 2580, employee 2580, customer 2468 (see test_credentials.md). Tested: iteration_34 (backend 13/13, frontend flows pass); biometric verified by main agent with CDP virtual authenticator.


## Professional App Opening (Splash) — Oct 2026
- Reference: user shared a Click2Track video; wanted a professional opening. Implemented inline HTML splash in public/index.html (#rt-splash: dark #0B0F17, red radial glow, grain, logo mark pop with 2 pulsing rings, wordmark, tagline, gradient progress bar, footer chips). Renders before JS; min 1.3s; fades 0.5s; safety auto-dismiss 9s.
- Handover: App.js `SplashDismiss` + `Fallback` (holds splash until first lazy route renders; Fallback itself is a light logo-pulse + top progress bar). `window.__rtSplashDone()`.
- Entrance motion: `.rt-enter` (+ -1/-2/-3 stagger) in index.css; applied to AuthShell (logo/title/form/support box), DashboardLayout <main> (keyed by pathname), lock screen card. App-lock loading state shows pulsing logo on dark. sw.js cache bumped to rt-pwa-v3. PWA manifest background matches splash (#0B0F17).
