#!/usr/bin/env python3
"""Write the site's menus -- the top navigation and the left sidebar -- into every public page.

Both are defined ONCE, below. Running this script replaces the
<header class="site-header">…</header> and <aside class="homepage-sidenav">…</aside>
on every top-level page, updates the copies inside js/site-chrome.js (pages that draw
their chrome with JavaScript), and makes sure each page loads css/menus.css and
js/menus.js exactly once. Edit the lists here, run it, and every page matches:

    python3 tools/build_chrome.py

Each school's event pages are added to the sidebar at page load by js/page-menu.js.
"""
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCHOOLS = [
    # key, name, grades, colour, school page, [(chip label, class page), ...]
    # Woestina Pre-K is part of Jefferson: its Pre-K class page is listed here.
    ('jefferson', 'Jefferson Elementary', 'Pre-K–4 · incl. Woestina', '#6bb044', 'jefferson.html',
     [('Pre-K', 'classof2040.html'), ('K', 'classof2039.html'), ('1st', 'classof2038.html'), ('2nd', 'classof2037.html'),
      ('3rd', 'classof2036.html'), ('4th', 'classof2035.html')]),
    ('middle', 'Middle School', 'Grades 5–8', '#087d40', 'middle-school.html',
     [('5th', 'classof2034.html'), ('6th', 'classof2033.html'), ('7th', 'classof2032.html'),
      ('8th', 'classof2031.html')]),
    ('high', 'High School', 'Grades 9–12', '#044d2a', 'high-school.html',
     [('Fr', 'classof2030.html'), ('So', 'classof2029.html'), ('Jr', 'classof2028.html'),
      ('Sr', 'classof2027.html')]),
]
# The left menu's main list (Julie, Oct 2026): one alphabetical list, all the same size.
# (label, link, match) -- `match` is a regex: calendar events whose title matches it are
# already covered by this item, so js/menus.js won't add them again from
# data/sidebar-events.json (every other upcoming PTO event is added, alphabetically).
# No backslashes in these: the menu is also stored inside a JavaScript string (js/site-chrome.js).
MAIN_ITEMS = [
    ('Brawl for the Ball', '/brawlfortheball', r'brawl'),
    ('Cheesy Fundraiser', '/event?t=cheesy-fundraiser', r'cheesy'),
    ('Charleston Wrap Fundraiser', '/jefferson/fallfr', r'charleston'),
    ('Coupon Books', 'couponbook.html', r'coupon'),
    ('Dances', 'dances.html', r'dance'),
    ('Directory', 'directory.html', ''),
    ('Donate', 'donate.html', ''),
    ('Events Calendar', 'index.html#calendar', ''),
    ('FAQs', 'faq.html', ''),
    ('Clubs', 'middle-school.html#announcements', r'club'),
    ('Food Drive', '/event?t=holiday-food-drive-holiday-boxes', r'food drive'),
    ('Giftcards', 'giftcards.html', r'gift ?cards?'),
    ('Holiday Catalog Fundraiser', 'holiday.html', r'holiday catalog'),
    ('Holiday Shoppe', 'holiday-shoppe.html', r'holiday shoppe'),
    ('PTO Meetings', 'meetings.html', r'meeting'),
    ('Merry Morning with Santa', 'craft-fair-santa.html', r'merry morning'),
    ('Picture Days', 'picture-days.html', r'picture'),
    ('School Spirit Fridays', '/event?t=school-spirit-friday', r'school spirit friday'),
    ('Spiritwear Shoppe', 'shop.html', r'spiritwear'),
    ('Sports', 'sports.html', ''),
    ('Trail of Treats', '/trailoftreats', r'trail of treats'),
    ('Yearbooks', 'yearbooks.html', r'yearbook'),
]
# Shown under "Partners" (no arrows, Julie). Full addresses open in a new tab.
PARTNER_GROUPS = [('Student Council', 'student-council.html'), ('Sabre Nation', 'partners.html#sabre-nation'),
                  ('Schalmont Athletic Association', 'https://www.schalmont.org/middle-school/schalmont-athletic-association/'),
                  ('Friends of Music', 'https://www.schalmont.org/friends-of-music/'),
                  ('Friends of the Library', 'https://sites.google.com/schalmont.net/friendsofschalmontlibraries/home'),
                  ('Scouts', 'https://www.troop3054.org/'),
                  ('Girl Scouts', 'https://www.girlscoutsneny.org')]
