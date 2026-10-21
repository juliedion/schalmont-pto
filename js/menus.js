/* ============================================================
   Site menus behaviour, shared by every page: the top navigation and
   the left sidebar. The markup itself is written into each page by
   tools/build_chrome.py (and into js/site-chrome.js for pages that draw
   their chrome with JS).

   Top navigation:
     • "Menu" button opens the whole menu on tablets and phones
     • each dropdown opens on click (and on hover with a mouse), closes on
       Escape or a click elsewhere
     • the current page, and the menu it lives in, are highlighted

   Left sidebar:
     • each school opens/closes with its button (no surprise page jumps)
     • the school you're in opens by itself: its school page, its class
       pages, or one of its event pages
     • the page you're on is highlighted
   ============================================================ */
(function () {
  'use strict';
  // The live site's .htaccess serves /about for about.html -- compare without ".html".
  function norm(href) {
    var a = document.createElement('a');
    a.href = href;
    return (a.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/') + a.hash;
  }

  function init(root) {
    var nav = (root || document).querySelector('.sn');
    if (!nav || nav.dataset.ready) return;
    nav.dataset.ready = '1';
    var here = norm(location.pathname), hereHash = norm(location.pathname + location.hash);

    function setOpen(group, open) {
      var btn = group.querySelector('.sn-school-btn'), panel = group.querySelector('.sn-sub');
      group.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
    }
    nav.querySelectorAll('.sn-school').forEach(function (g) {
      g.querySelector('.sn-school-btn').addEventListener('click', function () { setOpen(g, !g.classList.contains('is-open')); });
    });

    // Highlight the current page (an exact #anchor match wins over the page itself).
    function mark() {
      var best = null;
      nav.querySelectorAll('a[href]').forEach(function (a) {
        a.removeAttribute('aria-current');
        var h = norm(a.getAttribute('href'));
        if (h === hereHash) best = a;
        else if (!best && h === here) best = a;
      });
      if (best) {
        best.setAttribute('aria-current', 'page');
        var g = best.closest('.sn-school');
        if (g) setOpen(g, true);
      }
    }
    mark();
    // js/page-menu.js adds each school's event pages a moment later -- re-check then.
    nav.addEventListener('sn:links', mark);
  }

  function initHeader(root) {
    var head = (root || document).querySelector('.sh');
    if (!head || head.dataset.ready) return;
    head.dataset.ready = '1';
    var toggle = head.querySelector('.sh-toggle');
    var groups = [].slice.call(head.querySelectorAll('.sh-has'));
    function close(except) {
      groups.forEach(function (g) {
        if (g === except) return;
        g.classList.remove('is-open');
        g.querySelector('.sh-top').setAttribute('aria-expanded', 'false');
      });
    }
    groups.forEach(function (g) {
      var btn = g.querySelector('.sh-top');
      btn.addEventListener('click', function () {
        var open = !g.classList.contains('is-open');
        close(g);
        g.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    if (toggle) toggle.addEventListener('click', function () {
      var open = head.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('span').textContent = open ? 'Close' : 'Menu';
    });
    document.addEventListener('click', function (e) { if (!head.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var openG = groups.filter(function (g) { return g.classList.contains('is-open'); })[0];
      close();
      if (openG) openG.querySelector('.sh-top').focus();
      else if (head.classList.contains('menu-open') && toggle) { toggle.click(); toggle.focus(); }
    });
    // Highlight the page you're on, and the menu that holds it.
    var here = norm(location.pathname), hereHash = norm(location.pathname + location.hash);
    head.querySelectorAll('.sh-menu a[href]').forEach(function (a) {
      var h = norm(a.getAttribute('href'));
      if (h === hereHash || (h === here && a.getAttribute('href').indexOf('#') < 0)) {
        a.setAttribute('aria-current', 'page');
        var g = a.closest('.sh-has');
        (g ? g.querySelector('.sh-top') : a).classList.add('is-current');
      }
    });
  }

  function initAll(root) { initHeader(root); init(root); }
  window.initSidenav = initAll;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
})();
