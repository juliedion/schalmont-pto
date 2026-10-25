/* School-page calendar: the same compact calendar as the homepage (rolling 5 weeks on
   computers, a 2-week list on phones, bigger text), filtered to one PTO by default.
   Markup: <div class="scal" data-school-cal="jefferson|schalmont"></div>
   Needs js/public-calendar.js (window.PTOEventData) on the page; loads FullCalendar itself. */
(function () {
  var TZ = 'America/New_York';
  var GROUP = { woestina: 'jefferson', jefferson: 'jefferson', middle: 'schalmont', high: 'schalmont', pto: 'schalmont', '': 'schalmont', district: 'district' };
  var LABEL = { jefferson: 'Jefferson PTO', schalmont: 'Schalmont Central PTO', district: 'District' };
  var COLOR = { jefferson: '#63E629', schalmont: '#007A3D', district: '#2F5D8C' };
  var TEXT = { jefferson: '#002F20', schalmont: '#ffffff', district: '#ffffff' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function ymd(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: TZ }); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmt(s, o) { return new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, o)); }
  function dow(s) { return new Date(s + 'T12:00:00Z').getUTCDay(); }
  function prettyTime(hm) { var p = String(hm).split(':'), h = +p[0], m = p[1] || '00'; return (h % 12 || 12) + (m === '00' ? '' : ':' + m) + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function when(e) {
    var multi = e.endDate && e.endDate > e.date;
    var d = multi ? fmt(e.date, { month: 'short', day: 'numeric' }) + ' – ' + fmt(e.endDate, { month: 'short', day: 'numeric' }) : fmt(e.date, { weekday: 'long', month: 'long', day: 'numeric' });
    return d + ' · ' + (e.time ? prettyTime(e.time) : 'All day');
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/\b20\d\d\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

  function waitFor(test, ms) {
    return new Promise(function (ok, fail) {
      var t = 0; (function check() { if (test()) return ok(); if ((t += 150) > ms) return fail(); setTimeout(check, 150); })();
    });
  }
  function loadFC() {
    if (window.FullCalendar) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js';
      s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    });
  }
  var dataPromise = null;
  function loadEvents() {
    if (!dataPromise) dataPromise = waitFor(function () { return window.PTOEventData; }, 30000)
      .then(function () { return window.PTOEventData.loadAll(); })
      .then(function (r) {
        var seen = {};
        return (r.events || []).concat(r.district || []).map(function (e) {
          return { title: e.title, date: e.date, endDate: e.endDate || '', time: e.time || '', location: e.location || '', href: e.href || null, group: GROUP[e.school == null ? '' : e.school] || 'schalmont' };
        }).filter(function (e) { var k = e.group + '|' + norm(e.title) + '|' + e.date; if (seen[k]) return false; seen[k] = 1; return true; });
      });
    return dataPromise;
  }

  var dlg = null;
  function openEvent(e) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'scal-dialog';
      dlg.innerHTML = '<div class="scal-dlg-head"><span class="scal-dlg-tag"></span><h3></h3><button type="button" class="scal-dlg-x" aria-label="Close">✕</button></div><div class="scal-dlg-body"></div>';
      document.body.appendChild(dlg);
      dlg.querySelector('.scal-dlg-x').onclick = function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    }
    dlg.querySelector('.scal-dlg-tag').textContent = LABEL[e.group] || '';
    dlg.querySelector('h3').textContent = e.title;
    var maps = e.location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location) : '';
    dlg.querySelector('.scal-dlg-body').innerHTML = '<div>🕒 ' + esc(when(e)) + '</div>' +
      (e.location ? '<div>📍 <a href="' + esc(maps) + '" target="_blank" rel="noopener">' + esc(e.location) + '</a></div>' : '') +
      (e.href ? '<a class="btn btn-primary" href="' + esc(e.href) + '">Event details →</a>' : '');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function build(root) {
    var mine = root.getAttribute('data-school-cal') || 'all', filter = mine, calendar = null;
    var opts = [[mine, LABEL[mine]], ['all', 'All events'], ['district', 'District']].filter(function (o, i, a) { return o[1] && a.findIndex(function (x) { return x[0] === o[0]; }) === i; });
    root.innerHTML = '<div class="scal-filters" role="group" aria-label="Show events from">' + opts.map(function (o) {
      return '<button type="button" class="scal-filter" data-f="' + o[0] + '" aria-pressed="' + (o[0] === filter) + '">' + (COLOR[o[0]] ? '<i style="background:' + COLOR[o[0]] + '"></i>' : '') + esc(o[1]) + '</button>';
    }).join('') + '</div><div class="scal-cal"><p class="scal-status">Loading the calendar…</p></div>';
    root.querySelectorAll('.scal-filter').forEach(function (b) {
      b.onclick = function () {
        filter = b.getAttribute('data-f');
        root.querySelectorAll('.scal-filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (calendar) calendar.refetchEvents();
      };
    });
    var el = root.querySelector('.scal-cal');
    Promise.all([loadFC(), loadEvents()]).then(function (res) {
      var events = res[1], small = window.innerWidth < 640, today = ymd();
      el.innerHTML = '';
      calendar = new FullCalendar.Calendar(el, {
        initialView: small ? 'listUpcoming' : 'rolling5',
        initialDate: today, firstDay: dow(today), validRange: { start: today },
        headerToolbar: { left: 'prev,next today', center: 'title', right: small ? 'listUpcoming,listMonth' : 'rolling5,timeGridWeek' },
        buttonText: { today: 'Today', week: 'Week', listMonth: '30 days' },
        views: {
          rolling5: { type: 'dayGrid', duration: { weeks: 5 }, buttonText: 'Next 5 weeks' },
          listUpcoming: { type: 'list', duration: { days: 14 }, buttonText: '2 weeks' },
          listMonth: { type: 'list', duration: { days: 30 } }
        },
        height: 'auto', dayMaxEvents: false, eventDisplay: 'block',
        slotMinTime: '07:00:00', slotMaxTime: '22:00:00', scrollTime: '08:00:00',
        eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
        noEventsContent: 'Nothing on the calendar for this stretch.',
        events: function (info, ok) {
          var start = info.startStr.slice(0, 10);
          ok(events.filter(function (e) {
            if ((e.endDate || e.date) < today) return false;
            if (small && (e.endDate || e.date) < start) return false;
            return filter === 'all' || e.group === filter;
          }).map(function (e) {
            var multi = e.endDate && e.endDate > e.date, c = { backgroundColor: COLOR[e.group], borderColor: COLOR[e.group], textColor: TEXT[e.group], extendedProps: e };
            if (small && multi) return Object.assign({ title: e.title + ' (through ' + fmt(e.endDate, { month: 'short', day: 'numeric' }) + ')', allDay: true, start: e.date < start ? start : e.date }, c);
            var allDay = !e.time;
            return Object.assign({
              title: e.title, allDay: allDay,
              start: allDay ? e.date : e.date + 'T' + e.time,
              end: allDay ? (multi ? addDays(e.endDate, 1) : null) : (multi ? e.endDate + 'T23:59' : null)
            }, c);
          }));
        },
        eventDidMount: function (arg) {
          arg.el.setAttribute('tabindex', '0'); arg.el.setAttribute('role', 'button');
          arg.el.setAttribute('aria-label', arg.event.title + ', ' + LABEL[arg.event.extendedProps.group] + ', ' + when(arg.event.extendedProps));
          arg.el.addEventListener('keydown', function (k) { if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); openEvent(arg.event.extendedProps); } });
        },
        eventClick: function (arg) { arg.jsEvent.preventDefault(); openEvent(arg.event.extendedProps); }
      });
      calendar.render();
    }).catch(function () {
      el.innerHTML = '<p class="scal-status">The calendar couldn\'t be loaded right now. <a href="/index.html#calendar">Try the full calendar →</a></p>';
    });
  }

  function boot() { document.querySelectorAll('[data-school-cal]').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
