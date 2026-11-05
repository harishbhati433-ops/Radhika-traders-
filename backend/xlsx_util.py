"""Tiny Excel writer on openpyxl only (pandas+numpy would add ~60 MB RSS on the 200 MB Starter plan)."""
import io


def xlsx_bytes(rows: list[dict], cols: list[str], sheet: str = "Sheet1", max_width: int = 45) -> io.BytesIO:
    from openpyxl import Workbook
    from openpyxl.styles import Font
    wb = Workbook()
    ws = wb.active
    ws.title = (sheet or "Sheet1")[:30]
    ws.append(list(cols))
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([_cell(r.get(c, "")) for c in cols])
    for i, c in enumerate(cols, 1):
        width = max([len(str(c))] + [len(str(r.get(c, ""))) for r in rows[:500]]) + 2
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(max(width, 10), max_width)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _cell(v):
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    return str(v)
