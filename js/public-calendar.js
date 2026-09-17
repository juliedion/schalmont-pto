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
  // A page/event's routing school -- shared with several schools routes to 'pto',
  // matching how the rest of the site (p.html, page-menu.js) already routes pages.
  function routeOf(schools) {
    return (Array.isArray(schools) && schools.length === 1) ? schools[0] : 'pto';
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
      var byKey = {};   // title+date -> merged event

      eventsSnap.docs.forEach(function (d) {
        if (BOOKKEEPING[d.id] || d.id.indexOf('__') === 0) return;
        var e = d.data();
        if (!e.title || !e.date) return;
        // The district's own school-closing/early-release entries already have their own
        // District tab (the embedded Google Calendar) -- keep them out of the back-office
        // tabs so they don't show twice, once here and once under School PTO (MS & HS).
        if (e.category === 'District Calendar' || e.source === 'gcal') return;
        var key = e.title.trim().toLowerCase() + '|' + e.date;
        byKey[key] = {
          title: e.title, date: e.date, time: e.time || '',
          location: e.location || '', school: e.school || 'pto', href: null
        };
      });

      pagesSnap.docs.forEach(function (d) {
        var p = d.data();
        if (!p.eventDate || !p.title || !p.slug) return;
        var key = p.title.trim().toLowerCase() + '|' + p.eventDate;
        var sch = routeOf(Array.isArray(p.schools) && p.schools.length ? p.schools : (p.school ? [p.school] : []));
        var prefix = { woestina: 'woestina', jefferson: 'jes', middle: 'ms', high: 'hs', pto: 'pto' }[sch] || 'pto';
        var href = '/' + prefix + '/' + p.slug;
        var existing = byKey[key];
        if (existing) {
          existing.href = href;
          if (p.eventTime) existing.time = p.eventTime;
          if (p.eventLocation) existing.location = p.eventLocation;
        } else {
          byKey[key] = {
            title: p.title, date: p.eventDate, time: p.eventTime || '',
            location: p.eventLocation || '', school: sch, href: href
          };
        }
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

  function renderMonth(container, events, year, month) {
    container.querySelector('.pcal-month-label').textContent =
      new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    var byDate = {};
    events.forEach(function (e) {
      (byDate[e.date] = byDate[e.date] || []).push(e);
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

    container.querySelector('.pcal-grid').innerHTML = cells.join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('.pcal-cal[data-school]');
    if (!containers.length || !window.firebase || !firebase.apps || !firebase.apps.length) return;

    var state = { year: new Date().getFullYear(), month: new Date().getMonth() };
    var allEvents = [];

    containers.forEach(buildShell);

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
    }).catch(function () {
      containers.forEach(function (el) {
        el.querySelector('.pcal-grid').innerHTML =
          '<div class="pcal-cell pcal-cell-empty" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-light)">Could not load the calendar right now.</div>';
      });
    });
  });
})();
