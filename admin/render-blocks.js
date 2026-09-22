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
      // Same-origin embeds are always allowed (e.g. our own /signup.html sheets).
      if (u.origin === window.location.origin) return u.href;
      if (u.protocol !== 'https:') return '';
      return ok.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : '';
    } catch (_) { return ''; }
  }

  // Alignment applies to heading, paragraph and button blocks. Left is the default and
  // needs no inline style; center/right are set explicitly on the block's own element.
  function alignStyle(b) {
    return (b.align === 'center' || b.align === 'right') ? ` style="text-align:${b.align}"` : '';
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'heading': {
        const lvl = b.level === 3 ? 'h3' : b.level === 1 ? 'h1' : 'h2';
        return `<${lvl}${alignStyle(b)}>${e(b.text)}</${lvl}>`;
      }
      case 'paragraph':
        return e(b.text).split(/\n{2,}/).map(p =>
          `<p${alignStyle(b)}>${p.replace(/\n/g, '<br>')}</p>`).join('');
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
        return `<p${alignStyle(b)}><a class="${cls}" href="${e(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ''}>${e(b.label || 'Button')}</a></p>`;
      }
      case 'divider':
        return '<hr>';
      case 'columns': {
        // A responsive row of 2-4 cells, each its own mini stack of blocks. Stacks to
        // one column on phones. Older pages made before a cell could hold real blocks
        // still have the simple imageUrl/heading/body/buttonLabel fields -- those are
        // rendered the old way so nothing already published breaks.
        const n = [2, 3, 4].includes(b.count) ? b.count : 2;
        const cells = (b.cells || []).slice(0, n);
        while (cells.length < n) cells.push({});
        const inner = cells.map(c => {
          let h = '';
          if (Array.isArray(c.blocks) && c.blocks.length) {
            h = c.blocks.map(renderBlock).join('');
          } else {
            if (c.imageUrl) h += `<img src="${e(c.imageUrl)}" alt="${e(c.imageAlt || '')}" style="max-width:100%;border-radius:8px">`;
            if (c.heading)  h += `<h3>${e(c.heading)}</h3>`;
            if (c.body)     h += e(c.body).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
            if (c.buttonLabel) {
              const href = /^https?:|^mailto:|^\//.test(c.buttonHref || '') ? c.buttonHref : '#';
              h += `<p><a class="pg-btn" href="${e(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ''}>${e(c.buttonLabel)}</a></p>`;
            }
          }
          // An empty cell renders nothing publicly -- the "Empty column" placeholder
          // some viewers see is a CSS-only hint scoped to the editor's own preview
          // (#preview .pg-col-empty::after in admin.css), never real page content.
          return `<div class="pg-col${h ? '' : ' pg-col-empty'}">${h}</div>`;
        }).join('');
        return `<div class="pg-cols pg-cols-${n}">${inner}</div>`;
      }
      case 'signup': {
        if (!b.sheetId) return '';
        // The actual slots + sign-up form render right here, mounted at runtime by
        // js/signup-embed.js (needs Firestore, which isn't available while this
        // string is being built) -- see mountSignupEmbeds() in the calling page.
        return `<div>
                  <strong>${e(b.sheetTitle || 'Sign-Up Sheet')}</strong>
                  ${b.note ? `<p style="margin:4px 0 12px;color:var(--text-light);font-size:14px">${e(b.note)}</p>` : ''}
                  <div class="pg-su-embed" data-signup-id="${e(b.sheetId)}"><p style="color:var(--text-light)">Loading sign-up sheet…</p></div>
                </div>`;
      }
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

  /* The internal reminder to file the district's official facility-use PDF -- not a
     website form, since that process legally requires a wet signature and a submitted
     Certificate of Liability reviewed by the district itself. Shown only in the page
     editor's own live preview (never on the real public page -- it's a note for
     whoever is building the page, not visitors), and shown ABOVE the page title so it
     can't be missed. Kept separate from renderPageHeader() so the caller controls
     where it lands relative to the title. */
  global.renderFacilityNotice = function (page) {
    if (page.category !== 'events') return '';
    return `<div class="pg-facility-request">
      <a href="https://www.schalmont.org/wp-content/uploads/2023/03/Schalmont_Facilities_Use_Request_Form.pdf" target="_blank" rel="noopener" class="pg-btn outline">📋 Request Facility Use (District Form) →</a>
    </div>`;
  };

  /* Flyer image + event date/time/location card, shown above the blocks. */
  global.renderPageHeader = function (page) {
    let html = '';
    if (page.flyerUrl) {
      html += `<img src="${e(page.flyerUrl)}" alt="Event flyer" class="pg-flyer">`;
    }
    // A multi-day event shows as a range; an end date on or before the start is ignored.
    const endDate = page.eventDate && page.eventEndDate && page.eventEndDate > page.eventDate ? prettyDate(page.eventEndDate) : '';
    const date = prettyDate(page.eventDate) + (endDate ? ' – ' + endDate : '');
    const time = prettyTime(page.eventTime);
    const endTime = prettyTime(page.eventEndTime);
    const timeRange = time && endTime ? `${time} – ${endTime}` : time;
    const loc  = page.eventLocation;
    if (!page.hideEventBox && (date || timeRange || loc)) {
      html += '<div class="pg-eventbox">';
      if (date || timeRange) {
        html += `<div class="pg-eventrow"><span class="pg-eventicon">📅</span><span>${e(date)}${date && timeRange ? ' · ' : ''}${e(timeRange)}</span></div>`;
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
