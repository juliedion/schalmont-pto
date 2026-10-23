/* Yearbook photo submission form, shared by the school yearbook pages.
   Drop <div data-yearbook-form data-school="jefferson|middle|high"></div> on a page (that
   school starts out picked; families can switch to another school) and
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
      '<div class="ybf-msg" role="status" aria-live="polite"></div>' +
      '<form novalidate>' +
        '<fieldset class="ybf-group"><legend>About the photo</legend>' +
          '<div class="ybf-field"><span class="ybf-label">Student(s) in the photo <b class="ybf-req">*</b></span>' +
            '<span class="ybf-hint">First and last name for each student. A group photo? Add everyone you know, left to right if you can.</span>' +
            '<div class="ybf-students"></div>' +
            '<button type="button" class="ybf-add">+ Add another student</button></div>' +
          '<div class="ybf-field"><span class="ybf-label" id="' + uid + '-sl">School <b class="ybf-req">*</b></span>' +
            '<div class="ybf-grades ybf-schools" role="radiogroup" aria-labelledby="' + uid + '-sl">' +
              SCHOOLS.map(function (sc) {
                return '<label class="ybf-chip"><input type="radio" name="school" value="' + sc[0] + '"' + (sc[0] === school ? ' checked' : '') + ' required><span>' + esc(sc[1]) + '</span></label>';
              }).join('') +
            '</div></div>' +
          '<div class="ybf-field"><span class="ybf-label" id="' + uid + '-gl">Grade(s) of the student(s) <b class="ybf-req">*</b></span>' +
            '<span class="ybf-hint">Check every grade that\'s in the photo.</span>' +
            '<div class="ybf-grades ybf-grade-list" role="group" aria-labelledby="' + uid + '-gl"></div></div>' +
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
        '<button type="submit" class="btn btn-primary ybf-submit">Submit photos</button>' +
        '<p class="ybf-fine">By submitting, you confirm you took these photos and are OK with the Schalmont PTO using them in the yearbook and in marketing communications. ' +
          'To have a photo removed, email <a href="mailto:julie@schalmontpto.com">julie@schalmontpto.com</a>.</p>' +
      '</form>';

    var form = root.querySelector('form'), msg = root.querySelector('.ybf-msg');
    var studentBox = root.querySelector('.ybf-students'), addBtn = root.querySelector('.ybf-add'), rowN = 0;

    // ---- students: one First / Last row each ----
    function addStudent(focus) {
      var n = ++rowN, row = document.createElement('div');
      row.className = 'ybf-student';
      row.innerHTML =
        '<input type="text" class="ybf-first" maxlength="40" autocomplete="off" required placeholder="First name" aria-label="Student ' + n + ' first name">' +
        '<input type="text" class="ybf-last" maxlength="40" autocomplete="off" required placeholder="Last name" aria-label="Student ' + n + ' last name">' +
        '<button type="button" class="ybf-rm" aria-label="Remove this student">×</button>';
      row.querySelector('.ybf-rm').onclick = function () { row.remove(); syncStudents(); };
      studentBox.appendChild(row);
      syncStudents();
      if (focus) row.querySelector('.ybf-first').focus();
    }
    function syncStudents() {
      var rows = studentBox.children;
      [].forEach.call(rows, function (r) { r.querySelector('.ybf-rm').hidden = rows.length < 2; });
      addBtn.hidden = rows.length >= 30;
    }
    function resetStudents() { studentBox.innerHTML = ''; addStudent(false); }
    addBtn.onclick = function () { addStudent(true); };
    form.addEventListener('input', function () { if (msg.querySelector('.err')) show('', ''); });   // clear an error once they start fixing it
    resetStudents();
    var drop = root.querySelector('.ybf-drop'), input = drop.querySelector('input');
    var list = root.querySelector('.ybf-files'), btn = root.querySelector('.ybf-submit');
    var evSel = root.querySelector('select'), evOther = root.querySelector('.ybf-other');
    var gradeBox = root.querySelector('.ybf-grade-list');
    var chosen = [], folders = [], store = db();

    // Picking a school shows its grades and its events (the yearbook folders that school
    // set up in the back office), between "Not sure" and "Other".
    function setSchool(sc) {
      school = sc;
      gradeBox.innerHTML = school ? GRADES[school].map(function (g) {
        return '<label class="ybf-chip"><input type="checkbox" name="grades" value="' + g + '"><span>' + esc(g) + (g === 'K' ? '<i class="ybf-sr"> Kindergarten</i>' : /^\d/.test(g) ? '<i class="ybf-sr"> ' + esc(gradeLabel(g)) + '</i>' : '') + '</span></label>';
      }).join('') : '<span class="ybf-hint" style="margin:0">Choose a school first.</span>';
      folders = [];
      var keep = evSel.value === OTHER ? OTHER : '';
      [].slice.call(evSel.options, 1, -1).forEach(function (o) { o.remove(); });
      evSel.value = keep;
      if (!store || !school) return;
      var asked = school;
      store.collection('yearbook_folders').where('school', '==', school).get().then(function (snap) {
        if (asked !== school) return;   // switched schools while this was loading
        folders = snap.docs.map(function (d) { return d.data(); })
          .filter(function (f) { return f.slug && f.name; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); });
        evSel.options[evSel.options.length - 1].insertAdjacentHTML('beforebegin',
          folders.map(function (f) { return '<option value="' + esc(f.slug) + '">' + esc(f.name) + '</option>'; }).join(''));
      }).catch(function () {});
    }
    form.querySelectorAll('input[name=school]').forEach(function (r) { r.onchange = function () { setSchool(r.value); }; });
    setSchool(school);
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
    function show(kind, text, extraHTML) { msg.innerHTML = text ? '<div class="ybf-alert ' + kind + '">' + esc(text) + (extraHTML || '') + '</div>' : ''; }

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
      // Every student row needs both names; blank extra rows are ignored.
      var missing = null, names = [];
      [].forEach.call(studentBox.children, function (r) {
        var fi = r.querySelector('.ybf-first'), la = r.querySelector('.ybf-last'), a = fi.value.trim(), b = la.value.trim();
        if (!a && !b) return;
        if (!a || !b) { missing = missing || (a ? la : fi); return; }
        names.push(a + ' ' + b);
      });
      var students = names.join(', ');
      var wantsDir = !!form.querySelector('input[name=directory][value=yes]:checked');
      var picked = [].filter.call(form.querySelectorAll('input[name=grades]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
      var evSlug = evSel.value === OTHER ? '' : evSel.value;
      var evLabel = evSel.value === OTHER ? evOther.value.trim() : evSlug ? (folders.filter(function (x) { return x.slug === evSlug; })[0] || {}).name || '' : '';
      var problem = missing ? [missing, 'Please enter both a first and last name for each student.']
        : !students ? [studentBox.querySelector('.ybf-first'), 'Please enter the first and last name of the student(s) in the photo.']
        : !school ? [form.querySelector('input[name=school]'), 'Please choose the school.']
        : !picked.length ? [form.querySelector('input[name=grades]'), 'Please check the grade(s) of the student(s).']
        : !name ? [f.uploaderName, 'Please enter your name.']
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [f.uploaderEmail, 'Please enter a valid email address.']
        : !chosen.length ? [drop, 'Please choose at least one photo.'] : null;
      if (problem) { show('err', problem[1]); problem[0].focus(); return; }

      var batchId = new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 10);
      var gradesText = picked.map(gradeLabel).join(', ');
      btn.disabled = true; btn.textContent = 'Uploading…';
      chosen.forEach(function (it) { it.state = ''; });
      var saved = [], failed = 0;
      // One photo per request, in order.
      chosen.reduce(function (p, it) {
        return p.then(function () {
          it.state = 'up'; render();
          var fd = new FormData();
          fd.append('school', school); fd.append('batchId', batchId);
          fd.append('event', evSlug); fd.append('eventLabel', evLabel);
          fd.append('students', students); fd.append('grades', gradesText);
          fd.append('uploaderName', name); fd.append('uploaderEmail', email);
          fd.append('photos[]', it.file);
          return post(fd).then(function (d) { it.state = 'done'; saved = saved.concat(d.files); render(); })
            .catch(function (err) { it.state = 'fail'; it.err = err.message; failed++; render(); });
        });
      }, Promise.resolve()).then(function () {
        if (!saved.length) throw new Error((chosen[0] && chosen[0].err) || 'Upload failed');
        var rec = {
          school: school, event: evSlug || 'unsorted', eventLabel: evLabel || 'No event chosen',
          students: students, grades: picked, people: students + ' (' + gradesText + ')',
          uploaderName: name, uploaderEmail: email, directoryInterest: wantsDir, photos: saved, batchId: batchId, status: 'live',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        // The photos are already on the server (with a backup copy of these details), so don't
        // keep the family waiting if Firestore is slow to confirm.
        var saveRec = store ? store.collection('yearbook_photos').add(rec) : Promise.resolve();
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
          if (!failed) { resetStudents(); form.querySelectorAll('input[name=grades]').forEach(function (c) { c.checked = false; }); }
        });
      }).catch(function (err) {
        show('err', 'Sorry, the photos didn\'t upload: ' + err.message);
      }).then(function () {
        btn.disabled = false; btn.textContent = 'Submit photos';
        render();
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
  }

  function boot() { document.querySelectorAll('[data-yearbook-form]').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
