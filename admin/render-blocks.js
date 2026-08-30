/* ============================================================
   Shared block renderer
   Turns the list of blocks saved for a page into HTML.
   Used by BOTH the page editor (live preview) and the public
   page viewer (p.html) so they always look identical.
   ============================================================ */
(function (global) {
  function e(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  // allow only safe embed hosts for the Embed block
  function safeEmbedSrc(url) {
    try {
      const u = new URL(url, window.location.origin);
      const ok = ['docs.google.com', 'forms.gle', 'www.google.com', 'calendar.google.com',
                  'www.youtube.com', 'youtube.com', 'youtu.be', 'player.vimeo.com',
                  'www.instagram.com', 'www.facebook.com', 'drive.google.com'];
      if (u.protocol !== 'https:') return '';
      return ok.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : '';
    } catch (_) { return ''; }
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'heading': {
        const lvl = b.level === 3 ? 'h3' : b.level === 1 ? 'h1' : 'h2';
        return `<${lvl}>${e(b.text)}</${lvl}>`;
      }
      case 'paragraph':
        return e(b.text).split(/\n{2,}/).map(p =>
          `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      case 'list':
        return '<ul>' + (b.items || []).filter(Boolean)
          .map(i => `<li>${e(i)}</li>`).join('') + '</ul>';
      case 'image':
        return `<figure style="margin:0">
                  <img src="${e(b.url)}" alt="${e(b.alt || '')}" style="max-width:100%">
                  ${b.caption ? `<figcaption class="pg-caption">${e(b.caption)}</figcaption>` : ''}
                </figure>`;
      case 'button': {
        const cls = b.style === 'outline' ? 'pg-btn outline' : 'pg-btn';
        const href = /^https?:|^mailto:|^\//.test(b.href || '') ? b.href : '#';
        return `<p><a class="${cls}" href="${e(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ''}>${e(b.label || 'Button')}</a></p>`;
      }
      case 'divider':
        return '<hr>';
      case 'embed': {
        const src = safeEmbedSrc(b.src || '');
        return src
          ? `<iframe src="${e(src)}" loading="lazy" allowfullscreen></iframe>`
          : `<p style="color:#b00"><em>Embed not shown — the link must be an https:// address from Google Forms, Google Calendar, YouTube, Vimeo, Facebook or Instagram.</em></p>`;
      }
      default:
        return '';
    }
  }

  global.renderBlocks = function (blocks) {
    return (blocks || []).map(renderBlock).join('\n');
  };

  function prettyDate(ymd) {
    if (!ymd) return '';
    const p = ymd.split('-');
    if (p.length !== 3) return ymd;
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d)) return ymd;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function prettyTime(hm) {
    if (!hm) return '';
    const p = hm.split(':');
    if (p.length < 2) return hm;
    let h = +p[0]; const m = p[1];
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  }

  /* Flyer image + event date/time/location card, shown above the blocks */
  global.renderPageHeader = function (page) {
    let html = '';
    if (page.flyerUrl) {
      html += `<img src="${e(page.flyerUrl)}" alt="Event flyer" class="pg-flyer">`;
    }
    const date = prettyDate(page.eventDate);
    const time = prettyTime(page.eventTime);
    const loc  = page.eventLocation;
    if (date || time || loc) {
      html += '<div class="pg-eventbox">';
      if (date || time) {
        html += `<div class="pg-eventrow"><span class="pg-eventicon">📅</span><span>${e(date)}${date && time ? ' · ' : ''}${e(time)}</span></div>`;
      }
      if (loc) {
        const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc);
        html += `<div class="pg-eventrow"><span class="pg-eventicon">📍</span><a href="${e(maps)}" target="_blank" rel="noopener">${e(loc)}</a></div>`;
      }
      html += '</div>';
    }
    return html;
  };
})(window);
