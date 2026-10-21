#!/usr/bin/env python3
"""Build data/letter-days.json -- every letter day of the school year, for the homepage.

Source: each school's own public Google Calendar, kept by the district. Every school
day has one all-day event titled "A" Day / "B" Day / ...; days off have a
"NO SCHOOL - ..." event. Same rules as api/letter-days.php, but for the whole year
and saved as a plain file, so the homepage card doesn't depend on PHP at all.

Runs every morning in .github/workflows/lunch-menus.yml. If a school's calendar can't
be read, that school keeps yesterday's data instead of going blank.

    python3 tools/letter_days.py
"""
import datetime as dt
import json
import os
import re
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'letter-days.json')
FEEDS = {
    'jefferson': 'b8ps3245btumu5q6psc3cmvs8c@group.calendar.google.com',
    'middle': 'eumk9qp2llrljnfkp64k1dgk5g@group.calendar.google.com',
    'high': '8b7ohsc70vgab6398itc7e73q0@group.calendar.google.com',
}
LETTER = re.compile(r'^["“”\']?([A-F])["“”\']?\s*-?\s*Day$', re.I)
NO_SCHOOL = re.compile(r'\bno school\b', re.I)


def school_year(today):
    """Jul 1 – Aug 31 of the school year we're in (summer counts toward the coming year)."""
    start = today.year if today.month >= 7 else today.year - 1
    return dt.date(start, 7, 1), dt.date(start + 1, 8, 31)


def fetch(cal_id):
    url = 'https://calendar.google.com/calendar/ical/' + urllib.parse.quote(cal_id) + '/public/basic.ics'
    req = urllib.request.Request(url, headers={'User-Agent': 'SchalmontPTO/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode('utf-8', 'replace')
    if 'BEGIN:VCALENDAR' not in body:
        raise ValueError('not a calendar')
    return body


def ymd(compact):
    return dt.date(int(compact[:4]), int(compact[4:6]), int(compact[6:8]))


def summarize(ics, first, last):
    ics = re.sub(r'\r?\n[ \t]', '', ics)            # unfold continuation lines
    letters, no_school, last_letter = {}, {}, None
    for ev in ics.split('BEGIN:VEVENT')[1:]:
        s = re.search(r'^SUMMARY[^:]*:(.*)$', ev, re.M)
        d = re.search(r'^DTSTART[^:]*:(\d{8})', ev, re.M)
        if not s or not d or re.search(r'^STATUS:CANCELLED', ev, re.M):
            continue
        summary = s.group(1).replace('\\,', ',').replace('\\;', ';').replace('\\n', ' ').strip()
        start = ymd(d.group(1))
        m = LETTER.match(summary)
        if m:
            if first <= start <= last:
                letters[start.isoformat()] = m.group(1).upper()
                last_letter = max(last_letter or start, start)
            continue
        if NO_SCHOOL.search(summary):
            end = start                                # all-day DTEND is exclusive
            e = re.search(r'^DTEND[^:]*:(\d{8})', ev, re.M)
            if e:
                end = max(start, ymd(e.group(1)) - dt.timedelta(days=1))
            reason = re.sub(r'^\s*no school\s*[-–—:]*\s*', '', summary, flags=re.I).strip() or 'No School'
            day = max(start, first)
            while day <= min(end, last):
                no_school[day.isoformat()] = reason
                day += dt.timedelta(days=1)
    return {'ok': bool(letters), 'letters': dict(sorted(letters.items())),
            'noSchool': dict(sorted(no_school.items())),
            'lastLetter': last_letter.isoformat() if last_letter else ''}


def main():
    first, last = school_year(dt.date.today())
    try:
        with open(OUT, encoding='utf-8') as f:
            old = json.load(f)
    except (OSError, ValueError):
        old = {'schools': {}}
    out = {'schoolYear': '%d-%d' % (first.year, last.year), 'schools': {}}
    for key, cal in FEEDS.items():
        try:
            out['schools'][key] = summarize(fetch(cal), first, last)
            info = out['schools'][key]
            print('%-9s %3d letter days, %2d days off' % (key, len(info['letters']), len(info['noSchool'])))
        except Exception as e:                         # keep yesterday's copy for this school
            print('%-9s FAILED (%s) -- keeping the previous data' % (key, e))
            out['schools'][key] = old['schools'].get(key, {'ok': False})
    if out['schools'] == old.get('schools'):
        print('no change')
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
