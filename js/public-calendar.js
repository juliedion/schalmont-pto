/* ============================================================
   Public "Sort by" calendar on the homepage — pulls straight from the
   back office's own Firestore data (pto_events + published pages with
   an event date) instead of a separately-maintained Google Calendar.
   No manual sync step: whatever's in the back office calendar shows
   up here automatically.

   Renders a month grid (like a normal calendar) into each
   `.pcal-cal[data-school]` container already on the page. All panels
   share one current month; switching a "Sort by" tab just shows/hides
   the pre-built grid for that school.
   ============================================================ */
(function () {
  var SCHOOL_LABEL = { woestina: 'Woestina Pre-K', jefferson: 'Jefferson Elementary',
    middle: 'Middle School', high: 'High School', pto: 'Schalmont PTO' };
  var SCHOOL_COLOR = { woestina: '#8bc341', jefferson: '#6bb044', middle: '#087d40',
    high: '#044d2a', pto: '#295c38' };
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function prettyTime(hm) {
    if (!hm) return '';
    var p = hm.split(':');
    if (p.length < 2) return hm;
    var h = +p[0], m = p[1], ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  }
  // A page/event's routing school -- shared with several schools routes to 'pto', no
  // school at all routes to '' (prefix-less), matching how the rest of the site
  // (p.html, admin-core.js) already routes pages.
  function routeOf(schools) {
    if (Array.isArray(schools) && schools.length === 1) return schools[0];
    return (Array.isArray(schools) && schools.length === 0) ? '' : 'pto';
  }

  // Every visit to the homepage or any school page calls this -- cache the result in
  // sessionStorage for a few minutes so browsing several pages in one visit doesn't
  // re-read both collections from Firestore each time.
  var CACHE_KEY = 'pcalEvents', CACHE_MS = 10 * 60000;
  function loadEvents() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.events);
    } catch (_) { /* sessionStorage blocked or corrupt -- fetch fresh below */ }

    var db = firebase.firestore();
    var BOOKKEEPING = { meta_deleted: true, meta_gcal: true };

    return Promise.all([
      db.collection('pto_events').where('status', 'in', ['planned', 'confirmed', 'done']).get(),
      db.collection('pages').where('status', '==', 'published').get()
    ]).then(function (results) {
      var eventsSnap = results[0], pagesSnap = results[1];
      var byKey = {};       // title+date -> merged event
      var pageByTitle = {}; // title alone -> {href, time, location} (first match wins)

      pagesSnap.docs.forEach(function (d) {
        var p = d.data();
        if (!p.title || !p.slug) return;
        var titleKey = p.title.trim().toLowerCase();
        var sch = routeOf(Array.isArray(p.schools) && p.schools.length ? p.schools : (p.school ? [p.school] : []));
        var prefix = { woestina: 'woestina', jefferson: 'jefferson', middle: 'ms', high: 'hs', pto: 'pto' }[sch];
        var href = prefix ? '/' + prefix + '/' + p.slug : '/' + p.slug;
        if (!pageByTitle[titleKey]) {
          pageByTitle[titleKey] = { href: href, time: p.eventTime || '', location: p.eventLocation || '' };
        }
        if (!p.eventDate) return;
        var key = titleKey + '|' + p.eventDate;
        var endDate = p.eventEndDate && p.eventEndDate > p.eventDate ? p.eventEndDate : '';
        byKey[key] = {
          title: p.title, date: p.eventDate, endDate: endDate, time: p.eventTime || '',
          location: p.eventLocation || '', school: sch, href: href
        };
      });

      eventsSnap.docs.forEach(function (d) {
        if (BOOKKEEPING[d.id] || d.id.indexOf('__') === 0) return;
        var e = d.data();
        if (!e.title || !e.date) return;
        // The district's own school-closing/early-release entries already have their own
        // District tab (the embedded Google Calendar) -- keep them out of the back-office
        // tabs so they don't show twice, once here and once under School PTO (MS & HS).
        if (e.category === 'District Calendar' || e.source === 'gcal') return;
        var titleKey = e.title.trim().toLowerCase();
        var key = titleKey + '|' + e.date;
        // Link to a page with the same title even if its own event date has drifted from
        // this tracker row's date -- same "close enough" match the back office's own
        // calendar already uses to send a click to the right page/editor.
        var pageMatch = pageByTitle[titleKey];
        var existing = byKey[key];
        byKey[key] = {
          title: e.title, date: e.date, endDate: e.endDate && e.endDate > e.date ? e.endDate : (existing ? existing.endDate : ''),
          time: e.time || (existing ? existing.time : ''),
          location: e.location || (existing ? existing.location : ''),
          school: e.school || 'pto',
          href: (existing && existing.href) || (pageMatch && pageMatch.href) || null
        };
      });

      var events = Object.keys(byKey).map(function (k) { return byKey[k]; });
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), events: events })); } catch (_) {}
      return events;
    });
  }

  function eventsForSchool(events, school) {
    if (school === 'all') return events;
    if (school === 'schalmont') return events.filter(function (e) { return e.school === 'middle' || e.school === 'high' || e.school === 'pto'; });
    return events.filter(function (e) { return e.school === school; });
  }

  function buildShell(container) {
    container.innerHTML =
      '<div class="pcal-head">' +
        '<button type="button" class="pcal-nav" data-dir="-1" aria-label="Previous month">&#8249;</button>' +
        '<div class="pcal-month-label"></div>' +
        '<button type="button" class="pcal-nav" data-dir="1" aria-label="Next month">&#8250;</button>' +
      '</div>' +
      '<div class="pcal-weekdays">' + WEEKDAYS.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>' +
      '<div class="pcal-grid"></div>';
  }

  // Shared by the "Sort by" month tabs and the "Coming up" widget's own Month view.
  function monthCellsHtml(events, year, month) {
    var byDate = {};
    events.forEach(function (e) {
      if (!e.endDate) { (byDate[e.date] = byDate[e.date] || []).push(e); return; }
      // Multi-day event -- show it on every day from start to end, not just the first.
      var cur = new Date(e.date + 'T00:00:00'), last = new Date(e.endDate + 'T00:00:00');
      for (var guard = 0; cur <= last && guard < 62; guard++) {
        (byDate[cur.toISOString().slice(0, 10)] = byDate[cur.toISOString().slice(0, 10)] || []).push(e);
        cur.setDate(cur.getDate() + 1);
      }
    });

    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayStr = new Date().toISOString().slice(0, 10);

    var cells = [];
    for (var i = 0; i < firstDow; i++) cells.push('<div class="pcal-cell pcal-cell-empty"></div>');
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = ymd(year, month, d);
      var dayEvents = (byDate[dateStr] || []).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      var shown = dayEvents.slice(0, 3);
      var pills = shown.map(function (e) {
        var color = SCHOOL_COLOR[e.school] || 'var(--primary)';
        var label = (e.time ? prettyTime(e.time) + ' ' : '') + esc(e.title);
        var titleAttr = esc(e.title) + (e.location ? ' — ' + esc(e.location) : '');
        return e.href
          ? '<a href="' + esc(e.href) + '" class="pcal-pill" style="border-left-color:' + color + '" title="' + titleAttr + '">' + label + '</a>'
          : '<span class="pcal-pill" style="border-left-color:' + color + '" title="' + titleAttr + '">' + label + '</span>';
      }).join('');
      var more = dayEvents.length > 3 ? '<div class="pcal-more">+' + (dayEvents.length - 3) + ' more</div>' : '';
      cells.push('<div class="pcal-cell' + (dateStr === todayStr ? ' pcal-cell-today' : '') + '">' +
        '<div class="pcal-daynum">' + d + '</div>' + pills + more + '</div>');
    }
    // Pad the trailing row out to a full week for a tidy grid.
    while (cells.length % 7 !== 0) cells.push('<div class="pcal-cell pcal-cell-empty"></div>');
    return cells.join('');
  }

  function renderMonth(container, events, year, month) {
    var label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var now = new Date(), monthDiff = (year - now.getFullYear()) * 12 + (month - now.getMonth());
    if (monthDiff > 0) label += ' (Next month)';
    else if (monthDiff < 0) label += ' (Last month)';
    container.querySelector('.pcal-month-label').textContent = label;
    container.querySelector('.pcal-grid').innerHTML = monthCellsHtml(events, year, month);
  }

  function pweekItemHtml(e) {
    var color = SCHOOL_COLOR[e.school] || 'var(--primary)';
    var schoolLabel = SCHOOL_LABEL[e.school] || 'PTO';
    var meta = [e.time ? prettyTime(e.time) : '', e.location].filter(Boolean).join(' &middot; ');
    var inner = '<span class="pweek-title">' + esc(e.title) + '</span>' +
      (meta ? '<span class="pweek-meta">' + meta + '</span>' : '') +
      '<span class="pweek-school" style="color:' + color + '">' + esc(schoolLabel) + '</span>';
    return (e.href ? '<a href="' + esc(e.href) + '" class="pweek-item"' : '<div class="pweek-item"') +
      ' style="border-left-color:' + color + '">' + inner + (e.href ? '</a>' : '</div>');
  }

  // Day/Week views of the "Coming up" widget -- one column per day (1 for Day, 7 for
  // Week), laid out side by side instead of stacked, each showing every event that day
  // (or a quiet "No events" note) so every day in the range gets its own slot whether or
  // not anything's scheduled -- same merged event list as the Month view and the "Sort
  // by" tabs below.
  function renderDayColumns(container, events, numDays) {
    var byDate = {};
    events.forEach(function (e) {
      var cur = new Date(e.date + 'T00:00:00'), last = new Date((e.endDate || e.date) + 'T00:00:00');
      for (var guard = 0; cur <= last && guard < 62; guard++) {
        var ds = cur.toISOString().slice(0, 10);
        (byDate[ds] = byDate[ds] || []).push(e);
        cur.setDate(cur.getDate() + 1);
      }
    });

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());
    var cols = [];
    for (var i = 0; i < numDays; i++) {
      var d = new Date(today); d.setDate(d.getDate() + i);
      var ds = ymd(d.getFullYear(), d.getMonth(), d.getDate());
      var dayEvents = (byDate[ds] || []).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      var label = numDays === 1
        ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      var body = dayEvents.length
        ? '<div class="pweek-items">' + dayEvents.map(pweekItemHtml).join('') + '</div>'
        : '<div class="pweek-col-empty">No events</div>';
      cols.push('<div class="pweek-col"><div class="pweek-col-label' + (ds === todayStr ? ' is-today' : '') + '">' +
        esc(label) + '</div>' + body + '</div>');
    }
    container.style.setProperty('--pweek-cols', numDays);
    container.innerHTML = '<div class="pweek-cols">' + cols.join('') + '</div>';
  }

  // Month view of the "Coming up" widget -- the current calendar month, reusing the
  // exact same grid the "Sort by" tabs use below, just for every school merged together
  // and with no prev/next navigation (that's what the tabs are for).
  function renderMonthView(container, events) {
    var now = new Date();
    container.style.removeProperty('--pweek-cols');
    container.innerHTML =
      '<div class="pcal-weekdays">' + WEEKDAYS.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>' +
      '<div class="pcal-grid">' + monthCellsHtml(events, now.getFullYear(), now.getMonth()) + '</div>';
  }

  var UPCOMING_COPY = {
    day: { heading: 'Coming up today!', sub: 'Everything on the calendar across all four schools for today.' },
    week: { heading: 'Coming up this week!', sub: 'Everything on the calendar across all four schools for the next 7 days.' },
    month: { heading: 'Coming up this month!', sub: 'Everything on the calendar across all four schools this month.' }
  };
  function renderUpcoming(container, events, mode) {
    var copy = UPCOMING_COPY[mode] || UPCOMING_COPY.week;
    var heading = document.getElementById('pweek-heading'), sub = document.getElementById('pweek-sub');
    if (heading) heading.textContent = copy.heading;
    if (sub) sub.textContent = copy.sub;
    if (mode === 'month') { renderMonthView(container, events); return; }
    if (mode === 'day') { renderDayColumns(container, events, 1); return; }
    renderDayColumns(container, events, 7);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('.pcal-cal[data-school]');
    var weekEl = document.getElementById('pweek-list');
    var toggleEl = document.getElementById('pweek-toggle');
    if ((!containers.length && !weekEl) || !window.firebase || !firebase.apps || !firebase.apps.length) return;

    var state = { year: new Date().getFullYear(), month: new Date().getMonth() };
    var allEvents = [];
    var upcomingMode = 'week';

    containers.forEach(buildShell);

    if (toggleEl) {
      toggleEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-mode]');
        if (!btn || !weekEl) return;
        upcomingMode = btn.dataset.mode;
        toggleEl.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        renderUpcoming(weekEl, allEvents, upcomingMode);
      });
    }

    function renderAll() {
      containers.forEach(function (el) {
        var school = el.getAttribute('data-school');
        renderMonth(el, eventsForSchool(allEvents, school), state.year, state.month);
      });
    }

    containers.forEach(function (el) {
      el.addEventListener('click', function (e) {
        var btn = e.target.closest('.pcal-nav');
        if (!btn) return;
        state.month += (+btn.dataset.dir);
        if (state.month < 0) { state.month = 11; state.year--; }
        if (state.month > 11) { state.month = 0; state.year++; }
        renderAll();
      });
    });

    loadEvents().then(function (events) {
      allEvents = events;
      renderAll();
      if (weekEl) renderUpcoming(weekEl, events, upcomingMode);
    }).catch(function () {
      containers.forEach(function (el) {
        el.querySelector('.pcal-grid').innerHTML =
          '<div class="pcal-cell pcal-cell-empty" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-light)">Could not load the calendar right now.</div>';
      });
      if (weekEl) weekEl.innerHTML = '<div class="pweek-empty">Could not load this week\'s events right now.</div>';
    });
  });
})();
