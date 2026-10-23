/* Yearbook photo submission form, shared by the school yearbook pages.
   Drop <div data-yearbook-form data-school="jefferson|middle|high"></div> on a page (that
   school starts out picked for each student; each student can be from any school) and
   load this script after the Firebase scripts. Photos go one at a time to
   api/yearbook-upload.php (keeps each request under the server's upload limit); the
   submission details are saved to Firestore `yearbook_photos` for the back office's
   yearbook review (admin/yearbook.html). */
(function () {
  var SCHOOLS = [['woestina', 'Woestina'], ['jefferson', 'Jefferson'], ['middle', 'Middle School'], ['high', 'High School']];
  var GRADES = {
    woestina: ['Pre-K'],
    jefferson: ['K', '1', '2', '3', '4'],
    middle: ['5', '6', '7', '8'],
    high: ['9', '10', '11', '12']
  };
  var MAX_FILES = 12;                    // per submission (matches the Firestore rule)
  var MAX_BYTES = 20 * 1024 * 1024;      // per photo
  var SMALL_PX = 1200;                   // long edge under this may print blurry
  var OTHER = '__other';

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function gradeLabel(g) { return g === 'Pre-K' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : g + (g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th') + ' grade'; }
  function mb(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; }
  function isImage(f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); }

  function db() {
    if (!window.firebase || !firebase.firestore) return null;
    if (!firebase.apps.length && typeof firebaseConfig !== 'undefined') firebase.initializeApp(firebaseConfig);   // js/auth.js normally does this
    return firebase.firestore();
  }

  function build(root) {
    var school = root.getAttribute('data-school');
    if (!GRADES[school]) school = '';
    var uid = 'ybf-' + (school || 'x');
    root.classList.add('ybf');
    root.innerHTML =
      '<form novalidate>' +
        '<fieldset class="ybf-group"><legend>About the photo</legend>' +
          '<div class="ybf-field"><span class="ybf-label">Student(s) in the photo <b class="ybf-req">*</b></span>' +
            '<span class="ybf-hint">First and last name, school and grade for each student. A group photo? Add everyone you know, left to right if you can. Students can be from different schools.</span>' +
            '<div class="ybf-students"></div>' +
            '<button type="button" class="ybf-add">+ Add another student</button></div>' +
          '<div class="ybf-field"><label for="' + uid + '-event">Event <span class="ybf-opt">(optional)</span></label>' +
            '<select id="' + uid + '-event" name="event"><option value="">Not sure / no specific event</option><option value="' + OTHER + '">Other event (type it in)</option></select>' +
            '<input type="text" class="ybf-other" id="' + uid + '-other" maxlength="80" placeholder="What event is it from?" hidden aria-label="Event name"></div>' +
        '</fieldset>' +
        '<fieldset class="ybf-group"><legend>About you</legend>' +
          '<div class="ybf-row">' +
            '<div class="ybf-field"><label for="' + uid + '-name">Your name <b class="ybf-req">*</b></label>' +
              '<input type="text" id="' + uid + '-name" name="uploaderName" maxlength="80" autocomplete="name" required></div>' +
            '<div class="ybf-field"><label for="' + uid + '-email">Your email <b class="ybf-req">*</b></label>' +
              '<input type="email" id="' + uid + '-email" name="uploaderEmail" maxlength="120" autocomplete="email" required></div>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="ybf-group"><legend>Photos <b class="ybf-req">*</b></legend>' +
          '<span class="ybf-hint">Up to ' + MAX_FILES + ' photos, ' + mb(MAX_BYTES) + ' each (JPG, PNG, HEIC). Send the original full-size photo from your phone or camera; screenshots and photos saved from social media are too small to print well.</span>' +
          '<div class="ybf-drop" tabindex="0" role="button" aria-label="Choose photos to upload"><strong>Tap to choose photos</strong><span> or drag them here</span>' +
            '<input type="file" accept="image/*,.heic,.heif" multiple hidden></div>' +
          '<ul class="ybf-files"></ul>' +
        '</fieldset>' +
        '<fieldset class="ybf-group"><legend>Parent directory</legend>' +
          '<span class="ybf-label" id="' + uid + '-dl">Would you like to register for the Schalmont PTO parent directory?</span>' +
          '<span class="ybf-hint">The directory helps Schalmont families connect. Only other registered Schalmont PTO families can see it, and you choose what to share.</span>' +
          '<div class="ybf-grades" role="radiogroup" aria-labelledby="' + uid + '-dl">' +
            '<label class="ybf-chip"><input type="radio" name="directory" value="yes"><span>Yes, sign me up</span></label>' +
            '<label class="ybf-chip"><input type="radio" name="directory" value="no"><span>No thanks</span></label>' +
          '</div>' +
        '</fieldset>' +
        // Messages sit right above the button, where the parent is looking when they press it.
        '<div class="ybf-msg" role="status" aria-live="polite"></div>' +
        '<button type="submit" class="btn btn-primary ybf-submit">Submit photos</button>' +
        '<p class="ybf-fine">By submitting, you confirm you took these photos and are OK with the Schalmont PTO using them in the yearbook and in marketing communications. ' +
          'To have a photo removed, email <a href="mailto:julie@schalmontpto.com">julie@schalmontpto.com</a>.</p>' +
      '</form>';

    var form = root.querySelector('form'), msg = root.querySelector('.ybf-msg');
    var studentBox = root.querySelector('.ybf-students'), addBtn = root.querySelector('.ybf-add'), rowN = 0;

    var drop = root.querySelector('.ybf-drop'), input = drop.querySelector('input');
    var list = root.querySelector('.ybf-files'), btn = root.querySelector('.ybf-submit');
    var evSel = root.querySelector('select[name=event]'), evOther = root.querySelector('.ybf-other');
    var chosen = [], events = {}, store = db();   // events = {school: [Drive event folder names]}

    // ---- students: First / Last / School / Grade, one row each ----
    function gradeOptions(sc) {
      return '<option value="">Grade…</option>' + (GRADES[sc] || []).map(function (g) {
        return '<option value="' + g + '">' + esc(gradeLabel(g)) + '</option>';
      }).join('');
    }
    function addStudent(focus) {
      var n = ++rowN, row = document.createElement('div');
      var rows = studentBox.querySelectorAll('.ybf-school');
      var sc = rows.length ? rows[rows.length - 1].value : school;   // a new row starts on the last row's school
      row.className = 'ybf-student';
      row.innerHTML =
        '<input type="text" class="ybf-first" maxlength="40" autocomplete="off" required placeholder="First name" aria-label="Student ' + n + ' first name">' +
        '<input type="text" class="ybf-last" maxlength="40" autocomplete="off" required placeholder="Last name" aria-label="Student ' + n + ' last name">' +
        '<select class="ybf-school" required aria-label="Student ' + n + ' school"><option value="">School…</option>' +
          SCHOOLS.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select>' +
        '<select class="ybf-grade" required aria-label="Student ' + n + ' grade"></select>' +
        '<button type="button" class="ybf-rm" aria-label="Remove this student">×</button>';
      var scSel = row.querySelector('.ybf-school'), grSel = row.querySelector('.ybf-grade');
      scSel.value = sc || '';
      grSel.innerHTML = gradeOptions(scSel.value);
      if (scSel.value === 'woestina') grSel.value = 'Pre-K';
      scSel.onchange = function () {
        grSel.innerHTML = gradeOptions(scSel.value);
        if (scSel.value === 'woestina') grSel.value = 'Pre-K';
        fillEvents();
      };
      row.querySelector('.ybf-rm').onclick = function () { row.remove(); syncStudents(); fillEvents(); };
      studentBox.appendChild(row);
      syncStudents();
      if (focus) row.querySelector('.ybf-first').focus();
    }
    function syncStudents() {
      var rows = studentBox.children;
      [].forEach.call(rows, function (r) { r.querySelector('.ybf-rm').hidden = rows.length < 2; });
      addBtn.hidden = rows.length >= 30;
    }
    function rowSchools() {
      var out = [];
      studentBox.querySelectorAll('.ybf-school').forEach(function (s) { if (s.value && out.indexOf(s.value) < 0) out.push(s.value); });
      return out;
    }
    function resetStudents() { studentBox.innerHTML = ''; addStudent(false); fillEvents(); }
    addBtn.onclick = function () { addStudent(true); };
    form.addEventListener('input', function () { if (msg.querySelector('.err')) show('', ''); });   // clear an error once they start fixing it

    // ---- events: the event folders inside each school's folder in the PTO's Google Drive
    // (api/yearbook-events.php), for the schools picked above, grouped by school when
    // there's more than one. Option value = "school|folder name". ----
    function fillEvents() {
      var keep = evSel.value, scs = rowSchools();
      var opts = function (sc) { return (events[sc] || []).map(function (n) { return '<option value="' + esc(sc + '|' + n) + '">' + esc(n) + '</option>'; }).join(''); };
      var body = scs.length > 1
        ? scs.map(function (sc) {
            return (events[sc] || []).length ? '<optgroup label="' + esc(SCHOOLS.filter(function (x) { return x[0] === sc; })[0][1]) + '">' + opts(sc) + '</optgroup>' : '';
          }).join('')
        : scs.map(opts).join('');
      evSel.innerHTML = '<option value="">Not sure / no specific event</option>' + body + '<option value="' + OTHER + '">Other event (type it in)</option>';
      evSel.value = [].some.call(evSel.options, function (o) { return o.value === keep; }) ? keep : '';
      evOther.hidden = evSel.value !== OTHER;
    }
    fetch('/api/yearbook-events.php').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok && d.events) { events = d.events; fillEvents(); }
    }).catch(function () {});
    resetStudents();
    evSel.onchange = function () { evOther.hidden = evSel.value !== OTHER; if (!evOther.hidden) evOther.focus(); };

    // ---- choosing photos ----
    drop.onclick = function () { input.click(); };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('is-drag'); };
    drop.ondragleave = function () { drop.classList.remove('is-drag'); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('is-drag'); add(e.dataTransfer.files); };
    input.onchange = function () { add(input.files); input.value = ''; };

    function add(files) {
      var skipped = [];
      [].forEach.call(files, function (f) {
        if (!isImage(f)) return skipped.push(f.name + ' isn\'t a photo');
        if (f.size > MAX_BYTES) return skipped.push(f.name + ' is ' + mb(f.size) + ' (limit ' + mb(MAX_BYTES) + ')');
        if (chosen.length >= MAX_FILES) return skipped.push(f.name + ' (only ' + MAX_FILES + ' per submission)');
        var item = { file: f, small: false, state: '' };
        chosen.push(item);
        checkSize(item);
      });
      render();
      if (skipped.length) show('err', 'Skipped: ' + skipped.join('; ') + '.');
    }
    function checkSize(item) {
      if (!/^image\/(jpeg|png|webp)$/.test(item.file.type)) return;
      var img = new Image(), url = URL.createObjectURL(item.file);
      img.onload = function () { item.small = Math.max(img.naturalWidth, img.naturalHeight) < SMALL_PX; URL.revokeObjectURL(url); render(); };
      img.src = url;
    }
    function render() {
      list.innerHTML = '';
      chosen.forEach(function (it, i) {
        var li = document.createElement('li');
        li.className = 'ybf-file' + (it.state ? ' is-' + it.state : '');
        var thumb = /^image\/(jpeg|png|webp|gif)$/.test(it.file.type) ? '<img alt="" src="' + URL.createObjectURL(it.file) + '">' : '<span class="ybf-noprev">🖼️</span>';
        li.innerHTML = thumb + '<div><b>' + esc(it.file.name) + '</b><small>' + mb(it.file.size) +
          (it.small ? ' · <em>small photo; may print blurry</em>' : '') +
          (it.state === 'up' ? ' · uploading…' : it.state === 'done' ? ' · ✓ sent' : it.state === 'fail' ? ' · didn\'t upload' : '') + '</small></div>' +
          (btn.disabled ? '' : '<button type="button" aria-label="Remove ' + esc(it.file.name) + '">×</button>');
        var x = li.querySelector('button');
        if (x) x.onclick = function () { chosen.splice(i, 1); render(); };
        list.appendChild(li);
      });
      drop.hidden = chosen.length >= MAX_FILES;
    }
    function show(kind, text, extraHTML) {
      msg.innerHTML = text ? '<div class="ybf-alert ' + kind + '">' + esc(text) + (extraHTML || '') + '</div>' : '';
      if (text && msg.getBoundingClientRect) {
        var r = msg.getBoundingClientRect();
        if (r.top < 0 || r.bottom > (window.innerHeight || 800)) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // ---- submitting ----
    function post(fd) {
      return fetch('/api/yearbook-upload.php', { method: 'POST', body: fd }).then(function (r) {
        return r.json().catch(function () { return { ok: false, error: r.status === 413 ? 'That photo is too large for the server.' : 'Upload failed (' + r.status + ').' }; })
          .then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || 'Upload failed'); return d; });
      });
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      show('', '');
      var f = form.elements;
      var name = f.uploaderName.value.trim(), email = f.uploaderEmail.value.trim();
      // Every student row needs both names, a school and a grade; blank extra rows are ignored.
      var missing = null, kids = [];
      [].forEach.call(studentBox.children, function (r) {
        var fi = r.querySelector('.ybf-first'), la = r.querySelector('.ybf-last'), sc = r.querySelector('.ybf-school'), gr = r.querySelector('.ybf-grade');
        var a = fi.value.trim(), b = la.value.trim();
        if (!a && !b) return;
        if (missing) return;
        if (!a || !b) missing = [a ? la : fi, 'Please enter both a first and last name for each student.'];
        else if (!sc.value) missing = [sc, 'Please choose the school for ' + a + ' ' + b + '.'];
        else if (!gr.value) missing = [gr, 'Please choose the grade for ' + a + ' ' + b + '.'];
        else kids.push({ name: a + ' ' + b, school: sc.value, grade: gr.value });
      });
      var schools = [], gradeVals = [];
      kids.forEach(function (k) { if (schools.indexOf(k.school) < 0) schools.push(k.school); if (gradeVals.indexOf(k.grade) < 0) gradeVals.push(k.grade); });
      var schoolName = function (sc) { return SCHOOLS.filter(function (x) { return x[0] === sc; })[0][1]; };
      // "Maya Chen (3rd grade), …" -- with the school too when the photo spans schools.
      var students = kids.map(function (k) {
        return k.name + ' (' + (schools.length > 1 ? schoolName(k.school) + ', ' : '') + gradeLabel(k.grade) + ')';
      }).join(', ');
      var wantsDir = !!form.querySelector('input[name=directory][value=yes]:checked');
      var evPick = evSel.value && evSel.value !== OTHER ? evSel.value.split('|') : null;   // [school, folder name]
      var evSchool = evPick ? evPick[0] : '', evFolderName = evPick ? evPick.slice(1).join('|') : '';
      var evLabel = evSel.value === OTHER ? evOther.value.trim() : evFolderName;
      var problem = missing ? missing
        : !kids.length ? [studentBox.querySelector('.ybf-first'), 'Please enter the first and last name of the student(s) in the photo.']
        : !name ? [f.uploaderName, 'Please enter your name.']
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [f.uploaderEmail, 'Please enter a valid email address.']
        : !chosen.length ? [drop, 'Please choose at least one photo.'] : null;
      if (problem) { show('err', problem[1]); try { problem[0].focus({ preventScroll: true }); } catch (_) { problem[0].focus(); } return; }

      var batchId = new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 10);
      var gradesText = gradeVals.map(gradeLabel).join(', ');
      // Photo files live once on the server under the first school; Drive gets a copy for every school.
      var school = schools[0];
      btn.disabled = true; btn.textContent = 'Uploading…';
      chosen.forEach(function (it) { it.state = ''; });
      var saved = [], failed = 0;
      // One photo per request, in order.
      var total = chosen.length, nth = 0;
      show('ok', 'Uploading your photos… please keep this page open until it says Thank you.');
      chosen.reduce(function (p, it) {
        return p.then(function () {
          it.state = 'up'; render();
          btn.textContent = 'Uploading ' + (++nth) + ' of ' + total + '…';
          var fd = new FormData();
          fd.append('school', school); fd.append('schools', schools.join(',')); fd.append('batchId', batchId);
          fd.append('event', ''); fd.append('eventFolder', evFolderName); fd.append('eventSchool', evSchool); fd.append('eventLabel', evLabel);
          fd.append('students', students); fd.append('grades', gradesText);
          fd.append('uploaderName', name); fd.append('uploaderEmail', email);
          fd.append('photos[]', it.file);
          return post(fd).then(function (d) { it.state = 'done'; saved = saved.concat(d.files); render(); })
            .catch(function (err) { it.state = 'fail'; it.err = err.message; failed++; render(); });
        });
      }, Promise.resolve()).then(function () {
        if (!saved.length) throw new Error((chosen[0] && chosen[0].err) || 'Upload failed');
        // One review record per school, so each school's yearbook team sees the photo.
        var recs = schools.map(function (sc) {
          return {
            school: sc, event: 'unsorted', eventLabel: evLabel || 'No event chosen',
            students: students, grades: kids.filter(function (k) { return k.school === sc; }).map(function (k) { return k.grade; }),
            allSchools: schools, people: students,
            uploaderName: name, uploaderEmail: email, directoryInterest: wantsDir, photos: saved, batchId: batchId, status: 'live',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
        });
        // The photos are already on the server (with a backup copy of these details), so don't
        // keep the family waiting if Firestore is slow to confirm.
        var saveRec = store ? Promise.all(recs.map(function (r) { return store.collection('yearbook_photos').add(r); })) : Promise.resolve();
        return Promise.race([saveRec, new Promise(function (ok) { setTimeout(ok, 8000); })]).catch(function () {}).then(function () {
          var n = saved.length;
          var bad = chosen.filter(function (it) { return it.state === 'fail'; });
          // Said yes to the directory: hand their name and email to its Register form.
          var dirHTML = '';
          if (wantsDir) {
            try { sessionStorage.setItem('dirPrefill', JSON.stringify({ name: name, email: email })); } catch (_) {}
            dirHTML = '<span class="ybf-dir-next">One more step for the parent directory: create your account (it takes a minute).' +
              '<a class="btn btn-primary" href="/directory#register">Register for the parent directory →</a></span>';
          }
          show(failed ? 'err' : 'ok', 'Thank you! ' + n + ' photo' + (n === 1 ? ' was' : 's were') + ' sent to the yearbook team.' +
            (failed ? ' ' + failed + ' didn\'t upload (' + bad[0].err + ') and are still listed below; you can try them again.' : ''), dirHTML);
          chosen = bad;
          chosen.forEach(function (it) { it.state = ''; });
          if (!failed) resetStudents();
        });
      }).catch(function (err) {
        show('err', 'Sorry, the photos didn\'t upload: ' + err.message);
      }).then(function () {
        btn.disabled = false; btn.textContent = 'Submit photos';
        render();
      });
    };
  }

  function boot() { document.querySelectorAll('[data-yearbook-form]').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
