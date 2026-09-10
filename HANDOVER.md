# Radhika Traders — Developer Handover

Affiliate campaign management platform. Admin (Harish Bhati) manages campaigns, leads, wallets, KYC, withdrawals; customers (publishers) share referral links, submit leads, earn payouts.

## Stack
- **Frontend**: React 19 (CRA + craco), TailwindCSS, shadcn/ui, lucide-react, sonner, axios, react-router. PWA (`public/manifest.json`, `public/sw.js`).
- **Backend**: FastAPI (Python 3.11), Motor (async MongoDB), PyJWT, bcrypt, Pillow + qrcode (posters), pandas/openpyxl (Excel), httpx.
- **Database**: MongoDB. Collections: users, campaigns, leads, transactions, withdrawals, wallet_adjustments, banners, categories, clicks, notifications, broadcasts, reports, files, settings, security_logs, login_attempts, otps, ifsc_cache.
- **Email**: Resend via `EMERGENT_EMAIL_KEY` (see `backend/email_service.py`). Templates are deliberately light-HTML so mails land in Gmail Primary.
- **Object storage**: Emergent object storage (`backend/storage_service.py`) for logos, banners, KYC QR, reports.
- **External APIs**: Razorpay IFSC lookup (public, no key) in `lookup_ifsc_info`.

## Run locally
```bash
# backend
cd backend && pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
# frontend
cd frontend && yarn install && yarn start   # port 3000
```
All API routes are prefixed `/api`. Frontend calls `${REACT_APP_BACKEND_URL}/api`.

## Environment variables
`backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seeds admin on first start), `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `MIN_WITHDRAWAL`, `EMERGENT_LLM_KEY` (unused).
`frontend/.env`: `REACT_APP_BACKEND_URL`.
Never commit real values. Rotate `JWT_SECRET` / admin password when changing developers.

## Code map
- `backend/server.py` — all routes (~2200 lines). Sections in order: auth/OTP → settings → shutdown switch → profile/KYC → campaigns → /go redirect (click tracking) → leads → banners → wallet/withdrawals → admin (customers, credit, wallet adjust, reports) → share kit → files.
- `backend/auth_utils.py` — JWT, bcrypt (rounds=10, transparent rehash), OTP.
- `backend/email_service.py` — all email templates.
- `backend/share_kit.py` — poster/QR image generation (fonts in `backend/assets/`).
- `frontend/src/App.js` — routes (lazy-loaded), `ShutdownGate`.
- `frontend/src/pages/admin/*`, `frontend/src/pages/customer/*`, shared UI in `frontend/src/components/*`.
- `frontend/src/lib/api.js` — axios instance (401 → logout, 503 shutdown → maintenance page).
- `frontend/src/lib/validators.js` — PAN/Aadhaar/IFSC/UPI rules (mirrored in backend `_validate_kyc`).

## Key business rules
- Dual passwords: login password + transaction PIN (withdrawals).
- Login lockout after repeated failures (`login_attempts`).
- Wallet balance = sum(credit) − sum(debit) − pending withdrawals (`compute_wallet`). Never edit balances directly; always insert a transaction.
- Campaign live → one-time announce (`live_announced_at`) to all verified customers + auto banner in slider.
- Reports auto-expire after 7 days (`_purge_expired_reports`).
- Shutdown switch: `settings.app.shutdown_*`; customers get 503 `{code:"shutdown"}`; admin unaffected.
- Account statuses: active / paused / disabled / deleted (soft).

## Tests
- Backend pytest: `backend/tests/` (`pytest backend/tests -q`).
- E2E reports from QA runs: `test_reports/iteration_*.json`.
- Product history / decisions: `memory/PRD.md`. Test accounts: `memory/test_credentials.md` (change before production).

## Deploy notes
- Production build: `cd frontend && yarn build` (serve `build/`), backend behind HTTPS reverse proxy routing `/api/*` → :8001.
- Bump `CACHE_VERSION` in `public/sw.js` when changing static assets, otherwise PWA users may see stale files.
- Create MongoDB indexes automatically on startup (see `startup` in `server.py`).
