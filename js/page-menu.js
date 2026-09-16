/* ============================================================
   Auto-adds back-office pages to the left "Browse" sidebar.
   When a PTO admin creates a page and checks "Show in left menu",
   it should show up here without anyone editing this file or the
   hardcoded sidenav markup on every school page.

   Each school page's sidebar has a <div class="sidenav-submenu"
   id="snav-<school>">…</div> already. On load, this queries the
   `pages` collection for that school's published, showInLeftMenu
   pages and appends a link into that submenu.
   ============================================================ */
(function () {
  var SCHOOL_PREFIX = { woestina: 'woestina', jefferson: 'jes', middle: 'ms', high: 'hs', pto: 'pto' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function addLinks(school, submenu) {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    try {
      var col = firebase.firestore().collection('pages');
      // A page's routing `school` is only set when it belongs to exactly one school --
      // a page shared by several schools (routed under /pto/...) only has `schools`,
      // an array, so it needs its own query to show up in each of those schools' menus.
      Promise.all([
        col.where('school', '==', school).where('showInLeftMenu', '==', true).where('status', '==', 'published').get(),
        col.where('schools', 'array-contains', school).where('showInLeftMenu', '==', true).where('status', '==', 'published').get()
      ]).then(function (results) {
        var seen = {};
        var prefix = SCHOOL_PREFIX[school] || school;
        results.forEach(function (snap) {
          snap.docs.forEach(function (d) {
            if (seen[d.id]) return;
            seen[d.id] = true;
            var p = d.data();
            if (!p.slug) return;
            // A shared page is routed under /pto/..., not this school's own prefix.
            var pagePrefix = (Array.isArray(p.schools) && p.schools.length > 1) ? 'pto' : prefix;
            var a = document.createElement('a');
            a.href = '/' + pagePrefix + '/' + p.slug;
            a.className = 'sidenav-item sub';
            a.textContent = p.title || 'Untitled';
            submenu.appendChild(a);
          });
        });
      }).catch(function () { /* rules not published yet, or offline — leave menu as-is */ });
    } catch (e) { /* firestore not loaded on this page — leave menu as-is */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.sidenav-submenu[id^="snav-"]').forEach(function (submenu) {
      var school = submenu.id.replace(/^snav-/, '');
      addLinks(school, submenu);
    });
  });
})();
