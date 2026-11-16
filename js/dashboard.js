/* ============================================================
   Parent dashboard (dashboard.html, Julie Nov 2026)
   - My account: name (users/{uid}.displayName + the sign-in profile), email, approval status,
     password reset.
   - My directory listing: edit directory/{uid} in place (grades roll up each school year,
     js/grade-rollover.js). Photo and Parent/Guardian 2 stay on the directory's own editor,
     and are kept as they are when saving here.
   - My sign-ups: every live sign-up entry whose private contact record has this person's
     email (firestore.rules lets a verified user read only their own contact records).
     Cancel works the same way as on the sign-up sheets (entry.cancelled + checkEmail, then the
     slot's taken count rolls back). "Switch" = cancel, then open the sheet to pick again.
   - 8th Grade Dance: their Sabre's Story submissions + photos (api/my-dance.php).
   ============================================================ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade',
                '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
  var SCHOOLS = ['Woestina Pre-K', 'Jefferson Elementary', 'Schalmont Middle School', 'Schalmont High School'];
  var RELS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];
  var db = firebase.firestore();
  var me = null, listing = null;

  function msg(id, text, kind) { var m = $(id); m.className = 'db-msg' + (kind ? ' ' + kind : ''); m.textContent = text || ''; }
  function show(id, on) { $(id).hidden = !on; }
  function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
  function prettyDate(ymd) {
    if (!ymd) return '';
    var p = ymd.split('-'); if (p.length !== 3) return ymd;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? ymd : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function prettyTime(hm) {
    if (!hm) return ''; var p = hm.split(':'); if (p.length < 2) return hm;
    var h = +p[0], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + p[1] + ' ' + ap;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    show('db-loading', false);
    if (!user) { show('db-gate', true); return; }
    if (!user.emailVerified) {
      $('db-gate-text').innerHTML = 'Please verify your email address first. We sent a link to <strong>' + esc(user.email) + '</strong> when you registered.';
      $('db-gate').querySelector('a').hidden = true;
      show('db-resend', true); show('db-gate', true);
      $('db-resend').onclick = function () {
        user.sendEmailVerification().then(function () { msg('db-gate-msg', 'Sent! Check your inbox, then come back and refresh this page.', 'ok'); })
          .catch(function (e) { msg('db-gate-msg', e.message, 'err'); });
      };
      return;
    }
    me = user;
    document.querySelectorAll('.db-me').forEach(function (el) { el.textContent = user.email; });
    var first = (user.displayName || '').split(' ')[0];
    if (first) $('db-hello').textContent = 'Welcome back, ' + first + '! Your account, directory listing, sign-ups and shared photos, all in one place.';
    loadAccount(); loadDirectory(); loadSignups(); loadDance();
  });

  /* ---------------- account ---------------- */
  function loadAccount() {
    show('db-account', true);
    $('db-email').value = me.email;
    $('db-name').value = me.displayName || '';
    db.collection('users').doc(me.uid).get().then(function (snap) {
      var u = snap.exists ? snap.data() : {};
      if (u.displayName && !$('db-name').value) $('db-name').value = u.displayName;
      var st = u.status || (snap.exists ? 'pending' : 'none');
      var pill = $('db-status');
      if (u.role === 'admin' || u.role === 'superadmin') { pill.textContent = 'PTO admin'; $('db-status-text').innerHTML = 'You also have access to the <a href="/admin/">PTO back office</a>.'; }
      else if (st === 'approved') { pill.textContent = 'Approved'; $('db-status-text').textContent = 'Your account is approved, so you can see the parent directory.'; }
      else if (st === 'rejected') { pill.textContent = 'Not approved'; pill.className = 'db-pill is-bad'; $('db-status-text').innerHTML = 'Your account was not approved for the directory. Questions? <a href="/contact.html">Contact the PTO</a>.'; }
      else if (st === 'none') { pill.textContent = 'Getting started'; pill.className = 'db-pill is-wait'; $('db-status-text').innerHTML = 'To join the parent directory, <a href="/pending.html">tell us about your family</a>.'; }
      else { pill.textContent = 'Waiting for approval'; pill.className = 'db-pill is-wait'; $('db-status-text').textContent = 'A PTO officer will review your account soon. You can still use everything on this page.'; }
    }).catch(function () { $('db-status').hidden = true; });

    $('db-save-account').onclick = function () {
      var name = $('db-name').value.trim();
      if (!name) return msg('db-account-msg', 'Please enter your name.', 'err');
      this.disabled = true; var btn = this;
      me.updateProfile({ displayName: name }).then(function () {
        return db.collection('users').doc(me.uid).get().then(function (s) { if (s.exists) return db.collection('users').doc(me.uid).update({ displayName: name }); });
      }).then(function () { msg('db-account-msg', 'Saved.', 'ok'); })
        .catch(function (e) { msg('db-account-msg', 'Could not save: ' + e.message, 'err'); })
        .then(function () { btn.disabled = false; });
    };
    $('db-pass').onclick = function () {
      firebase.auth().sendPasswordResetEmail(me.email)
        .then(function () { msg('db-account-msg', 'We emailed you a link to set a new password.', 'ok'); })
        .catch(function (e) { msg('db-account-msg', e.message, 'err'); });
    };
  }

  /* ---------------- directory listing ---------------- */
  function opt(list, val, blank) {
    return (blank ? '<option value="">' + blank + '</option>' : '') + list.map(function (v) { return '<option' + (v === val ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  var kidN = 0;
  function addKid(s) {
    s = s || {};
    var n = ++kidN, box = document.createElement('div');
    box.className = 'db-kid';
    box._orig = s;   // keeps Parent/Guardian 2 and anything else this editor doesn't show
    var rel = s.relationship || '';
    box.innerHTML =
      '<div class="db-kid-row">' +
        '<div class="db-f"><label for="k' + n + '-name">Child&#8217;s name</label><input type="text" id="k' + n + '-name" class="k-name" maxlength="80" value="' + esc(s.name) + '"></div>' +
        '<div class="db-f"><label for="k' + n + '-grade">Grade</label><select id="k' + n + '-grade" class="k-grade">' + opt(GRADES.concat(s.grade === 'Graduated' ? ['Graduated'] : []), s.grade, 'Grade…') + '</select></div>' +
        '<div class="db-f"><label for="k' + n + '-school">School</label><select id="k' + n + '-school" class="k-school">' + opt(SCHOOLS, s.school, 'School…') + '</select></div>' +
      '</div>' +
      '<div class="db-kid-row2">' +
        '<div class="db-f"><label for="k' + n + '-teacher">Teacher</label><input type="text" id="k' + n + '-teacher" class="k-teacher" maxlength="80" value="' + esc(s.teacher) + '"></div>' +
        '<div class="db-f"><label for="k' + n + '-rel">You are their</label><select id="k' + n + '-rel" class="k-rel">' + opt(RELS, rel, 'Choose…') + '</select></div>' +
        '<button type="button" class="db-rm">Remove</button>' +
      '</div>' +
      '<div class="db-f k-other-wrap"' + (rel === 'Other' ? '' : ' hidden') + '><label for="k' + n + '-other">Relationship</label><input type="text" id="k' + n + '-other" class="k-other" maxlength="60" value="' + esc(s.relationshipOther) + '"></div>' +
      (s.gradeAdvanced ? '<p class="db-note" style="margin:0">We moved this grade up for the new school year. Please check it and add this year&#8217;s teacher.</p>' : '');
    box.querySelector('.db-rm').onclick = function () { box.remove(); };
    box.querySelector('.k-rel').onchange = function () { box.querySelector('.k-other-wrap').hidden = this.value !== 'Other'; };
    // Picking a grade picks the school that goes with it.
    box.querySelector('.k-grade').onchange = function () {
      var i = GRADES.indexOf(this.value); if (i < 0) return;
      box.querySelector('.k-school').value = i === 0 ? SCHOOLS[0] : i <= 5 ? SCHOOLS[1] : i <= 9 ? SCHOOLS[2] : SCHOOLS[3];
    };
    $('db-kids').appendChild(box);
  }

  function loadDirectory() {
    show('db-dir', true);
    db.collection('directory').doc(me.uid).get().then(function (snap) {
      if (!snap.exists) { show('db-dir-none', true); return; }
      listing = window.advanceDirectoryGrades ? window.advanceDirectoryGrades(snap.data()) : snap.data();
      $('db-first').value = listing.firstName || ''; $('db-last').value = listing.lastName || '';
      $('db-dir-email').value = listing.email || ''; $('db-phone').value = listing.phone || '';
      $('db-show-email').checked = !!listing.showEmail; $('db-show-phone').checked = !!listing.showPhone; $('db-texts').checked = !!listing.textReminders;
      (listing.students || []).forEach(addKid);
      if (!(listing.students || []).length) addKid();
      show('db-dir-form', true);
      maybeDance();
    }).catch(function (e) { show('db-dir-none', true); $('db-dir-none').innerHTML = '<p class="db-empty">Could not load your listing (' + esc(e.message) + ').</p>'; });

    $('db-add-kid').onclick = function () { addKid(); };
    $('db-dir-form').onsubmit = function (e) {
      e.preventDefault();
      var first = $('db-first').value.trim(), last = $('db-last').value.trim();
      if (!first || !last) return msg('db-dir-msg', 'Please enter your first and last name.', 'err');
      var students = [].map.call(document.querySelectorAll('#db-kids .db-kid'), function (b) {
        var s = Object.assign({}, b._orig);
        delete s.gradeAdvanced;
        s.name = b.querySelector('.k-name').value.trim();
        s.grade = b.querySelector('.k-grade').value;
        s.school = b.querySelector('.k-school').value;
        s.teacher = b.querySelector('.k-teacher').value.trim();
        s.relationship = b.querySelector('.k-rel').value;
        s.relationshipOther = s.relationship === 'Other' ? b.querySelector('.k-other').value.trim() : '';
        return s;
      }).filter(function (s) { return s.name; });
      var btn = $('db-save-dir'); btn.disabled = true; msg('db-dir-msg', 'Saving…');
      db.collection('directory').doc(me.uid).update({
        firstName: first, lastName: last, email: $('db-dir-email').value.trim(), phone: $('db-phone').value.trim(),
        showEmail: $('db-show-email').checked, showPhone: $('db-show-phone').checked, textReminders: $('db-texts').checked,
        students: students, updatedAt: new Date().toISOString()
      }).then(function () {
        msg('db-dir-msg', 'Saved! Your directory listing is up to date.', 'ok');
        document.querySelectorAll('#db-kids .db-note').forEach(function (n) { n.remove(); });
        listing.students = students; maybeDance();
      }).catch(function (e) { msg('db-dir-msg', 'Could not save: ' + e.message, 'err'); })
        .then(function () { btn.disabled = false; });
    };
  }

  /* ---------------- sign-ups ---------------- */
  function loadSignups() {
    show('db-signups', true);
    var box = $('db-su-list'), found = [];
    db.collection('signups').get().then(function (sheets) {
      return Promise.all(sheets.docs.map(function (sheet) {
        var sref = sheet.ref;
        return sref.collection('entries').get().then(function (entries) {
          var live = entries.docs.filter(function (d) { return !d.data().cancelled; });
          // The contact record (with the email) is private; this only succeeds for the signer's own.
          return Promise.all(live.map(function (d) {
            return sref.collection('contacts').doc(d.id).get().then(function (c) {
              if (c.exists) found.push({ sheet: sheet, entry: d, contact: c.data() });
            }).catch(function () { /* someone else's sign-up */ });
          }));
        }).then(function () {
          var mine = found.filter(function (f) { return f.sheet.id === sheet.id; });
          if (!mine.length) return;
          return sref.collection('slots').get().then(function (slots) {
            var byId = {}; slots.docs.forEach(function (s) { byId[s.id] = s.data(); });
            mine.forEach(function (f) { f.slot = byId[f.entry.data().slotId] || {}; });
          });
        });
      }));
    }).then(function () { renderSignups(found); })
      .catch(function (e) { box.innerHTML = '<p class="db-empty">Could not load your sign-ups (' + esc(e.message) + ').</p>'; });
  }

  function renderSignups(found) {
    var box = $('db-su-list'), t = today();
    if (!found.length) {
      box.innerHTML = '<p class="db-empty">You don&#8217;t have any sign-ups yet with this email. Sign-ups made with a different email won&#8217;t show here.</p>';
      return;
    }
    found.forEach(function (f) { f.date = f.slot.date || f.sheet.data().eventDate || ''; f.past = !!f.date && f.date < t; });
    found.sort(function (a, b) { return (a.past - b.past) || String(a.date || '9999').localeCompare(String(b.date || '9999')); });
    box.innerHTML = '';
    found.forEach(function (f) {
      var sh = f.sheet.data(), e = f.entry.data(), s = f.slot;
      var href = sh.slug ? '/signup/' + encodeURIComponent(sh.slug) : '/signup.html?id=' + encodeURIComponent(f.sheet.id);
      var when = [prettyDate(f.date), [prettyTime(s.start || (!s.date ? sh.eventTime : '')), prettyTime(s.end || (!s.date ? sh.eventEndTime : ''))].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
      var closed = sh.status === 'closed';
      var el = document.createElement('div');
      el.className = 'db-su' + (f.past ? ' is-past' : '');
      el.innerHTML = '<h3>' + esc(sh.title || 'Sign-up') + '</h3>' +
        '<div class="db-when"><strong>' + esc(s.label || 'Signed up') + '</strong>' + (when ? ' · ' + esc(when) : '') + '</div>' +
        (sh.eventLocation ? '<div class="db-meta">' + esc(sh.eventLocation) + '</div>' : '') +
        '<div class="db-meta">Signed up as ' + esc(e.name) + ((e.count || 1) > 1 ? ' (' + e.count + ' people)' : '') + (e.item ? ' · bringing ' + esc(e.item) : '') +
          (f.contact.phone ? ' · phone ' + esc(f.contact.phone) : '') + (f.contact.comment ? ' · note: ' + esc(f.contact.comment) : '') + '</div>' +
        '<div class="db-actions">' +
          '<a class="db-btn is-ghost" href="' + href + '">View sign-up sheet</a>' +
          (f.past ? '<span class="db-meta">This event has passed.</span>' : closed ? '<span class="db-meta">This sheet is closed. To make a change, contact ' + esc(sh.contactName || 'the organizer') + '.</span>' :
            '<button type="button" class="db-btn is-ghost" data-act="switch">Switch to a different spot</button>' +
            '<button type="button" class="db-btn is-danger" data-act="cancel">Cancel my sign-up</button>') +
          '<span class="db-msg" role="status"></span>' +
        '</div>';
      el.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var sw = b.dataset.act === 'switch';
          if (!window.confirm(sw ? 'This cancels your current spot, then opens the sign-up sheet so you can pick a new one. Continue?' : 'Cancel your sign-up for "' + (s.label || sh.title) + '"?')) return;
          var m = el.querySelector('.db-msg');
          el.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
          m.className = 'db-msg'; m.textContent = 'Cancelling…';
          cancelEntry(f).then(function () {
            if (sw) { location.href = href; return; }
            el.querySelector('.db-actions').innerHTML = '<span class="db-msg ok">Cancelled. Your spot is open for someone else.</span> <a class="db-btn is-ghost" href="' + href + '">Sign up again</a>';
            el.classList.add('is-past');
          }).catch(function (x) {
            m.className = 'db-msg err'; m.textContent = 'Could not cancel: ' + (x && x.message || x);
            el.querySelectorAll('button').forEach(function (y) { y.disabled = false; });
          });
        };
      });
      box.appendChild(el);
    });
  }

  // Same steps as the sign-up sheets: mark the entry cancelled (proven with the email on its
  // contact record), roll the slot's count back, then mark the rollback done.
  function cancelEntry(f) {
    var entryRef = f.entry.ref, sref = f.sheet.ref, e = f.entry.data();
    var slotRef = sref.collection('slots').doc(e.slotId), count = e.count || 1;
    return entryRef.update({ cancelled: true, checkEmail: f.contact.email }).then(function () {
      return slotRef.get();
    }).then(function (snap) {
      var taken = (snap.data() || {}).taken || 0;
      return slotRef.update({ taken: Math.max(0, taken - count), lastCancelEid: entryRef.id });
    }).then(function () { return entryRef.update({ takenReverted: true }); });
  }

  /* ---------------- 8th Grade Dance ---------------- */
  var danceSubs = null;
  function has8th() { return !!listing && (listing.students || []).some(function (s) { return s.grade === '8th Grade'; }); }
  function maybeDance() {
    if (danceSubs === null) return;
    if (!danceSubs.length && !has8th()) { show('db-dance', false); return; }
    show('db-dance', true);
    var box = $('db-dance-list');
    if (!danceSubs.length) {
      box.innerHTML = '<p class="db-empty">You haven&#8217;t shared anything yet. <a href="/8thgradedance#photos">Share photos and a Sabre&#8217;s Story for the slideshow</a>.</p>';
      return;
    }
    box.innerHTML = danceSubs.map(function (s) {
      var facts = Object.keys(s.funFacts || {}).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(s.funFacts[k]) + '</dd>'; }).join('');
      var when = s.submittedAt ? new Date(s.submittedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      return '<div class="db-story"><h3>' + esc(s.student) + '</h3>' +
        '<div class="db-meta" style="font-size:13.5px;color:var(--text-light)">Shared by ' + esc(s.familyName) + (when ? ' on ' + esc(when) : '') + '</div>' +
        (s.message ? '<blockquote>' + esc(s.message) + '</blockquote>' : '') +
        (facts ? '<dl>' + facts + '</dl>' : '') +
        (s.memories && s.memories.length ? '<div style="margin-top:10px;font-weight:800;color:#1f2a5a;font-size:14.5px">Favorite memories</div><ol>' + s.memories.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' : '') +
        (s.photos.length ? '<div class="db-photos">' + s.photos.map(function (p, i) {
          return '<a href="/' + esc(p.url) + '" target="_blank" rel="noopener">' + (p.viewable ? '<img src="/' + esc(p.url) + '" alt="Photo ' + (i + 1) + ' of ' + esc(s.student) + '" loading="lazy">' : '<span>' + esc(p.ext.toUpperCase()) + ' photo<br>(tap to download)</span>') + '</a>';
        }).join('') + '</div>' : '') +
      '</div>';
    }).join('');
  }
  function loadDance() {
    me.getIdToken().then(function (tok) {
      var fd = new FormData(); fd.append('idToken', tok);
      return fetch('/api/my-dance.php', { method: 'POST', body: fd });
    }).then(function (r) { return r.json(); }).then(function (j) {
      danceSubs = j && j.ok ? j.submissions : [];
      maybeDance();
    }).catch(function () { danceSubs = []; maybeDance(); });
  }
})();
