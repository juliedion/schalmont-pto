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
   <div class="pg-su-embed" data-signup-id="..."></div>
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
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
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
    var byName = {};
    var liveIds = {};
    entryDocs.forEach(function (d) {
      var e = d.data();
      liveIds[d.id] = !e.cancelled;
      if (e.cancelled) return;
      (byName[e.slotId] = byName[e.slotId] || []).push({ name: e.name, count: e.count || 1, item: e.item || '' });
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
    if (sheet.intro) html += '<p class="pg-su-intro">' + esc(sheet.intro) + '</p>';
    if (closed) html += '<div class="pg-su-closed">This sign-up sheet is closed.</div>';
    if (!slotDocs.length) html += '<p style="color:var(--text-light)">No slots have been added yet.</p>';

    if (cols > 1) html += '<div class="pg-su-grid pg-su-grid-' + cols + '">';
    slotDocs.forEach(function (d) {
      var s = d.data(), taken = s.taken || 0, cap = s.capacity || 0;
      var left = cap ? Math.max(0, cap - taken) : null;
      var full = cap && left <= 0;
      var when = [prettyDate(s.date), [prettyTime(s.start), prettyTime(s.end)].filter(Boolean).join('–')].filter(Boolean).join(' · ');
      var names = (byName[d.id] || []).map(function (n) {
        return '<span>' + esc(displayName(n.name)) + (n.count > 1 ? ' (' + n.count + ')' : '') + (n.item ? ' — ' + esc(n.item) : '') + '</span>';
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
        html += formHtml(prefill && prefill.slotId === d.id ? prefill : null, sheet.askItem !== false);
      }
      html += '</div>';
    });
    if (cols > 1) html += '</div>';
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

  function formHtml(prefill, askItem) {
    prefill = prefill || {};
    return '<form class="pg-su-form' + (prefill.open ? ' open' : '') + '">' +
      '<label>Your name</label><input name="name" required maxlength="80" placeholder="First and last name" value="' + esc(prefill.name || '') + '">' +
      '<label>Email</label><input name="email" type="email" required value="' + esc(prefill.email || '') + '">' +
      '<div class="pg-su-row2">' +
        '<div><label>Phone</label><input name="phone" required value="' + esc(prefill.phone || '') + '"></div>' +
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
    var email = form.email.value.trim(), phone = form.phone.value.trim(), comment = form.comment.value.trim();
    var item = form.item ? form.item.value.trim() : '';
    var msg = form.querySelector('.pg-su-msg');
    if (!name || !email || !phone) {
      msg.className = 'pg-su-msg err'; msg.textContent = 'Name, email and phone are all required.'; return;
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
        tx.set(eref, { slotId: slotId, name: name, count: count, item: item, at: firebase.firestore.FieldValue.serverTimestamp() });
        tx.set(db.collection('signups').doc(id).collection('contacts').doc(eref.id),
          { email: email, phone: phone, comment: comment });
      });
    }).then(function () {
      rememberMine(id, { entryId: newEntryId, slotId: slotId, name: name, email: email, phone: phone, comment: comment, item: item });
      msg.className = 'pg-su-msg done'; msg.textContent = '✓ You\'re signed up. Thank you!';
      // Best-effort — whoever's watching this sheet gets an email. Never blocks or
      // affects the sign-up itself, which is already saved by this point.
      fetch('/api/notify-signup.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: id, entryId: newEntryId })
      }).catch(function () {});
      setTimeout(function () { loadOne(db, el); }, 900);
    }).catch(function (e) {
      btn.disabled = false;
      msg.className = 'pg-su-msg err'; msg.textContent = e.message || 'Something went wrong — please try again.';
    });
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
      return entryRef.update({ cancelled: true, checkEmail: email });
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
        ? 'That email doesn\'t match what you signed up with.'
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
          name: priorFields.name, email: priorFields.email, phone: priorFields.phone, comment: priorFields.comment, item: priorFields.item
        });
      });
    });
  }

  global.mountSignupEmbeds = function (db) {
    document.querySelectorAll('.pg-su-embed[data-signup-id]').forEach(function (el) { loadOne(db, el); });
  };
})(window);
