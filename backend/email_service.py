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
        '<div style="max-width:560px;margin:0 auto;padding:16px 4px;font-family:Arial,Helvetica,sans-serif;color:#0B0F17">'
        f'{inner}'
        '<p style="margin-top:24px;font-size:11px;color:#94a3b8">Radhika Traders, Agar, Madhya Pradesh. We never ask for your password, OTP or card details by email.</p>'
        '</div>'
    )


async def send_otp_email(to: str, name: str, code: str, purpose: str) -> str | None:
    reason = "verify your account" if purpose == "signup" else "reset your password"
    subject = f"{code} is your Radhika Traders verification code"
    inner = (
        f'<p style="font-size:15px;color:#0B0F17">Hi {escape(name or "there")},</p>'
        f'<p style="font-size:14px;color:#334155">You requested to {reason}. Your one-time code is:</p>'
        f'<div style="margin:20px 0"><span style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0B0F17">{escape(code)}</span></div>'
        f'<p style="font-size:14px;color:#334155">This code is valid for 10 minutes. Please do not share it with anyone.</p>'
        f'<p style="font-size:12px;color:#94a3b8">If you did not request this, you can ignore this email.</p>'
        f'<p style="font-size:13px;color:#334155;margin-top:20px">Regards,<br>Harish Bhati<br>Radhika Traders</p>'
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
        f'<p style="font-size:13px;color:#334155;margin-top:20px">Thank you for partnering with us.<br>Harish Bhati<br>Founder, Radhika Traders</p>'
    )
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


def _campaign_block(c: dict, link: str) -> str:
    lines = [f"Payout: Rs.{c.get('payout_amount', 0):g} {c.get('payout_type', '')}".strip()]
    if c.get("company"):
        lines.append(f"Company: {c['company']}")
    if c.get("fund_add"):
        lines.append(f"Fund add: {c['fund_add']}")
    if c.get("requirements"):
        lines.append(f"Requirement: {str(c['requirements'])[:200]}")
    body = "<br>".join(escape(x) for x in lines)
    return (f'<p style="font-size:14px;color:#0B0F17;margin:14px 0"><b>{escape(c.get("offer_name", ""))}</b><br>{body}</p>'
            f'<p style="font-size:14px;color:#334155;margin:14px 0">Your personal link for this campaign:<br>'
            f'<a href="{escape(link)}" style="color:#991B1B">{escape(link)}</a></p>')


def _signature() -> str:
    return ('<p style="margin-top:20px;font-size:14px;color:#334155">Any question? Just reply to this email, I read every message.</p>'
            '<p style="font-size:14px;color:#334155">Regards,<br>Harish Bhati<br>Radhika Traders</p>')


def _first(name: str) -> str:
    return (name or "Partner").strip().split()[0]


async def send_campaign_live_email(to: str, name: str, c: dict, link: str) -> str | None:
    if not to:
        return None
    subject = f"{_first(name)}, {c.get('offer_name', 'a new campaign')} is live on your dashboard"
    inner = (f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>'
             f'<p style="font-size:14px;color:#334155">I have just made <b>{escape(c.get("offer_name", ""))}</b> live for you. '
             f'Here are the details so you can start sharing today.</p>'
             f'{_campaign_block(c, link)}{_signature()}')
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))


async def send_broadcast_email(to: str, name: str, subject: str, message: str, c: dict | None, link: str) -> str | None:
    if not to:
        return None
    body = "".join(f'<p style="font-size:14px;color:#334155;margin:0 0 10px">{escape(p)}</p>' for p in message.split("\n") if p.strip())
    inner = f'<p style="font-size:15px;color:#0B0F17">Hi {escape(_first(name))},</p>{body}'
    if c:
        inner += _campaign_block(c, link)
    inner += _signature()
    return await send_email(to=to, subject=subject, html=_wrap(subject, inner))