ABOUT_ITEMS = [('About us', 'about.html'), ('Contact Us', 'contact.html'), ('Social Media', 'social.html')]
# Extra blocks shown at the top of the sidebar on specific pages (below the search box).
GIFT_CARD_AD = '\n'.join([
    '  <a href="giftcards.html" class="sidenav-gc-ad">',
    # data-soon: js/spiritwear-shop.js removes this badge once "comingSoon" is false
    '    <b class="sidenav-gc-soon" data-soon>Coming soon</b>',
    '    <img src="images/spiritwear/giftcard.webp" alt="Schalmont Spiritwear Shoppe gift card">',
    '    <strong>Give the gift of Sabre spirit!</strong>',
    '    <span>Gift cards delivered to school, to a home, or shipped wrapped &amp; addressed.</span>',
    '    <em>See gift cards →</em>',
    '  </a>'])
SIDEBAR_EXTRA = {'shop.html': GIFT_CARD_AD, 'couponbook.html': GIFT_CARD_AD}
ICON = {
    'search': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    'home': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    'cal': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    'chev': '<svg class="sn-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
}


# Each school's own yearbook page.
YEARBOOK = {'jefferson': 'yearbook-jefferson.html', 'middle': 'yearbook-middle.html', 'high': 'yearbook-high.html'}

# Extra pages listed under a school in the sidebar (after Yearbook).
EXTRA_LINKS = {'middle': [('5th Grade Dance', '5th-grade-dance.html'), ('6th & 7th Grade Dance', '6th-7th-grade-dance.html'),
                          ('8th Grade Dance', '8th-grade-dance.html')]}

