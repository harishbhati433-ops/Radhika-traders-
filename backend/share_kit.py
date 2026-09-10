import io
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).parent / "assets"
W = H = 1080
DARK, RED, GOLD, WHITE, MUTED = (11, 15, 23), (153, 27, 27), (245, 158, 11), (255, 255, 255), (148, 163, 184)


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ASSETS / ("LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf")), size)


def qr_image(url: str, size: int = 600) -> Image.Image:
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=1)
    q.add_data(url)
    q.make(fit=True)
    return q.make_image(fill_color="black", back_color="white").convert("RGB").resize((size, size), Image.NEAREST)


def qr_png(url: str, size: int = 600) -> bytes:
    buf = io.BytesIO()
    qr_image(url, size).save(buf, "PNG")
    return buf.getvalue()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int, max_lines: int) -> list[str]:
    words, lines, cur = (text or "").split(), [], ""
    for w in words:
        t = f"{cur} {w}".strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
        if len(lines) == max_lines:
            break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and len(" ".join(lines)) < len(text or ""):
        lines[-1] = lines[-1].rstrip(".,") + "…"
    return lines


def _rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def poster_png(c: dict, link: str, partner_name: str, logo_bytes: bytes | None) -> bytes:
    img = Image.new("RGB", (W, H), DARK)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 150), fill=RED)
    d.rectangle((0, 150, W, 158), fill=GOLD)
    d.text((60, 42), "RADHIKA", font=_font(46), fill=WHITE)
    d.text((60 + d.textlength("RADHIKA ", font=_font(46)), 42), "TRADERS", font=_font(46), fill=(252, 211, 77))
    d.text((60, 100), "TRUSTED PARTNER FOR FINANCIAL GROWTH", font=_font(20), fill=(253, 230, 138))

    y = 210
    x_text = 60
    if logo_bytes:
        try:
            logo = Image.open(io.BytesIO(logo_bytes)).convert("RGB")
            logo.thumbnail((160, 160))
            canvas = Image.new("RGB", (160, 160), WHITE)
            canvas.paste(logo, ((160 - logo.width) // 2, (160 - logo.height) // 2))
            img.paste(_rounded(canvas, 28), (60, y), _rounded(canvas, 28))
            x_text = 250
        except Exception:
            pass
    name_lines = _wrap(d, c.get("offer_name", ""), _font(58), W - x_text - 60, 2)
    ty = y
    for ln in name_lines:
        d.text((x_text, ty), ln, font=_font(58), fill=WHITE)
        ty += 68
    if c.get("company"):
        d.text((x_text, ty + 4), str(c["company"]).upper(), font=_font(26), fill=GOLD)
        ty += 44
    y = max(ty, y + 170) + 30

    d.rectangle((60, y, 120, y + 6), fill=GOLD)
    y += 30
    benefit = c.get("customer_benefit") or c.get("benefits") or c.get("description") or "Open your account today with a trusted partner."
    for ln in _wrap(d, benefit, _font(34, False), W - 120, 4):
        d.text((60, y), ln, font=_font(34, False), fill=(226, 232, 240))
        y += 46

    qr_size = 400
    card = Image.new("RGB", (qr_size + 40, qr_size + 40), WHITE)
    card.paste(qr_image(link, qr_size), (20, 20))
    card_r = _rounded(card, 32)
    cx, cy = W - 60 - card.width, H - 60 - card.height
    img.paste(card_r, (cx, cy), card_r)

    bx, by = 60, cy + 30
    d.text((bx, by), "SCAN TO APPLY", font=_font(30), fill=GOLD)
    d.text((bx, by + 46), "Open your phone camera and", font=_font(26, False), fill=(226, 232, 240))
    d.text((bx, by + 82), "point it at this QR code.", font=_font(26, False), fill=(226, 232, 240))
    if partner_name:
        d.text((bx, by + 150), "Shared by", font=_font(22, False), fill=MUTED)
        for i, ln in enumerate(_wrap(d, partner_name, _font(34), cx - bx - 30, 1)):
            d.text((bx, by + 178 + i * 40), ln, font=_font(34), fill=WHITE)
    d.text((bx, by + 250), "Free · No investment · Radhika Traders partner", font=_font(22, False), fill=MUTED)
    d.text((bx, by + 292), "www.radhikatraders.net", font=_font(26), fill=(252, 211, 77))
    d.text((bx, by + 334), "WhatsApp +91 63765 41191", font=_font(22, False), fill=MUTED)

    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
