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
   ============================================================ */
(function (global) {
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
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

  function render(db, el, id, sheet, slotDocs, entryDocs) {
    var byName = {};
    entryDocs.forEach(function (d) {
      var e = d.data();
      (byName[e.slotId] = byName[e.slotId] || []).push({ name: e.name, count: e.count || 1 });
    });
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
        return '<span>' + esc(n.name) + (n.count > 1 ? ' (' + n.count + ')' : '') + '</span>';
      }).join('');
      html += '<div class="pg-su-slot" data-slot="' + esc(d.id) + '">';
      html += '<h4>' + esc(s.label || 'Slot') + '</h4>';
      if (when) html += '<div class="pg-su-when">' + esc(when) + '</div>';
      html += '<div class="pg-su-spots ' + (full ? 'full' : 'ok') + '">' +
        (cap ? (full ? 'Full' : left + ' of ' + cap + ' spot' + (cap === 1 ? '' : 's') + ' left') : (taken ? taken + ' signed up' : 'Open — sign up below')) + '</div>';
      if (names) html += '<div class="pg-su-names">' + names + '</div>';
      if (!closed && !full) {
        html += '<button type="button" class="pg-su-open">Sign up</button>';
        html += '<form class="pg-su-form">' +
          '<label>Your name</label><input name="name" required maxlength="80" placeholder="First and last name">' +
          '<div class="pg-su-row2">' +
            '<div><label>How many people / spots?</label><input name="count" type="number" min="1" max="20" value="1"></div>' +
            '<div><label>Email <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="email" type="email"></div>' +
          '</div>' +
          '<div class="pg-su-row2">' +
            '<div><label>Phone <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="phone"></div>' +
            '<div><label>Note to organizer <span style="font-weight:400;color:var(--text-light)">(optional)</span></label><input name="comment" maxlength="200"></div>' +
          '</div>' +
          '<div style="margin-top:12px"><button type="submit" class="pg-su-submit">Sign me up</button></div>' +
          '<div class="pg-su-msg"></div>' +
        '</form>';
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
    });
  }

  function submit(db, el, id, form) {
    var slotEl = form.closest('.pg-su-slot');
    var slotId = slotEl.dataset.slot;
    var name = form.name.value.trim();
    var count = Math.max(1, Math.min(20, parseInt(form.count.value, 10) || 1));
    var email = form.email.value.trim(), phone = form.phone.value.trim(), comment = form.comment.value.trim();
    var msg = form.querySelector('.pg-su-msg');
    if (!name) { msg.className = 'pg-su-msg err'; msg.textContent = 'Please enter your name.'; return; }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    msg.className = 'pg-su-msg'; msg.textContent = 'Saving…';

    var slotRef = db.collection('signups').doc(id).collection('slots').doc(slotId);
    db.runTransaction(function (tx) {
      return tx.get(slotRef).then(function (s) {
        if (!s.exists) throw new Error('That slot is no longer available.');
        var d = s.data(), taken = d.taken || 0;
        if (d.capacity && taken + count > d.capacity) throw new Error('Sorry — not enough spots left.');
        tx.update(slotRef, { taken: taken + count });
        var eref = db.collection('signups').doc(id).collection('entries').doc();
        tx.set(eref, { slotId: slotId, name: name, count: count, at: firebase.firestore.FieldValue.serverTimestamp() });
        if (email || phone || comment) {
          tx.set(db.collection('signups').doc(id).collection('contacts').doc(eref.id),
            { email: email, phone: phone, comment: comment });
        }
      });
    }).then(function () {
      msg.className = 'pg-su-msg done'; msg.textContent = '✓ You\'re signed up. Thank you!';
      setTimeout(function () { loadOne(db, el); }, 900);
    }).catch(function (e) {
      btn.disabled = false;
      msg.className = 'pg-su-msg err'; msg.textContent = e.message || 'Something went wrong — please try again.';
    });
  }

  global.mountSignupEmbeds = function (db) {
    document.querySelectorAll('.pg-su-embed[data-signup-id]').forEach(function (el) { loadOne(db, el); });
  };
})(window);
