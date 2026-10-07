/* ============================================================
   Click-to-enlarge for photos built from the page editor's own
   Photo block (#pg-body img on a published p.html page). Opens a
   full-screen lightbox with Print / Download / Close -- a photo
   that's already a clickable link (href set on the Photo block,
   e.g. a QR code) keeps that link behavior instead; this only
   takes over a plain, unlinked photo's click.
   ============================================================ */
(function () {
  var overlay = null, curUrl = '', curAlt = '';

  function buildOverlay() {
    var ov = document.createElement('div');
    ov.id = 'pg-lightbox';
    ov.innerHTML =
      '<div class="pg-lb-backdrop"></div>' +
      '<div class="pg-lb-panel">' +
        '<img class="pg-lb-img" src="" alt="">' +
        '<div class="pg-lb-bar">' +
          '<button type="button" class="pg-lb-btn" data-act="download">⬇ Download</button>' +
          '<button type="button" class="pg-lb-btn" data-act="print">🖨 Print</button>' +
          '<button type="button" class="pg-lb-btn pg-lb-close" data-act="close" aria-label="Close">✕</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  function open(url, alt) {
    if (!overlay) overlay = buildOverlay();
    curUrl = url; curAlt = alt || '';
    var img = overlay.querySelector('.pg-lb-img');
    img.src = curUrl; img.alt = curAlt;
    overlay.classList.add('open');
    document.body.classList.add('pg-lb-lock');
  }
  function close() {
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('pg-lb-lock');
  }
  function download() {
    if (!curUrl) return;
    var a = document.createElement('a');
    a.href = curUrl;
    a.download = (curAlt || 'photo').trim().replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'photo';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // A hidden iframe, not a new window -- prints just the photo without tripping a
  // popup blocker (window.open can get blocked even from a direct click handler in
  // some browsers; an iframe never does).
  function doPrint() {
    if (!curUrl) return;
    var ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    ifr.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ifr);
    ifr.onload = function () {
      try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (_) {}
      setTimeout(function () { ifr.remove(); }, 1000);
    };
    ifr.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>' +
      'body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}' +
      'img{max-width:100%;max-height:100vh}</style></head><body><img src="' +
      curUrl.replace(/"/g, '&quot;') + '"></body></html>';
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest('#pg-body img');
    if (!img || img.closest('a')) return;
    e.preventDefault();
    open(img.currentSrc || img.src, img.alt);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.pg-lb-btn');
    if (btn) {
      var act = btn.dataset.act;
      if (act === 'close') close();
      else if (act === 'download') download();
      else if (act === 'print') doPrint();
      return;
    }
    if (e.target.classList && e.target.classList.contains('pg-lb-backdrop')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) close();
  });
})();