TOP_MENUS = [
    ('Families', [('Picture days', 'picture-days.html'), ('Yearbooks', 'yearbooks.html'),
                  ('Lunch menus', 'index.html#hz-lunch'), ('Parent directory', 'directory.html'),
                  ('Photo gallery', 'gallery.html'), ('Sports', 'sports.html'), ('Scouts', 'family-scouts.html')]),
    ('Support', [('Volunteer', 'volunteer.html'), ('Donate', 'donate.html'), ('Fundraisers', 'fundraisers.html'),
                 ('Spirit shop', 'shop.html'), ('Gift cards', 'giftcards.html'), ('Coupon book', 'couponbook.html'),
                 ('Partner groups', 'partners.html')]),
    ('About', [('About the PTO', 'about.html'), ('Jefferson Elementary PTO', 'about.html#jefferson-pto'),
               ('Schalmont Central PTO', 'about.html#schalmont-central-pto'), ('Meetings', 'meetings.html'),
               ('FAQs', 'faq.html'), ('Contact us', 'contact.html'), ('Social media', 'social.html')]),
]
SOCIAL = [
    ('Facebook', 'https://www.facebook.com/groups/schalmontpto/', 'background:#1877F2',
     '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>'),
    ('Instagram', 'https://www.instagram.com/schalmontpto/', 'background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%)',
     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>'),
]


def header(p, style=''):
    """The top navigation. p = '' (root pages) or '/' (js/site-chrome.js)."""
    e = html.escape
    down = '<svg class="sh-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
    schools = ''.join(
        f'<a class="sh-school" href="{p}{page}" style="--sc:{colour}"><span class="sh-dot" aria-hidden="true"></span>'
        f'<span><b>{e(name)}</b><small>{e(grades)}</small></span></a>'
        for key, name, grades, colour, page, classes in SCHOOLS)
    menus = ''.join(
        f'<li class="sh-has"><button type="button" class="sh-top" aria-expanded="false">{e(label)}{down}</button>'
        f'<div class="sh-drop">' + ''.join(f'<a href="{p}{href}">{e(t)}</a>' for t, href in links) + '</div></li>'
        for label, links in TOP_MENUS)
    social = ''.join(f'<a class="sh-social" href="{u}" target="_blank" rel="noopener" aria-label="{n}" style="{st};color:#fff">{svg}</a>'
                     for n, u, st, svg in SOCIAL)
    st = f' style="{style}"' if style else ''
    return '\n'.join([
        f'<header class="site-header sh"{st}>',
        '  <nav class="sh-inner" aria-label="Main">',
        f'    <a href="{p}index.html" class="sh-brand" aria-label="Schalmont PTO home">',
        f'      <img src="{p}images/logo-web.png" alt="Schalmont Central PTO" width="360" height="230">',
        f'      <img src="{p}images/jes-pto-tiger-web.png" alt="Jefferson Elementary PTO" width="422" height="300">',
        '    </a>',
        '    <button type="button" class="sh-toggle" id="sh-toggle" aria-expanded="false" aria-controls="sh-menu">'
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></button>',
        '    <div class="sh-menu" id="sh-menu">',
        '      <ul class="sh-list">',
        f'        <li><a class="sh-top" href="{p}index.html">Home</a></li>',
        f'        <li class="sh-has"><button type="button" class="sh-top" aria-expanded="false">Schools{down}</button>'
        f'<div class="sh-drop sh-drop-schools">{schools}<a class="sh-all" href="{p}schools.html">All schools →</a></div></li>',
        f'        <li><a class="sh-top" href="{p}index.html#calendar">Calendar</a></li>',
        f'        <li><a class="sh-top" href="{p}yearbooks.html">Yearbooks</a></li>',
        '        ' + menus,
        f'        <li><a class="sh-top" href="{p}contact.html">Contact</a></li>',
        '      </ul>',
        '      <div class="sh-actions">',
        f'        <a class="sh-icon" href="{p}index.html#search" aria-label="Search the site">{ICON["search"]}</a>',
        f'        <a class="sh-login" id="nav-login-btn" href="{p}login.html">Login</a>',
        '        ' + social,
        f'        <a class="sh-cta" href="{p}get-involved.html">Get Involved</a>',
        '      </div>',
        '    </div>',
        '  </nav>',
        '</header>'])


def sidebar(p, extra=''):
    """p = '' for pages at the site root, '/' for js/site-chrome.js (absolute links).
    extra = a page's SIDEBAR_EXTRA block, placed just under the search box."""
    e = html.escape
    out = ['<aside class="homepage-sidenav sn" aria-label="Site menu">',
           f'  <form class="sn-search" action="{p}index.html" role="search">',
           '    <label class="sn-sr" for="sn-q">Search the site</label>',
           f'    {ICON["search"]}<input id="sn-q" name="q" type="search" placeholder="Search the site" autocomplete="off">',
           '  </form>'] + ([extra] if extra else []) + [
           f'  <a class="sn-item" href="{p}index.html">Home</a>']
    def link(t, href, cls='sn-item', match=''):
        full = href if href.startswith(('http', '/')) else p + href
        ext = ' target="_blank" rel="noopener"' if href.startswith('http') else ''
        m = f' data-match="{e(match)}"' if match else ''
        return f'<a class="{cls}" href="{e(full)}"{ext}{m}>{e(t)}</a>'
    # Main list: fixed items + Partners (with its groups); js/menus.js adds calendar events and sorts.
    out.append('  <nav class="sn-main" aria-label="PTO events and pages">')
    for t, href, match in MAIN_ITEMS:
        out.append('    ' + link(t, href, match=match))
    out.append('    <div class="sn-row" data-sort="Partners">' + link('Partners', 'partners.html') +
               '<div class="sn-children">' + ''.join(link(t, h, 'sn-item sn-child') for t, h in PARTNER_GROUPS) + '</div></div>')
    out.append('  </nav>')
    out.append('  <hr class="sn-div">')
    out += ['  ' + link(t, h) for t, h in ABOUT_ITEMS]
    out.append('  <hr class="sn-div">')
    out.append('  <div class="sn-label">Schools</div>')
    for key, name, grades, colour, page, classes in SCHOOLS:
        chips = ''.join(f'<a href="{p}{href}">{e(lbl)}</a>' for lbl, href in classes)
        out += [
            f'  <div class="sn-school" style="--sc:{colour}">',
            f'    <button type="button" class="sn-school-btn" aria-expanded="false" aria-controls="snav-{key}">',
            f'      <span class="sn-dot" aria-hidden="true"></span><span class="sn-school-name">{e(name)}<small>{e(grades)}</small></span>{ICON["chev"]}',
            '    </button>',
            # id + class kept: js/page-menu.js appends this school's event pages into it
            f'    <div class="sn-sub sidenav-submenu" id="snav-{key}" hidden>',
            f'      <a class="sn-subitem" href="{p}{page}">School page</a>',
            f'      <a class="sn-subitem" href="{p}{page}#program-grid">Events &amp; programs</a>',
            *([f'      <a class="sn-subitem" href="{p}{YEARBOOK[key]}">Yearbook</a>'] if key in YEARBOOK else []),
            *[f'      <a class="sn-subitem" href="{p}{href}">{e(lbl)}</a>' for lbl, href in EXTRA_LINKS.get(key, [])],
            f'      <div class="sn-classes" aria-label="{e(name)} class pages"><span>Classes</span>{chips}</div>',
            '    </div>',
            '  </div>']
    out.append('  <div class="sn-ad" data-ad="square"></div>')   # ad spot: filled from data/ads.json
    out.append('</aside>')
    return '\n'.join(out)


ASIDE = re.compile(r'<aside class="homepage-sidenav[^"]*"[^>]*>.*?</aside>(\s*<script src="[^"]*sidenav\.js[^"]*"></script>)?', re.S)


HEADER = re.compile(r'<header class="site-header[^"]*"(?: style="([^"]*)")?[^>]*>.*?</header>', re.S)
# Staff-only booking tools keep their own trimmed menu.
HEADER_SKIP = {'cancel-booking.html', 'raffle-signup.html'}
ASSETS_CSS = re.compile(r'\s*<link rel="stylesheet" href="/?css/(?:sidenav|menus)\.css[^"]*">')
ASSETS_JS = re.compile(r'\s*<script src="/?js/(?:sidenav|menus)\.js[^"]*"></script>')


def add_assets(src, slash):
    """css/menus.css in <head>, js/menus.js before </body> -- exactly once each."""
    src = ASSETS_CSS.sub('', src)
    src = ASSETS_JS.sub('', src)
    src = re.sub(r'(\n[ \t]*)</head>', lambda m: m.group(1) + f'  <link rel="stylesheet" href="{slash}css/menus.css?v=6">' + m.group(1) + '</head>', src, count=1)
    return re.sub(r'(\n[ \t]*)</body>', lambda m: m.group(1) + f'  <script src="{slash}js/menus.js?v=3"></script>' + m.group(1) + '</body>', src, count=1)


def indent_block(block, indent):
    return block.replace('\n', '\n' + indent)


def main():
    changed = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.html'):
            continue
        path = os.path.join(ROOT, name)
        src = open(path, encoding='utf-8').read()
        new = src
        if name not in HEADER_SKIP:
            m = HEADER.search(new)
            if m:
                indent = re.search(r'([ \t]*)<header class="site-header', new).group(1)
                block = indent_block(header('', m.group(1) or ''), indent)
                new = new[:m.start()] + block + new[m.end():]
        if '<aside class="homepage-sidenav' in new:
            indent = re.search(r'([ \t]*)<aside class="homepage-sidenav', new).group(1)
            new = ASIDE.sub(lambda m: indent_block(sidebar('', SIDEBAR_EXTRA.get(name, '')), indent), new, count=1)
        uses_js_chrome = 'id="sc-header"' in new or 'id="sc-sidenav"' in new
        if new != src or 'class="site-header sh"' in new or uses_js_chrome:
            new = add_assets(new, '/' if uses_js_chrome else '')
        if new != src:
            open(path, 'w', encoding='utf-8').write(new)
            changed += 1

    chrome = os.path.join(ROOT, 'js', 'site-chrome.js')
    src = open(chrome, encoding='utf-8').read()
    new = re.sub(r'const SIDENAV = `.*?`;', lambda m: 'const SIDENAV = `\n' + sidebar('/') + '`;', src, count=1, flags=re.S)
    new = re.sub(r'const HEADER = `.*?`;', lambda m: 'const HEADER = `\n' + header('/') + '`;', new, count=1, flags=re.S)
    if new != src:
        open(chrome, 'w', encoding='utf-8').write(new)
        changed += 1
    print('menus written to %d files' % changed)


if __name__ == '__main__':
    main()
