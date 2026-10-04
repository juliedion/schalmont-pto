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

  // A heading/subhead's text can carry light formatting (bold/italic/underline/font-size
  // always; bullet and numbered lists only when it's rendered as a "Paragraph"-style div,
  // since a real <h1>-<h3> can't legally contain a <ul>/<ol>). Only ever keeps this small
  // safe set of tags, and on SPAN only a font-size style -- strips every other attribute,
  // so admin-authored formatting can never carry a script, style or event handler onto
  // the public page. Used both when the editor cleans up what was typed and when the
  // public page renders it.
  const RICH_INLINE_TAGS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1 };
  const RICH_BLOCK_TAGS = { UL: 1, OL: 1, LI: 1 };
  // Tags a contenteditable region commonly wraps a new line in (Chrome/Firefox/Safari
  // all differ here) -- in inline-only mode (a real <h1>-<h3>, which can't legally
  // contain block children) these get unwrapped like anything else disallowed, but
  // unlike a plain stray wrapper, a <br> has to go in their place or the line break
  // itself silently disappears along with the tag.
  const LINE_WRAPPER_TAGS = { DIV: 1, P: 1, LI: 1 };
  // execCommand('fontSize', ...) (the editor's font-size picker) writes legacy
  // <font size="N">, 1-7 -- normalize to a span with an actual pixel size.
  const FONT_SIZE_PX = { '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
  function sanitizeRichText(html, inlineOnly) {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html == null ? '' : html);
    [...tmp.querySelectorAll('font')].forEach(f => {
      const span = document.createElement('span');
      const px = FONT_SIZE_PX[f.getAttribute('size')];
      if (px) span.style.fontSize = px;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
    });
    (function clean(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 1) {
          const allowed = RICH_INLINE_TAGS[child.tagName] || (!inlineOnly && RICH_BLOCK_TAGS[child.tagName]);
          if (!allowed) {
            // A line-wrapper tag (a contenteditable's own "new line" element -- which
            // browser differs) means "start a new line here", so its promoted content
            // needs a <br> right before it to keep that line break -- unless it's the
            // very first thing in the field, where there's nothing to break away from.
            const needsBreak = inlineOnly && LINE_WRAPPER_TAGS[child.tagName] && child.previousSibling;
            const first = child.firstChild;
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            if (needsBreak) node.insertBefore(document.createElement('br'), first || child);
            node.removeChild(child);
            return;
          }
          if (child.tagName === 'SPAN') {
            const m = /font-size\s*:\s*([\d.]+(?:px|em|%))/i.exec(child.getAttribute('style') || '');
            [...child.attributes].forEach(a => child.removeAttribute(a.name));
            if (m) child.setAttribute('style', 'font-size:' + m[1]);
          } else {
            [...child.attributes].forEach(a => child.removeAttribute(a.name));
          }
          clean(child);
        } else if (child.nodeType !== 3) {
          node.removeChild(child);
        }
      });
    })(tmp);
    return tmp.innerHTML;
  }
  global.sanitizeRichText = sanitizeRichText;

  function renderBlock(b) {
    switch (b.type) {
      case 'heading': {
        const isPara = b.level === 'p';
        const lvl = isPara ? 'div' : (b.level === 3 ? 'h3' : b.level === 1 ? 'h1' : 'h2');
        const cls = isPara ? ' class="pg-richtext"' : '';
        return `<${lvl}${cls}${alignStyle(b)}>${sanitizeRichText(b.text, !isPara)}</${lvl}>`;
      }
      case 'paragraph':
        return e(b.text).split(/\n{2,}/).map(p =>
          `<p${alignStyle(b)}>${p.replace(/\n/g, '<br>')}</p>`).join('');
      case 'list':
        return '<ul>' + (b.items || []).filter(Boolean)
          .map(i => `<li>${e(i)}</li>`).join('') + '</ul>';
      case 'image': {
        // Small/medium cap how wide the image can get; large (and no size set at all,
        // for every image already on the site before this existed) is the original
        // unbounded "fill the content column" behavior. X-Large/XX-Large break out
        // past the column entirely -- that's done with CSS classes (see #pg-body
        // .pg-photo-xl/-xxl in admin.css), so the inline max-width:100% that every
        // other size relies on has to be skipped for those two, since an inline style
        // would otherwise always win over the external rule and silently cap it back.
        const isBreakout = b.size === 'xl' || b.size === 'xxl';
        const sizeCap = { sm: '240px', md: '420px' }[b.size];
        const img = `<img src="${e(b.url)}" alt="${e(b.alt || '')}"${isBreakout ? '' : ` style="max-width:100%${sizeCap ? ';width:' + sizeCap : ''}"`}>`;
        // A QR code or flyer image often needs to actually go somewhere when tapped --
        // same safe-link rule as a button, works identically on desktop/tablet/mobile
        // since it's just a normal anchor around the image, nothing device-specific.
        const href = /^https?:|^mailto:|^\//.test(b.href || '') ? b.href : '';
        const picture = href
          ? `<a href="${e(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${img}</a>`
          : img;
        const figClass = [isBreakout ? 'pg-photo-' + b.size : '', b.align === 'center' ? 'pg-photo-center' : b.align === 'right' ? 'pg-photo-right' : '']
          .filter(Boolean).join(' ');
        return `<figure${figClass ? ` class="${figClass}"` : ''} style="margin:0">
                  ${picture}
                  ${b.caption ? `<figcaption class="pg-caption">${e(b.caption)}</figcaption>` : ''}
                </figure>`;
      }
      case 'button': {
        let cls = 'pg-btn';
        if (b.style === 'outline') cls += ' outline';
        if (b.size === 'sm' || b.size === 'lg') cls += ' ' + b.size;
        if (b.full) cls += ' full';
        const href = /^https?:|^mailto:|^\//.test(b.href || '') ? b.href : '#';
        // A custom color overrides the default green -- solid fills the button with it,
        // outline uses it for the border/text instead (background stays white).
        let colorStyle = '';
        if (/^#[0-9a-fA-F]{6}$/.test(b.color || '')) {
          colorStyle = b.style === 'outline'
            ? `border-color:${b.color};color:${b.color}`
            : `background:${b.color}`;
        }
        return `<p${alignStyle(b)}><a class="${cls}" ${colorStyle ? `style="${colorStyle}"` : ''} href="${e(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ''}>${e(b.label || 'Button')}</a></p>`;
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
                  <div class="pg-su-embed" data-signup-id="${e(b.sheetId)}"${b.hideButton ? ' data-hide-button="1"' : ''}><p style="color:var(--text-light)">Loading sign-up sheet…</p></div>
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
