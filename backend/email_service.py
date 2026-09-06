"""Emergent managed email (Resend) with guardrail gate."""
import os
import re
import ipaddress
import logging
import httpx
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
