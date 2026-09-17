/* ============================================================
   Public "Sort by" calendar on the homepage — pulls straight from the
   back office's own Firestore data (pto_events + published pages with
   an event date) instead of a separately-maintained Google Calendar.
   No manual sync step: whatever's in the back office calendar shows
   up here automatically.

   Renders a simple upcoming-events agenda list (not a full month grid)
   into each `.pcal-list[data-school]` container already on the page.
   ============================================================ */
(function () {
  var SCHOOL_LABEL = { woestina: 'Woestina Pre-K', jefferson: 'Jefferson Elementary',
    middle: 'Middle School', high: 'High School', pto: 'Schalmont PTO' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function prettyDate(ymd) {
    var p = (ymd || '').split('-');
    if (p.length !== 3) return ymd || '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d)) return ymd;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
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

  function loadEvents() {
    var db = firebase.firestore();
    var todayYmd = new Date().toISOString().slice(0, 10);
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

      return Object.keys(byKey).map(function (k) { return byKey[k]; })
        .filter(function (e) { return e.date >= todayYmd; })
        .sort(function (a, b) { return a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date < b.date ? -1 : 1; });
    });
  }

  function renderList(el, events) {
    if (!events.length) {
      el.innerHTML = '<p style="padding:32px 24px;text-align:center;color:var(--text-light)">No upcoming events on the calendar right now — check back soon.</p>';
      return;
    }
    el.innerHTML = events.map(function (e) {
      var meta = [prettyDate(e.date)];
      if (e.time) meta.push(prettyTime(e.time));
      if (e.location) meta.push(esc(e.location));
      var titleHtml = e.href
        ? '<a href="' + esc(e.href) + '" class="pcal-title">' + esc(e.title) + '</a>'
        : '<span class="pcal-title">' + esc(e.title) + '</span>';
      return '<div class="pcal-row">' +
        '<div class="pcal-date">' + esc(prettyDate(e.date)) + '</div>' +
        '<div class="pcal-body">' + titleHtml +
        '<div class="pcal-meta">' + meta.slice(1).join(' &middot; ') + ' &middot; ' + (SCHOOL_LABEL[e.school] || e.school) + '</div>' +
        '</div></div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('.pcal-list[data-school]');
    if (!containers.length || !window.firebase || !firebase.apps || !firebase.apps.length) return;
    loadEvents().then(function (events) {
      containers.forEach(function (el) {
        var school = el.getAttribute('data-school');
        var filtered = school === 'all' ? events
          : school === 'schalmont' ? events.filter(function (e) { return e.school === 'middle' || e.school === 'high' || e.school === 'pto'; })
          : events.filter(function (e) { return e.school === school; });
        renderList(el, filtered);
      });
    }).catch(function (e) {
      containers.forEach(function (el) {
        el.innerHTML = '<p style="padding:32px 24px;text-align:center;color:var(--text-light)">Could not load the calendar right now.</p>';
      });
    });
  });
})();
