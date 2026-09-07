"""Emergent managed email (Resend) with guardrail gate."""
import os
import re
import ipaddress
import logging
import httpx
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

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


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return None


def _wrap(title: str, inner: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="480" style="background:#ffffff;border-radius:12px;'
        'border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;overflow:hidden">'
        '<tr><td style="background:#991B1B;padding:20px 28px">'
        '<span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px">RADHIKA TRADERS</span>'
        '<div style="color:#F59E0B;font-size:11px;letter-spacing:1px;margin-top:2px">TRUSTED PARTNER FOR FINANCIAL GROWTH</div>'
        '</td></tr>'
        f'<tr><td style="padding:28px">{inner}</td></tr>'
        '<tr><td style="padding:16px 28px;background:#0B0F17;color:#94a3b8;font-size:11px">'
        'Sent by Radhika Traders. We never ask for your password or card details by email.'
        '</td></tr>'
        '</table></td></tr></table>'
    )


async def send_otp_email(to: str, name: str, code: str, purpose: str) -> str | None:
    reason = "verify your account" if purpose == "signup" else "reset your password"
    subject = f"Your Radhika Traders verification code: {code}"
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "there")},</p>'
        f'<p style="font-size:14px;color:#334155">Use the code below to {reason}. '
        f'It is valid for 10 minutes.</p>'
        f'<div style="margin:24px 0;text-align:center">'
        f'<span style="display:inline-block;background:#fef2f2;border:1px dashed #991B1B;'
        f'border-radius:10px;padding:16px 28px;font-size:32px;font-weight:bold;letter-spacing:8px;'
        f'color:#991B1B">{escape(code)}</span></div>'
        f'<p style="font-size:12px;color:#94a3b8">If you did not request this, you can safely ignore this email.</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_payment_email(to: str, name: str, amount: float, method: str, details: str, utr: str, proof_link: str) -> str | None:
    if not to:
        return None
    amt = f"₹{amount:g}"
    date = datetime.now(timezone.utc).strftime("%d %b %Y")
    subject = f"🎉 Payment Successful – Your {amt} Payout Has Been Processed"
    rows = [("💰 Payout Amount", amt), ("💳 Payment Method", method), ("✅ Status", "Paid Successfully"), ("📅 Payment Date", date), ("Paid to", details)]
    if utr:
        rows.append(("UTR / Ref No.", utr))
    table = "".join(
        f'<tr><td style="padding:8px 0;color:#64748b;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:8px 0;text-align:right;font-weight:bold;color:#0B0F17;font-size:13px">{escape(str(v))}</td></tr>'
        for k, v in rows)
    proof = (f'<p style="margin:20px 0 0;text-align:center"><a href="{escape(proof_link)}" '
             f'style="display:inline-block;background:#991B1B;color:#fff;padding:12px 26px;border-radius:999px;'
             f'text-decoration:none;font-weight:bold;font-size:13px">View Payment Proof</a></p>') if proof_link else ""
    inner = (
        f'<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:22px;text-align:center">'
        f'<div style="font-size:26px;font-weight:800;color:#047857">💚 {amt} PAID SUCCESSFULLY ✓</div>'
        f'<div style="font-size:13px;color:#065f46;margin-top:4px;font-weight:bold">Payment Successful</div></div>'
        f'<p style="font-size:15px;color:#0B0F17;margin-top:22px">Hi {escape(name or "Partner")}, 👋</p>'
        f'<p style="font-size:14px;color:#334155">🎉 Good News! Your payout has been successfully processed. '
        f'Payment has been sent successfully to your registered {escape(method)} account.</p>'
        f'<div style="font-size:12px;font-weight:bold;color:#991B1B;letter-spacing:1px;margin-top:18px">PAYMENT DETAILS</div>'
        f'<table width="100%" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:8px 0">{table}</table>'
        f'{proof}'
        f'<p style="font-size:12px;color:#64748b;margin-top:18px">Please allow a few minutes for the amount to reflect in your account.</p>'
        f'<div style="margin-top:24px;padding-top:16px;border-top:1px dashed #e2e8f0;text-align:center">'
        f'<div style="font-size:14px;font-weight:bold;color:#047857">💚 Thank You for Partnering With Us</div>'
        f'<div style="font-size:12px;color:#64748b;margin-top:4px">We appreciate your continued trust and support.</div>'
        f'<div style="font-size:13px;font-weight:bold;color:#0B0F17;margin-top:14px">Radhika Traders</div>'
        f'<div style="font-size:11px;color:#F59E0B;letter-spacing:1px">TRUSTED PARTNER FOR FINANCIAL GROWTH</div>'
        f'<div style="font-size:12px;color:#334155;margin-top:8px">Harish Bhati<br><span style="color:#94a3b8">Founder | Radhika Traders</span></div></div>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def _campaign_block(c: dict, link: str) -> str:
    rows = [("💰 Payout", f"₹{c.get('payout_amount', 0):g} ({c.get('payout_type', '')})"), ("🏢 Company", c.get("company", "")),
            ("📂 Category", c.get("category", ""))]
    if c.get("fund_add"):
        rows.append(("💳 Fund Add", str(c["fund_add"])))
    if c.get("requirements"):
        rows.append(("📈 Requirement", str(c["requirements"])[:200]))
    table = "".join(f'<tr><td style="padding:6px 0;color:#64748b;font-size:13px">{escape(k)}</td>'
                    f'<td style="padding:6px 0;text-align:right;font-weight:bold;color:#0B0F17;font-size:13px">{escape(str(v))}</td></tr>' for k, v in rows if v)
    return (f'<div style="border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:16px;margin-top:16px">'
            f'<div style="font-size:18px;font-weight:800;color:#0B0F17">{escape(c.get("offer_name", ""))}</div>'
            f'<table width="100%" style="margin-top:8px">{table}</table>'
            f'<p style="margin:16px 0 0;text-align:center"><a href="{escape(link)}" style="display:inline-block;background:#991B1B;color:#fff;'
            f'padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:13px">👉 View Campaign</a></p></div>')


def _signature() -> str:
    return ('<div style="margin-top:22px;font-size:12px;color:#334155"><b>Radhika Traders | Harish Bhati</b><br>'
            '<span style="color:#F59E0B">Trusted Partner for Financial Growth</span></div>')


async def send_campaign_live_email(to: str, name: str, c: dict, link: str) -> str | None:
    if not to:
        return None
    subject = "🎉 Good News! New Campaign is LIVE – Grab the Opportunity"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "Partner")}, 👋</p>'
             f'<p style="font-size:14px;color:#334155">🎉 <b>Good News! New Campaign is LIVE!</b><br>'
             f'<b>{escape(c.get("offer_name", ""))}</b> is now LIVE. 🔥 Grab the campaign and complete maximum eligible account openings.</p>'
             f'{_campaign_block(c, link)}{_signature()}')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_broadcast_email(to: str, name: str, subject: str, message: str, c: dict | None, link: str) -> str | None:
    if not to:
        return None
    body = "".join(f'<p style="font-size:14px;color:#334155;margin:0 0 10px">{escape(p)}</p>' for p in message.split("\n") if p.strip())
    inner = f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "Partner")}, 👋</p>{body}'
    if c:
        inner += _campaign_block(c, link)
    inner += _signature()
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))
