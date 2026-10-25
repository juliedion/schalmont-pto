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

  /* ---- Ad spots: every <div data-ad="banner|square"> on a page is filled from data/ads.json
     (the one place to change ads). Several ads in a spot take turns; none -> "Advertise with us". */
  var adsPromise = null;
  function initAds() {
    var spots = document.querySelectorAll('[data-ad]:not([data-ad-done])');
    if (!spots.length) return;
    if (!adsPromise) adsPromise = fetch('/data/ads.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; });
    adsPromise.then(function (cfg) {
      [].forEach.call(spots, function (el, n) {
        el.setAttribute('data-ad-done', '');
        var kind = el.getAttribute('data-ad'), list = (cfg[kind] || []).filter(function (a) { return a && a.img; });
        el.classList.add('ad-spot', 'ad-' + kind);
        if (!list.length) {
          el.innerHTML = '<a class="ad-house" href="' + (cfg.advertiseLink || '/fundraisers.html#advertise') + '"><b>Your business here</b><span>Reach Schalmont families · Advertise with the PTO →</span></a>';
          return;
        }
        el.innerHTML = '<span class="ad-label">Sponsor</span>' + list.map(function (a, i) {
          return '<a class="ad-item" href="' + a.href + '" target="_blank" rel="noopener sponsored"' + (i ? ' hidden' : '') + '>' +
            '<img src="' + a.img + '" alt="' + String(a.name || 'Sponsor').replace(/"/g, '&quot;') + ' (advertisement)" loading="lazy"></a>';
        }).join('');
        var items = el.querySelectorAll('.ad-item'), cur = (n + Math.floor(Math.random() * items.length)) % items.length;
        [].forEach.call(items, function (it, i) { it.hidden = i !== cur; });
        if (items.length > 1 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
          setInterval(function () { items[cur].hidden = true; cur = (cur + 1) % items.length; items[cur].hidden = false; }, 10000);
        }
      });
    });
  }

  /* ---- Left menu: every upcoming PTO event from the calendar (data/sidebar-events.json, made
     by tools/sidebar-events.mjs), merged alphabetically into the main list. Events a fixed item
     already covers (its data-match regex) are skipped; each event drops off after it ends. */
  function sortKey(el) {
    var t = (el.getAttribute('data-sort') || el.textContent || '').trim().toLowerCase();
    return t.replace(/^(20\d\d\s+|the\s+|a\s+)/, '');
  }
  function sortMain(main) {
    [].slice.call(main.children).sort(function (a, b) { return sortKey(a).localeCompare(sortKey(b)); })
      .forEach(function (el) { main.appendChild(el); });
  }
  function initMenuEvents(root) {
    var main = (root || document).querySelector('.sn .sn-main');
    if (!main || main.dataset.events) return;
    main.dataset.events = '1';
    sortMain(main);
    var covers = [].map.call(main.querySelectorAll('[data-match]'), function (a) { try { return new RegExp(a.getAttribute('data-match'), 'i'); } catch (_) { return null; } }).filter(Boolean);
    var today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    fetch('/data/sidebar-events.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      var have = {};
      [].forEach.call(main.querySelectorAll('a'), function (a) { have[a.textContent.trim().toLowerCase()] = 1; });
      (d.events || []).forEach(function (e) {
        if (!e.title || (e.end || e.date) < today || have[e.title.toLowerCase()]) return;
        if (covers.some(function (re) { return re.test(e.title); })) return;
        var a = document.createElement('a');
        a.className = 'sn-item sn-event'; a.href = e.href || '/index.html#calendar'; a.textContent = e.title;
        if (norm(a.getAttribute('href')) === norm(location.pathname + location.search)) a.setAttribute('aria-current', 'page');
        main.appendChild(a);
      });
      sortMain(main);
    }).catch(function () {});
  }

  /* ---- "More" hint at the bottom of the left menu: the menu scrolls on its own, so when items
     are hidden below (a long list, or the footer coming up under it) a bar with a down arrow
     shows; clicking it scrolls the menu. It hides once you reach the end of the list. */
  function initMoreHint(root) {
    var nav = (root || document).querySelector('aside.sn');
    if (!nav || nav.querySelector('.sn-more')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sn-more'; btn.setAttribute('aria-label', 'Scroll the menu down for more');
    btn.innerHTML = '<span>More</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    nav.appendChild(btn);
    function update() {
      var rect = nav.getBoundingClientRect();
      var hiddenInside = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 12;   // more list below
      var cutOff = rect.bottom > window.innerHeight + 4;                             // menu runs past the screen
      btn.classList.toggle('is-on', hiddenInside || cutOff);
    }
    btn.addEventListener('click', function () {
      if (nav.scrollTop + nav.clientHeight < nav.scrollHeight - 12) nav.scrollBy({ top: Math.round(nav.clientHeight * 0.7), behavior: 'smooth' });
      else window.scrollBy({ top: Math.round(window.innerHeight * 0.6), behavior: 'smooth' });
    });
    nav.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // The menu grows when calendar events and ads load in, and when a school is opened.
    if (window.ResizeObserver) new ResizeObserver(update).observe(nav);
    nav.addEventListener('click', function () { setTimeout(update, 250); });
    setTimeout(update, 400); setTimeout(update, 2000);
    update();
  }

  function initAll(root) { initHeader(root); init(root); initAds(); initMenuEvents(root); initMoreHint(root); }
  window.initSidenav = initAll;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
})();
