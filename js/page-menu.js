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
      firebase.firestore().collection('pages')
        .where('school', '==', school)
        .where('showInLeftMenu', '==', true)
        .where('status', '==', 'published')
        .get()
        .then(function (snap) {
          snap.docs.forEach(function (d) {
            var p = d.data();
            if (!p.slug) return;
            var prefix = SCHOOL_PREFIX[school] || school;
            var a = document.createElement('a');
            a.href = '/' + prefix + '/' + p.slug;
            a.className = 'sidenav-item sub';
            a.textContent = p.title || 'Untitled';
            submenu.appendChild(a);
          });
        })
        .catch(function () { /* rules not published yet, or offline — leave menu as-is */ });
    } catch (e) { /* firestore not loaded on this page — leave menu as-is */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.sidenav-submenu[id^="snav-"]').forEach(function (submenu) {
      var school = submenu.id.replace(/^snav-/, '');
      addLinks(school, submenu);
    });
  });
})();
