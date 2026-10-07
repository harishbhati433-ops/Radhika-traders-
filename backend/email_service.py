"""Emergent managed email (Resend) with guardrail gate."""
import os
import re
import asyncio
import time
import ipaddress
import logging
import httpx
from datetime import datetime, timezone, timedelta
from html import escape
import office_timing as ot
from html.parser import HTMLParser
from urllib.parse import urlparse
from contact_settings import CONTACT, wa_number

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Radhika Traders")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


_db = None
_send_lock = asyncio.Lock()
_last_send = 0.0
_last_failure = ""  # last provider error seen by send_email (e.g. 'HTTP 429') — lets the outbox worker stop early during a quota outage
MIN_GAP = 0.6  # provider allows ~2 req/s — space sends so bursts (admin + employee mails per punch) never hit 429
BACKOFF = (2, 4, 8, 12, 16)


def set_db(db) -> None:
    global _db
    _db = db


async def _log(to: str, subject: str, status: str, error: str = "", email_id: str | None = None, attempts: int = 0) -> None:
    if _db is None:
        return
    try:
        await _db.email_log.insert_one({"to": to, "subject": subject[:160], "status": status, "error": (error or "")[:300], "email_id": email_id, "attempts": attempts,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass


RETRY_GAPS_MIN = (5, 10, 15, 30, 60, 120)  # outbox re-send schedule after the immediate retries are exhausted


def _permanent(err: str) -> bool:
    return err.startswith("HTTP 4") and not err.startswith("HTTP 429")


async def _queue_retry(to: str, subject: str, html: str, error: str) -> None:
    if _db is None:
        return
    nxt = datetime.now(timezone.utc) + timedelta(minutes=RETRY_GAPS_MIN[0])
    await _db.email_outbox.insert_one({"to": to, "subject": subject[:160], "html": html, "attempts": 0, "status": "queued", "last_error": error[:300],
                                       "next_try_at": nxt.isoformat(), "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()})


async def send_email(*, to: str, subject: str, html: str, _from_outbox: bool = False) -> str | None:
    global _last_send, _last_failure
    _last_failure = ""
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    last_err = ""
    for attempt in range(len(BACKOFF)):
        try:
            async with _send_lock:  # serialise + throttle all outgoing mail
                wait = MIN_GAP - (time.monotonic() - _last_send)
                if wait > 0:
                    await asyncio.sleep(wait)
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
                _last_send = time.monotonic()
            if resp.status_code == 429 or resp.status_code >= 500:
                last_err = f"HTTP {resp.status_code}"
                logger.warning(f"Email send retry {attempt + 1} for {to}: {last_err}")
                await asyncio.sleep(BACKOFF[attempt])
                continue
            resp.raise_for_status()
            email_id = resp.json().get("id")
            await _log(to, subject, "sent", email_id=email_id, attempts=attempt + 1)
            return email_id
        except httpx.HTTPStatusError as e:
            last_err = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
            logger.error(f"Email send error to {to}: {last_err}")
            await _log(to, subject, "failed", last_err, attempts=attempt + 1)  # 4xx = bad address / rejected content → retrying won't help
            return None
        except Exception as e:
            last_err = str(e)
            logger.warning(f"Email send retry {attempt + 1} for {to}: {last_err}")
            await asyncio.sleep(BACKOFF[attempt])
    logger.error(f"Email send gave up for {to}: {last_err}")
    _last_failure = last_err
    if _from_outbox:
        await _log(to, subject, "queued" if last_err.startswith("HTTP 429") else "failed", f"{last_err} — still waiting in queue" if last_err.startswith("HTTP 429") else last_err, attempts=len(BACKOFF))
    else:  # provider down / rate-limited → park it and re-send automatically after 5, 10, 15, 30, 60, 120 min
        await _log(to, subject, "queued", f"{last_err} — queued for automatic re-send in {RETRY_GAPS_MIN[0]} min", attempts=len(BACKOFF))
        await _queue_retry(to, subject, html, last_err)
    return None


BULK_PER_RUN = 6          # low-priority (campaign) mails drained per 5-min cron run → max ~70/hour
DAILY_SOFT_CAP = 400      # total sends/day before bulk is deferred to tomorrow (one-to-one mails are never deferred)


async def sent_today() -> int:
    if _db is None:
        return 0
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    return await _db.email_log.count_documents({"status": "sent", "created_at": {"$gte": start}})


async def enqueue_bulk(to: str, subject: str, html: str) -> None:
    """Campaign / announcement mails never go out in a burst: they wait in the outbox and are drained slowly by the cron."""
    if _db is None or not to:
        return
    now = datetime.now(timezone.utc)
    await _db.email_outbox.insert_one({"to": to, "subject": subject[:160], "html": html, "attempts": 0, "status": "queued", "priority": "bulk", "last_error": "",
                                       "next_try_at": now.isoformat(), "created_at": now.isoformat(), "updated_at": now.isoformat()})


async def process_outbox(limit: int = 50) -> dict:
    """Called by the 5-min cron: re-send queued mails whose next_try_at has passed."""
    if _db is None:
        return {"processed": 0}
    now = datetime.now(timezone.utc)
    q = {"status": "queued", "next_try_at": {"$lte": now.isoformat()}}
    due = await _db.email_outbox.find({**q, "priority": {"$ne": "bulk"}}).sort("next_try_at", 1).to_list(limit)   # retries of one-to-one mails first
    if await sent_today() < DAILY_SOFT_CAP:
        due += await _db.email_outbox.find({**q, "priority": "bulk"}).sort("created_at", 1).to_list(BULK_PER_RUN)
    sent = failed = requeued = 0
    for m in due:
        mid = await send_email(to=m["to"], subject=m["subject"], html=m["html"], _from_outbox=True)
        attempts = int(m.get("attempts", 0)) + 1
        quota_outage = _last_failure.startswith("HTTP 429")
        age_h = (now - datetime.fromisoformat(m["created_at"])).total_seconds() / 3600
        if mid:
            sent += 1
            await _db.email_outbox.update_one({"_id": m["_id"]}, {"$set": {"status": "sent", "attempts": attempts, "email_id": mid, "sent_at": now.isoformat(), "updated_at": now.isoformat()}})
        elif quota_outage and age_h < 48:
            # provider quota exhausted: keep the mail for up to 48 h and try again every 30 min; stop this run — every other mail would hit the same wall
            requeued += 1
            await _db.email_outbox.update_one({"_id": m["_id"]}, {"$set": {"status": "queued", "attempts": attempts, "last_error": _last_failure, "next_try_at": (now + timedelta(minutes=30)).isoformat(), "updated_at": now.isoformat()}})
            logger.warning("email outbox: provider rate-limited (429) — pausing outbox drain for 30 min")
            break
        elif attempts >= len(RETRY_GAPS_MIN):
            failed += 1
            await _db.email_outbox.update_one({"_id": m["_id"]}, {"$set": {"status": "failed", "attempts": attempts, "updated_at": now.isoformat()}})
            await _db.activity_logs.insert_one({"actor_id": "system", "actor_name": "System", "actor_role": "system", "actor_username": "", "action": "email_failed", "entity_type": "email",
                                                "entity_id": str(m["_id"]), "entity_label": m["to"], "campaign_id": "", "campaign_name": "", "client_id": "", "client_name": "", "status": "failed",
                                                "amount": None, "detail": f"'{m['subject']}' to {m['to']} failed permanently after {attempts} scheduled retries (5→120 min)", "ip": "", "created_at": now.isoformat()})
        else:
            requeued += 1
            nxt = now + timedelta(minutes=RETRY_GAPS_MIN[min(attempts, len(RETRY_GAPS_MIN) - 1)])
            await _db.email_outbox.update_one({"_id": m["_id"]}, {"$set": {"status": "queued", "attempts": attempts, "next_try_at": nxt.isoformat(), "updated_at": now.isoformat()}})
    if due:
        logger.info(f"email outbox: {sent} sent, {requeued} re-queued, {failed} failed of {len(due)} due")
    return {"processed": len(due), "sent": sent, "requeued": requeued, "failed": failed}


def _wrap(title: str, inner: str) -> str:
    return (
        '<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#0B0F17;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
        '<div style="background:#991B1B;padding:16px 22px;border-bottom:3px solid #F59E0B">'
        '<div style="font-size:19px;font-weight:bold;letter-spacing:1px;color:#ffffff">RADHIKA <span style="color:#FCD34D">TRADERS</span></div>'
        '<div style="font-size:10px;letter-spacing:2px;color:#FDE68A;font-weight:bold;margin-top:2px">TRUSTED PARTNER FOR FINANCIAL GROWTH</div></div>'
        f'<div style="padding:20px 22px 6px">{inner}</div>'
        '<div style="background:#0B0F17;padding:12px 22px;margin-top:18px">'
        '<div style="font-size:12px;font-weight:bold;color:#ffffff">Radhika Traders</div>'
        f'<div style="font-size:11px;color:#94a3b8;margin-top:2px">Agar, Madhya Pradesh · WhatsApp {wa_number()} · {escape(CONTACT["support_email"])} · '
        '<a href="https://www.radhikatraders.net" style="color:#FCD34D">www.radhikatraders.net</a></div>'
        '<div style="font-size:10px;color:#64748b;margin-top:6px">We never ask for your password, OTP or card details by email.</div></div>'
        '</div>'
    )


async def send_otp_email(to: str, name: str, code: str, purpose: str) -> str | None:
    reason = {"signup": "verify your account", "app_lock": "reset your App Lock PIN", "email_change": "verify your new login email"}.get(purpose, "reset your password")
    subject = f"{code} is your Radhika Traders verification code"
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "there")},</p>'
        f'<p style="font-size:14px;color:#334155">You requested to {reason}. Your one-time code is:</p>'
        f'<div style="margin:20px 0"><span style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0B0F17">{escape(code)}</span></div>'
        f'<p style="font-size:14px;color:#334155">This code is valid for {"5" if purpose == "reset" else "10"} minutes. Please do not share it with anyone — Radhika Traders will never ask for it.</p>'
        f'<p style="font-size:12px;color:#94a3b8">If you did not request this, you can ignore this email.</p>'
        f'<p style="font-size:13px;color:#334155;margin-top:20px">Regards,<br>Team Radhika Traders</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def _salary_rows(row: dict, mlabel: str, extra: list) -> str:
    running = row.get("in_progress")
    final_label = f"SALARY TILL {datetime.fromisoformat(row['as_of']).strftime('%d %b')} ({row.get('paid_days', 0):g} paid days)" if running and row.get("as_of") else "FINAL SALARY"
    rows = [("Salary Month", mlabel), ("Base Monthly Salary", f"₹{row['monthly_salary']:,.2f}"), ("Daily Rate (÷30)", f"₹{row['per_day']:,.2f}"),
            ("Present / Half / Absent", f"{row['present'] + row['late']} / {row['half_day']} / {row['absent']}"), ("Leave (Paid / Unpaid)", f"{row['paid_leave']} / {row['unpaid_leave']}"),
            ("Weekly Off · Sunday Worked", f"{row['weekly_off']} · {row['sunday_worked']}"), ("Sunday Extra (+)", f"₹{row['sunday_extra']:,.2f}"), ("Bonus / Incentive (+)", f"₹{row['bonus'] + row['incentive']:,.2f}"),
            ("Attendance Deduction (−)", f"₹{row['attendance_deduction']:,.2f}"), ("Adjustments (−)", f"₹{row['manual_adjustment']:,.2f}"), (final_label, f"₹{row['net_payable']:,.2f}")] + extra
    return "".join(f'<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td>'
                   f'<td style="padding:6px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)


async def send_salary_published_email(to: str, name: str, row: dict, portal_link: str) -> str | None:
    if not to:
        return None
    mlabel = datetime.strptime(row["month"], "%Y-%m").strftime("%B %Y")
    subject = f"Final salary for {mlabel}: ₹{row['net_payable']:,.2f}"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">Your salary for <b>{escape(mlabel)}</b> has been finalized by the admin. Final Salary: <b style="color:#991B1B">₹{row["net_payable"]:,.2f}</b>. Breakdown:</p>'
             f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{_salary_rows(row, mlabel, [("Payment", "Pending — you will get another email when it is paid")])}</table>'
             f'<p style="margin:16px 0 6px"><a href="{escape(portal_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">View in Employee Panel</a></p>'
             f'<p style="font-size:12px;color:#64748b;margin-top:16px">If any detail looks incorrect, please contact the admin before payment.</p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_salary_paid_email(to: str, name: str, row: dict, payment_date: str, proof_link: str, utr: str) -> str | None:
    if not to:
        return None
    amt = f"₹{row['net_payable']:,.2f}"
    mlabel = datetime.strptime(row["month"], "%Y-%m").strftime("%B %Y")
    subject = f"Salary credited: {amt} for {mlabel}"
    extra = [("Payment Date", payment_date)] + ([("UTR / Reference", utr)] if utr else [])
    proof = f'<p style="margin:18px 0 0"><a href="{escape(proof_link)}" style="color:#991B1B;font-weight:bold;font-size:13px">View payment proof</a></p>' if proof_link else ""
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">Your salary of <b style="color:#15803d">{amt}</b> for <b>{escape(mlabel)}</b> has been <b>credited</b>. Details:</p>'
             f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{_salary_rows(row, mlabel, extra)}</table>{proof}'
             f'<p style="font-size:12px;color:#64748b;margin-top:16px">If any detail looks incorrect, please contact the admin. Thank you for your hard work!</p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_attendance_email(to: str, name: str, kind: str, emp_name: str, emp_code: str, date_str: str, time_str: str, status: str, hours, for_admin: bool,
                                check_in: str = "", check_out: str = "", short_minutes=None, gps: str = "", selfie_link: str = "") -> str | None:
    if not to:
        return None
    auto = kind == "auto"
    verb = "checked in" if kind == "in" else "checked out" if kind == "out" else "did NOT check out"
    if auto:
        subject = f"{'Checkout missing: ' + emp_name if for_admin else 'You forgot to check out'} — auto-closed at {ot.auto_close_12()}, {date_str}"
    else:
        subject = f"{'Attendance: ' + emp_name if for_admin else 'Your attendance'} {verb} at {time_str} — {date_str}"
    rows = [("Employee", f"{emp_name} ({emp_code})" if emp_code else emp_name), ("Date", date_str)]
    if kind == "in":
        rows.append(("Check-In", time_str))
    else:
        rows += [("Check-In", check_in or "—"), ("Manual Check-Out", check_out or (f"Missing — auto-closed {ot.auto_close_12()}" if auto else time_str))]
    rows.append(("Status", status))
    if hours is not None:
        rows.append(("Working Duration", str(hours)))
    if short_minutes:
        rows.append(("Short Working", f"{short_minutes} min (deducted minute-wise)"))
    if gps:
        rows.append(("Location", gps))
    if selfie_link:
        rows.append(("Selfie", "attached — see link below"))
    table = "".join(f'<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td>'
                    f'<td style="padding:6px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)
    if auto:
        lead = (f"<b>{escape(emp_name)}</b> checked in today but never checked out. The session was auto-closed at {ot.auto_close_12()} and marked <b>Checkout Missing – Admin Review</b>. "
                f"This day is <b>not paid</b> until you enter the actual check-out time." if for_admin
                else f"You forgot to check out today. Your session was auto-closed at {ot.auto_close_12()} and sent to the admin for review — please tell the admin your actual leaving time.")
        foot = "Open Admin Panel → Attendance &amp; Salary → click <b>Review</b> on this row to enter the actual check-out time." if for_admin else "Please check out yourself every day so your full working time is counted."
    else:
        lead = (f"<b>{escape(emp_name)}</b> has {verb} at the office." if for_admin else f"You have successfully {verb}. Office hours are {ot.start_12()} – {ot.end_12()} · 7 hours of work = Full Day.")
        foot = "Open Admin Panel → Attendance &amp; Salary to review or correct." if for_admin else "If anything looks wrong, please inform the admin."
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p><p style="font-size:14px;color:#334155">{lead}</p>'
             f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{table}</table>'
             + (f'<p style="margin:0 0 14px"><a href="{escape(selfie_link)}" style="color:#991B1B;font-weight:bold;font-size:13px">View {"check-in" if kind == "in" else "check-out"} selfie</a></p>' if selfie_link else "")
             + f'<p style="font-size:12px;color:#64748b">{foot}</p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_attendance_reminder_email(to: str, name: str, emp_code: str, date_str: str, portal_link: str) -> str | None:
    if not to:
        return None
    subject = f"Reminder: you have not checked in yet — {date_str}"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">It is past <b>{ot.start_12()}</b> and your attendance for <b>{escape(date_str)}</b> has not been marked yet'
             f'{" (" + escape(emp_code) + ")" if emp_code else ""}. Office hours are {ot.start_12()} – {ot.end_12()} · 7 hours of work = Full Day.</p>'
             f'<p style="font-size:14px;color:#334155">Please open the Employee Panel and press <b>Check In</b> now. Arriving after {ot.start_12()} is recorded as a late mark, '
             f'and a day with no check-in is counted as <b>Absent</b> after {ot.auto_close_12()}.</p>'
             f'<p style="margin:16px 0"><a href="{escape(portal_link)}" style="background:#991B1B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">Check In Now</a></p>'
             f'<p style="font-size:12px;color:#64748b">On leave or holiday today? Please inform the admin so your attendance can be marked correctly.</p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_employee_kyc_email(to: str, name: str, status: str, reason: str, portal_link: str) -> str | None:
    if not to:
        return None
    ok = status == "verified"
    subject = "Your KYC has been verified" if ok else "Your KYC needs correction"
    body = ("Your KYC details (identity + bank account) have been <b style=\"color:#15803d\">verified</b> by the admin. No further action is needed."
            if ok else f"The admin could not verify your KYC. Reason: <b style=\"color:#991B1B\">{escape(reason or 'details did not match')}</b>. Please open the Employee Panel, correct the details and submit again.")
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p><p style="font-size:14px;color:#334155">{body}</p>'
             f'<p style="margin:16px 0 6px"><a href="{escape(portal_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open My KYC</a></p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_checkout_reminder_email(to: str, name: str, date_str: str, check_in_time: str, portal_link: str) -> str | None:
    if not to:
        return None
    subject = f"Reminder: please check out — {date_str}"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">Office hours are over ({ot.start_12()} – {ot.end_12()}). You checked in at <b>{escape(check_in_time)}</b> today but have not checked out yet.</p>'
             f'<p style="font-size:14px;color:#334155">Please press <b>Check Out</b> before <b>{ot.auto_close_12()}</b>. If you do not, the day is marked <b>Checkout Missing</b>, goes to admin review and stays unpaid until approved.</p>'
             f'<p style="margin:16px 0"><a href="{escape(portal_link)}" style="background:#991B1B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">Check Out Now</a></p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_login_alert_email(to: str, name: str, when_ist: str, ip: str, device: str, reset_link: str, security_link: str) -> str | None:
    if not to:
        return None
    subject = f"New device login to Radhika Traders Admin Panel — {device}"
    rows = [("Date & Time", when_ist), ("Device / Browser", device), ("IP Address", ip or "Unknown")]
    table = "".join(f'<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td>'
                    f'<td style="padding:6px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
        f'<p style="font-size:14px;color:#334155">Your <b>Admin Panel</b> was just logged into from a device or IP address we have not seen before:</p>'
        f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{table}</table>'
        f'<p style="font-size:14px;color:#334155"><b>Was this you?</b> No action needed. You will not be alerted again for this device.</p>'
        f'<p style="font-size:14px;color:#B91C1C"><b>Not you?</b> Reset your password immediately — this logs out every device, including the intruder.</p>'
        f'<p style="margin:16px 0 6px"><a href="{escape(reset_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Reset admin password</a></p>'
        f'<p style="font-size:12px;color:#64748b">Or open Admin Panel → <a href="{escape(security_link)}" style="color:#991B1B">Security</a> to review recent activity.</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_login_locked_email(to: str, name: str, when_ist: str, ip: str, device: str, attempts: int, lock_minutes: int, reset_link: str) -> str | None:
    if not to:
        return None
    subject = f"Security alert: Admin login locked after {attempts} wrong password attempts"
    rows = [("Date & Time", when_ist), ("Device / Browser", device), ("IP Address", ip or "Unknown"), ("Wrong attempts", attempts), ("Locked for", f"{lock_minutes} minutes")]
    table = "".join(f'<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td>'
                    f'<td style="padding:6px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
        f'<p style="font-size:14px;color:#334155">Someone entered the wrong password for your <b>Admin Panel</b> {attempts} times in a row. '
        f'As a safety measure, admin login is now <b>locked for {lock_minutes} minutes</b> for everyone, including you.</p>'
        f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{table}</table>'
        f'<p style="font-size:14px;color:#334155"><b>Was this you?</b> Just wait {lock_minutes} minutes and try again, or reset your password via OTP to unlock instantly.</p>'
        f'<p style="font-size:14px;color:#B91C1C"><b>Not you?</b> Someone is trying to guess your password. Your account is still safe — the password was NOT cracked. '
        f'We recommend resetting it now to a stronger one.</p>'
        f'<p style="margin:16px 0 6px"><a href="{escape(reset_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Reset admin password</a></p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))



async def send_password_changed_email(to: str, name: str, when_ist: str, ip: str) -> str | None:
    if not to:
        return None
    subject = "Your Radhika Traders password was changed"
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
        f'<p style="font-size:14px;color:#334155">The login password for your Radhika Traders account was changed on <b>{escape(when_ist)}</b>'
        f'{f" from IP {escape(ip)}" if ip else ""}. For your security, all other logged-in devices have been signed out.</p>'
        f'<p style="font-size:14px;color:#334155">If this was you, no action is needed. If you did not do this, contact us immediately on WhatsApp {wa_number()}.</p>'
        f'<p style="font-size:13px;color:#334155;margin-top:20px">Regards,<br>Team Radhika Traders</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_payment_email(to: str, name: str, amount: float, method: str, details: str, utr: str, proof_link: str) -> str | None:
    if not to:
        return None
    amt = f"₹{amount:g}"
    date = datetime.now(timezone.utc).strftime("%d %b %Y")
    subject = f"Payment of {amt} sent to your {method} account"
    rows = [("Amount", amt), ("Payment method", method), ("Status", "Paid"), ("Date", date), ("Paid to", details)]
    if utr:
        rows.append(("UTR / Reference No.", utr))
    table = "".join(
        f'<tr><td style="padding:8px 0;color:#64748b;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:8px 0;text-align:right;font-weight:bold;color:#0B0F17;font-size:13px">{escape(str(v))}</td></tr>'
        for k, v in rows)
    proof = (f'<p style="margin:18px 0 0"><a href="{escape(proof_link)}" style="color:#991B1B;font-weight:bold;font-size:13px">View payment proof</a></p>') if proof_link else ""
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "Partner")},</p>'
        f'<p style="font-size:14px;color:#334155">Your withdrawal of <b>{amt}</b> has been paid to your registered {escape(method)} account. Details below:</p>'
        f'<table width="100%" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:12px 0">{table}</table>'
        f'{proof}'
        f'<p style="font-size:13px;color:#64748b;margin-top:16px">It may take a few minutes to reflect in your account. Reply to this email if anything looks incorrect.</p>'
        f'<p style="font-size:13px;color:#334155;margin-top:20px">Thank you for partnering with us.<br>Team Radhika Traders<br>Harish Bhati, Founder</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def _campaign_block(c: dict, link: str) -> str:
    rows = [("Payout", f"Rs.{c.get('payout_amount', 0):g} {c.get('payout_type', '')}".strip()), ("Company", c.get("company", ""))]
    if c.get("fund_add"):
        rows.append(("Fund add", str(c["fund_add"])))
    if c.get("requirements"):
        rows.append(("Requirement", str(c["requirements"])[:200]))
    table = "".join(
        f'<tr><td style="padding:5px 0;color:#64748b;font-size:13px;width:110px">{escape(k)}</td>'
        f'<td style="padding:5px 0;color:#0B0F17;font-size:13px;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows if v)
    return (
        f'<div style="border:1px solid #e2e8f0;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 16px;margin:16px 0;background:#fffdf7">'
        f'<div style="font-size:16px;font-weight:bold;color:#0B0F17">{escape(c.get("offer_name", ""))}</div>'
        f'<table style="margin-top:6px;border-collapse:collapse">{table}</table>'
        f'<p style="margin:12px 0 0;font-size:13px;color:#334155">Your referral link: <a href="{escape(link)}" style="color:#991B1B;word-break:break-all">{escape(link)}</a></p></div>')


def _signature() -> str:
    return ('<p style="margin-top:18px;font-size:14px;color:#334155">Any question? Just reply to this email — our team reads every message.</p>'
            '<table style="margin-top:14px;border-collapse:collapse"><tr>'
            '<td style="padding-right:12px;border-right:3px solid #991B1B;vertical-align:top">'
            '<div style="font-size:14px;font-weight:bold;color:#0B0F17">Team Radhika Traders</div>'
            '<div style="font-size:12px;color:#64748b">Harish Bhati, Founder</div></td>'
            '<td style="padding-left:12px;font-size:12px;color:#334155;vertical-align:top">'
            f'WhatsApp: {wa_number()}<br>'
            f'Email: <a href="mailto:{escape(CONTACT["support_email"])}" style="color:#991B1B">{escape(CONTACT["support_email"])}</a><br>'
            '<a href="https://www.radhikatraders.net" style="color:#991B1B">www.radhikatraders.net</a></td></tr></table>')


def _first(name: str) -> str:
    return (name or "Partner").strip().split()[0].capitalize()


def _plain(inner: str) -> str:
    # Looks like a personally typed Gmail message (no banner, boxes, buttons or colours) → lands in Primary, not Promotions.
    return f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222222;max-width:600px">{inner}</div>'


def campaign_live_html(name: str, c: dict, link: str) -> tuple[str, str]:
    first = _first(name)
    offer = c.get("offer_name", "a new campaign")
    subject = f"{first}, I have added {offer} to your account"
    details = [f"Company: {c.get('company', '')}", f"Payout: Rs.{c.get('payout_amount', 0):g} {c.get('payout_type', '')}".strip()]
    if c.get("fund_add"):
        details.append(f"Fund add: {c['fund_add']}")
    if c.get("requirements"):
        details.append(f"Requirement: {str(c['requirements'])[:200]}")
    detail_html = "<br>".join(escape(x) for x in details if x.split(":", 1)[1].strip())
    inner = (f'<p>Hi {escape(first)},</p>'
             f'<p>Harish here from Radhika Traders. I have just added <b>{escape(offer)}</b> to your dashboard and wanted to tell you personally.</p>'
             f'<p>{detail_html}</p>'
             f'<p>Your referral link for this one:<br><a href="{escape(link)}" style="color:#1a0dab">{escape(link)}</a></p>'
             f'<p>Share it with people who would be a good fit, and I will track the leads for you on your dashboard. If you have any question, just reply to this email, I read every message.</p>'
             f'<p>Thanks,<br>Harish Bhati<br>Radhika Traders<br>WhatsApp: {escape(wa_number())}</p>')
    return _plain(inner), subject


async def send_campaign_live_email(to: str, name: str, c: dict, link: str) -> str | None:
    if not to:
        return None
    html, subject = campaign_live_html(name, c, link)
    return await send_email(to=to, subject=subject, html=html)


async def send_broadcast_email(to: str, name: str, subject: str, message: str, c: dict | None, link: str) -> str | None:
    if not to:
        return None
    body = "".join(f'<p style="font-size:14px;color:#334155;margin:0 0 10px">{escape(p)}</p>' for p in message.split("\n") if p.strip())
    inner = f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>{body}'
    if c:
        inner += _campaign_block(c, link)
    inner += _signature()
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def welcome_letter_paragraphs(name: str, referral_code: str, signup_bonus: float) -> list[str]:
    first = _first(name)
    paras = [
        f"Dear {escape(name or first)},",
        "Congratulations and a very warm welcome to the Radhika Traders partner family!",
        "We are delighted to have you on board. Radhika Traders is an advertising and affiliate marketing agency working with India's leading brokers, "
        "banks and insurers. As our partner, you can share campaign links with your network and earn a fixed payout on every approved account opening — "
        "with zero investment.",
        f"Your Partner ID / Referral Code is <b>{escape(referral_code or '')}</b>. Use it to invite others and grow your own network.",
    ]
    if signup_bonus and signup_bonus > 0:
        paras.append(f"As a welcome gift, Rs.{signup_bonus:g} has been added to your Bonus Wallet. It moves to your main wallet as soon as your first lead is approved.")
    paras += [
        "Here is how to get started: 1) Complete your KYC in Profile so your payouts are never delayed. 2) Open Campaigns and copy your referral link. "
        "3) Share it on WhatsApp, Telegram or social media. 4) Track your leads and earnings live on your dashboard.",
        "We believe in honest partnerships, on-time payments and long-term growth. Our team is always a message away on WhatsApp if you need any help.",
        "Wishing you great success with Radhika Traders.",
    ]
    return paras


async def send_welcome_email(to: str, name: str, referral_code: str, signup_bonus: float, dashboard_link: str) -> str | None:
    if not to:
        return None
    subject = f"Welcome to Radhika Traders, {_first(name)} — you are now our partner"
    paras = welcome_letter_paragraphs(name, referral_code, signup_bonus)
    body = "".join(f'<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 12px">{p}</p>' for p in paras)
    inner = (
        f'<div style="font-size:11px;letter-spacing:2px;color:#B45309;font-weight:bold">WELCOME LETTER</div>'
        f'<div style="font-size:22px;font-weight:bold;color:#0B0F17;margin:4px 0 16px">Congratulations, {escape(_first(name))}!</div>'
        f'{body}'
        f'<p style="margin:18px 0 6px"><a href="{escape(dashboard_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;'
        f'border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open my dashboard</a></p>'
        f'<p style="font-size:11px;color:#64748b">This letter is always available in your Profile.</p>'
        f'{_signature()}'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_report_email(to: str, name: str, title: str, note: str, link: str, expires_on: str) -> str | None:
    if not to:
        return None
    subject = f"{_first(name)}, a new report is ready for you — {title}"
    note_html = f'<p style="font-size:14px;color:#334155;line-height:1.6">{escape(note)}</p>' if note else ""
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
        f'<p style="font-size:14px;color:#334155">Radhika Traders has shared a new file with you: <b>{escape(title)}</b>.</p>'
        f'{note_html}'
        f'<p style="margin:18px 0 6px"><a href="{escape(link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;'
        f'border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open Reports &amp; download</a></p>'
        f'<p style="font-size:12px;color:#64748b">Log in to your dashboard → <b>Reports</b> to download it. This file stays available until <b>{escape(expires_on)}</b> (7 days) and is then removed automatically.</p>'
        f'{_signature()}'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_admin_withdrawal_alert(to: str, w: dict, customer_id: str, when_ist: str, review_link: str) -> str | None:
    if not to:
        return None
    amount = f"₹{w.get('amount', 0):,.0f}" if float(w.get("amount", 0)).is_integer() else f"₹{w.get('amount', 0):,.2f}"
    subject = f"New withdrawal request — {w.get('user_name', 'Customer')} · {amount}"
    rows = [("Customer", w.get("user_name", "")), ("Customer ID", customer_id), ("Withdrawal Amount", amount), ("Date & Time", when_ist),
            ("Method", f"{w.get('method', '')} · {w.get('details', '')}"), ("Status", "Pending")]
    table = "".join(f'<tr><td style="padding:5px 12px 5px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td>'
                    f'<td style="padding:5px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">🔔 <b>New Withdrawal Request</b></p>'
        f'<table style="border-collapse:collapse;margin:6px 0 14px">{table}</table>'
        f'<p style="margin:14px 0 6px"><a href="{escape(review_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;'
        f'border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open &amp; review in Admin Panel</a></p>'
        f'<p style="font-size:12px;color:#64748b">Admin Panel → Withdrawals → Pending. This request is waiting for your approval.</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def _leave_rows(l: dict) -> str:
    rng = l["from_date"] if l["from_date"] == l["to_date"] else f'{l["from_date"]} → {l["to_date"]}'
    rows = [("Employee", f'{l.get("employee_name", "")} ({l.get("employee_code", "")})'), ("Dates", rng), ("Working days", str(l.get("days", 0))),
            ("Type", str(l.get("leave_type", "")).title()), ("Reason", l.get("reason", ""))]
    if l.get("admin_note"):
        rows.append(("Admin note", l["admin_note"]))
    return "".join(f'<tr><td style="padding:6px 10px 6px 0;font-size:13px;color:#64748b;white-space:nowrap">{escape(k)}</td><td style="padding:6px 0;font-size:13px;color:#0B0F17;font-weight:bold">{escape(str(v))}</td></tr>' for k, v in rows)


async def send_leave_request_email(to: str, name: str, l: dict, review_link: str) -> str | None:
    if not to:
        return None
    subject = f"Leave request: {l.get('employee_name', '')} · {l.get('days', 0)} day(s) from {l['from_date']}"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">A new leave request is waiting for your one-tap approval.</p>'
             f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{_leave_rows(l)}</table>'
             f'<p style="margin:16px 0 6px"><a href="{escape(review_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Approve / Reject in Admin Panel</a></p>'
             f'<p style="font-size:12px;color:#64748b;margin-top:16px">Approve as <b>Paid</b> (no salary cut) or <b>Unpaid</b> (that day\'s salary is deducted automatically).</p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_leave_decision_email(to: str, name: str, l: dict, label: str, portal_link: str) -> str | None:
    if not to:
        return None
    approved = l.get("status") == "approved"
    subject = f"Leave {label.lower()} — {l['from_date']}" if not approved else f"Leave approved ({'Paid' if l.get('paid') else 'Unpaid'}) — {l['from_date']}"
    color = "#15803d" if approved else "#991B1B"
    note = ("No salary will be deducted for these days." if l.get("paid") else "These days are unpaid — the salary for them will be deducted in your monthly salary sheet.") if approved else "Please contact the admin if you have any questions."
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">Your leave request has been <b style="color:{color}">{escape(label)}</b> by the admin.</p>'
             f'<table style="border-collapse:collapse;margin:8px 0 14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{_leave_rows(l)}</table>'
             f'<p style="font-size:13px;color:#334155">{note}</p>'
             f'<p style="margin:16px 0 6px"><a href="{escape(portal_link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">View in Employee Panel</a></p>')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def campaign_status_html(name: str, c: dict, status: str, link: str) -> tuple[str, str]:
    """Pause / Close / Resume (live again) notice for an existing campaign."""
    first, offer = _first(name), c.get("offer_name", "a campaign")
    cfg = {
        "paused": ("paused", "#b45309", f"{first}, {offer} is paused for now",
                   "This campaign is <b>temporarily paused</b>. Please do not share its link until it is live again — new leads submitted while paused may not be counted. We will email you the moment it resumes."),
        "closed": ("closed", "#991B1B", f"{first}, {offer} has been closed",
                   "This campaign is now <b>closed</b>. Its referral link no longer accepts new leads. Earnings for leads already approved stay safe in your wallet."),
        "live": ("live again", "#15803d", f"{first}, {offer} is LIVE again",
                 "Good news — this campaign is <b>live again</b>. Your referral link is active; start sharing and earning right away."),
    }[status]
    word, color, subject, body = cfg
    details = [f"Company: {c.get('company', '')}", f"Payout: Rs.{c.get('payout_amount', 0):g} {c.get('payout_type', '')}".strip(), f"Status: {word.upper()}"]
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(first)},</p>'
             f'<p style="font-size:14px;color:#334155">Campaign <b>{escape(offer)}</b> is now <b style="color:{color}">{escape(word)}</b>.</p>'
             f'<p style="font-size:14px;color:#334155">{body}</p>'
             f'<ul style="font-size:13px;color:#334155;padding-left:18px">{"".join(f"<li>{escape(d)}</li>" for d in details)}</ul>'
             + (f'<p style="margin:16px 0 6px"><a href="{escape(link)}" style="display:inline-block;background:#991B1B;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open your referral link</a></p>' if status == "live" else
                f'<p style="margin:16px 0 6px"><a href="{escape(link)}" style="display:inline-block;background:#0B0F17;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Open your dashboard</a></p>'))
    return _wrap(subject, inner), subject


async def send_campaign_status_email(to: str, name: str, c: dict, status: str, link: str) -> str | None:
    if not to:
        return None
    html, subject = campaign_status_html(name, c, status, link)
    return await send_email(to=to, subject=subject, html=html)
