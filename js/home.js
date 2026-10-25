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
     • Site search .... data/search-index.json, built from the pages on every deploy
                        by tools/build_search_index.py, plus QUICK below and the events
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
  // Hero photos: images/hero-wide/hero-NN.jpg (first day of school 2026, 1000px wide, no
  // location data). Each entry: [alt text, desktop focus, phone focus]. Focus = CSS
  // object-position Y in %, from face detection: hair at least 7% below the top edge (about
  // 14% at usual sizes) and every chin above the "Share your photos"/dots bar (bottom 20%),
  // from the wide desktop panel (2:1) to its narrowest (about 1.15:1) and the tablet/phone band.
  var HERO_PHOTOS = [
    ['Two students on their front porch on the first day of school', 57, 57],
    ['A student sitting on the steps with a first-day-of-4th-grade chalkboard sign', 31, 32],
    ['A student holding a first-day-of-first-grade sign', 37, 38],
    ['A smiling student holding a first-day-of-2nd-grade sign', 15, 13],
    ['Two friends smiling in front of a world map', 22, 22],
    ['A student standing by a blue spruce on the first day of school', 32, 33],
    ['A student with a backpack on the first day of school', 45, 46],
    ['A student holding a first-day-of-fourth-grade sign at the front door', 33, 34],
    ['Three students together on the first day of school', 40, 42],
    ['A smiling student in a denim jacket ready for school', 41, 43],
    ['Two high school students on the first day of school', 20, 21],
    ['A student in a soccer jersey outside the school', 35, 36],
    ['A student on the front steps with a first-day-of-sixth-grade sign', 5, 4],
    ['A smiling student heading to school with a bag of supplies', 4, 5],
    ['A student with a new backpack on the first day of school', 38, 40],
    ['A young student in a gray hoodie by a fence', 20, 20],
    ['A grinning student with a backpack on the first day of school', 9, 11],
    ['Two brothers ready for the first day of school', 14, 12]
  ];
  function heroSrc(i) { return 'images/hero-wide/hero-' + String(i + 1).padStart(2, '0') + '.jpg'; }
  function initHero() {
    var hero = $('#hz-hero'), wrap = $('#hz-slides'), dotsEl = $('#hz-dots');
    if (!hero || !wrap) return;
    wrap.innerHTML = HERO_PHOTOS.map(function (p, i) {
      var pos = ' style="--fd:' + p[1] + '%;--fm:' + p[2] + '%"';
      // Only the first photo loads up front; each next one loads just before it's shown.
      var attr = i === 0 ? 'src="' + heroSrc(i) + '" fetchpriority="high"' : 'data-src="' + heroSrc(i) + '"';
      return '<div class="hz-slide' + (i === 0 ? ' is-active' : '') + '" role="group" aria-roledescription="slide" aria-label="' +
        (i + 1) + ' of ' + HERO_PHOTOS.length + '"' + (i ? ' aria-hidden="true"' : '') + '>' +
        '<img ' + attr + pos + ' alt="' + esc(p[0]) + '" width="1000" height="1333" decoding="async"></div>';
    }).join('');
    dotsEl.innerHTML = HERO_PHOTOS.map(function (_, i) {
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
  // Straight from the browser, used only when our own api/weather.php can't answer
  // (a local preview with no PHP, or the server having a bad moment). Same shape as
  // that script's output. Both services allow browser requests and need no key.
  var WX_LAT = 42.7765, WX_LON = -73.9278;
  function weatherDirect() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + WX_LAT + '&longitude=' + WX_LON +
      '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=5';
    var alert = getJSON('https://api.weather.gov/alerts/active?point=' + WX_LAT + ',' + WX_LON, 6000)
      .then(function (a) { return (a.features && a.features[0] && a.features[0].properties.event) || null; })
      .catch(function () { return null; });
    return Promise.all([getJSON(url, 10000), alert]).then(function (r) {
      var o = r[0], dl = o.daily;
      if (!o.current || !dl || !dl.time || dl.time.length < 5) throw new Error('no weather');
      return {
        ok: true, source: 'Open-Meteo', updated: new Date().toISOString(), stale: false, alert: r[1],
        current: { temp: Math.round(o.current.temperature_2m), code: o.current.weather_code, desc: '' },
        today: { hi: Math.round(dl.temperature_2m_max[0]), lo: Math.round(dl.temperature_2m_min[0]), pop: dl.precipitation_probability_max[0] },
        days: [1, 2, 3, 4].map(function (i) {
          return { date: dl.time[i], hi: Math.round(dl.temperature_2m_max[i]), lo: Math.round(dl.temperature_2m_min[i]), code: dl.weather_code[i], desc: '' };
        })
      };
    });
  }
  function initWeather() {
    var box = $('#hz-weather');
    if (!box) return;
    var NWS = 'https://forecast.weather.gov/MapClick.php?lat=42.7765&lon=-73.9278';
    // Normally served by our own server (Open-Meteo, falling back to the National Weather
    // Service), cached there -- see api/weather.php. If that fails, ask Open-Meteo directly.
    getJSON('/api/weather.php', 8000).then(function (d) {
      if (!d || !d.ok) throw new Error('no weather');
      return d;
    }).catch(weatherDirect).then(function (d) {
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
  function ldTiles(S, ymd) {
    return '<div class="hz-ld-tiles">' + LD_SCHOOLS.map(function (s) {
      var x = ldStatus(S[s.key], ymd), inner;
      if (x.kind === 'letter') {
        inner = '<span class="hz-ld-letter">' + esc(x.letter) + '</span><span class="hz-ld-day">Day</span>' +
          (x.note ? '<span class="hz-ld-warn">⚠ ' + esc(x.note) + '</span>' : '');
      } else if (x.kind === 'off') {
        inner = '<span class="hz-ld-msg">No School</span><span class="hz-ld-warn">' + esc(x.reason) + '</span>';
      } else {
        inner = '<span class="hz-ld-msg">Not on the<br>school calendar</span>';
      }
      var label = s.name + ': ' + (x.kind === 'letter' ? x.letter + ' Day' : x.kind === 'off' ? 'No school, ' + x.reason : 'not on the school calendar');
      return '<div class="hz-ld-tile ' + s.tile + (x.kind !== 'letter' ? ' is-off' : '') + '" role="group" aria-label="' + esc(label) + '">' +
        '<span class="hz-ld-school">' + esc(s.name) + '</span>' + inner + '</div>';
    }).join('') + '</div>';
  }
  // Mon–Fri of the week around `ymd`, one row per school -- handy for planning gym/library days.
  function ldWeek(S, ymd, today) {
    var mon = addDays(ymd, dow(ymd) === 0 ? 1 : 1 - dow(ymd)), days = [0, 1, 2, 3, 4].map(function (i) { return addDays(mon, i); });
    var head = '<span></span>' + days.map(function (d) {
      return '<span class="hz-wk-h' + (d === ymd ? ' is-on' : '') + '">' + fmt(d, { weekday: 'short' }) + '<small>' + ymdDate(d).getUTCDate() + '</small></span>';
    }).join('');
    var rows = LD_SCHOOLS.map(function (s) {
      return '<span class="hz-wk-name">' + esc(s.short) + '</span>' + days.map(function (d) {
        var x = ldStatus(S[s.key], d);
        var txt = x.kind === 'letter' ? esc(x.letter) : x.kind === 'off' ? '–' : '?';
        var tip = fmt(d, { weekday: 'long', month: 'short', day: 'numeric' }) + ': ' + (x.kind === 'letter' ? x.letter + ' Day' : x.kind === 'off' ? 'No school (' + x.reason + ')' : 'not on the school calendar');
        return '<span class="hz-wk-c ' + s.cls + (x.kind === 'letter' ? '' : ' is-off') + (d === ymd ? ' is-on' : '') + (d < today ? ' is-past' : '') + '" title="' + esc(tip) + '">' + txt + '</span>';
      }).join('');
    }).join('');
    return '<div class="hz-wk" role="table" aria-label="Letter days for the week of ' + esc(fmt(mon, { month: 'long', day: 'numeric' })) + '">' +
      '<p class="hz-wk-title">This week</p><div class="hz-wk-grid" aria-hidden="true">' + head + rows + '</div></div>';
  }
  function initLetterDays() {
    var box = $('#hz-letters'), pill = $('#hz-ld-pill'), dateEl = $('#hz-today-date');
    if (!box) return;
    var today = etYMD();
    if (dateEl) dateEl.textContent = fmt(today, { weekday: 'long', month: 'long', day: 'numeric' });

    // The whole year's letter days are a plain file (data/letter-days.json, rebuilt every
    // morning by tools/letter_days.py), so this card doesn't need PHP. The live
    // api/letter-days.php is only a backup for if that file is ever missing.
    getJSON('/data/letter-days.json?d=' + today, 8000).catch(function () {
      return getJSON('/api/letter-days.php', 12000);
    }).then(function (data) {
      var S = data.schools || {};
      var hasLetter = function (d) { return LD_SCHOOLS.some(function (s) { return ldStatus(S[s.key], d).kind === 'letter'; }); };
      var inSession = hasLetter(today), show = today;
      // On a day off, the big tiles jump ahead to the next school day -- that's what a
      // parent checking on Sunday night actually wants to know.
      if (!inSession) {
        show = null;
        for (var k = 1; k <= 45 && !show; k++) if (hasLetter(addDays(today, k))) show = addDays(today, k);
      }
      var allOff = LD_SCHOOLS.every(function (s) { return ldStatus(S[s.key], today).kind === 'off'; });
      pill.textContent = inSession ? 'School in session' : allOff ? 'No school today' : 'Check schedule';
      pill.className = 'hz-pill' + (inSession ? '' : allOff ? ' is-off' : ' is-unknown');

      if (!show) {   // summer, or the calendar isn't posted yet
        box.innerHTML = ldTiles(S, today);
        return;
      }
      var label = show === today ? 'Today · ' + fmt(today, { weekday: 'long', month: 'short', day: 'numeric' })
        : (show === addDays(today, 1) ? 'Tomorrow' : 'Next school day') + ' · ' + fmt(show, { weekday: 'long', month: 'short', day: 'numeric' });
      box.innerHTML = '<p class="hz-ld-when' + (show === today ? '' : ' is-ahead') + '">' + esc(label) + '</p>' +
        ldTiles(S, show) + ldWeek(S, show, today);
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
    { key: 'woestina', label: 'Pre-K', name: 'Woestina Pre-K (Jefferson)' }
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
    // The next day after today (within two weeks) that has a lunch menu, labeled "Tomorrow" or by day.
    function nextLunch(school) {
      for (var k = 1; k <= 14; k++) {
        var d2 = addDays(today, k), x = dayEntry(school, d2);
        if (x && x.items.length) {
          return { entry: x, label: k === 1 ? 'Tomorrow' : fmt(d2, k < 7 ? { weekday: 'long' } : { weekday: 'long', month: 'short', day: 'numeric' }) };
        }
      }
      return null;
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
        var next = data ? nextLunch(current) : null;
        if (e && e.items.length) {
          html += '<p class="hz-lunch-when">Today\'s lunch</p>' + list(e);
          // ...and the next school day's, so families can plan ahead.
          if (next) html += '<div class="hz-lunch-next"><p class="hz-lunch-when">' + esc(next.label) + '\'s lunch</p>' + list(next.entry) + '</div>';
        } else if (e || e === null || (e === undefined && data && (dow(today) === 0 || dow(today) === 6))) {
          // No lunch today (a day off, or the weekend) -- say why, then show the next menu.
          var why = e && e.notes.length ? e.notes.slice(0, 2).join(' · ') : (dow(today) === 0 || dow(today) === 6 ? 'No school today' : 'No lunch listed today');
          html += '<p class="hz-lunch-note">' + esc(why) + '</p>';
          if (next) html += '<p class="hz-lunch-when">' + esc(next.label) + '\'s lunch</p>' + list(next.entry);
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

  /* ================= TODAY'S EVENTS + NEXT WEEK (dashboard cards) ================= */
  function byStartTime(a, b) {
    // All-day and multi-day entries first, then by start time.
    var ta = a.time || '', tb = b.time || '';
    return a.date < b.date ? -1 : a.date > b.date ? 1 : ta < tb ? -1 : ta > tb ? 1 : 0;
  }
  function dedupe(list) {
    var seen = {};
    return list.filter(function (e) { var k = normTitle(e.title); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function dayEventHTML(e, meta) {
    var title = e.href ? '<a href="' + esc(e.href) + '">' + esc(e.title) + '</a>' : esc(e.title);
    return '<li class="hz-event"><div class="hz-event-main">' +
      '<span class="hz-te-tag" style="background:' + GROUP_COLOR[e.group] + ';color:' + GROUP_TEXT[e.group] + '">' + esc(GROUP_LABEL[e.group] || '') + '</span>' +
      '<p class="hz-event-title">' + title + '</p>' +
      '<div class="hz-event-meta"><span>' + ICON.clock + esc(meta) + '</span>' +
      (e.location ? '<span>' + ICON.pin + esc(e.location) + '</span>' : '') + '</div></div>' +
      (e.href ? '<a class="hz-event-go" href="' + esc(e.href) + '" aria-label="Details: ' + esc(e.title) + '">Details →</a>' : '') + '</li>';
  }
  // Daily themes shown under each day in the Today / Next Week cards (school spirit days etc.).
  var DAY_NOTES = {
    '2026-10-26': 'Cozy or Fancy', '2026-10-27': 'Tourist Day', '2026-10-28': 'Beach vs. Boots',
    '2026-10-29': 'Team Sports Apparel', '2026-10-30': 'Favorite Character Duo Day'
  };
  function dayNoteHTML(ymd) {
    return DAY_NOTES[ymd] ? '<a class="hz-te-note" href="/spirit-week">💚 MS Spirit Week: <b>' + esc(DAY_NOTES[ymd]) + '</b></a>' : '';
  }
  function initDayEvents() {
    var todayList = $('#hz-te-list'), weekList = $('#hz-nw-list');
    if (!todayList) return;
    var today = etYMD();
    $('#hz-te-pill').textContent = fmt(today, { weekday: 'short', month: 'short', day: 'numeric' });

    /* ---- WEEK AT A GLANCE: "This week" / "Next week" tabs. A school week runs Mon-Sun; on a
       Saturday or Sunday, "this week" is the one about to start. Top: a "Don't miss" strip of
       deadlines and schedule changes; then things running all week; then one column per day. */
    var allEvents = [], weekOffset = 0;
    var thisMon = addDays(today, dow(today) === 0 ? 1 : dow(today) === 6 ? 2 : 1 - dow(today));
    var SCHEDULE = /no school|school closed|schools? closed|early (dismissal|release)|half[ -]?day|delay(ed)? (opening|start)|recess|holiday (break|recess)|superintendent|conference day|parent conferences/i;
    var DEADLINE = /deadline|due|last day|orders?\b|closes?|ends?\b|final|registration|register|sign[ -]?ups?|rsvp|vote|voting|retake|picture day/i;
    function shortDay(ymd) { return fmt(ymd, { weekday: 'short', month: 'short', day: 'numeric' }); }
    function link(e, cls) { return e.href ? '<a class="' + (cls || '') + '" href="' + esc(e.href) + '">' + esc(e.title) + '</a>' : esc(e.title); }
    function renderWeek() {
      var mon = addDays(thisMon, weekOffset * 7), sun = addDays(mon, 6);
      $('#hz-nw-pill').textContent = fmt(mon, { weekday: 'long', month: 'long', day: 'numeric' }) + ' – ' + fmt(addDays(mon, 4), { weekday: 'long', month: 'long', day: 'numeric' });
      $('#hz-wk-this').setAttribute('aria-selected', weekOffset ? 'false' : 'true');
      $('#hz-wk-next').setAttribute('aria-selected', weekOffset ? 'true' : 'false');
      var multi = function (e) { return e.endDate && e.endDate > e.date; };
      var wk = dedupe(allEvents.filter(function (e) { return e.date <= sun && (e.endDate || e.date) >= mon; }).sort(byStartTime));
      var span = function (e) { return Math.round((ymdDate(e.endDate) - ymdDate(e.date)) / 864e5) + 1; };
      var longOnes = wk.filter(function (e) { return multi(e) && span(e) >= 3; });   // run across the week
      var dayOnes = wk.filter(function (e) { return longOnes.indexOf(e) < 0; });

      // Don't miss: schedule changes, deadlines, and long-running things that END this week.
      var alerts = [];
      dayOnes.forEach(function (e) {
        var kind = SCHEDULE.test(e.title) ? 'school' : DEADLINE.test(e.title) ? 'due' : '';
        if (kind) alerts.push({ d: e.date < mon ? mon : e.date, kind: kind, html: link(e) });
      });
      longOnes.forEach(function (e) {
        if (SCHEDULE.test(e.title)) alerts.push({ d: e.date < mon ? mon : e.date, kind: 'school', html: link(e) + ' <span>(through ' + esc(fmt(e.endDate, { weekday: 'short' })) + ')</span>' });
        else if (e.endDate <= sun && span(e) >= 7) alerts.push({ d: e.endDate, kind: 'due', html: 'Last day: ' + link(e) });   // month-long fundraisers/drives, not a 5-day spirit week
      });
      alerts.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
      var html = '';
      if (alerts.length) {
        html += '<div class="hz-wk-alerts" role="note"><p class="hz-wk-alerts-t">⚠️ Don\'t miss</p><ul>' + alerts.slice(0, 6).map(function (x) {
          return '<li class="is-' + x.kind + '"><b>' + esc(shortDay(x.d)) + '</b><span class="hz-wk-ico" aria-hidden="true">' + (x.kind === 'school' ? '🏫' : '⏰') + '</span><span class="hz-wk-txt">' + x.html + '</span></li>';
        }).join('') + '</ul></div>';
      }
      if (longOnes.length) {
        html += '<div class="hz-wk-long"><span class="hz-wk-long-t">All week</span>' + longOnes.map(function (e) {
          var from = e.date < mon ? 'Mon' : fmt(e.date, { weekday: 'short' }), to = e.endDate > sun ? 'Sun' : fmt(e.endDate, { weekday: 'short' });
          return '<span class="hz-wk-chip" style="--c:' + GROUP_COLOR[e.group] + '">' + link(e) + ' <i>' + esc(from + '–' + to) + '</i></span>';
        }).join('') + '</div>';
      }
      // Day columns: Mon-Fri, plus Sat/Sun only when something is on them.
      var days = [];
      for (var i = 0; i < 7; i++) {
        var d = addDays(mon, i);
        var list = dayOnes.filter(function (e) { return (e.date < mon ? mon : e.date) === d || (multi(e) && e.date <= d && e.endDate >= d); });
        if (i < 5 || list.length) days.push({ d: d, list: list });
      }
      html += '<div class="hz-wk-days" style="--n:' + days.length + '">' + days.map(function (x) {
        var isToday = x.d === today, past = x.d < today;
        return '<div class="hz-wk-day' + (isToday ? ' is-today' : '') + (past ? ' is-past' : '') + '">' +
          '<p class="hz-wk-dh"><span>' + esc(fmt(x.d, { weekday: 'short' })) + '</span><b>' + ymdDate(x.d).getUTCDate() + '</b>' + (isToday ? '<em>Today</em>' : '') + '</p>' +
          (DAY_NOTES[x.d] ? '<a class="hz-wk-note" href="/spirit-week">💚 ' + esc(DAY_NOTES[x.d]) + '</a>' : '') +
          (x.list.length ? '<ul>' + x.list.map(function (e) {
            return '<li style="--c:' + GROUP_COLOR[e.group] + '">' + link(e) + '<small>' + esc(e.time ? prettyTime(e.time) : 'All day') + '</small></li>';
          }).join('') + '</ul>' : '<p class="hz-wk-none">Nothing scheduled</p>') + '</div>';
      }).join('') + '</div>';
      if (!wk.length && !Object.keys(DAY_NOTES).some(function (d) { return d >= mon && d <= sun; }))
        html = '<p class="hz-empty">Nothing posted for this week yet — check back soon!</p>';
      weekList.innerHTML = html;
    }
    $('#hz-wk-this').onclick = function () { weekOffset = 0; renderWeek(); };
    $('#hz-wk-next').onclick = function () { weekOffset = 1; renderWeek(); };

    loadEvents().then(function (events) {
      var multi = function (e) { return e.endDate && e.endDate > e.date; };

      // TODAY: anything on today, including multi-day events that are under way.
      var now = dedupe(events.filter(function (e) { return e.date <= today && (e.endDate || e.date) >= today; })
        .sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : 0; }));
      var todayNote = dayNoteHTML(today) ? '<li class="hz-te-block">' + dayNoteHTML(today) + '</li>' : '';
      if (now.length) {
        todayList.innerHTML = todayNote + now.slice(0, 5).map(function (e) {
          var meta = multi(e) ? (e.date < today ? 'Through ' : fmt(e.date, { month: 'short', day: 'numeric' }) + ' – ') + fmt(e.endDate, { weekday: 'short', month: 'short', day: 'numeric' })
            : (e.time ? prettyTime(e.time) : 'All day');
          return dayEventHTML(e, meta);
        }).join('') + (now.length > 5 ? '<li class="hz-empty">+ ' + (now.length - 5) + ' more on the calendar</li>' : '');
      } else {
        var next = events.filter(function (e) { return e.date > today; }).sort(byStartTime)[0];
        todayList.innerHTML = todayNote + '<li class="hz-empty">Nothing on the calendar today.' +
          (next ? '<br>Next up: <b>' + (next.href ? '<a class="hz-link" href="' + esc(next.href) + '">' + esc(next.title) + '</a>' : esc(next.title)) + '</b>, ' +
            esc(fmt(next.date, { weekday: 'short', month: 'short', day: 'numeric' })) : '') + '</li>';
      }

      allEvents = events;
      renderWeek();
    }).catch(function () {
      var msg = '<li class="hz-empty">Events couldn\'t be loaded right now. <a class="hz-link" href="events.html">See the events page →</a></li>';
      todayList.innerHTML = msg; weekList.innerHTML = '<p class="hz-empty">Events couldn\'t be loaded right now. <a class="hz-link" href="events.html">See the events page →</a></p>';
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
    // Every "Events calendar" link on the site goes to index.html#calendar (all events); the PTO
    // menus' Events links use #calendar-jefferson / -schalmont / -district to open it pre-filtered.
    function fromHash() {
      var m = /^#calendar(?:-(jefferson|schalmont|district|all))?$/.exec(location.hash);   // #calendar = everything
      if (!m) return;
      setFilter(m[1] || 'all');
      var sec = $('#hz-calendar-section');
      if (!sec) return;
      sec.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      // The cards above (letter days, lunch, events, photos) fill in after the jump and push the
      // calendar down -- land on it again once they have, unless the visitor has scrolled away.
      var start = Date.now(), moved = false;
      var stop = function () { moved = true; };
      window.addEventListener('wheel', stop, { once: true, passive: true });
      window.addEventListener('touchmove', stop, { once: true, passive: true });
      [700, 1600, 3000].forEach(function (ms) {
        setTimeout(function () {
          if (moved || Date.now() - start > 4000) return;
          var top = sec.getBoundingClientRect().top;
          if (Math.abs(top - 104) > 24) sec.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, ms);
      });
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();

    onVisible(el, function () {
      loadScript('https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js').then(function () {
        return loadEvents();
      }).then(function (events) {
        status.remove();
        var small = window.innerWidth < 640;
        // A ROLLING calendar: it starts today (each row begins on today's weekday) and
        // looks ahead -- past dates aren't shown and you can't page back into them. Days
        // grow to fit every event instead of squeezing them into "+3 more".
        var calToday = etYMD();
        calendar = new FullCalendar.Calendar(el, {
          initialView: small ? 'listUpcoming' : 'rolling5',
          initialDate: calToday,
          firstDay: dow(calToday),
          validRange: { start: calToday },
          headerToolbar: { left: 'prev,next today', center: 'title', right: small ? 'listUpcoming,listMonth' : 'rolling5,timeGridWeek' },
          buttonText: { today: 'Today', week: 'Week', listMonth: '30 days' },
          views: {
            rolling5: { type: 'dayGrid', duration: { weeks: 5 }, buttonText: 'Next 5 weeks' },
            listUpcoming: { type: 'list', duration: { days: 14 }, buttonText: '2 weeks' },
            listMonth: { type: 'list', duration: { days: 30 } }
          },
          height: 'auto', dayMaxEvents: false, eventDisplay: 'block', nowIndicator: true,
          slotMinTime: '07:00:00', slotMaxTime: '22:00:00', scrollTime: '08:00:00',
          eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
          noEventsContent: 'Nothing on the calendar for this stretch.',
          events: function (info, ok) {
            // In a list (the phone layout) a month-long fundraiser would repeat on every
            // single day -- show it once, on the first day in view, as "… (through Oct 16)".
            var isList = small;   // phones only ever get the list views
            var rangeStart = info.startStr.slice(0, 10);
            ok(events.filter(function (e) {
              if ((e.endDate || e.date) < calToday) return false;   // already over
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

  /* ================= SITE SEARCH ================= */
  // Answers that live on THIS page (or on the district's site), with the words parents
  // actually type. Everything else comes from data/search-index.json and the calendar.
  var QUICK = [
    { t: 'Today\'s letter day', d: 'The letter day for Jefferson, the Middle School and the High School', u: '#today', flash: 'hz-card-letters', i: '🔤', k: 'letter day letters rotation special schedule what day is it' },
    { t: 'Today\'s lunch menu', d: 'What\'s for lunch at each school today, plus the full monthly menus', u: '#hz-lunch', flash: 'hz-card-lunch', i: '🍎', k: 'lunch menu food cafeteria meal hot lunch eat' },
    { t: 'Weather', d: 'Rotterdam forecast for today and the next few days', u: '#today', flash: 'hz-card-weather', i: '⛅', k: 'weather forecast rain snow cold temperature recess coat' },
    { t: 'School closings & delays', d: 'Closings and delays are announced by the school district', u: 'https://www.schalmont.org', ext: true, i: '❄️', k: 'snow day closing closed delay delayed cancel cancelled emergency' },
    { t: 'PTO & district calendar', d: 'Every PTO event and district date in one calendar', u: '#hz-calendar-section', i: '📅', k: 'calendar events dates schedule no school day off holiday break vacation half day early dismissal' },
    { t: 'Add school calendars to your phone', d: 'Subscribe in Google Calendar, iPhone or Outlook', u: '#hz-subscribe', i: '📲', k: 'subscribe phone iphone android google outlook ical sync calendar app' },
    { t: 'ParentSquare', d: 'School & teacher messages for every grade. School code: 28782', u: 'https://www.parentsquare.com/signin', ext: true, i: '💬', k: 'parentsquare parent square messages message teacher email announcements notifications app school code sign in login' },
    { t: 'Parent Portal: progress reports & report cards', d: 'The district\'s eSchoolData parent portal', u: 'https://parentportal-neric.eschooldata.com/SchalmontCSD', ext: true, i: '📊', k: 'report card cards progress reports grades marks eschooldata eschool portal parent portal transcript' },
    { t: 'Schoology', d: 'Class messages & assignments for the Middle & High School', u: 'https://app.schoology.com/login', ext: true, i: '🎒', k: 'schoology class classes assignments homework teacher messages middle high school login' },
    { t: 'Order school pictures', d: 'Woestina & Jefferson: iSmile Studios · Middle School: Adirondack (code 26SHLMT) · High School: Upstate Images (code 21714F2627)', u: '#school-pictures', flash: 'hz-pics', i: '📸', k: 'school pictures picture photos portrait portraits order prints retake ismile gotphoto adirondack upstate images code yearbook photo' },
    { t: 'Yearbook ordering', d: 'Middle School orders open: $25 through Dec. 31, $30 through Apr. 16. Other schools: details coming', u: '#yearbooks', flash: 'hz-yb', i: '📘', k: 'yearbook yearbooks order buy price cost deadline balfour entourage' },
    { t: 'Schalmont school district website', d: 'Buses, enrollment and anything run by the district', u: 'https://www.schalmont.org', ext: true, i: '🏫', k: 'district bus buses transportation enroll enrollment register registration principal nurse attendance absent' },
    { t: 'District food services', d: 'Monthly menus and school meal information from the district', u: FOOD_PAGE, ext: true, i: '🥪', k: 'food services meal breakfast nutrition allergy' }
  ];
  // A word a parent types → other words the page might use instead.
  var SYN = {
    photo: ['picture'], pic: ['picture'], picture: ['photo'], headshot: ['picture'],
    spiritwear: ['spirit', 'shop'], apparel: ['spirit'], shirt: ['spirit'], tshirt: ['spirit'], hoodie: ['spirit'], merch: ['spirit', 'shop'], clothe: ['spirit'], store: ['shop'],
    give: ['donate'], donation: ['donate'], help: ['volunteer'], chaperone: ['volunteer'],
    officer: ['board', 'team'], president: ['board', 'team'], board: ['team'],
    supplie: ['supply'], supply: ['supplie'],
    prek: ['woestina', 'pre'], preschool: ['woestina'], elementary: ['jefferson'], ms: ['middle'], hs: ['high'],
    fundraiser: ['fundrais', 'catalog'], email: ['contact'], question: ['faq', 'contact'], party: ['dance', 'party']
  };
  // Words that don't narrow anything down ("pto" and "schalmont" are on every page).
  var STOPQ = ' a an and are can do does for how i in is it me my of on or the to what when where which who why will with you your pto ptos schalmont sabre sabres ';
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function stemW(w) { return w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w; }   // "meetings" → "meeting"
  function field(s) { return ' ' + norm(s).split(' ').map(stemW).join(' ') + ' '; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function initSearch() {
    var form = $('#hz-search'), input = $('#hz-q'), box = $('#hz-results'), status = $('#hz-search-status');
    if (!form) return;
    if (window.innerWidth < 600) input.placeholder = 'Search lunch, picture day…';   // the long hint gets cut off on phones
    var docs = QUICK.map(function (q) { return { kind: 'quick', t: q.t, d: q.d, u: q.u, ext: q.ext, flash: q.flash, i: q.i, T: field(q.t), H: '', D: field(q.d), K: field(q.k) }; });
    var indexState = 'idle', events = null, hits = [], active = -1, today = etYMD();

    function loadIndex() {
      if (indexState !== 'idle') return;
      indexState = 'loading';
      getJSON('/data/search-index.json', 10000).then(function (d) {
        (d.pages || []).forEach(function (p) {
          docs.push({ kind: 'page', t: p.t, d: p.d || p.h, u: p.u, i: '📄', T: field(p.t), H: field(p.h), D: field(p.d), K: field(p.k) });
        });
        (d.faqs || []).forEach(function (f) {
          // Both PTOs answer "How do I donate?" -- say whose answer this is.
          docs.push({ kind: 'faq', t: f.q, d: (f.g ? f.g + ': ' : '') + f.a, u: f.u, i: '💬', T: field(f.q), H: '', D: field(f.g + ' ' + f.a), K: '' });
        });
        indexState = 'ready';
        if (input.value.trim()) run();
      }).catch(function () { indexState = 'idle'; });   // try again on the next keystroke
      loadEvents().then(function (list) { events = list; if (input.value.trim()) run(); }).catch(function () {});
    }

    function tokens(q) {
      var all = norm(q).split(' ').filter(Boolean);
      var t = all.filter(function (w) { return w.length > 1 && STOPQ.indexOf(' ' + w + ' ') < 0; });
      return (t.length ? t : all).map(stemW);
    }
    function alts(tok) { return [tok].concat(SYN[tok] || []); }
    function score(doc, toks) {
      var total = 0;
      for (var n = 0; n < toks.length; n++) {
        var best = 0, a = alts(toks[n]);
        for (var j = 0; j < a.length; j++) {
          var w = ' ' + a[j], f = j ? 0.8 : 1, s = 0;
          if (doc.T.indexOf(w + ' ') >= 0) s = 12;
          else if (doc.T.indexOf(w) >= 0) s = 8;
          else if (doc.H.indexOf(w) >= 0) s = 5;
          else if (doc.D.indexOf(w) >= 0) s = 3;
          else if (doc.K.indexOf(w) >= 0) s = 1.5;
          best = Math.max(best, s * f);
        }
        if (!best) return 0;   // every word has to match something
        total += best;
      }
      return total;
    }
    function eventDoc(e) {
      return { kind: 'event', ev: e, t: e.title, T: field(e.title), H: '', D: field(e.location + ' ' + GROUP_LABEL[e.group] + ' ' + fmt(e.date, { month: 'long' })), K: '' };
    }
    // Best n matches; anything far weaker than the best one is noise (a stray keyword), so it's dropped.
    function top(list, toks, n, phrase) {
      var ranked = list.map(function (doc) {
        var s = score(doc, toks);
        if (s && phrase && doc.T.indexOf(' ' + phrase + ' ') >= 0) s += 10;
        return { doc: doc, s: s };
      }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
      var floor = ranked.length ? ranked[0].s * 0.4 : 0;
      return ranked.filter(function (x) { return x.s >= floor; }).slice(0, n).map(function (x) { return x.doc; });
    }
    function mark(text, toks) {
      var words = [];
      toks.forEach(function (t) { words = words.concat(alts(t)); });
      var parts = String(text || '').split(new RegExp('\\b(' + words.map(escRe).join('|') + ')', 'i'));
      return parts.map(function (p, i) { return i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p); }).join('');
    }
    function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }

    function run() {
      var q = input.value.trim(), toks = tokens(q);
      form.classList.toggle('has-q', !!q);
      if (!q || !toks.length) { close(); return; }
      loadIndex();
      var phrase = toks.join(' ');
      // Upcoming events, each title once (a monthly "PTO Meeting" shows its next date only).
      var seenEv = {}, upcoming = (events || []).filter(function (e) { return (e.endDate || e.date) >= today; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        .filter(function (e) { var k = e.group + normTitle(e.title); if (seenEv[k]) return false; seenEv[k] = 1; return true; })
        .map(eventDoc);
      var groups = [
        ['Quick answers', top(docs.filter(function (d) { return d.kind === 'quick'; }), toks, 3, phrase)],
        ['Pages', top(docs.filter(function (d) { return d.kind === 'page'; }), toks, 6, phrase)],
        ['Questions & answers', top(docs.filter(function (d) { return d.kind === 'faq'; }), toks, 3, phrase)],
        ['Upcoming events', top(upcoming, toks, 4, phrase).sort(function (a, b) { return a.ev.date < b.ev.date ? -1 : 1; })]
      ];
      hits = []; active = -1;
      var html = groups.filter(function (g) { return g[1].length; }).map(function (g) {
        return '<div class="hz-r-group" role="group" aria-label="' + esc(g[0]) + '"><div class="hz-r-label" aria-hidden="true">' + esc(g[0]) + '</div>' +
          g[1].map(function (doc) {
            var n = hits.push(doc) - 1, ico, sub, href;
            if (doc.kind === 'event') {
              var e = doc.ev;
              ico = '<span class="hz-r-ico is-date" aria-hidden="true"><small>' + fmt(e.date, { month: 'short' }) + '</small>' + ymdDate(e.date).getUTCDate() + '</span>';
              sub = whenText(e, today) + ' · ' + GROUP_LABEL[e.group] + (e.location ? ' · ' + e.location : '');
              href = e.href || '#hz-calendar-section';
            } else {
              ico = '<span class="hz-r-ico" aria-hidden="true">' + doc.i + '</span>';
              sub = clip(doc.d, 150);
              href = doc.u;
            }
            return '<a class="hz-r" role="option" id="hz-r-' + n + '" data-n="' + n + '" tabindex="-1" aria-selected="false" href="' + esc(href) + '"' +
              (doc.ext ? ' target="_blank" rel="noopener"' : '') + '>' + ico +
              '<span class="hz-r-main"><span class="hz-r-t">' + mark(doc.t, toks) + (doc.ext ? ' ↗' : '') + '</span>' +
              (sub ? '<span class="hz-r-d">' + (doc.kind === 'event' ? esc(sub) : mark(sub, toks)) + '</span>' : '') + '</span></a>';
          }).join('') + '</div>';
      }).join('');
      if (!hits.length) {
        html = indexState === 'loading' ? '<div class="hz-r-empty">Searching…</div>' :
          '<div class="hz-r-empty"><b>No matches for “' + esc(q) + '”.</b><br>Try a simpler word like “dance” or “yearbook”, browse the <a href="faq.html">FAQs</a>, or <a href="contact.html">ask the PTO</a> and we\'ll point you in the right direction.</div>';
      }
      box.innerHTML = html;
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      input.removeAttribute('aria-activedescendant');
      status.textContent = hits.length ? hits.length + ' result' + (hits.length === 1 ? '' : 's') + '. Use the up and down arrows to choose.' : (indexState === 'loading' ? '' : 'No results.');
    }
    function close() {
      box.hidden = true; box.innerHTML = ''; hits = []; active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function setActive(n) {
      if (!hits.length) return;
      active = (n + hits.length) % hits.length;
      [].forEach.call(box.querySelectorAll('.hz-r'), function (el) { el.setAttribute('aria-selected', +el.getAttribute('data-n') === active ? 'true' : 'false'); });
      var el = $('#hz-r-' + active);
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
    // Returns true when it handled the result itself (an event, or a spot on this page).
    function choose(doc) {
      if (!doc) return false;
      if (doc.kind === 'event') { close(); openEvent(doc.ev); return true; }
      if (doc.u.charAt(0) === '#') { close(); input.blur(); goTo(doc.u, doc.flash); return true; }
      return false;
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { loadIndex(); if (input.value.trim()) run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (box.hidden) run(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Escape') { if (!box.hidden) { close(); e.preventDefault(); } }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (box.hidden) run();
      var doc = hits[active >= 0 ? active : 0];
      if (!doc || choose(doc)) return;
      if (doc.ext) window.open(doc.u, '_blank', 'noopener');
      else location.href = doc.kind === 'event' ? doc.ev.href : doc.u;
    });
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus in the box while clicking
    box.addEventListener('click', function (e) {
      var a = e.target.closest('.hz-r');
      if (a && choose(hits[+a.getAttribute('data-n')])) e.preventDefault();
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
    // The top menu's search icon links to index.html#search: jump to the box.
    function focusFromHash() {
      if (location.hash !== '#search') return;
      form.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
    }
    window.addEventListener('hashchange', focusFromHash);
    focusFromHash();
    // Arriving from another page's sidebar search (index.html?q=…): show those results.
    var startQ = new URLSearchParams(location.search).get('q');
    if (startQ) {
      input.value = startQ.slice(0, 100);
      input.focus();
      run();
    }
    // "/" jumps to the search box from anywhere on the page.

    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  }

  // Scroll to a spot on this page; a card can pulse once so the eye lands on it.
  function goTo(hash, flashCls) {
    var el = $(hash);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    if (hash === '#hz-calendar-section') setFilter('all');
    el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    var card = flashCls ? $('.' + flashCls) : null;
    if (card) {
      card.classList.remove('hz-flash'); void card.offsetWidth; card.classList.add('hz-flash');
      setTimeout(function () { card.classList.remove('hz-flash'); }, 1700);
    }
  }
  function initJumpLinks() {
    // The "Popular" chips and "Add school calendars" link scroll within the page.
    document.querySelectorAll('a[href^="#"][data-flash], a[href="#hz-subscribe"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goTo(a.getAttribute('href'), a.getAttribute('data-flash')); });
    });
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
    initDayEvents();
    initCalendar();
    initSearch();
    initJumpLinks();
    initMoments();
    var y = $('#hz-year'); if (y) y.textContent = new Date().getFullYear();
  }
  // Loaded right after the page content (before the Firebase scripts), so everything it
  // needs is already in the DOM -- start now instead of waiting for DOMContentLoaded.
  boot();
})();
