/* ============================================================
   Homepage dashboard (index.html) — hero, weather, letter days,
   lunch menus, the two PTO event panels, the combined calendar
   and Community Moments.

   Where the data comes from (nothing on this page is typed in by hand):
     • Photos ......... HOME_PHOTOS below (images/moments/, cropped from the
                        approved homepage hero artboards in images/hero/)
     • Weather ........ Open-Meteo (free, no key) + weather.gov alerts
     • Letter days .... /api/letter-days.php — the district's own school calendars
     • Lunch menus .... /api/lunch-menus.php — links to the district's monthly PDFs
     • PTO events ..... the back office calendar, via js/public-calendar.js
                        (window.PTOEventData.loadAll)
   ============================================================ */
(function () {
  'use strict';

  var TZ = 'America/New_York';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Approved photos. To add one: crop the photo part of a hero artboard into
     images/moments/ (about 450×560), then add a line here. Order = display order. */
  var HOME_PHOTOS = [
    ['moment-01', 'A student smiling at a holiday party'],
    ['moment-02', 'Students visiting Santa and Mrs. Claus'],
    ['moment-03', 'Two students smiling together'],
    ['moment-04', 'Schalmont football players lined up on the field'],
    ['moment-05', 'Students on a school field trip'],
    ['moment-06', 'A student holding a first-day-of-kindergarten sign'],
    ['moment-07', 'Students dressed in neon at a school dance'],
    ['moment-08', 'Graduates in green caps and gowns with family'],
    ['moment-09', 'A student by a Schalmont Sabres banner'],
    ['moment-10', 'Siblings holding first-day-of-school signs'],
    ['moment-11', 'A student smiling on the first day of school'],
    ['moment-12', 'Three students ready for the first day of school'],
    ['moment-13', 'A student holding a first-day-of-kindergarten board'],
    ['moment-14', 'Schalmont cheerleaders in uniform'],
    ['moment-15', 'A student playing in the snow'],
    ['moment-16', 'A student and parent smiling together'],
    ['moment-17', 'Students posing with the Grinch'],
    ['moment-18', 'A student in a Santa hat and holiday sweater'],
    ['moment-19', 'Two students at a glow dance'],
    ['moment-20', 'A student with a first-day-of-school letter board'],
    ['moment-21', 'A student ready for the first day of school'],
    ['moment-22', 'A student with a backpack by the flowers'],
    ['moment-23', 'Students at a nighttime school event'],
    ['moment-24', 'Two young football players on the field'],
    ['moment-25', 'A preschooler holding a basketball'],
    ['moment-26', 'A smiling student close-up'],
    ['moment-27', 'A student in a holiday photo frame'],
    ['moment-28', 'A student wearing fun glasses in the gym'],
    ['moment-29', 'A student on the playground'],
    ['moment-30', 'Students at a fall festival photo booth'],
    ['moment-31', 'Students cheering at a school event']
  ];
  function photoSrc(p) { return 'images/moments/' + p[0] + '.jpg'; }

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  // Today's date in Eastern time as YYYY-MM-DD, regardless of the viewer's own zone.
  function etYMD(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: TZ }); }
  function addDays(ymd, n) { var d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function ymdDate(ymd) { return new Date(ymd + 'T12:00:00Z'); }
  function fmt(ymd, opts) { return ymdDate(ymd).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts)); }
  function dow(ymd) { return ymdDate(ymd).getUTCDay(); }
  function prettyTime(hm) {
    if (!hm || hm.indexOf(':') < 0) return '';
    var p = hm.split(':'), h = +p[0], ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + p[1] + ' ' + ap;
  }
  function getJSON(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 10000) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function onVisible(el, fn, margin) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: margin || '300px' });
    io.observe(el);
  }

  var ICON = {
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };

  /* ================= HERO ================= */
  // Hero photos: images/hero-wide/hero-NN.jpg, the photo part of each homepage hero
  // artboard (images/hero/mobile/). Same order as HOME_PHOTOS, so the alt text matches.
  // HERO_FOCUS nudges the crop for photos whose faces sit near the top edge.
  var HERO_FOCUS = { 1: '0%', 2: '0%', 3: '0%', 4: '0%', 6: '0%', 14: '0%', 16: '5%', 18: '5%', 22: '5%', 26: '8%', 31: '0%' };
  function heroSrc(i) { return 'images/hero-wide/hero-' + String(i + 1).padStart(2, '0') + '.jpg'; }
  function initHero() {
    var hero = $('#hz-hero'), wrap = $('#hz-slides'), dotsEl = $('#hz-dots');
    if (!hero || !wrap) return;
    wrap.innerHTML = HOME_PHOTOS.map(function (p, i) {
      var pos = HERO_FOCUS[i + 1] ? ' style="object-position:center ' + HERO_FOCUS[i + 1] + '"' : '';
      // Only the first photo loads up front; each next one loads just before it's shown.
      var attr = i === 0 ? 'src="' + heroSrc(i) + '" fetchpriority="high"' : 'data-src="' + heroSrc(i) + '"';
      return '<div class="hz-slide' + (i === 0 ? ' is-active' : '') + '" role="group" aria-roledescription="slide" aria-label="' +
        (i + 1) + ' of ' + HOME_PHOTOS.length + '"' + (i ? ' aria-hidden="true"' : '') + '>' +
        '<img ' + attr + pos + ' alt="' + esc(p[1]) + '" width="1143" height="690" decoding="async"></div>';
    }).join('');
    dotsEl.innerHTML = HOME_PHOTOS.map(function (_, i) {
      return '<button type="button" class="hz-dot" aria-label="Show photo ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('');

    var slides = wrap.children, dots = dotsEl.children, cur = 0, timer = null, paused = false;
    function prime(n) {
      [].forEach.call(slides[n].querySelectorAll('img[data-src]'), function (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); });
    }
    function go(n) {
      n = (n + slides.length) % slides.length;
      if (n === cur) return;
      prime(n);
      slides[cur].classList.remove('is-active'); slides[cur].setAttribute('aria-hidden', 'true'); dots[cur].removeAttribute('aria-current');
      slides[n].classList.add('is-active'); slides[n].removeAttribute('aria-hidden'); dots[n].setAttribute('aria-current', 'true');
      cur = n;
      prime((n + 1) % slides.length);
    }
    function start() { stop(); if (!REDUCED && !paused && slides.length > 1) timer = setInterval(function () { go(cur + 1); }, 6000); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    $('#hz-prev').onclick = function () { go(cur - 1); start(); };
    $('#hz-next').onclick = function () { go(cur + 1); start(); };
    [].forEach.call(dots, function (d, i) { d.onclick = function () { go(i); start(); }; });
    hero.addEventListener('mouseenter', function () { paused = true; stop(); });
    hero.addEventListener('mouseleave', function () { paused = false; start(); });
    hero.addEventListener('focusin', function () { paused = true; stop(); });
    hero.addEventListener('focusout', function () { paused = false; start(); });
    var x0 = null;
    hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); start(); }
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if (slides.length > 1) prime(1);
    start();
  }

  /* ================= WEATHER ================= */
  var WMO = {
    0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Cloudy'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Freezing fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'],
    56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'], 71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
    77: ['❄️', 'Snow grains'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Rain showers'], 82: ['⛈️', 'Heavy showers'], 85: ['🌨️', 'Snow showers'],
    86: ['❄️', 'Heavy snow showers'], 95: ['⛈️', 'Thunderstorms'], 96: ['⛈️', 'Thunderstorms & hail'], 99: ['⛈️', 'Thunderstorms & hail']
  };
  function wmo(c) { return WMO[c] || ['🌡️', '—']; }
  function initWeather() {
    var box = $('#hz-weather');
    if (!box) return;
    var NWS = 'https://forecast.weather.gov/MapClick.php?lat=42.7765&lon=-73.9278';
    // Served by our own server (Open-Meteo, falling back to the National Weather
    // Service), cached there -- see api/weather.php.
    getJSON('/api/weather.php', 12000).then(function (d) {
      if (!d || !d.ok) throw new Error('no weather');
      var c = d.current, w = wmo(c.code), desc = c.desc || w[1];
      var days = (d.days || []).slice(0, 4).map(function (x) {
        var ww = wmo(x.code), label = x.desc || ww[1];
        return '<div class="hz-wx-day" title="' + esc(label) + '"><b>' + fmt(x.date, { weekday: 'short' }) + '</b><span role="img" aria-label="' + esc(label) + '">' + ww[0] + '</span>' +
          '<small>' + (x.hi != null ? x.hi + '°' : '–') + ' <i>' + (x.lo != null ? x.lo + '°' : '') + '</i></small></div>';
      }).join('');
      var t = d.today || {};
      var hl = [t.hi != null ? 'High ' + t.hi + '°' : '', t.lo != null ? 'Low ' + t.lo + '°' : '', t.pop != null ? t.pop + '% chance of rain' : '']
        .filter(Boolean).join(' · ');
      var updated = new Date(d.updated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
      box.innerHTML =
        '<div class="hz-wx-now"><div class="hz-wx-icon" role="img" aria-label="' + esc(desc) + '">' + w[0] + '</div>' +
          '<div><div class="hz-wx-temp">' + esc(c.temp) + '°F</div>' +
          '<div class="hz-wx-desc">' + esc(desc) + '</div>' +
          '<div class="hz-wx-hl">' + esc(hl) + '</div></div></div>' +
        (days ? '<div class="hz-wx-days" aria-label="Next four days">' + days + '</div>' : '') +
        (d.alert ? '<div class="hz-wx-alert" role="status">⚠️ ' + esc(d.alert) + '</div>' : '') +
        '<div class="hz-wx-foot"><span class="hz-note">Updated ' + esc(updated) + (d.stale ? ' (couldn\'t refresh)' : '') + '</span>' +
          '<a class="hz-link hz-note" href="' + NWS + '" target="_blank" rel="noopener">Full forecast ↗</a></div>';
    }).catch(function () {
      box.innerHTML = '<p class="hz-note" style="margin:6px 0 10px">Weather is unavailable right now.</p>' +
        '<a class="hz-btn hz-btn-dark hz-btn-sm" href="' + NWS + '" target="_blank" rel="noopener">See the forecast at weather.gov ↗</a>';
    });
  }

  /* ================= LETTER DAYS ================= */
  var LD_SCHOOLS = [
    { key: 'jefferson', cls: 'jes', tile: 'hz-ld-jes', name: 'Jefferson Elementary', short: 'Jefferson' },
    { key: 'middle', cls: 'ms', tile: 'hz-ld-ms', name: 'Middle School', short: 'MS' },
    { key: 'high', cls: 'hs', tile: 'hz-ld-hs', name: 'High School', short: 'HS' }
  ];
  // What we actually know about one school on one date -- never a guess.
  function ldStatus(sch, ymd) {
    if (!sch || !sch.ok) return { kind: 'unknown' };
    var letter = sch.letters && sch.letters[ymd];
    var off = sch.noSchool && sch.noSchool[ymd];
    if (letter) return { kind: 'letter', letter: letter, note: off || '' };
    if (off) return { kind: 'off', reason: off };
    var d = dow(ymd);
    if (d === 0 || d === 6) return { kind: 'off', reason: 'Weekend' };
    var m = +ymd.slice(5, 7);
    if (sch.lastLetter && ymd > sch.lastLetter && m >= 6 && m <= 8) return { kind: 'off', reason: 'Summer break' };
    return { kind: 'unknown' };
  }
  function initLetterDays() {
    var box = $('#hz-letters'), pill = $('#hz-ld-pill'), dateEl = $('#hz-ld-date');
    if (!box) return;
    var today = etYMD();
    dateEl.textContent = fmt(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    getJSON('/api/letter-days.php', 12000).then(function (data) {
      var S = data.schools || {};
      var st = LD_SCHOOLS.map(function (s) { return ldStatus(S[s.key], today); });
      box.innerHTML = '<div class="hz-ld-tiles">' + LD_SCHOOLS.map(function (s, i) {
        var x = st[i], inner;
        if (x.kind === 'letter') {
          inner = '<span class="hz-ld-letter">' + esc(x.letter) + '</span><span class="hz-ld-day">Day</span>' +
            (x.note ? '<span class="hz-ld-warn">⚠ ' + esc(x.note) + '</span>' : '');
        } else if (x.kind === 'off') {
          inner = '<span class="hz-ld-msg">No School</span><span class="hz-ld-warn">' + esc(x.reason) + '</span>';
        } else {
          inner = '<span class="hz-ld-msg">Schedule<br>unavailable</span>';
        }
        var label = s.name + ': ' + (x.kind === 'letter' ? x.letter + ' Day' : x.kind === 'off' ? 'No school, ' + x.reason : 'schedule unavailable');
        return '<div class="hz-ld-tile ' + s.tile + (x.kind !== 'letter' ? ' is-off' : '') + '" role="group" aria-label="' + esc(label) + '">' +
          '<span class="hz-ld-school">' + esc(s.name) + '</span>' + inner + '</div>';
      }).join('') + '</div>';

      var inSession = st.some(function (x) { return x.kind === 'letter'; });
      var allOff = st.every(function (x) { return x.kind === 'off'; });
      pill.textContent = inSession ? 'School in session' : allOff ? 'No school today' : 'Check schedule';
      pill.className = 'hz-pill' + (inSession ? '' : allOff ? ' is-off' : ' is-unknown');

      // Next instructional day (the first upcoming date where any school has a letter).
      var next = null;
      for (var k = 1; k <= 30 && !next; k++) {
        var dte = addDays(today, k);
        if (LD_SCHOOLS.some(function (s) { return ldStatus(S[s.key], dte).kind === 'letter'; })) next = dte;
      }
      if (next) {
        var head = next === addDays(today, 1) ? 'Tomorrow' : 'Next school day · ' + fmt(next, { weekday: 'short', month: 'short', day: 'numeric' });
        box.insertAdjacentHTML('beforeend', '<div class="hz-ld-next"><b>' + esc(head) + ':</b>' +
          LD_SCHOOLS.map(function (s) {
            var x = ldStatus(S[s.key], next);
            return '<span class="hz-ld-chip ' + s.cls + '" title="' + esc(s.name) + '"><i>' + (x.kind === 'letter' ? esc(x.letter) : '–') + '</i>' + esc(s.short) + '</span>';
          }).join('') + '</div>');
      }
    }).catch(function () {
      pill.textContent = 'Unavailable'; pill.className = 'hz-pill is-unknown';
      box.innerHTML = '<p class="hz-note" style="margin:4px 0 10px">Letter days couldn\'t be loaded right now.</p>' +
        '<a class="hz-link" href="https://www.schalmont.org/wp-content/uploads/2021/11/JES_2026-27_Letter_Day_Calendar.pdf" target="_blank" rel="noopener">Jefferson letter-day calendar (PDF) ↗</a>';
    });
  }

  /* ================= LUNCH ================= */
  var LUNCH_TABS = [
    { key: 'jefferson', label: 'Jefferson', name: 'Jefferson Elementary' },
    { key: 'middle', label: 'Middle', name: 'Schalmont Middle School' },
    { key: 'high', label: 'High', name: 'Schalmont High School' },
    { key: 'woestina', label: 'Woestina', name: 'Woestina Pre-K' }
  ];
  var FOOD_PAGE = 'https://www.schalmont.org/district-office-services/food-services/';
  // Today's lunch comes from data/lunch-menus.json, built daily from the district's menu
  // PDFs by tools/lunch_menus.py (a GitHub Action). If a school's month couldn't be read
  // reliably it's simply absent, and the card falls back to the PDF link.
  function initLunch() {
    var tabsEl = $('#hz-lunch-tabs'), panel = $('#hz-lunch-panel');
    if (!tabsEl) return;
    var data = null, links = null, failed = false, current = 'jefferson';
    var today = etYMD();
    try { current = localStorage.getItem('hzLunchTab') || current; } catch (_) {}
    if (!LUNCH_TABS.some(function (t) { return t.key === current; })) current = 'jefferson';

    tabsEl.innerHTML = LUNCH_TABS.map(function (t) {
      return '<button type="button" role="tab" class="hz-tab" id="hz-tab-' + t.key + '" aria-controls="hz-lunch-panel" data-k="' + t.key + '">' + esc(t.label) + '</button>';
    }).join('');

    function dayEntry(school, ymd) {
      var s = data && data.schools && data.schools[school];
      var m = s && s.months && s.months[ymd.slice(0, 7)];
      return m && m.ok && m.days ? (m.days[ymd] || null) : undefined;   // undefined = month unknown
    }
    function pdfFor(school) {
      var s = data && data.schools && data.schools[school], m = s && s.months && s.months[today.slice(0, 7)];
      if (m && m.pdf) return m.pdf;
      var l = links && links.schools && links.schools[school];
      return (l && l.lunch) || FOOD_PAGE;
    }
    function list(entry) {
      var html = '';
      if (entry.notes && entry.notes.length) html += '<p class="hz-lunch-note">' + entry.notes.map(esc).join(' · ') + '</p>';
      if (entry.items && entry.items.length) html += '<ul class="hz-lunch-items">' + entry.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      return html;
    }
    function render() {
      [].forEach.call(tabsEl.children, function (b) {
        var on = b.getAttribute('data-k') === current;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'hz-tab-' + current);
      var t = LUNCH_TABS.filter(function (x) { return x.key === current; })[0];
      var html = '<p class="hz-lunch-school">' + esc(t.name) + '</p>';
      if (!data && !links && !failed) {
        html += '<span class="hz-skel" style="width:80%;margin:8px 0"></span><span class="hz-skel" style="width:55%"></span>';
      } else {
        var e = dayEntry(current, today);
        if (e && e.items.length) {
          html += '<p class="hz-lunch-when">Today\'s lunch</p>' + list(e);
        } else if (e || e === null || (e === undefined && data && (dow(today) === 0 || dow(today) === 6))) {
          // No lunch today (a day off, or the weekend) -- say why, then show the next menu.
          var next = null, ne = null;
          for (var k = 1; k <= 14 && !next; k++) {
            var d2 = addDays(today, k), x = dayEntry(current, d2);
            if (x && x.items.length) { next = d2; ne = x; }
          }
          var why = e && e.notes.length ? e.notes.slice(0, 2).join(' · ') : (dow(today) === 0 || dow(today) === 6 ? 'No school today' : 'No lunch listed today');
          html += '<p class="hz-lunch-note">' + esc(why) + '</p>';
          if (next) html += '<p class="hz-lunch-when">' + (next === addDays(today, 1) ? 'Tomorrow' : esc(fmt(next, { weekday: 'long', month: 'short', day: 'numeric' }))) + '</p>' + list(ne);
        } else {
          html += '<p class="hz-lunch-body">Today\'s lunch is on the district\'s monthly menu.</p>';
        }
        html += '<div class="hz-lunch-actions"><a class="hz-btn hz-btn-dark hz-btn-sm" href="' + esc(pdfFor(current)) + '" target="_blank" rel="noopener">View Full Menu ↗</a></div>';
      }
      panel.innerHTML = html;
    }
    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      current = b.getAttribute('data-k');
      try { localStorage.setItem('hzLunchTab', current); } catch (_) {}
      render();
    });
    tabsEl.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = LUNCH_TABS.map(function (t) { return t.key; }).indexOf(current);
      current = LUNCH_TABS[(i + (e.key === 'ArrowRight' ? 1 : LUNCH_TABS.length - 1)) % LUNCH_TABS.length].key;
      render();
      $('#hz-tab-' + current).focus();
      e.preventDefault();
    });
    render();
    getJSON('/data/lunch-menus.json?d=' + today, 10000).then(function (d) { data = d; render(); })
      .catch(function () {
        // No daily data -- at least link this month's PDFs.
        getJSON('/api/lunch-menus.php', 12000).then(function (d) { links = d; render(); })
          .catch(function () { failed = true; render(); });
      });
  }

  /* ================= EVENTS (shared by the panels + calendar) ================= */
  var GROUP = { woestina: 'jefferson', jefferson: 'jefferson', middle: 'schalmont', high: 'schalmont', pto: 'schalmont', '': 'schalmont', district: 'district' };
  var GROUP_LABEL = { jefferson: 'Jefferson PTO', schalmont: 'Schalmont Central PTO', district: 'District' };
  var GROUP_COLOR = { jefferson: '#63E629', schalmont: '#007A3D', district: '#2F5D8C' };
  var GROUP_TEXT = { jefferson: '#002F20', schalmont: '#ffffff', district: '#ffffff' };
  var eventsPromise = null;
  function normTitle(t) { return String(t || '').toLowerCase().replace(/&amp;/g, '&').replace(/\b20\d\d\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function decode(t) { var d = document.createElement('textarea'); d.innerHTML = t || ''; return d.value; }
  // One list with no duplicates: the same event entered for both the MS and the HS (or on
  // the tracker AND as a page) shows once, keeping whichever copy has the most detail.
  // This script runs before the Firebase SDK has downloaded (so weather, letter days and
  // lunch don't wait on it); events wait here until js/public-calendar.js is ready.
  function eventData() {
    return new Promise(function (ok, fail) {
      var waited = 0;
      (function check() {
        if (window.PTOEventData) return ok(window.PTOEventData);
        if ((waited += 150) > 30000) return fail(new Error('calendar unavailable'));
        setTimeout(check, 150);
      })();
    });
  }
  function loadEvents() {
    if (eventsPromise) return eventsPromise;
    eventsPromise = eventData().then(function (d) { return d.loadAll(); }).then(function (r) {
      var all = (r.events || []).concat(r.district || []), byKey = {};
      all.forEach(function (e) {
        var g = GROUP[e.school == null ? '' : e.school] || 'schalmont';
        var key = g + '|' + normTitle(e.title) + '|' + e.date;
        var have = byKey[key];
        var ev = { title: decode(e.title), date: e.date, endDate: e.endDate || '', time: e.time || '', location: e.location || '', href: e.href || null, group: g };
        if (!have) { byKey[key] = ev; return; }
        have.time = have.time || ev.time; have.location = have.location || ev.location;
        have.href = have.href || ev.href; have.endDate = have.endDate || ev.endDate;
      });
      return Object.keys(byKey).map(function (k) { return byKey[k]; });
    });
    return eventsPromise;
  }

  function dateBadge(e, today) {
    if (today && e.date < today) return '<div class="hz-date is-now" aria-hidden="true"><b>Now</b><span>On</span></div>';
    return '<div class="hz-date" aria-hidden="true"><b>' + fmt(e.date, { month: 'short' }) + '</b><span>' + ymdDate(e.date).getUTCDate() + '</span></div>';
  }
  function whenText(e, today) {
    var multi = e.endDate && e.endDate > e.date;
    if (multi && today && e.date < today) return 'Happening now · through ' + fmt(e.endDate, { weekday: 'short', month: 'short', day: 'numeric' });
    var d = multi ? fmt(e.date, { month: 'short', day: 'numeric' }) + ' – ' + fmt(e.endDate, { month: 'short', day: 'numeric' }) : fmt(e.date, { weekday: 'short', month: 'short', day: 'numeric' });
    return d + ' · ' + (e.time ? prettyTime(e.time) : 'All day');
  }
  function initPanels() {
    var lists = { jefferson: $('#hz-jes-events'), schalmont: $('#hz-sc-events') };
    if (!lists.jefferson) return;
    var today = etYMD();
    loadEvents().then(function (events) {
      Object.keys(lists).forEach(function (g) {
        var byStart = function (a, b) {
          return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : 0;
        };
        var mine = events.filter(function (e) { return e.group === g && (e.endDate || e.date) >= today; });
        // Truly upcoming events first; things already under way (a month-long fundraiser)
        // only fill whatever slots are left. One line per event name.
        var seen = {}, up = mine.filter(function (e) { return e.date >= today; }).sort(byStart)
          .concat(mine.filter(function (e) { return e.date < today; }).sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; }))
          .filter(function (e) { var k = normTitle(e.title); if (seen[k]) return false; seen[k] = 1; return true; })
          .slice(0, 4);
        lists[g].innerHTML = up.length ? up.map(function (e) {
          var title = e.href ? '<a href="' + esc(e.href) + '">' + esc(e.title) + '</a>' : esc(e.title);
          return '<li class="hz-event">' + dateBadge(e, today) +
            '<div class="hz-event-main"><p class="hz-event-title">' + title + '</p>' +
            '<div class="hz-event-meta"><span>' + ICON.clock + esc(whenText(e, today)) + '</span>' +
            (e.location ? '<span>' + ICON.pin + esc(e.location) + '</span>' : '') + '</div></div>' +
            (e.href ? '<a class="hz-event-go" href="' + esc(e.href) + '" aria-label="Details: ' + esc(e.title) + '">Details →</a>' : '') + '</li>';
        }).join('') : '<li class="hz-empty">No upcoming events posted yet — check back soon!</li>';
      });
    }).catch(function () {
      Object.keys(lists).forEach(function (g) {
        lists[g].innerHTML = '<li class="hz-empty">Events couldn\'t be loaded right now. <a class="hz-link" href="events.html">See the events page →</a></li>';
      });
    });
  }

  /* ================= COMBINED CALENDAR ================= */
  var calFilter = 'all', calendar = null;
  function setFilter(f) {
    calFilter = f;
    document.querySelectorAll('.hz-filter').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false'); });
    if (calendar) calendar.refetchEvents();
  }
  function initCalendar() {
    var el = $('#hz-calendar'), status = $('#hz-cal-status');
    if (!el) return;
    document.querySelectorAll('.hz-filter').forEach(function (b) { b.onclick = function () { setFilter(b.getAttribute('data-f')); }; });
    // "View Full Calendar" on each PTO panel jumps here with that PTO pre-selected.
    document.querySelectorAll('[data-cal-filter]').forEach(function (a) {
      a.addEventListener('click', function () { setFilter(a.getAttribute('data-cal-filter')); });
    });
    // The nav's "Events" links (index.html#calendar-jefferson / #calendar-schalmont /
    // #calendar-district) open the calendar already filtered to that PTO.
    function fromHash() {
      var m = /^#calendar-(jefferson|schalmont|district|all)$/.exec(location.hash);
      if (!m) return;
      setFilter(m[1]);
      var sec = $('#hz-calendar-section');
      if (sec) sec.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();

    onVisible(el, function () {
      loadScript('https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js').then(function () {
        return loadEvents();
      }).then(function (events) {
        status.remove();
        var small = window.innerWidth < 640;
        calendar = new FullCalendar.Calendar(el, {
          initialView: small ? 'listWeek' : 'dayGridMonth',
          headerToolbar: { left: 'prev,next today', center: 'title', right: small ? 'listDay,listWeek,listMonth' : 'dayGridMonth,timeGridWeek,timeGridDay' },
          buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', listMonth: 'Month', listWeek: 'Week', listDay: 'Day' },
          views: { listMonth: { buttonText: 'Month' }, listWeek: { buttonText: 'Week' }, listDay: { buttonText: 'Day' } },
          height: 'auto', dayMaxEvents: 3, fixedWeekCount: false, nowIndicator: true,
          slotMinTime: '07:00:00', slotMaxTime: '22:00:00', scrollTime: '08:00:00',
          eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
          noEventsContent: 'Nothing on the calendar for this stretch.',
          events: function (info, ok) {
            // In a list (the phone layout) a month-long fundraiser would repeat on every
            // single day -- show it once, on the first day in view, as "… (through Oct 16)".
            var isList = small;   // phones only ever get the list views
            var rangeStart = info.startStr.slice(0, 10);
            ok(events.filter(function (e) {
              if (isList && (e.endDate || e.date) < rangeStart) return false;
              return calFilter === 'all' || e.group === calFilter;
            }).map(function (e) {
              if (isList && e.endDate && e.endDate > e.date) {
                return {
                  title: e.title + ' (through ' + fmt(e.endDate, { month: 'short', day: 'numeric' }) + ')', allDay: true,
                  start: e.date < rangeStart ? rangeStart : e.date,
                  backgroundColor: GROUP_COLOR[e.group], borderColor: GROUP_COLOR[e.group], textColor: GROUP_TEXT[e.group], extendedProps: e
                };
              }
              var allDay = !e.time;
              var endEx = e.endDate && e.endDate > e.date ? addDays(e.endDate, 1) : null;  // FullCalendar end is exclusive
              return {
                title: e.title, allDay: allDay,
                start: allDay ? e.date : e.date + 'T' + e.time,
                end: allDay ? endEx : (e.endDate && e.endDate > e.date ? e.endDate + 'T23:59' : null),
                backgroundColor: GROUP_COLOR[e.group], borderColor: GROUP_COLOR[e.group], textColor: GROUP_TEXT[e.group],
                extendedProps: e
              };
            }));
          },
          eventDidMount: function (arg) {
            // Make every event reachable and openable from the keyboard.
            arg.el.setAttribute('tabindex', '0');
            arg.el.setAttribute('role', 'button');
            arg.el.setAttribute('aria-label', arg.event.title + ', ' + GROUP_LABEL[arg.event.extendedProps.group] + ', ' + whenText(arg.event.extendedProps));
            arg.el.addEventListener('keydown', function (k) {
              if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); openEvent(arg.event.extendedProps); }
            });
          },
          eventClick: function (arg) { arg.jsEvent.preventDefault(); openEvent(arg.event.extendedProps); }
        });
        calendar.render();
      }).catch(function () {
        status.innerHTML = 'The calendar couldn\'t be loaded right now. <a class="hz-link" href="events.html">Open the events page →</a>';
      });
    }, '500px');
  }
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      if (window.FullCalendar) return ok();
      var s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function openEvent(e) {
    var dlg = $('#hz-event-dialog');
    if (!dlg) return;
    var maps = e.location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location) : '';
    $('#hz-dlg-tag').textContent = GROUP_LABEL[e.group] || '';
    $('#hz-dlg-title').textContent = e.title;
    $('#hz-dlg-body').innerHTML =
      '<div>' + ICON.clock + ' ' + esc(whenText(e)) + '</div>' +
      (e.location ? '<div>' + ICON.pin + ' <a class="hz-link" href="' + esc(maps) + '" target="_blank" rel="noopener">' + esc(e.location) + '</a></div>' : '') +
      (e.href ? '<a class="hz-btn hz-btn-lime hz-btn-sm" href="' + esc(e.href) + '">Event details →</a>' : '');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ================= COMMUNITY MOMENTS ================= */
  function initMoments() {
    var track = $('#hz-track');
    if (!track) return;
    track.innerHTML = HOME_PHOTOS.map(function (p) {
      return '<figure class="hz-moment"><img src="' + photoSrc(p) + '" alt="' + esc(p[1]) + '" width="220" height="275" loading="lazy" decoding="async"></figure>';
    }).join('');
    function step(dir) {
      var card = track.querySelector('.hz-moment');
      var w = card ? card.getBoundingClientRect().width + 14 : 240;
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (dir > 0 && atEnd) track.scrollTo({ left: 0 });
      else track.scrollBy({ left: dir * w });
    }
    $('#hz-m-prev').onclick = function () { step(-1); };
    $('#hz-m-next').onclick = function () { step(1); };
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    });
    if (REDUCED) return;
    var timer = null, hold = false;
    function start() { stop(); timer = setInterval(function () { if (!hold && !document.hidden) step(1); }, 4500); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) { track.parentNode.addEventListener(ev, function () { hold = true; }, { passive: true }); });
    ['mouseleave', 'focusout'].forEach(function (ev) { track.parentNode.addEventListener(ev, function () { hold = false; }); });
    track.addEventListener('touchend', function () { setTimeout(function () { hold = false; }, 6000); });
    onVisible(track, start, '0px');
  }

  /* ---------------- boot ---------------- */
  // The ☰ menu: wired here, right away, so it works before the slower Firebase-dependent
  // site script (js/app.js, which skips it when it sees data-bound) has even loaded.
  function initMenu() {
    var t = $('#nav-toggle'), links = $('.nav-links');
    if (!t || !links) return;
    t.dataset.bound = '1';
    t.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) { links.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); t.focus(); } });
  }

  function boot() {
    initMenu();
    var dlg = $('#hz-event-dialog');
    if (dlg) {
      $('#hz-dlg-x').onclick = function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    }
    initHero();
    initWeather();
    initLetterDays();
    initLunch();
    initPanels();
    initCalendar();
    initMoments();
    var y = $('#hz-year'); if (y) y.textContent = new Date().getFullYear();
  }
  // Loaded right after the page content (before the Firebase scripts), so everything it
  // needs is already in the DOM -- start now instead of waiting for DOMContentLoaded.
  boot();
})();
