#!/usr/bin/env python3
"""
Build data/lunch-menus.json: what's for lunch each school day, for the homepage's
"School Lunch Menus" card.

The district only publishes menus as monthly PDF calendars on its Food Services page
(https://www.schalmont.org/district-office-services/food-services/). Every school's menu
uses the same template: a Monday-Friday grid where each day's box holds a few lines of
text. The day numbers and the boxes themselves are part of a background picture, so this
works out each item's date from WHERE its text sits on the page:

  * column  = which fifth of the calendar the text is in (Mon ... Fri)
  * week    = which row of boxes it is in (rows are found by clustering the text)
  * date    = the month/year printed at the top + the weekday the 1st falls on

Every menu is checked before it's used. If anything doesn't add up (a row missing, text
landing on a weekend, two boxes for one date ...) that school's month is left out, and the
homepage falls back to just linking the PDF. A wrong lunch is worse than no lunch.

Runs daily from .github/workflows/lunch-menus.yml. Locally:
    pip install pdfplumber && python3 tools/lunch_menus.py
"""
import calendar
import datetime as dt
import html
import io
import json
import re
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

import pdfplumber

PAGE = "https://www.schalmont.org/district-office-services/food-services/"
OUT = Path(__file__).resolve().parent.parent / "data" / "lunch-menus.json"
TZ = ZoneInfo("America/New_York")
UA = "Mozilla/5.0 (compatible; SchalmontPTO/1.0; +https://schalmontpto.com)"
SCHOOLS = ["woestina", "jefferson", "middle", "high"]
MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
MONTH_ABBR = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7,
              "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}

# The template's Monday..Friday column edges, as fractions of the page width (measured from
# the Oct 2026 menus; identical for all three). Text is centred in its box, so a word's
# centre falls well inside its column even when a long line pokes out of the box.
COL_EDGES = [0.2356, 0.4106, 0.5863, 0.7625]
# The calendar body sits between the coloured title band and the "Available Daily" footer.
BODY_TOP, BODY_BOTTOM = 0.165, 0.885
# The grid of day boxes: top of the first week's boxes, bottom of the last week's, and the
# gap between weeks (fractions of the page height; same template).
GRID_TOP, GRID_BOTTOM, GRID_GAP = 0.191, 0.874, 0.0105


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def find_pdfs(page_html):
    """{(school, monthIndex): url} for every lunch-menu PDF linked on the Food Services page."""
    found = {}
    for href, text in re.findall(r'<a\s[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>', page_html, re.I | re.S):
        label = html.unescape(re.sub(r"<[^>]+>", "", text)).lower()
        if "lunch" not in label:
            continue
        m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[_\-\s]*(20\d\d)",
                      href.rsplit("/", 1)[-1], re.I)
        if not m:
            continue
        idx = int(m.group(2)) * 12 + MONTH_ABBR[m.group(1)[:3].lower()]
        for s, word in [("woestina", "woestina"), ("jefferson", "jefferson"), ("middle", "middle"), ("high", "high")]:
            if word in label:
                found[(s, idx)] = html.unescape(href)
    return found


def weekday_rows(year, month):
    """The Mon-Fri weeks of the month, top to bottom: [[date or None x5], ...]."""
    rows = []
    for week in calendar.Calendar(firstweekday=0).monthdatescalendar(year, month):
        days = [d if d.month == month else None for d in week[:5]]
        if any(days):
            rows.append(days)
    return rows


