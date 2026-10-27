/* ============================================================
   Sign-up sheet — inline embed
   ------------------------------------------------------------
   Renders a page's `signup` block's actual slots and sign-up
   form right where the block is, instead of just linking out to
   signup.html. Reuses the exact same data model and join logic
   as signup.html (same Firestore paths, same transaction), so a
   slot filled here and a slot filled on signup.html stay in
   sync -- this is just a second way to reach the same sheet.

   Call mountSignupEmbeds(db) once after the page's blocks are in
   the DOM (each block that needs it renders a
   <div class="pg-su-embed" data-signup-id="..."></div>   (or data-signup-slug="...")
   placeholder — see render-blocks.js).

   Cancelling/editing your own sign-up: anonymous visitors don't
   log in, so "yours" is remembered two ways -- (1) this browser's
   localStorage points straight at your entry, and (2) cancelling
   it requires re-typing the email you signed up with, checked by
   Firestore rules against the private contacts record for that
   entry. Editing is just cancel-then-resubmit, pre-filled with
   your old answers.
   ============================================================ */
(function (global) {
  var WORK_SCHOOL_OPTIONS = ['Woestina', 'Jefferson', 'Middle School', 'High School', 'District', 'Other'];
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  // Today as YYYY-MM-DD in local time (the latest date of birth allowed).
  function todayYmd() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  // The Intro field allows a small safe subset of HTML (bold/italic/underline, a
  // font-size-only span) set via the admin's rich text toolbar -- re-sanitize on the
  // way out too, in case anything ever reaches Firestore without going through that.
  function sanitizeIntroHtml(html) {
    var ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SPAN: 1, BR: 1, DIV: 1, P: 1 };
    var root = document.createElement('div');
    root.innerHTML = html || '';
    (function walk(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 1) {
          if (!ALLOWED[child.tagName]) {
            var first = child.firstChild;
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
            next = first || next;
          } else {
            var kept = [];
            if (child.tagName === 'SPAN') {
              var style = child.getAttribute('style') || '';
              var sizeM = /font-size\s*:\s*([\d.]+(?:px|em|%))/i.exec(style);
              var colorM = /color\s*:\s*(#[0-9a-f]{6}|#[0-9a-f]{3}|rgba?\([\d.%,\s]+\))/i.exec(style);
              if (sizeM) kept.push('font-size:' + sizeM[1]);
              if (colorM) kept.push('color:' + colorM[1]);
            }
            Array.prototype.slice.call(child.attributes).forEach(function (a) { child.removeAttribute(a.name); });
            if (kept.length) child.setAttribute('style', kept.join(';'));
            walk(child);
          }
        } else if (child.nodeType !== 3) {
          node.removeChild(child);
        }
        child = next;
      }
    })(root);
    return root.innerHTML;
  }
  // Public list shows first name + last initial only, for privacy -- full names still
  // live in Firestore/the admin Responses tab, this is display-only.
  function displayName(name) {
    var parts = (name || '').trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || '';
    return parts.slice(0, -1).join(' ') + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
  }
  function prettyDate(ymd) {
    if (!ymd) return '';
    var p = ymd.split('-'); if (p.length !== 3) return ymd;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? ymd : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function prettyTime(hm) {
    if (!hm) return ''; var p = hm.split(':'); if (p.length < 2) return hm;
    var h = +p[0], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + p[1] + ' ' + ap;
  }
  // A sheet's own optional call-to-action button (label + link), same solid/outline +
  // custom-color options a regular page's button block has.
  function ctaButtonHtml(sheet, cls) {
    var rawHref = (sheet.buttonHref || '').trim();
    // A bare domain typed without a scheme (e.g. "schalmontpto.com/page") would
    // otherwise silently fail the safety check below and turn into a dead "#" link.
    if (rawHref && !/^https?:|^mailto:|^\//.test(rawHref) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(rawHref)) {
      rawHref = 'https://' + rawHref;
    }
    var href = /^https?:|^mailto:|^\//.test(rawHref) ? rawHref : '#';
    var outline = sheet.buttonStyle === 'outline';
    var color = /^#[0-9a-fA-F]{6}$/.test(sheet.buttonColor || '') ? sheet.buttonColor : '';
    // A custom solid background needs an explicit white text color -- the default green
    // text would otherwise blend into a dark custom background and become unreadable.
    var style = color ? (outline ? 'border-color:' + color + ';color:' + color : 'background:' + color + ';color:#fff') : '';
    var align = (sheet.buttonAlign === 'center' || sheet.buttonAlign === 'right') ? sheet.buttonAlign : 'left';
    return '<p style="text-align:' + align + '"><a class="' + cls + (outline ? ' outline' : '') + '"' +
      (style ? ' style="' + style + '"' : '') + ' href="' + esc(href) + '"' +
      (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(sheet.buttonLabel) + '</a></p>';
  }
  // Aligns a block-level element (like the flyer image) via margins rather than
  // text-align, since it isn't inline content.
  function alignMargin(align) {
    if (align === 'center') return 'margin-left:auto;margin-right:auto';
    if (align === 'right') return 'margin-left:auto';
    return '';
  }

  // ---- "my signups" (per-browser, per-sheet) ----
  function mineKey(id) { return 'pto_su_mine_' + id; }
  function getMine(id) {
    try { return JSON.parse(localStorage.getItem(mineKey(id)) || '[]'); } catch (e) { return []; }
  }
  function setMine(id, list) {
    try { localStorage.setItem(mineKey(id), JSON.stringify(list)); } catch (e) { /* ignore (private browsing etc.) */ }
  }
  function rememberMine(id, entry) {
    var list = getMine(id).filter(function (m) { return m.entryId !== entry.entryId; });
    list.push(entry);
    setMine(id, list);
  }
  function forgetMine(id, entryId) {
    setMine(id, getMine(id).filter(function (m) { return m.entryId !== entryId; }));
  }

  function loadOne(db, el) {
    var id = el.dataset.signupId;
    if (!id) return;
    el.innerHTML = '<p style="color:var(--text-light)">Loading sign-up sheet…</p>';
    db.collection('signups').doc(id).get().then(function (snap) {
      if (!snap.exists) { el.innerHTML = '<p class="pg-su-msg err">This sign-up sheet was not found.</p>'; return; }
      var sheet = snap.data();
      return Promise.all([
        db.collection('signups').doc(id).collection('slots').orderBy('order').get(),
        db.collection('signups').doc(id).collection('entries').get()
      ]).then(function (res) { render(db, el, id, sheet, res[0].docs, res[1].docs); });
    }).catch(function (e) {
      el.innerHTML = '<p class="pg-su-msg err">Could not load this sign-up sheet. ' + esc(e.message) + '</p>';
    });
  }

  function render(db, el, id, sheet, slotDocs, entryDocs, prefill) {
    // A page can correct an embedded sheet's details without changing the sheet itself:
    // window.SIGNUP_OVERRIDES = { sheetId: { sheet: {eventTime, eventLocation, ...}, slot: {start, ...}, note: 'html' } }
    var ov = (window.SIGNUP_OVERRIDES || {})[id];
    if (ov) {
      sheet = Object.assign({}, sheet, ov.sheet || {});
      if (ov.slot) slotDocs = slotDocs.map(function (d) { var x = Object.assign({}, d.data(), ov.slot); return { id: d.id, data: function () { return x; } }; });
    }
    var byName = {};
    var liveIds = {};
    entryDocs.forEach(function (d) {
      var e = d.data();
      liveIds[d.id] = !e.cancelled;
      if (e.cancelled) return;
      (byName[e.slotId] = byName[e.slotId] || []).push({ name: e.name, count: e.count || 1, item: e.item || '', workSchool: e.workSchool || '' });
    });
    // Drop any locally-remembered entry that's gone or been cancelled some other way
    // (e.g. an admin removed it) so a stale Cancel/Edit prompt doesn't linger.
    var mine = getMine(id).filter(function (m) { return liveIds[m.entryId]; });
    setMine(id, mine);
    var mineBySlot = {};
    mine.forEach(function (m) { mineBySlot[m.slotId] = m; });

    var closed = sheet.status === 'closed';
    var cols = [2, 3, 4].indexOf(sheet.columns) !== -1 ? sheet.columns : 1;

    var html = '';
    var when = [prettyDate(sheet.eventDate), [prettyTime(sheet.eventTime), prettyTime(sheet.eventEndTime)].filter(Boolean).join('–')].filter(Boolean).join(' · ');
    if (when || sheet.eventLocation) {
      html += '<div class="pg-su-eventbox">';
      if (when) html += '<div class="pg-su-eventrow"><span class="pg-su-eventicon">📅</span><span>' + esc(when) + '</span></div>';
      if (sheet.eventLocation) {
        var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(sheet.eventLocation);
        html += '<div class="pg-su-eventrow"><span class="pg-su-eventicon">📍</span><a href="' + esc(maps) + '" target="_blank" rel="noopener">' + esc(sheet.eventLocation) + '</a></div>';
      }
      html += '</div>';
    }
    if (sheet.intro) html += '<div class="pg-su-intro">' + sanitizeIntroHtml(sheet.intro) + '</div>';
    // A sheet can require a date of birth (e.g. roles limited to older students); say so up front.
    // A page can turn that off for its embedded sheets with window.SIGNUP_NO_DOB = true (p.html).
    // Only a sheet's own age note is shown (no standard wording); plus the date-of-birth line when that field is asked.
    var ageBits = [sheet.askBirthdate === true ? (sheet.ageNote || '') : '', (sheet.askBirthdate === true && !window.SIGNUP_NO_DOB) ? 'A date of birth is required to sign up.' : ''].filter(Boolean);
    if (ageBits.length) html += '<div class="pg-su-age">🎂 ' + esc(ageBits.join(' ')) + '</div>';
    if (ov && ov.note) html += '<div class="pg-su-note" style="margin:8px 0;padding:10px 12px;border-radius:10px;background:#fff4e5;font-weight:700">' + ov.note + '</div>';
    if (sheet.imageUrl) {
      var imgMargin = alignMargin(sheet.imageAlign);
      html += '<figure class="pg-su-figure"' + (imgMargin ? ' style="' + imgMargin + '"' : '') + '><img src="' + esc(sheet.imageUrl) + '" alt="' + esc(sheet.imageAlt || '') + '">' +
        (sheet.imageCaption ? '<figcaption class="pg-caption">' + esc(sheet.imageCaption) + '</figcaption>' : '') + '</figure>';
    }
    if (closed) html += '<div class="pg-su-closed">This sign-up sheet is closed.</div>';
    if (!slotDocs.length) html += '<p style="color:var(--text-light)">No slots have been added yet.</p>';

    if (cols > 1) html += '<div class="pg-su-grid pg-su-grid-' + cols + '">';
    slotDocs.forEach(function (d) {
      var s = d.data(), taken = s.taken || 0, cap = s.capacity || 0;
      var left = cap ? Math.max(0, cap - taken) : null;
      var full = cap && left <= 0;
      var when = [prettyDate(s.date), [prettyTime(s.start), prettyTime(s.end)].filter(Boolean).join('–')].filter(Boolean).join(' · ');
      var names = (byName[d.id] || []).map(function (n) {
        return '<span>' + esc(displayName(n.name)) + (n.count > 1 ? ' (' + n.count + ')' : '') + (n.workSchool ? ' — ' + esc(n.workSchool) : '') + (n.item ? ' — ' + esc(n.item) : '') + '</span>';
      }).join('');
      var myEntry = mineBySlot[d.id];
      html += '<div class="pg-su-slot" data-slot="' + esc(d.id) + '">';
      html += '<h4>' + esc(s.label || 'Slot') + '</h4>';
      if (when) html += '<div class="pg-su-when">' + esc(when) + '</div>';
      html += '<div class="pg-su-spots ' + (full ? 'full' : 'ok') + '">' +
        (cap ? (full ? 'Full' : left + ' of ' + cap + ' spot' + (cap === 1 ? '' : 's') + ' left') : (taken ? taken + ' signed up' : 'Open — sign up below')) + '</div>';
      if (names) html += '<div class="pg-su-names">' + names + '</div>';
      if (myEntry) {
        html += '<div class="pg-su-mine">You\'re signed up as <strong>' + esc(myEntry.name) + '</strong> ' +
          '<button type="button" class="pg-su-edit" data-entry="' + esc(myEntry.entryId) + '">Edit</button> ' +
          '<button type="button" class="pg-su-cancel" data-entry="' + esc(myEntry.entryId) + '">Cancel</button></div>';
      } else if (!closed && !full) {
        html += '<button type="button" class="pg-su-open">Sign up</button>';
      }
      if (!myEntry && !closed && (!full || (prefill && prefill.slotId === d.id))) {
        html += formHtml(prefill && prefill.slotId === d.id ? prefill : null, sheet.askItem !== false, sheet.askSchool === true, (sheet.askBirthdate === true && !window.SIGNUP_NO_DOB));
      }
      html += '</div>';
    });
    if (cols > 1) html += '</div>';
    if (sheet.buttonLabel && sheet.buttonHref && el.dataset.hideButton !== '1') {
      html += ctaButtonHtml(sheet, 'pg-su-cta');
    }
    el.innerHTML = html;

    el.querySelectorAll('.pg-su-open').forEach(function (b) {
      b.onclick = function () { b.nextElementSibling.classList.toggle('open'); };
    });
    el.querySelectorAll('.pg-su-form').forEach(function (form) {
      form.onsubmit = function (ev) { ev.preventDefault(); submit(db, el, id, form); };
      if (form.classList.contains('open')) form.name.focus();
    });
    el.querySelectorAll('.pg-su-cancel').forEach(function (b) {
      b.onclick = function () { cancelClicked(db, el, id, b.closest('.pg-su-slot').dataset.slot, b.dataset.entry, false); };
    });
    el.querySelectorAll('.pg-su-edit').forEach(function (b) {
      b.onclick = function () { cancelClicked(db, el, id, b.closest('.pg-su-slot').dataset.slot, b.dataset.entry, true); };
    });
  }

  function formHtml(prefill, askItem, askSchool, askBirthdate) {
    prefill = prefill || {};
    return '<form class="pg-su-form' + (prefill.open ? ' open' : '') + '">' +
      '<label>Your name</label><input name="name" required maxlength="80" placeholder="First and last name" value="' + esc(prefill.name || '') + '">' +
      '<label>Email</label><input name="email" type="email" required value="' + esc(prefill.email || '') + '">' +
    (askBirthdate ? '<label>Date of birth</label><input name="birthdate" type="date" required min="1900-01-01" max="' + todayYmd() + '" value="' + esc(prefill.birthdate || '') + '">' +
      '<div class="pg-su-dob-note">Required for this role. Kept private — only PTO organizers see it.</div>' : '') +
      (askSchool ? '<label>Which school do you work for?</label><select name="workSchool" required>' +
        '<option value="" disabled' + (prefill.workSchool ? '' : ' selected') + '>Select a school…</option>' +
        WORK_SCHOOL_OPTIONS.map(function (o) { return '<option value="' + esc(o) + '"' + (prefill.workSchool === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
        '</select>' : '') +
      '<div class="pg-su-row2">' +
        '<div><label>Phone <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="phone" value="' + esc(prefill.phone || '') + '"></div>' +
        '<div><label>Note to organizer <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="comment" maxlength="200" value="' + esc(prefill.comment || '') + '"></div>' +
      '</div>' +
      (askItem ? '<label>What are you bringing? <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="item" maxlength="100" placeholder="e.g. A dozen cookies" value="' + esc(prefill.item || '') + '">' : '') +
      '<div style="margin-top:12px"><button type="submit" class="pg-su-submit">Sign me up</button></div>' +
      '<div class="pg-su-msg"></div>' +
    '</form>';
  }

  function submit(db, el, id, form) {
    var slotEl = form.closest('.pg-su-slot');
    var slotId = slotEl.dataset.slot;
    var name = form.name.value.trim();
    var count = 1;   // one sign-up = one spot; people no longer pick how many
    var email = form.email.value.trim().toLowerCase(), phone = form.phone.value.trim(), comment = form.comment.value.trim();
    var item = form.item ? form.item.value.trim() : '';
    var workSchool = form.workSchool ? form.workSchool.value : '';
    var birthdate = form.birthdate ? form.birthdate.value : '';
    var msg = form.querySelector('.pg-su-msg');
    if (!name || !email) {
      msg.className = 'pg-su-msg err'; msg.textContent = 'Name and email are required.'; return;
    }
    if (form.birthdate && !(/^\d{4}-\d{2}-\d{2}$/.test(birthdate) && birthdate >= '1900-01-01' && birthdate <= todayYmd())) {
    msg.className = 'pg-su-msg err'; msg.textContent = 'Please enter a valid date of birth.'; return;
  }
  if (form.workSchool && !workSchool) {
      msg.className = 'pg-su-msg err'; msg.textContent = 'Please select which school you work for.'; return;
    }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    msg.className = 'pg-su-msg'; msg.textContent = 'Saving…';

    var slotRef = db.collection('signups').doc(id).collection('slots').doc(slotId);
    var newEntryId = null;
    db.runTransaction(function (tx) {
      return tx.get(slotRef).then(function (s) {
        if (!s.exists) throw new Error('That slot is no longer available.');
        var d = s.data(), taken = d.taken || 0;
        if (d.capacity && taken + count > d.capacity) throw new Error('Sorry — not enough spots left.');
        tx.update(slotRef, { taken: taken + count });
        var eref = db.collection('signups').doc(id).collection('entries').doc();
        newEntryId = eref.id;
        // Only include workSchool at all on a sheet that actually asks for it -- until
        // the matching rules update is published, an old-shape sheet that never
        // mentions this field should keep working exactly as before.
        var entryData = { slotId: slotId, name: name, count: count, item: item, at: firebase.firestore.FieldValue.serverTimestamp() };
        if (workSchool) entryData.workSchool = workSchool;
        tx.set(eref, entryData);
        tx.set(db.collection('signups').doc(id).collection('contacts').doc(eref.id),
          birthdate ? { email: email, phone: phone, comment: comment, birthdate: birthdate } : { email: email, phone: phone, comment: comment });
      });
    }).then(function () {
      rememberMine(id, { entryId: newEntryId, slotId: slotId, name: name, email: email, phone: phone, comment: comment, item: item, workSchool: workSchool, birthdate: birthdate });
      msg.className = 'pg-su-msg done'; msg.textContent = '✓ You\'re signed up. Thank you! Check your email for a confirmation.';
      // Best-effort — a confirmation to the signer, plus whoever's watching this sheet.
      // Never blocks or affects the sign-up itself, which is already saved by this point.
      fetch('/api/notify-signup.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: id, entryId: newEntryId, signerEmail: email })
      }).catch(function () {});
      setTimeout(function () { loadOne(db, el); }, 900);
    }).catch(function (e) {
      btn.disabled = false;
      msg.className = 'pg-su-msg err'; msg.textContent = e.message || 'Something went wrong — please try again.';
    });
  }

  // The email check is exact, and phones often capitalize the first letter typed into the
  // prompt (or the email was signed up with capitals). Try the email as typed, all
  // lowercase, and with only the first letter lowered, stopping at the first that matches.
  function cancelWithEmail(entryRef, email) {
    var tries = [email, email.toLowerCase(), email.charAt(0).toLowerCase() + email.slice(1)]
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    var i = 0;
    function next(err) {
      if (i >= tries.length) return Promise.reject(err);
      var e = tries[i++];
      return entryRef.update({ cancelled: true, checkEmail: e }).catch(function (x) {
        if (x && x.code === 'permission-denied') return next(x);
        throw x;
      });
    }
    return next({ code: 'permission-denied' });
  }

  // Cancels entryId (rolling its slot's taken count back), verified by re-typing the
  // signup email. If asEdit, re-opens the sign-up form on that slot pre-filled with the
  // old answers once the cancel succeeds, so "editing" is just cancel + resubmit.
  function cancelClicked(db, el, id, slotId, entryId, asEdit) {
    var email = window.prompt('To ' + (asEdit ? 'edit' : 'cancel') + ' this sign-up, please re-enter the email you used:');
    if (email == null) return;
    email = email.trim();
    if (!email) return;
    var entryRef = db.collection('signups').doc(id).collection('entries').doc(entryId);
    var slotRef = db.collection('signups').doc(id).collection('slots').doc(slotId);
    var priorCount = 1, priorFields = null;
    entryRef.get().then(function (snap) {
      if (!snap.exists) throw new Error('That sign-up was already removed.');
      priorCount = snap.data().count || 1;
      var mine = getMine(id).filter(function (m) { return m.entryId === entryId; })[0];
      priorFields = mine || {};
      return cancelWithEmail(entryRef, email);
    }).then(function () {
      return slotRef.get();
    }).then(function (slotSnap) {
      var taken = (slotSnap.data() || {}).taken || 0;
      return slotRef.update({ taken: Math.max(0, taken - priorCount), lastCancelEid: entryId });
    }).then(function () {
      return entryRef.update({ takenReverted: true });
    }).then(function () {
      forgetMine(id, entryId);
      if (asEdit) {
        loadOneWithPrefill(db, el, id, slotId, priorFields);
      } else {
        loadOne(db, el);
      }
    }).catch(function (e) {
      window.alert(e.code === 'permission-denied'
        ? 'That email doesn\'t match the one used for this sign-up. Check the spelling and try again, or contact the organizer to be removed.'
        : (e.message || 'Something went wrong — please try again.'));
    });
  }

  function loadOneWithPrefill(db, el, id, slotId, priorFields) {
    db.collection('signups').doc(id).get().then(function (snap) {
      var sheet = snap.data();
      return Promise.all([
        db.collection('signups').doc(id).collection('slots').orderBy('order').get(),
        db.collection('signups').doc(id).collection('entries').get()
      ]).then(function (res) {
        render(db, el, id, sheet, res[0].docs, res[1].docs, {
          slotId: slotId, open: true,
          name: priorFields.name, email: priorFields.email, phone: priorFields.phone, comment: priorFields.comment, item: priorFields.item, workSchool: priorFields.workSchool, birthdate: priorFields.birthdate
        });
      });
    });
  }

  global.mountSignupEmbeds = function (db) {
    document.querySelectorAll('.pg-su-embed[data-signup-id]').forEach(function (el) { loadOne(db, el); });
    // A hand-built page can point at a sheet by its custom address instead of its id:
    //   <div class="pg-su-embed" data-signup-slug="5th-grade-dance-volunteers">fallback…</div>
    // Until a sheet with that address exists, the element's own fallback content stays.
    document.querySelectorAll('.pg-su-embed[data-signup-slug]:not([data-signup-id])').forEach(function (el) {
      db.collection('signups').where('slug', '==', el.dataset.signupSlug).limit(1).get().then(function (q) {
        if (q.empty) return;
        el.dataset.signupId = q.docs[0].id;
        loadOne(db, el);
      }).catch(function () { /* keep the fallback */ });
    });
  };
})(window);
