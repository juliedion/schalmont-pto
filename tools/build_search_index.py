#!/usr/bin/env python3
"""Build data/search-index.json for the homepage search box.

Reads every public top-level *.html page and records its title, description,
headings and the distinct words of its visible text, plus each question and
answer on faq.html. Runs on every deploy (.github/workflows/deploy.yml), so a
new or edited page is searchable as soon as it goes live -- nothing to update by hand.

    python3 tools/build_search_index.py
"""
import html
import json
import os
import re
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'search-index.json')

# Not for parents: admin tools, staff-only sign-ups, duplicates and stubs.
SKIP = {
    'index.html', 'admin-users.html', 'cancel-booking.html', 'p.html', 'pending.html',
    'send-blast.html', 'tat-teacher-order.html', 'massage-signup.html', 'raffle-signup.html',
    'casinoroyale.html',
}
SKIP_TAGS = {'script', 'style', 'noscript', 'svg', 'header', 'nav', 'footer', 'aside', 'template', 'dialog'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
STOP = set("""a about after all also an and any are as at be been before but by can could did do does
for from had has have he her his how i if in into is it its just may more most my no not of on one
only or our out over she so some such than that the their them then there these they this to too up
us was we were what when where which who will with you your yours here more page click see view
schalmont pto""".split())
TITLE_SUFFIX = re.compile(r'\s*[|—–-]\s*Schalmont PTO\s*$', re.I)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.desc = '', ''
        self.heads, self.text = [], []
        self.faqs = []           # (group id, question, answer)
        self._stack = []         # open tags: (tag, skipping?)
        self._in_title = False
        self._head = None        # collecting an h1-h3
        self._group = ''         # current faq-group id
        self.group_names = {}    # faq-group id -> its heading ("Schalmont Central PTO")
        self._faq = None         # [question, answer] while inside a faq-item
        self._in_summary = False

    @property
    def skipping(self):
        return any(s for _, s in self._stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and a.get('name') == 'description' and not self.desc:
            self.desc = (a.get('content') or '').strip()
        if tag in VOID:
            return
        cls = a.get('class') or ''
        skip = tag in SKIP_TAGS or a.get('id') in ('sc-header', 'sc-sidenav', 'sc-footer') \
            or any(c in cls for c in ('partners-section', 'site-header', 'homepage-sidenav', 'homepage-adrail', 'footer-ad'))
        self._stack.append((tag, skip))
        if tag == 'title':
            self._in_title = True
        if tag in ('h1', 'h2', 'h3') and not self.skipping:
            self._head = []
        if tag == 'section' and 'faq-group' in cls:
            self._group = a.get('id') or ''
        if tag == 'details' and 'faq-item' in cls:
            self._faq = ['', '']
        if tag == 'summary' and self._faq is not None:
            self._in_summary = True

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] == tag:
                del self._stack[i:]
                break
        if tag == 'title':
            self._in_title = False
        if tag in ('h1', 'h2', 'h3') and self._head is not None:
            h = clean(' '.join(self._head))
            if h:
                self.heads.append(h)
                if tag == 'h2' and self._group and self._group not in self.group_names:
                    self.group_names[self._group] = h
            self._head = None
        if tag == 'summary':
            self._in_summary = False
        if tag == 'details' and self._faq is not None:
            q, ans = clean(self._faq[0]), clean(self._faq[1])
            if q:
                self.faqs.append((self._group, q, ans))
            self._faq = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
            return
        if self.skipping:
            return
        self.text.append(data)
        if self._head is not None:
            self._head.append(data)
        if self._faq is not None:
            self._faq[0 if self._in_summary else 1] += ' ' + data


def clean(s):
    s = re.sub(r'[\U0001F000-\U0001FFFF☀-➿️]', '', s)   # emoji
    return re.sub(r'\s+', ' ', s).strip()


def keywords(text, already):
    seen, out = set(already), []
    for w in re.findall(r"[a-z0-9][a-z0-9'’]*", text.lower()):
        w = w.strip("'’")
        if len(w) < 3 or w in STOP or w in seen or w.isdigit() and len(w) != 4:
            continue
        seen.add(w)
        out.append(w)
    return ' '.join(out[:300])


def main():
    pages, faqs = [], []
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.html') or name in SKIP:
            continue
        with open(os.path.join(ROOT, name), encoding='utf-8', errors='replace') as f:
            p = Page()
            p.feed(f.read())
        title = TITLE_SUFFIX.sub('', clean(html.unescape(p.title))) or name[:-5]
        heads = list(dict.fromkeys(h for h in p.heads if h.lower() != title.lower()))[:12]
        base = (title + ' ' + ' '.join(heads) + ' ' + p.desc).lower()
        pages.append({
            'u': name,
            't': title,
            'd': clean(p.desc),
            'h': ' · '.join(heads),
            'k': keywords(' '.join(p.text), set(re.findall(r'[a-z0-9]+', base))),
        })
        for group, q, ans in p.faqs:
            faqs.append({'u': name + ('#' + group if group else ''), 'q': q, 'a': ans, 'g': p.group_names.get(group, '')})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'pages': pages, 'faqs': faqs}, f, ensure_ascii=False, separators=(',', ':'))
    print('search index: %d pages, %d FAQs, %d KB' % (len(pages), len(faqs), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