def parse_menu(pdf_bytes):
    """Returns (year, month, {"YYYY-MM-DD": [lines]}) or raises ValueError."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        W, H = page.width, page.height
        words = page.extract_words(keep_blank_chars=True, use_text_flow=False, x_tolerance=1.5, y_tolerance=2)
        full = page.extract_text() or ""

    m = re.search(r"\b(" + "|".join(MONTHS) + r")\s+(20\d\d)\b", full, re.I)
    if not m:
        raise ValueError("no month/year title")
    year, month = int(m.group(2)), MONTHS[m.group(1).lower()]

    # 1. Words in the calendar body, sorted into the five weekday columns.
    cols = [[] for _ in range(5)]
    for w in words:
        if not (BODY_TOP * H < w["top"] < BODY_BOTTOM * H):
            continue
        cx = (w["x0"] + w["x1"]) / 2 / W
        c = sum(cx > e for e in COL_EDGES)
        if cx < 0.04 or cx > 0.96:
            continue
        cols[c].append(w)

    # 2. Weeks. The boxes sit on an evenly spaced grid that fills the calendar body
    #    (first box top .. last box bottom), however many weeks the month has.
    expected = weekday_rows(year, month)
    n = len(expected)
    pitch = (GRID_BOTTOM - GRID_TOP + GRID_GAP) / n

    def row_of(top):
        r = int((top / H - GRID_TOP + GRID_GAP / 2) // pitch)
        return min(max(r, 0), n - 1)

    # 3. Words -> lines (same baseline, same column) -> each line into its (week, weekday) box.
    days = {}
    for c, ws in enumerate(cols):
        ws.sort(key=lambda w: (round(w["top"]), w["x0"]))
        lines = []
        for w in ws:
            if lines and abs(w["top"] - lines[-1]["top"]) < 3:
                lines[-1]["words"].append(w)
            else:
                lines.append({"top": w["top"], "words": [w]})
        for ln in lines:
            text = re.sub(r"\s+", " ", " ".join(x["text"].strip() for x in sorted(ln["words"], key=lambda x: x["x0"]))).strip()
            if not text or re.fullmatch(r"\d{1,2}", text):      # stray bits of day numbers
                continue
            r = row_of(ln["top"])
            d = expected[r][c]
            if d is None:
                raise ValueError(f"text where there is no school day (week {r + 1}, col {c + 1}): {text!r}")
            days.setdefault(d.isoformat(), []).append(text)

    if not days:
        raise ValueError("no menu text found")
    filled = sum(1 for row in expected for d in row if d)
    if len(days) < filled * 0.6:
        raise ValueError(f"only {len(days)} of {filled} school days have text")
    return year, month, {k: clean(v) for k, v in sorted(days.items())}


NOTICE = re.compile(r"^(no school|no lunch|early dismissal|breakfast only|grades pre ?k|staff development|"
                    r"columbus day|national school lunch week|october \d|join us|cafeteria circus|"
                    r"[a-z]+ (day|break|recess)$|.*\b(class trip|field trip)\b)", re.I)
# Woestina's menu lists USDA meal-pattern credits ("1 ½ m/a & 1 grain", "1/8 cup r/o veg")
# for food service staff -- not useful to parents, so they're left out.
CREDIT = re.compile(r"\bm/(m/)?a\b|\br/o veg\b|^[\d¼½¾ .]*(oz\.?|ea\.?)?\s*(&|grain)", re.I)
# Serving sizes anywhere in a line: "4 oz.", "¼ cup", "8 ea.", "1oz", a trailing "¾" ...
SIZE = re.compile(r"\s*(\b\d+(\.\d+)?\s*|[¼½¾]\s*|\b\d+\s*[¼½¾]\s*)(oz\.?|ea\.?|cup)(?=\s|$|&|,)|\s+cup\b|\s+[¼½¾]$|\s+\d(?=\s+w\s*/)", re.I)


def clean(lines):
    """One day's raw lines -> {"items": [...], "notes": [...]} as a parent would read them."""
    raw = []
    for ln in lines:
        ln = re.sub(r"\s+", " ", ln.replace("\u00a0", " ")).strip()
        ln = ln.replace("W eek", "Week")
        if not ln or re.fullmatch(r"[\d\W]{1,2}", ln):          # stray digits / brackets
            continue
        if CREDIT.search(ln) and not NOTICE.search(ln):           # meal-pattern credit lines
            continue
        ln = SIZE.sub("", ln).strip()                              # "Salsa cup 2 oz." -> "Salsa"
        if not ln:
            continue
        raw.append(ln)
    # Re-join items the menu wrapped onto several lines.
    joined = []
    for ln in raw:
        low = ln.lower()
        prev = joined[-1].lower() if joined else ""
        if joined and (low in ("or", "&", "and") or re.search(r"(^|\s)(or|&|and)$", prev)
                       or re.match(r"^(w ?/|with |& )", low)):
            joined[-1] = (joined[-1] + " " + ln).replace("  ", " ")
        else:
            joined.append(ln)
    items, notes = [], []
    for ln in joined:
        if NOTICE.search(ln):
            notes.append(ln)
            continue
        ln = re.sub(r"\s+", " ", ln.replace("w / ", "w/ ")).strip(" &")
        if ln:
            items.append(ln)
    return {"items": items, "notes": notes}


def main():
    now = dt.datetime.now(TZ)
    this_idx = now.year * 12 + now.month
    try:
        page_html = fetch(PAGE).decode("utf-8", "replace")
    except Exception as e:
        print("could not read the Food Services page:", e, file=sys.stderr)
        return 0   # keep whatever data file is already published

    pdfs = find_pdfs(page_html)
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
        except Exception:
            old = {}

    out = {"source": PAGE, "schools": {}}
    by_url = {}
    for s in SCHOOLS:
        # This month and next month (menus are often posted early).
        for idx in (this_idx, this_idx + 1):
            url = pdfs.get((s, idx))
            if not url:
                continue
            if url not in by_url:
                try:
                    by_url[url] = parse_menu(fetch(url))
                except Exception as e:
                    by_url[url] = e
                    print(f"{s} {url}: skipped -- {e}", file=sys.stderr)
            res = by_url[url]
            month_key = f"{idx // 12 if idx % 12 else idx // 12 - 1}-{(idx - 1) % 12 + 1:02d}"
            entry = out["schools"].setdefault(s, {"months": {}})
            if isinstance(res, Exception):
                entry["months"][month_key] = {"pdf": url, "ok": False}
                continue
            y, mth, days = res
            entry["months"][f"{y}-{mth:02d}"] = {"pdf": url, "ok": True, "days": days}

    # Only rewrite (and so only redeploy) when the menus themselves changed.
    if {k: v for k, v in old.items() if k != "generated"} == out:
        print("no change")
        return 0
    out["generated"] = now.isoformat(timespec="seconds")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    for s, e in out["schools"].items():
        for mk, mv in e["months"].items():
            print(s, mk, "ok" if mv["ok"] else "SKIPPED", len(mv.get("days", {})), "days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
