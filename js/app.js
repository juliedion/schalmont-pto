/* ============================================================
   Schalmont PTO — Main Application JavaScript
   ============================================================ */

/* === Utility Functions === */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

function getMonthName(m) {
  return ['January','February','March','April','May','June','July',
          'August','September','October','November','December'][m];
}

function pad(n) { return String(n).padStart(2, '0'); }

function showAlert(container, msg, type = 'success', duration = 4000) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.insertAdjacentElement('afterbegin', el);
  if (duration) setTimeout(() => el.remove(), duration);
  return el;
}

function initNavToggle() {
  const toggle = $('#nav-toggle');
  const links  = $('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', links.classList.contains('open'));
  });
  // Close on link click
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
const Store = {
  get: (key, def = []) => {
    try { return JSON.parse(localStorage.getItem('pto_' + key)) ?? def; } catch { return def; }
  },
  set: (key, val) => localStorage.setItem('pto_' + key, JSON.stringify(val)),
  push: (key, item, def = []) => {
    const arr = Store.get(key, def);
    arr.push(item);
    Store.set(key, arr);
    return arr;
  }
};

/* ============================================================
   SAMPLE DATA (pre-populated on first load)
   ============================================================ */
function seedData() {

  // Directory — starts empty; families add themselves
  if (!Store.get('dir_seeded_v3', false)) {
    Store.set('directory', []);
    Store.set('dir_seeded_v3', true);
  }

  // Volunteer events
  if (!Store.get('vol_seeded', false)) {
    const volEvents = [
      {
        id: 'v1',
        title: 'Spring Book Fair',
        date: '2026-03-16',
        roles: [
          { id: 'r1', name: 'Setup Crew', description: 'Help set up tables and displays (7:00–8:30 AM)', slots: 6, signups: [] },
          { id: 'r2', name: 'Cashier / Sales', description: 'Help students purchase books (8:30 AM–12:00 PM)', slots: 4, signups: [] },
          { id: 'r3', name: 'Cashier / Sales', description: 'Help students purchase books (12:00–3:30 PM)', slots: 4, signups: [] },
          { id: 'r4', name: 'Teardown Crew', description: 'Help pack up at end of day (3:00–4:30 PM)', slots: 4, signups: [] }
        ]
      },
      {
        id: 'v2',
        title: 'Spring Carnival',
        date: '2026-04-25',
        roles: [
          { id: 'r5', name: 'Game Booth Host', description: 'Run a carnival game booth (11 AM–1 PM)', slots: 8, signups: [] },
          { id: 'r6', name: 'Game Booth Host', description: 'Run a carnival game booth (1–4 PM)', slots: 8, signups: [] },
          { id: 'r7', name: 'Food Service', description: 'Help serve food and drinks all day', slots: 6, signups: [] },
          { id: 'r8', name: 'Raffle Table', description: 'Sell raffle tickets and manage prizes', slots: 3, signups: [] },
          { id: 'r9', name: 'Setup / Breakdown', description: 'Setup 8–11 AM or Breakdown 4–6 PM', slots: 10, signups: [] }
        ]
      },
      {
        id: 'v3',
        title: 'Teacher Appreciation Luncheon',
        date: '2026-05-06',
        roles: [
          { id: 'r10', name: 'Food Donation', description: 'Bring a dish to share (drop off by 11 AM)', slots: 12, signups: [] },
          { id: 'r11', name: 'Setup & Serving', description: 'Help set up and serve the luncheon', slots: 5, signups: [] },
          { id: 'r12', name: 'Cleanup', description: 'Help clean up after the event (1–2 PM)', slots: 4, signups: [] }
        ]
      }
    ];
    Store.set('vol_events', volEvents);
    Store.set('vol_seeded', true);
  }
}

/* ============================================================
   EVENTS CALENDAR PAGE
   ============================================================ */
function initEventsPage() {
  if (!$('#calendar-grid')) return;

  const db          = firebase.firestore();
  let cachedEvents  = [];
  let currentDate   = new Date();
  currentDate.setDate(1);

  // ── admin helpers ─────────────────────────────────────────
  function isAdmin() {
    const user = firebase.auth().currentUser;
    return user && Array.isArray(adminEmails) && adminEmails.includes(user.email);
  }

  function updateAdminUI() {
    const btn = $('#admin-toggle');
    if (btn) btn.style.display = isAdmin() ? '' : 'none';
  }

  // ── real-time Firestore listener ──────────────────────────
  db.collection('events').onSnapshot(snapshot => {
    cachedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCalendar();
  }, err => {
    console.error('Firestore error:', err);
  });

  firebase.auth().onAuthStateChanged(() => {
    updateAdminUI();
    renderCalendar();
  });

  // ── render calendar grid ──────────────────────────────────
  function renderCalendar() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    $('#cal-month-label').textContent = `${getMonthName(month)} ${year}`;

    const eventsByDate = {};
    cachedEvents.forEach(ev => {
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
      eventsByDate[ev.date].push(ev);
    });

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><span class="day-num">${daysInPrev - i}</span></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = `${year}-${pad(month+1)}-${pad(d)}`;
      const isToday   = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const dayEvents = eventsByDate[dateStr] || [];
      const cls = 'cal-day' + (isToday ? ' today' : '') + (dayEvents.length ? ' has-event' : '');
      const numEl = isToday ? `<span class="day-num flex-center">${d}</span>` : `<span class="day-num">${d}</span>`;
      const dots  = dayEvents.slice(0, 2).map(ev =>
        `<span class="cal-event-dot type-${ev.type}" title="${esc(ev.title)}">${esc(ev.title)}</span>`
      ).join('');
      const more  = dayEvents.length > 2 ? `<span class="cal-event-dot" style="background:#9ca3af">+${dayEvents.length - 2} more</span>` : '';
      html += `<div class="${cls}" data-date="${dateStr}">${numEl}${dots}${more}</div>`;
    }
    const remaining = 42 - (firstDay + daysInMonth);
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="cal-day other-month"><span class="day-num">${d}</span></div>`;
    }

    $('#calendar-grid').innerHTML = html;
    $$('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => showDayEvents(el.dataset.date));
    });

    renderEventList();
    updateAdminUI();
  }

  // ── render event list sidebar ─────────────────────────────
  function renderEventList() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthEvents = cachedEvents
      .filter(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const list = $('#event-list');
    if (!list) return;
    if (monthEvents.length === 0) {
      list.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:24px">No events this month.</p>';
      return;
    }
    list.innerHTML = monthEvents.map(ev => {
      const d         = new Date(ev.date + 'T00:00:00');
      const deleteBtn = isAdmin()
        ? `<button class="btn btn-sm btn-danger" onclick="deleteEvent('${ev.id}')">✕</button>`
        : '';
      return `<div class="event-list-item">
        <div class="event-date-badge">
          <span class="eday">${d.getDate()}</span>
          <span class="emonth">${getMonthName(d.getMonth()).slice(0,3)}</span>
        </div>
        <div class="event-info">
          <h4>${esc(ev.title)}</h4>
          <p>${esc(ev.description || '')}</p>
          <div class="event-meta">
            ${ev.time ? `<span>🕐 ${esc(ev.time)}</span>` : ''}
            ${ev.location ? `<span>📍 ${esc(ev.location)}</span>` : ''}
            <span><span class="badge badge-blue">${esc(ev.type)}</span></span>
          </div>
        </div>
        ${deleteBtn}
      </div>`;
    }).join('');
  }

  // ── day-click modal ───────────────────────────────────────
  function showDayEvents(dateStr) {
    const events = cachedEvents.filter(ev => ev.date === dateStr);
    const modal  = $('#day-modal');
    const body   = $('#day-modal-body');
    const d      = new Date(dateStr + 'T00:00:00');
    $('#day-modal-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    body.innerHTML = events.length === 0
      ? '<p style="color:var(--text-light)">No events on this day.</p>'
      : events.map(ev => `
        <div style="margin-bottom:16px;padding:14px;background:var(--light-bg);border-radius:var(--radius)">
          <h4 style="margin-bottom:6px">${esc(ev.title)}</h4>
          ${ev.time     ? `<p style="font-size:13px;color:var(--text-light)">🕐 ${esc(ev.time)}</p>`        : ''}
          ${ev.location ? `<p style="font-size:13px;color:var(--text-light)">📍 ${esc(ev.location)}</p>`   : ''}
          ${ev.description ? `<p style="font-size:13px;margin-top:8px">${esc(ev.description)}</p>`         : ''}
        </div>`).join('');
    modal.classList.remove('hidden');
  }

  // ── delete event (admin only) ─────────────────────────────
  window.deleteEvent = async function(id) {
    if (!isAdmin()) return;
    if (!confirm('Delete this event?')) return;
    try {
      await db.collection('events').doc(id).delete();
    } catch (err) {
      alert('Could not delete event: ' + err.message);
    }
  };

  // ── month nav ─────────────────────────────────────────────
  $('#cal-prev').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // ── day modal close ───────────────────────────────────────
  $('#day-modal-close')?.addEventListener('click', () => $('#day-modal').classList.add('hidden'));
  $('#day-modal')?.addEventListener('click', e => { if (e.target === $('#day-modal')) $('#day-modal').classList.add('hidden'); });

  // ── admin panel toggle ────────────────────────────────────
  $('#admin-toggle')?.addEventListener('click', () => {
    $('#admin-form-wrap').classList.toggle('hidden');
  });

  // ── add event form (admin only) ───────────────────────────
  $('#add-event-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdmin()) return;
    const fd  = new FormData(e.target);
    const ev  = {
      title:       fd.get('title').trim(),
      date:        fd.get('date'),
      time:        fd.get('time'),
      location:    fd.get('location').trim(),
      type:        fd.get('type'),
      description: fd.get('description').trim()
    };
    if (!ev.title || !ev.date) {
      showAlert($('#add-event-alert'), 'Please fill in title and date.', 'error');
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled    = true;
    btn.textContent = 'Saving…';
    try {
      await db.collection('events').add(ev);
      e.target.reset();
      showAlert($('#add-event-alert'), `"${ev.title}" has been added to the calendar!`, 'success');
      $('#admin-form-wrap').classList.add('hidden');
    } catch (err) {
      showAlert($('#add-event-alert'), 'Error saving event: ' + err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Add to Calendar';
    }
  });

  updateAdminUI();
}

/* ============================================================
   DIRECTORY PAGE
   ============================================================ */
function initDirectoryPage() {
  if (!$('#directory-list')) return;

  // ── EmailJS config — fill these in from your EmailJS dashboard ────────────
  // Sign up free at https://www.emailjs.com, create a service + template,
  // then paste your IDs below. Leave as-is to disable email notifications.
  const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

  const db = firebase.firestore();

  const GRADES = ['Pre-K','Kindergarten','1st Grade','2nd Grade','3rd Grade','4th Grade',
                  '5th Grade','6th Grade','7th Grade','8th Grade','9th Grade','10th Grade',
                  '11th Grade','12th Grade'];

  let currentMember  = null;
  let allMembers     = [];
  let sortMode       = 'name';
  let directoryUnsub = null;

  // ── panel toggle ──────────────────────────────────────────────────────────
  function showFormPanel() {
    const fp = $('#dir-form-panel'), pp = $('#dir-profile-panel');
    if (fp) fp.style.display = 'block';
    if (pp) pp.style.display = 'none';
  }

  function showProfilePanel(m) {
    currentMember = m;
    const fp = $('#dir-form-panel'), pp = $('#dir-profile-panel');
    if (fp) fp.style.display = 'none';
    if (pp) { pp.style.display = 'block'; renderMyCard(m); }
  }

  function renderMyCard(m) {
    const card = $('#dir-my-card');
    if (!card || !m) return;
    const initials = `${(m.firstName||'?')[0]}${(m.lastName||'?')[0]}`;
    const students = m.students || [];
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:${students.length ? 12 : 0}px">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:2px solid var(--white);box-shadow:0 2px 6px rgba(0,0,0,0.12)">
          ${m.photo
            ? `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover" alt="">`
            : `<span style="color:#fff;font-size:18px;font-weight:700;line-height:1">${esc(initials)}</span>`}
        </div>
        <div>
          <div style="font-weight:700;font-size:16px">${esc(m.firstName)} ${esc(m.lastName)}</div>
          <div style="font-size:12px;color:var(--text-light)">In directory since ${m.joined || '—'}</div>
        </div>
      </div>
      ${students.length > 0 ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
          <p style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:0.05em;margin-bottom:6px;text-transform:uppercase">Students</p>
          ${students.map(s => `
            <div style="font-size:13px;margin-bottom:5px">
              <strong>${esc(s.name)}</strong>
              ${s.grade        ? ` &middot; <span style="color:var(--text-light)">${esc(s.grade)}</span>` : ''}
              ${s.teacher      ? ` &middot; <span style="color:var(--text-light)">Teacher: ${esc(s.teacher)}</span>` : ''}
              ${s.relationship ? ` &middot; <span style="color:var(--text-light)">${esc(s.relationship === 'Other' && s.relationshipOther ? s.relationshipOther : s.relationship)}</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
      ${m.showEmail && m.email ? `<p style="font-size:13px;margin-top:8px">&#x2709; ${esc(m.email)}</p>` : ''}
      ${m.showPhone && m.phone ? `<p style="font-size:13px">&#128222; ${esc(m.phone)}</p>` : ''}
    `;
  }

  // ── student row helpers (create form) ─────────────────────────────────────
  const SCHOOLS = ['Woestina Pre-K', 'Jefferson Elementary', 'Schalmont Middle School', 'Schalmont High School'];

  window.toggleRelOther = function(sel) {
    const next = sel.nextElementSibling;
    if (next) next.style.display = sel.value === 'Other' ? '' : 'none';
  };

  window.toggleStudentP2 = function(btn) {
    const section = btn.nextElementSibling;
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'flex' : 'none';
    btn.textContent = isHidden ? '— Remove Parent / Guardian 2' : '+ Add Parent / Guardian 2 (optional)';
  };

  const REL_OPTIONS = ['Mother','Father','Guardian','Grandparent','Other'];

  window.addStudentRow = function(name = '', grade = '', teacher = '', school = '', relationship = '', relationshipOther = '', p2 = {}) {
    const rows = $('#student-rows');
    if (!rows) return;
    const div = document.createElement('div');
    div.className = 'student-input-group';
    div.style.cssText = 'margin-bottom:10px;background:var(--light-bg);border-radius:var(--radius);padding:10px';
    const p2HasData = !!(p2.firstName || p2.lastName || p2.email);
    div.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
        <input type="text" name="studentName" placeholder="Student name" value="${esc(name)}" style="flex:1;min-width:0">
        <select name="studentGrade" style="flex:1;min-width:0">
          <option value="">Grade…</option>
          ${GRADES.map(g => `<option value="${g}"${g === grade ? ' selected' : ''}>${g}</option>`).join('')}
        </select>
        <button type="button" onclick="removeStudentRow(this)" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:none;cursor:pointer;color:var(--text-light);font-size:14px;line-height:1" aria-label="Remove">&#x2715;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        <select name="studentSchool" style="flex:1;min-width:0;font-size:13px">
          <option value="">School…</option>
          ${SCHOOLS.map(s => `<option value="${s}"${s === school ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
        <input type="text" name="studentTeacher" placeholder="Teacher last name (optional)" value="${esc(teacher)}" style="flex:1;min-width:0;font-size:13px">
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select name="studentRelationship" style="flex:1;min-width:0;font-size:13px" onchange="toggleRelOther(this)">
          <option value="">Your relationship to this child… (required)</option>
          ${REL_OPTIONS.map(r => `<option value="${r}"${r === relationship ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        <input type="text" name="studentRelationshipOther" placeholder="Please specify…" value="${esc(relationshipOther)}" style="flex:1;min-width:0;font-size:13px;display:${relationship === 'Other' ? '' : 'none'}">
      </div>
      <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        <button type="button" onclick="toggleStudentP2(this)" style="background:none;border:none;color:var(--primary-light);font-size:12px;font-weight:600;cursor:pointer;padding:0">${p2HasData ? '— Remove Parent / Guardian 2' : '+ Add Parent / Guardian 2 (optional)'}</button>
        <div style="display:${p2HasData ? 'flex' : 'none'};flex-direction:column;gap:8px;margin-top:8px">
          <div style="display:flex;gap:8px">
            <input type="text" name="studentP2FirstName" placeholder="First name" value="${esc(p2.firstName||'')}" style="flex:1;min-width:0;font-size:13px">
            <input type="text" name="studentP2LastName" placeholder="Last name" value="${esc(p2.lastName||'')}" style="flex:1;min-width:0;font-size:13px">
          </div>
          <input type="email" name="studentP2Email" placeholder="Email address" value="${esc(p2.email||'')}" style="width:100%;font-size:13px;box-sizing:border-box">
          <input type="tel" name="studentP2Phone" placeholder="Phone (optional)" value="${esc(p2.phone||'')}" style="width:100%;font-size:13px;box-sizing:border-box">
          <label class="form-check">
            <input type="checkbox" name="studentP2NotifyEmail"${p2.notifyEmail ? ' checked' : ''}>
            <span style="font-size:12px">Send Parent/Guardian 2 a notification email</span>
          </label>
          <label class="form-check">
            <input type="checkbox" name="studentP2TextReminders"${p2.textReminders ? ' checked' : ''}>
            <span style="font-size:12px">Include Parent/Guardian 2 in PTO text reminders</span>
          </label>
        </div>
      </div>
    `;
    rows.appendChild(div);
  };

  window.removeStudentRow = function(btn) {
    const rows = $('#student-rows');
    if (rows && rows.children.length > 1) btn.closest('.student-input-group').remove();
  };

  if ($('#student-rows')) {
    window.addStudentRow();
    $('#add-student-btn')?.addEventListener('click', () => window.addStudentRow());
  }

  // ── phone auto-format ─────────────────────────────────────────────────────
  function wirePhone(id) {
    $(id)?.addEventListener('input', e => {
      const d = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (!d.length) { e.target.value = ''; return; }
      if (d.length <= 3)      e.target.value = `(${d}`;
      else if (d.length <= 6) e.target.value = `(${d.slice(0,3)}) ${d.slice(3)}`;
      else                    e.target.value = `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    });
  }
  wirePhone('#dir-phone');
  wirePhone('#edit-phone');

  // ── photo upload + crop ───────────────────────────────────────────────────
  function wirePhoto(inputId, previewId, initialsId) {
    $(inputId)?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 160;
          const ctx = canvas.getContext('2d');
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, 160, 160);
          const url = canvas.toDataURL('image/jpeg', 0.6);
          $(previewId).src = url;
          $(previewId).style.display = 'block';
          $(initialsId).style.display = 'none';
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  wirePhoto('#dir-photo',  '#dir-photo-preview',  '#dir-photo-initials');
  wirePhoto('#edit-photo', '#edit-photo-preview', '#edit-photo-initials');

  // ── render directory list ─────────────────────────────────────────────────
  function currentUserEmail() {
    try { return firebase.auth().currentUser?.email || ''; } catch { return ''; }
  }

  function renderDirectory(filter = '') {
    const list = $('#directory-list');
    if (!list) return;
    const lower   = filter.toLowerCase();
    const myEmail = currentUserEmail();

    let filtered = allMembers.filter(m => {
      const students = m.students || [];
      return `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
        (m.email||'').toLowerCase().includes(lower) ||
        students.some(s =>
          (s.name||'').toLowerCase().includes(lower) ||
          (s.grade||'').toLowerCase().includes(lower) ||
          (s.teacher||'').toLowerCase().includes(lower) ||
          (s.school||'').toLowerCase().includes(lower) ||
          `${s.p2FirstName||''} ${s.p2LastName||''}`.toLowerCase().includes(lower) ||
          (s.p2Email||'').toLowerCase().includes(lower)
        );
    });

    // Grade sort order helper
    const gradeOrder = v => {
      const mapped = {'pre-k':0,'prek':0,'k':1}[String(v).toLowerCase().replace(/\s/g,'')];
      if (mapped !== undefined) return mapped;
      const n = parseInt(v);
      return isNaN(n) ? 99 : n + 1;
    };

    const firstStudent = m => (m.students && m.students[0]) || {};

    if (sortMode === 'grade') {
      filtered.sort((a, b) => {
        const ga = gradeOrder(firstStudent(a).grade || '');
        const gb = gradeOrder(firstStudent(b).grade || '');
        return ga !== gb ? ga - gb : `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase());
      });
    } else if (sortMode === 'teacher') {
      filtered.sort((a, b) => {
        const ta = (firstStudent(a).teacher || '').toLowerCase();
        const tb = (firstStudent(b).teacher || '').toLowerCase();
        return ta !== tb ? ta.localeCompare(tb) : `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase());
      });
    } else if (sortMode === 'school') {
      filtered.sort((a, b) => {
        const sa = (firstStudent(a).school || '').toLowerCase();
        const sb = (firstStudent(b).school || '').toLowerCase();
        return sa !== sb ? sa.localeCompare(sb) : `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase());
      });
    } else {
      // default: sort by parent last name
      filtered.sort((a, b) =>
        `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase())
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:32px">No members found.</p>';
      $('#dir-count').textContent = '0 members';
      return;
    }

    // Group by sort field
    const groups = {};
    filtered.forEach(m => {
      let groupKey;
      if (sortMode === 'grade') {
        groupKey = (firstStudent(m).grade || 'Unknown');
      } else if (sortMode === 'teacher') {
        groupKey = (firstStudent(m).teacher || 'Unknown');
      } else if (sortMode === 'school') {
        groupKey = (firstStudent(m).school || 'Unknown');
      } else {
        groupKey = (m.lastName || '?')[0].toUpperCase();
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(m);
    });

    let html = '';
    const sortedKeys = sortMode === 'name'
      ? Object.keys(groups).sort()
      : Object.keys(groups); // already in sort order from filtered
    sortedKeys.forEach(letter => {
      html += `<div class="dir-letter-group"><div class="dir-letter-header">${letter}</div>`;
      groups[letter].forEach(m => {
        const students = m.students || [];
        const isOwner = myEmail && m.email === myEmail;
        const studentSummary = students.map(s => s.name).filter(Boolean).join(', ');
        const entryId = 'dir-entry-' + m.id;
        html += `<div class="dir-entry">
          <button class="dir-entry-toggle" onclick="toggleDirEntry('${entryId}',this)" aria-expanded="false">
            <span class="dir-entry-name">${esc(m.lastName)}, ${esc(m.firstName)}</span>
            ${studentSummary ? `<span class="dir-entry-preview">${esc(studentSummary)}</span>` : ''}
            <span class="dir-entry-arrow">&#9658;</span>
          </button>
          <div class="dir-entry-details" id="${entryId}" style="display:none">
            ${m.showEmail && m.email ? `<div class="dir-detail-row">&#x2709; <a href="mailto:${esc(m.email)}" style="color:var(--primary)">${esc(m.email)}</a></div>` : ''}
            ${m.showPhone && m.phone ? `<div class="dir-detail-row">&#128222; ${esc(m.phone)}</div>` : ''}
            ${students.length > 0 ? `
              <div class="dir-students">
                <div class="dir-students-label">Students</div>
                ${students.map(s => `
                  <div class="dir-student-row">
                    <span class="dir-student-name">${esc(s.name)}</span>
                    ${s.grade ? `<span class="badge badge-blue" style="font-size:11px;padding:2px 7px">${esc(s.grade)}</span>` : ''}
                    ${s.school ? `<span class="dir-student-school">${esc(s.school)}</span>` : ''}
                    ${s.teacher ? `<span class="dir-student-meta">Teacher: ${esc(s.teacher)}</span>` : ''}
                    ${s.relationship ? `<span class="dir-student-meta">${esc(s.relationship === 'Other' && s.relationshipOther ? s.relationshipOther : s.relationship)}</span>` : ''}
                    ${(s.p2FirstName || s.p2LastName) ? `<span class="dir-student-meta" style="color:var(--text-light)">&#43; ${esc(((s.p2FirstName||'') + ' ' + (s.p2LastName||'')).trim())}${s.p2Email ? ' &middot; <a href="mailto:' + esc(s.p2Email) + '" style="color:var(--primary)">' + esc(s.p2Email) + '</a>' : ''}${s.p2Phone ? ' &middot; ' + esc(s.p2Phone) : ''}</span>` : ''}
                  </div>`).join('')}
              </div>` : ''}
            ${isOwner ? `<button class="btn btn-sm btn-blue" style="margin-top:10px;font-size:12px" onclick="openEditModal()">&#9998; Edit My Listing</button>` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    });

    list.innerHTML = html;
    $('#dir-count').textContent = `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;
  }

  window.toggleDirEntry = function(id, btn) {
    const details = document.getElementById(id);
    if (!details) return;
    const open = details.style.display !== 'none';
    details.style.display = open ? 'none' : 'block';
    if (btn) btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  };

  $('#dir-search')?.addEventListener('input', e => renderDirectory(e.target.value));
  $('#dir-sort')?.addEventListener('change', e => {
    sortMode = e.target.value;
    renderDirectory($('#dir-search')?.value || '');
  });

  // ── Firestore real-time listener ──────────────────────────────────────────
  function startDirectoryListener() {
    if (directoryUnsub) directoryUnsub();

    // One-time fetch so existing entries appear immediately on load
    db.collection('directory').get().then(snap => {
      allMembers = [];
      snap.forEach(doc => allMembers.push({ id: doc.id, ...doc.data() }));
      renderDirectory($('#dir-search')?.value || '');
    }).catch(err => {
      console.error('Directory get() error:', err.code, err.message);
    });

    // Real-time listener keeps the list in sync with future writes
    directoryUnsub = db.collection('directory').onSnapshot(snap => {
      allMembers = [];
      snap.forEach(doc => allMembers.push({ id: doc.id, ...doc.data() }));
      renderDirectory($('#dir-search')?.value || '');
    }, err => {
      console.error('Directory onSnapshot error:', err.code, err.message);
      const countEl = $('#dir-count');
      if (countEl) {
        if (err.code === 'permission-denied') {
          countEl.textContent = 'Access denied — check Firestore rules for the directory collection';
        } else {
          countEl.textContent = `Unable to load directory (${err.code})`;
        }
      }
    });
  }

  // ── check if signed-in user already has a profile ─────────────────────────
  async function checkUserProfile(user) {
    try {
      const doc = await db.collection('directory').doc(user.uid).get();
      if (doc.exists) {
        showProfilePanel({ id: doc.id, ...doc.data() });
      } else {
        showFormPanel();
      }
    } catch(err) {
      console.warn('Profile check error:', err);
      showFormPanel();
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      startDirectoryListener();
      checkUserProfile(user);
    }
  });

  // ── edit listing modal ────────────────────────────────────────────────────
  function addEditStudentRow(name = '', grade = '', teacher = '', school = '', relationship = '', relationshipOther = '', p2 = {}) {
    const rows = $('#edit-student-rows');
    if (!rows) return;
    const div = document.createElement('div');
    div.className = 'student-input-group';
    div.style.cssText = 'margin-bottom:10px;background:var(--light-bg);border-radius:var(--radius);padding:10px';
    const p2HasData = !!(p2.firstName || p2.lastName || p2.email);
    div.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
        <input type="text" name="editStudentName" placeholder="Student name" value="${esc(name)}" style="flex:1;min-width:0">
        <select name="editStudentGrade" style="flex:1;min-width:0">
          <option value="">Grade…</option>
          ${GRADES.map(g => `<option value="${g}"${g === grade ? ' selected' : ''}>${g}</option>`).join('')}
        </select>
        <button type="button" onclick="if($('#edit-student-rows').children.length>1)this.closest('.student-input-group').remove()" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:none;cursor:pointer;color:var(--text-light);font-size:14px;line-height:1" aria-label="Remove">&#x2715;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        <select name="editStudentSchool" style="flex:1;min-width:0;font-size:13px">
          <option value="">School…</option>
          ${SCHOOLS.map(s => `<option value="${s}"${s === school ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
        <input type="text" name="editStudentTeacher" placeholder="Teacher last name (optional)" value="${esc(teacher)}" style="flex:1;min-width:0;font-size:13px">
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select name="editStudentRelationship" style="flex:1;min-width:0;font-size:13px" onchange="toggleRelOther(this)">
          <option value="">Your relationship to this child… (required)</option>
          ${REL_OPTIONS.map(r => `<option value="${r}"${r === relationship ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        <input type="text" name="editStudentRelationshipOther" placeholder="Please specify…" value="${esc(relationshipOther)}" style="flex:1;min-width:0;font-size:13px;display:${relationship === 'Other' ? '' : 'none'}">
      </div>
      <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        <button type="button" onclick="toggleStudentP2(this)" style="background:none;border:none;color:var(--primary-light);font-size:12px;font-weight:600;cursor:pointer;padding:0">${p2HasData ? '— Remove Parent / Guardian 2' : '+ Add Parent / Guardian 2 (optional)'}</button>
        <div style="display:${p2HasData ? 'flex' : 'none'};flex-direction:column;gap:8px;margin-top:8px">
          <div style="display:flex;gap:8px">
            <input type="text" name="editStudentP2FirstName" placeholder="First name" value="${esc(p2.firstName||'')}" style="flex:1;min-width:0;font-size:13px">
            <input type="text" name="editStudentP2LastName" placeholder="Last name" value="${esc(p2.lastName||'')}" style="flex:1;min-width:0;font-size:13px">
          </div>
          <input type="email" name="editStudentP2Email" placeholder="Email address" value="${esc(p2.email||'')}" style="width:100%;font-size:13px;box-sizing:border-box">
          <input type="tel" name="editStudentP2Phone" placeholder="Phone (optional)" value="${esc(p2.phone||'')}" style="width:100%;font-size:13px;box-sizing:border-box">
          <label class="form-check">
            <input type="checkbox" name="editStudentP2NotifyEmail"${p2.notifyEmail ? ' checked' : ''}>
            <span style="font-size:12px">Send Parent/Guardian 2 a notification email</span>
          </label>
          <label class="form-check">
            <input type="checkbox" name="editStudentP2TextReminders"${p2.textReminders ? ' checked' : ''}>
            <span style="font-size:12px">Include Parent/Guardian 2 in PTO text reminders</span>
          </label>
        </div>
      </div>
    `;
    rows.appendChild(div);
  }

  $('#edit-add-student-btn')?.addEventListener('click', () => addEditStudentRow());

  window.openEditModal = function() {
    const m = currentMember;
    if (!m) return;

    $('#edit-member-id').value    = m.id || '';
    $('#edit-fname').value        = m.firstName || '';
    $('#edit-lname').value        = m.lastName  || '';
    $('#edit-email').value        = m.email     || '';
    $('#edit-phone').value        = m.phone     || '';
    $('#edit-show-email').checked = !!m.showEmail;
    $('#edit-show-phone').checked = !!m.showPhone;
    const trEl = $('#edit-text-reminders');
    if (trEl) trEl.checked = !!m.textReminders;

    // Students
    $('#edit-student-rows').innerHTML = '';
    const students = m.students || [];
    if (students.length > 0) students.forEach(s => addEditStudentRow(s.name, s.grade, s.teacher || '', s.school || '', s.relationship || '', s.relationshipOther || '', {
      firstName: s.p2FirstName || '', lastName: s.p2LastName || '',
      email: s.p2Email || '', phone: s.p2Phone || '',
      notifyEmail: s.p2NotifyEmail || false, textReminders: s.p2TextReminders || false
    }));
    else addEditStudentRow();

    // Photo
    const preview  = $('#edit-photo-preview');
    const initials = $('#edit-photo-initials');
    if (m.photo) {
      preview.src = m.photo; preview.style.display = 'block'; initials.style.display = 'none';
    } else {
      preview.src = ''; preview.style.display = 'none'; initials.style.display = '';
    }
    if ($('#edit-photo')) $('#edit-photo').value = '';

    $('#edit-modal').classList.remove('hidden');
  };

  $('#edit-modal-close')?.addEventListener('click', () => $('#edit-modal').classList.add('hidden'));
  $('#edit-cancel-btn')?.addEventListener('click',  () => $('#edit-modal').classList.add('hidden'));
  $('#edit-modal')?.addEventListener('click', e => { if (e.target === $('#edit-modal')) $('#edit-modal').classList.add('hidden'); });

  $('#edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;

    const fd = new FormData(e.target);
    const studentGroups = Array.from(document.querySelectorAll('#edit-student-rows .student-input-group'));
    const students = studentGroups.map(g => ({
      name:             (g.querySelector('[name=editStudentName]')?.value || '').trim(),
      grade:             g.querySelector('[name=editStudentGrade]')?.value || '',
      teacher:          (g.querySelector('[name=editStudentTeacher]')?.value || '').trim(),
      school:            g.querySelector('[name=editStudentSchool]')?.value || '',
      relationship:      g.querySelector('[name=editStudentRelationship]')?.value || '',
      relationshipOther:(g.querySelector('[name=editStudentRelationshipOther]')?.value || '').trim(),
      p2FirstName:      (g.querySelector('[name=editStudentP2FirstName]')?.value || '').trim(),
      p2LastName:       (g.querySelector('[name=editStudentP2LastName]')?.value || '').trim(),
      p2Email:          (g.querySelector('[name=editStudentP2Email]')?.value || '').trim(),
      p2Phone:          (g.querySelector('[name=editStudentP2Phone]')?.value || '').trim(),
      p2NotifyEmail:     g.querySelector('[name=editStudentP2NotifyEmail]')?.checked || false,
      p2TextReminders:   g.querySelector('[name=editStudentP2TextReminders]')?.checked || false,
    })).filter(s => s.name);

    const photoEl = $('#edit-photo-preview');
    const photo   = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : '';

    const updated = {
      ...currentMember,
      firstName:     fd.get('firstName').trim(),
      lastName:      fd.get('lastName').trim(),
      email:         fd.get('email').trim(),
      phone:         fd.get('phone').trim(),
      students,
      photo,
      showEmail:     fd.get('showEmail')     === 'on',
      showPhone:     fd.get('showPhone')     === 'on',
      textReminders: fd.get('textReminders') === 'on',
      updatedAt:     new Date().toISOString()
    };

    const btn = e.target.querySelector('[type=submit]');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await db.collection('directory').doc(user.uid).set(updated);
      currentMember = { ...updated, id: user.uid };
      // Immediately reflect the update in the directory list
      const editIdx = allMembers.findIndex(m => m.id === user.uid);
      if (editIdx >= 0) allMembers[editIdx] = currentMember;
      else allMembers.push(currentMember);
      renderDirectory($('#dir-search')?.value || '');
      showProfilePanel(currentMember);
      $('#edit-modal').classList.add('hidden');
      sendDirectoryEmail(updated, false);
      showAlert($('#dir-alert'), 'Your listing has been updated!', 'success');
    } catch(err) {
      showAlert($('#edit-alert'), 'Save failed: ' + err.message, 'error');
    } finally {
      btn.textContent = 'Save Changes'; btn.disabled = false;
    }
  });

  // ── delete listing ────────────────────────────────────────────────────────
  window.confirmDeleteListing = async function() {
    if (!confirm('Remove your family from the directory? This cannot be undone.')) return;
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
      await db.collection('directory').doc(user.uid).delete();
      allMembers = allMembers.filter(m => m.id !== user.uid);
      renderDirectory($('#dir-search')?.value || '');
      currentMember = null;
      showFormPanel();
      const form = $('#dir-form');
      if (form) form.reset();
      $('#student-rows').innerHTML = '';
      window.addStudentRow();
      const pv = $('#dir-photo-preview'); if (pv) { pv.src = ''; pv.style.display = 'none'; }
      const pi = $('#dir-photo-initials'); if (pi) pi.style.display = '';
    } catch(err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // ── add to directory form ─────────────────────────────────────────────────
  $('#dir-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;

    const fd = new FormData(e.target);
    const studentGroups = Array.from(document.querySelectorAll('#student-rows .student-input-group'));
    const students = studentGroups.map(g => ({
      name:             (g.querySelector('[name=studentName]')?.value || '').trim(),
      grade:             g.querySelector('[name=studentGrade]')?.value || '',
      teacher:          (g.querySelector('[name=studentTeacher]')?.value || '').trim(),
      school:            g.querySelector('[name=studentSchool]')?.value || '',
      relationship:      g.querySelector('[name=studentRelationship]')?.value || '',
      relationshipOther:(g.querySelector('[name=studentRelationshipOther]')?.value || '').trim(),
      p2FirstName:      (g.querySelector('[name=studentP2FirstName]')?.value || '').trim(),
      p2LastName:       (g.querySelector('[name=studentP2LastName]')?.value || '').trim(),
      p2Email:          (g.querySelector('[name=studentP2Email]')?.value || '').trim(),
      p2Phone:          (g.querySelector('[name=studentP2Phone]')?.value || '').trim(),
      p2NotifyEmail:     g.querySelector('[name=studentP2NotifyEmail]')?.checked || false,
      p2TextReminders:   g.querySelector('[name=studentP2TextReminders]')?.checked || false,
    })).filter(s => s.name);

    const photoEl = $('#dir-photo-preview');
    const photo   = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : '';

    const member = {
      uid:           user.uid,
      firstName:     (fd.get('firstName') || '').trim(),
      lastName:      (fd.get('lastName')  || '').trim(),
      email:         (fd.get('email')     || '').trim(),
      phone:         (fd.get('phone')     || '').trim(),
      students,
      photo,
      showEmail:     fd.get('showEmail')     === 'on',
      showPhone:     fd.get('showPhone')     === 'on',
      textReminders: fd.get('textReminders') === 'on',
      joined:        new Date().toISOString().split('T')[0],
      updatedAt:     new Date().toISOString()
    };

    if (!member.firstName || !member.lastName || !member.email) {
      showAlert($('#dir-alert'), 'Please fill in first name, last name, and email.', 'error');
      return;
    }

    const btn = e.target.querySelector('[type=submit]');
    btn.textContent = 'Adding…'; btn.disabled = true;
    try {
      await db.collection('directory').doc(user.uid).set(member);
      currentMember = { ...member, id: user.uid };
      // Immediately show in the directory list without waiting for onSnapshot
      const existIdx = allMembers.findIndex(m => m.id === user.uid);
      if (existIdx >= 0) allMembers[existIdx] = currentMember;
      else allMembers.push(currentMember);
      renderDirectory($('#dir-search')?.value || '');
      e.target.reset();
      $('#student-rows').innerHTML = '';
      window.addStudentRow();
      if (photoEl) { photoEl.src = ''; photoEl.style.display = 'none'; }
      const initialsEl = $('#dir-photo-initials');
      if (initialsEl) initialsEl.style.display = '';
      if ($('#dir-photo')) $('#dir-photo').value = '';
      showProfilePanel(currentMember);
      sendDirectoryEmail(member, true);
    } catch(err) {
      showAlert($('#dir-alert'), 'Save failed: ' + err.message, 'error');
    } finally {
      btn.textContent = 'Add My Family to the Directory'; btn.disabled = false;
    }
  });

  // ── email notification via EmailJS ────────────────────────────────────────
  function sendDirectoryEmail(member, isNew) {
    if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') return; // not configured yet
    try {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:    member.email,
        to_name:     member.firstName,
        action:      isNew ? 'added to' : 'updated in',
        family_name: `${member.firstName} ${member.lastName}`
      });
    } catch(err) { console.warn('EmailJS send failed:', err); }
  }
}

/* ============================================================
   SHOP PAGE
   ============================================================ */
function initShopPage() {
  if (!$('#shop-grid')) return;

  const products = [
    { id: 'p1', name: 'Classic T-Shirt', price: 15, icon: '👕', desc: 'Comfortable 100% cotton tee in Schalmont Blue. Proudly sport the Sabres logo on the front.', sizes: ['Youth S','Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL','Adult XXL'], badge: 'Best Seller' },
    { id: 'p2', name: 'Hooded Sweatshirt', price: 38, icon: '🧥', desc: 'Stay warm in this cozy pullover hoodie with the Schalmont Sabres logo and PTO crest.', sizes: ['Youth S','Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL'], badge: 'Popular' },
    { id: 'p3', name: 'Baseball Cap', price: 20, icon: '🧢', desc: 'Adjustable snapback cap in school blue with gold embroidered Sabres logo.', sizes: ['One Size'], badge: null },
    { id: 'p4', name: 'Spirit Water Bottle', price: 14, icon: '🍶', desc: '20oz stainless steel insulated water bottle. Keeps drinks cold 24 hrs, hot 12 hrs.', sizes: ['One Size'], badge: 'New' },
    { id: 'p5', name: 'Tote Bag', price: 18, icon: '👜', desc: 'Reusable canvas tote bag — perfect for books, groceries, and more. Schalmont PTO logo.', sizes: ['One Size'], badge: null },
    { id: 'p6', name: 'Car Magnet', price: 8, icon: '🚗', desc: 'Show your school pride! 4" × 6" full-color Schalmont Sabres magnetic car sign.', sizes: ['One Size'], badge: null },
    { id: 'p7', name: 'Zip-Up Hoodie', price: 42, icon: '🧣', desc: 'Full-zip fleece hoodie with Schalmont emblem on left chest and Sabres on the back.', sizes: ['Youth S','Youth M','Adult S','Adult M','Adult L','Adult XL'], badge: null },
    { id: 'p8', name: 'Youth Jogger Pants', price: 28, icon: '👖', desc: 'Comfortable elastic-waist jogger pants for kids. School blue with gold stripe.', sizes: ['Youth XS','Youth S','Youth M','Youth L','Youth XL'], badge: null }
  ];

  let cart = Store.get('cart', []);

  function updateCartUI() {
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cart-count');
    const totalEl = $('#cart-total-amount');
    if (badge) badge.textContent = count;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    const items = $('#cart-items');
    if (items) {
      if (cart.length === 0) {
        items.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:32px">Your cart is empty.</p>';
      } else {
        items.innerHTML = cart.map((item, idx) => `
          <div class="cart-item">
            <div style="font-size:28px">${item.icon}</div>
            <div class="cart-item-info">
              <h5>${esc(item.name)}</h5>
              <p>Size: ${esc(item.size)} &middot; Qty:
                <button onclick="changeQty(${idx}, -1)" style="border:none;background:none;cursor:pointer;font-size:16px">−</button>
                ${item.qty}
                <button onclick="changeQty(${idx},  1)" style="border:none;background:none;cursor:pointer;font-size:16px">+</button>
              </p>
            </div>
            <div>
              <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
              <button onclick="removeFromCart(${idx})" style="border:none;background:none;cursor:pointer;color:var(--error);font-size:13px;margin-top:4px">Remove</button>
            </div>
          </div>`).join('');
      }
    }
    Store.set('cart', cart);
  }

  window.changeQty = function(idx, delta) {
    cart[idx].qty = Math.max(1, cart[idx].qty + delta);
    updateCartUI();
  };
  window.removeFromCart = function(idx) {
    cart.splice(idx, 1);
    updateCartUI();
  };

  window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    const sizeEl  = $(`#size-${productId}`);
    const size    = sizeEl ? sizeEl.value : 'One Size';
    const existing = cart.find(i => i.id === productId && i.size === size);
    if (existing) { existing.qty++; }
    else { cart.push({ id: productId, name: product.name, price: product.price, size, qty: 1, icon: product.icon }); }
    updateCartUI();
    openCart();
  };

  function openCart() {
    $('#cart-sidebar').classList.add('open');
    $('#cart-overlay').classList.add('open');
  }
  function closeCart() {
    $('#cart-sidebar').classList.remove('open');
    $('#cart-overlay').classList.remove('open');
  }

  $('#cart-fab')?.addEventListener('click', openCart);
  $('#cart-close')?.addEventListener('click', closeCart);
  $('#cart-overlay')?.addEventListener('click', closeCart);

  $('#checkout-btn')?.addEventListener('click', () => {
    if (cart.length === 0) { showAlert($('#shop-alert'), 'Your cart is empty!', 'error'); return; }
    closeCart();
    const modal = $('#checkout-modal');
    modal.classList.remove('hidden');
  });

  $('#checkout-close')?.addEventListener('click', () => $('#checkout-modal').classList.add('hidden'));
  $('#checkout-modal')?.addEventListener('click', (e) => { if (e.target === $('#checkout-modal')) $('#checkout-modal').classList.add('hidden'); });

  $('#checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd  = new FormData(e.target);
    const orderNum = 'SC' + Date.now().toString().slice(-6);
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    // Save order
    const order = {
      id: orderNum,
      name: fd.get('name'),
      email: fd.get('email'),
      items: [...cart],
      total,
      date: new Date().toISOString(),
      notes: fd.get('notes')
    };
    Store.push('orders', order);
    cart = [];
    Store.set('cart', cart);
    updateCartUI();
    $('#checkout-modal').classList.add('hidden');
    $('#order-success').classList.remove('hidden');
    $('#order-num').textContent = orderNum;
    showAlert($('#shop-alert'), `Order #${orderNum} submitted successfully! You'll receive a confirmation email.`, 'success');
  });

  // Render products
  $('#shop-grid').innerHTML = products.map(p => `
    <div class="shop-product-card">
      <div class="product-img-wrap">
        <span class="product-icon">${p.icon}</span>
        ${p.badge ? `<span class="badge badge-gold product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.desc)}</p>
        ${p.sizes.length > 1 ? `
          <div class="form-group">
            <label for="size-${p.id}">Size</label>
            <select id="size-${p.id}" class="size-select">
              ${p.sizes.map(s => `<option>${s}</option>`).join('')}
            </select>
          </div>` : `<input type="hidden" id="size-${p.id}" value="One Size">`}
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="btn btn-primary btn-sm" onclick="addToCart('${p.id}')">Add to Cart</button>
        </div>
      </div>
    </div>`).join('');

  updateCartUI();
}

/* ============================================================
   VOLUNTEER PAGE
   ============================================================ */
function initVolunteerPage() {
  if (!$('#volunteer-events')) return;

  function renderEvents() {
    const events = Store.get('vol_events', []);
    const el = $('#volunteer-events');

    el.innerHTML = events.map(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      return `<div class="volunteer-event-card">
        <div class="volunteer-event-header">
          <div>
            <h3>${esc(ev.title)}</h3>
            <p style="opacity:0.85;font-size:14px">📅 ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <span class="badge badge-gold">${ev.roles.reduce((s,r) => s + (r.slots - r.signups.length), 0)} spots open</span>
        </div>
        <div class="volunteer-event-body">
          ${ev.roles.map(role => {
            const filled = role.signups.length;
            const open   = role.slots - filled;
            const chips  = Array.from({length: role.slots}, (_, i) =>
              `<div class="slot-chip ${i < filled ? 'filled' : 'open'}" title="${i < filled ? role.signups[i] : 'Open spot'}">${i < filled ? '✓' : ''}</div>`
            ).join('');
            return `<div class="volunteer-role">
              <div class="volunteer-role-info">
                <h5>${esc(role.name)}</h5>
                <p>${esc(role.description)}</p>
              </div>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                <div class="slots-display">${chips}</div>
                <span style="font-size:13px;color:var(--text-light)">${open} of ${role.slots} open</span>
                ${open > 0 ? `<button class="btn btn-blue btn-sm" onclick="openVolSignup('${ev.id}','${role.id}','${esc(ev.title)}','${esc(role.name)}')">Sign Up</button>` : `<span class="badge badge-green">Full</span>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function renderMySignups() {
    const myName = localStorage.getItem('pto_myname') || '';
    const events = Store.get('vol_events', []);
    const rows   = [];
    events.forEach(ev => {
      ev.roles.forEach(role => {
        if (role.signups.includes(myName)) {
          rows.push({ event: ev.title, date: ev.date, role: role.name, desc: role.description });
        }
      });
    });
    const table = $('#my-signups-table');
    if (!table) return;
    if (rows.length === 0) {
      table.innerHTML = '<p style="color:var(--text-light);padding:16px">You have not signed up for any volunteer roles yet.</p>';
      return;
    }
    table.innerHTML = `<table class="my-signups-table">
      <thead><tr><th>Event</th><th>Date</th><th>Role</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(r.event)}</strong></td>
        <td>${formatDate(r.date)}</td>
        <td>${esc(r.role)}<br><span style="color:var(--text-light);font-size:12px">${esc(r.desc)}</span></td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  window.openVolSignup = function(eventId, roleId, eventTitle, roleName) {
    $('#vol-modal-title').textContent  = eventTitle;
    $('#vol-modal-role').textContent   = roleName;
    $('#vol-form').dataset.eventId = eventId;
    $('#vol-form').dataset.roleId  = roleId;
    const savedName = localStorage.getItem('pto_myname') || '';
    const savedEmail = localStorage.getItem('pto_myemail') || '';
    if (savedName)  $('#vol-name').value  = savedName;
    if (savedEmail) $('#vol-email').value = savedEmail;
    $('#vol-modal').classList.remove('hidden');
  };

  $('#vol-modal-close')?.addEventListener('click', () => $('#vol-modal').classList.add('hidden'));
  $('#vol-modal')?.addEventListener('click', e => { if (e.target === $('#vol-modal')) $('#vol-modal').classList.add('hidden'); });

  $('#vol-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd      = new FormData(e.target);
    const name    = fd.get('name').trim();
    const email   = fd.get('email').trim();
    const eventId = e.target.dataset.eventId;
    const roleId  = e.target.dataset.roleId;

    if (!name || !email) { showAlert($('#vol-alert'), 'Please enter your name and email.', 'error'); return; }

    const events = Store.get('vol_events', []);
    const ev   = events.find(e => e.id === eventId);
    const role = ev?.roles.find(r => r.id === roleId);

    if (!role) { showAlert($('#vol-alert'), 'Role not found.', 'error'); return; }
    if (role.signups.includes(name)) { showAlert($('#vol-alert'), 'You are already signed up for this role!', 'error'); return; }
    if (role.signups.length >= role.slots) { showAlert($('#vol-alert'), 'Sorry, this role is now full.', 'error'); return; }

    role.signups.push(name);
    Store.set('vol_events', events);
    localStorage.setItem('pto_myname', name);
    localStorage.setItem('pto_myemail', email);

    $('#vol-modal').classList.add('hidden');
    e.target.reset();
    showAlert($('#vol-success'), `Thank you, ${name}! You're signed up to volunteer.`, 'success');
    renderEvents();
    renderMySignups();
  });

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#${btn.dataset.tab}`).classList.add('active');
    });
  });

  renderEvents();
  renderMySignups();
}

/* ============================================================
   CONTACT PAGE
   ============================================================ */
function initContactPage() {
  const form = $('#contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const school = fd.get('school') || '';
    const toContact = (school === 'woestina' || school === 'jefferson')
      ? 'corrie@jeffersonpto.com'
      : 'julie@schalmontpto.com';
    const msg = {
      id: 'm' + Date.now(),
      name: fd.get('name'),
      email: fd.get('email'),
      school: school,
      toContact: toContact,
      subject: fd.get('subject'),
      message: fd.get('message'),
      date: new Date().toISOString()
    };
    Store.push('messages', msg);
    form.reset();
    showAlert($('#contact-alert'), 'Thank you for your message! We\'ll get back to you within 2 business days.', 'success');
  });
}

/* ============================================================
   HERO SLIDER — homepage background image rotator (admin upload)
   ============================================================ */
const HERO_HEADLINES = [
  ['Creators of', 'the magic.'],
  ['Keepers of', 'the memories.'],
  ['Fuelers of', 'the fun.'],
  ['Champions of', 'the kids.'],
  ['Builders of', 'belonging.'],
  ['Guardians of', 'good times.'],
  ['Makers of', 'the moments.'],
  ['Believers in', 'every child.'],
  ['Sparkers of', 'the smiles.'],
  ['Growers of', 'great days.'],
  ['Supporters of', 'ideas.'],
  ['Protectors of', 'traditions.'],
  ['Lifters of', 'little moments.'],
  ['Backers of', 'bright futures.'],
  ['Cheerleaders of', 'Sabre pride.'],
  ['Protectors of', 'the peace.'],
  ['Curators of', 'community.'],
  ['Caretakers of', 'causes.'],
  ['Handlers of', 'Max the Mighty.'],
  ['Cultivators of', 'curiosity.'],
  ['Builders of', 'tomorrow.'],
  ['Carriers of', 'the torch.'],
  ['Generators of', 'the energy.'],
  ['Architects of', 'the experiences.'],
  ['Amplifiers of', 'the applause.'],
  ['Connectors of', 'the community.'],
  ['Igniters of', 'ideas.'],
  ['Defenders of', 'peace.'],
  ['Drivers of', 'dreams.'],
  ['Anchors of', 'their journey.'],
  ['Leaders of', 'a legacy.'],
];

const HERO_DEFAULT_SLIDES = [
  'images/gallery/homepage/homepage-heros_0000s_0001_Gradient Fill 1 copy 3.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0002_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0003_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0004_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0005_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0006_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0007_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0008_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0009_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0010_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0011_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0012_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0013_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0014_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0015_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0016_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0017_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0018_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0020_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0021_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0022_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0023_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0024_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0025_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0026_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0027_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0028_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0029_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0030_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0031_Gradient Fill 1.jpg',
  'images/gallery/homepage/homepage-heros_0000s_0032_Gradient Fill 1.jpg',
];

const HERO_MOBILE_SLIDES = [
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0001_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0002_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0003_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0004_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0005_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0006_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0007_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0008_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0009_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0010_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0011_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0012_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0014_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0015_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0016_mobile-hero_0000s_0023_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0017_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0018_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0019_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0020_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0021_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0022_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0023_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0024_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0025_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0026_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0027_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0028_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0029_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0030_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0031_Gradient Fill 1.jpg',
  'images/gallery/homepage/mobile/mobile-hero-m_0000s_0032_Gradient Fill 1.jpg',
];

function initHeroSlider() {
  const section = document.getElementById('hero-slider');
  if (!section) return;

  // Clear any stale file-path-based cached slides (keep only admin-uploaded base64 images)
  const stored = Store.get('hero_slides', null);
  const customUploads = stored ? stored.filter(s => s.startsWith('data:')) : [];
  if (stored && customUploads.length !== stored.length) {
    // Purge stale local paths — keep only base64 uploads
    Store.set('hero_slides', customUploads);
  }
  let slides = customUploads.length > 0 ? [...HERO_DEFAULT_SLIDES, ...customUploads] : [...HERO_DEFAULT_SLIDES];
  let current   = 0;
  let timer     = null;

  const slidesEl    = document.getElementById('hero-slides');
  const overlayEl   = document.getElementById('hero-overlay');
  const prevBtn     = document.getElementById('hero-prev');
  const nextBtn     = document.getElementById('hero-next');
  if (prevBtn) prevBtn.addEventListener('click', function() { window.heroGoTo(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { window.heroGoTo(current + 1); });
  const adminBar    = document.getElementById('hero-admin-bar');
  const removeBtn   = document.getElementById('hero-remove-btn');
  const headlineEl  = section.querySelector('.hero-content h1');

  function render() {
    if (!slidesEl) return;
    if (slides.length === 0) {
      slidesEl.innerHTML = '';
      dotsEl.innerHTML   = '';
      if (overlayEl) overlayEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      return;
    }
    if (current >= slides.length) current = slides.length - 1;

    const isMob = window.matchMedia('(max-width: 768px)').matches;
    slidesEl.innerHTML = slides.map((src, i) => {
      const mobileSrc = src.startsWith('data:') ? src : (HERO_MOBILE_SLIDES[i] || src);
      const bg = isMob ? mobileSrc : src;
      const bgSize = isMob ? 'contain' : 'cover';
      return `<div style="position:absolute;top:0;right:0;bottom:0;left:0;background-image:url('${bg}');background-position:center top;background-size:${bgSize};background-repeat:no-repeat;opacity:${i === current ? 1 : 0};transition:opacity 0.8s ease"></div>`;
    }).join('');

    if (overlayEl) overlayEl.style.display = 'block';

    const showArrows = slides.length > 1;
    if (prevBtn) prevBtn.style.display = showArrows ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = showArrows ? 'flex' : 'none';

    if (removeBtn) removeBtn.style.display = 'inline-flex';

    // Update headline to match current slide (sparkle animation)
    if (headlineEl && HERO_HEADLINES.length > 0) {
      const idx = current % HERO_HEADLINES.length;
      const [line1, line2] = HERO_HEADLINES[idx];
      headlineEl.classList.remove('headline-sparkle');
      void headlineEl.offsetWidth; // force reflow to restart animation
      headlineEl.innerHTML = `${line1} <span>${line2}</span>`;
      headlineEl.classList.add('headline-sparkle');
    }
  }

  window.heroGoTo = function(idx) {
    current = ((idx % slides.length) + slides.length) % slides.length;
    render();
    resetTimer();
  };

  function advance() {
    if (slides.length > 1) { current = (current + 1) % slides.length; render(); }
  }

  function resetTimer() {
    clearInterval(timer);
    if (slides.length > 1) timer = setInterval(advance, 5000);
  }

  // Re-render on viewport change (portrait ↔ landscape, mobile ↔ desktop)
  var heroMq = window.matchMedia('(max-width: 768px)');
  heroMq.addEventListener('change', function() { render(); });

  // Show admin controls only for admins
  if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged(user => {
      if (adminBar) {
        adminBar.style.display = (user && Array.isArray(adminEmails) && adminEmails.includes(user.email)) ? 'flex' : 'none';
      }
    });
  }

  // Image upload + canvas compress
  const fileInput = document.getElementById('hero-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
          const MAX = 1920;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          slides.push(canvas.toDataURL('image/jpeg', 0.75));
          Store.set('hero_slides', slides);
          current = slides.length - 1;
          render();
          resetTimer();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  window.heroRemoveSlide = function() {
    if (slides.length === 0) return;
    if (!confirm('Remove this photo from the slider?')) return;
    slides.splice(current, 1);
    Store.set('hero_slides', slides);
    current = Math.max(0, Math.min(current, slides.length - 1));
    render();
    resetTimer();
  };

  render();
  resetTimer();
}

/* ============================================================
   CALENDAR TABS — homepage school calendar switcher
   ============================================================ */
window.showCalTab = function(id, btn) {
  document.querySelectorAll('.cal-panel').forEach(p => { p.style.display = 'none'; });
  document.querySelectorAll('.cal-tab-btn').forEach(b => { b.classList.remove('active'); });
  const panel = document.getElementById('cal-panel-' + id);
  if (panel) panel.style.display = 'block';
  if (btn) btn.classList.add('active');
  // Sync mobile select
  const sel = document.getElementById('cal-tab-select');
  if (sel) sel.value = id;
};

// Mobile calendar dropdown handler
window.showCalTabFromSelect = function(id) {
  window.showCalTab(id, null);
  // Highlight matching desktop tab button
  document.querySelectorAll('.cal-tab-btn').forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    if (onclick.includes("'" + id + "'")) b.classList.add('active');
  });
};

/* ============================================================
   HOME PAGE — upcoming events preview
   ============================================================ */
function initHomePage() {
  const upcomingEl = $('#upcoming-events');
  if (!upcomingEl) return;
  const today = new Date().toISOString().split('T')[0];

  firebase.firestore()
    .collection('events')
    .where('date', '>=', today)
    .orderBy('date')
    .limit(3)
    .get()
    .then(snapshot => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (events.length === 0) {
        upcomingEl.innerHTML = '<p style="color:var(--text-light)">No upcoming events. Check back soon!</p>';
        return;
      }
      upcomingEl.innerHTML = events.map(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        return `<div class="announcement-item">
          <div class="announcement-date">
            <div class="day">${d.getDate()}</div>
            <div class="month">${getMonthName(d.getMonth()).slice(0,3)}</div>
          </div>
          <div class="announcement-content">
            <h4><a href="events.html">${esc(ev.title)}</a></h4>
            <p>${ev.time ? ev.time + ' · ' : ''}${ev.location || ''}</p>
          </div>
        </div>`;
      }).join('');
    })
    .catch(() => {
      upcomingEl.innerHTML = '<p style="color:var(--text-light)">Check back soon for upcoming events!</p>';
    });
}

/* ============================================================
   NAV AUTH — swap Login button for user name/photo on all pages
   ============================================================ */
function initNavAuth() {
  if (typeof firebase === 'undefined') return;

  // Create dropdown (appended to body, positioned via JS)
  const dropdown = document.createElement('div');
  dropdown.id = 'nav-auth-dropdown';
  dropdown.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.14);min-width:180px;overflow:hidden';
  dropdown.innerHTML = `
    <div id="nav-auth-email" style="padding:12px 16px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border);word-break:break-all"></div>
    <a href="directory.html" style="display:block;padding:10px 16px;font-size:14px;color:var(--text);text-decoration:none;font-weight:600" onmouseover="this.style.background='var(--light-bg)'" onmouseout="this.style.background=''">My Directory Listing</a>
    <button onclick="signOut()" style="width:100%;text-align:left;padding:10px 16px;font-size:14px;color:var(--error);font-weight:600;border:none;background:none;cursor:pointer;font-family:inherit" onmouseover="this.style.background='var(--light-bg)'" onmouseout="this.style.background=''">Sign Out</button>
  `;
  document.body.appendChild(dropdown);

  let dropdownOpen = false;
  function closeDropdown() { dropdown.style.display = 'none'; dropdownOpen = false; }
  document.addEventListener('click', e => {
    if (dropdownOpen && !dropdown.contains(e.target) && e.target.id !== 'nav-login-btn') closeDropdown();
  });

  function renderNavBtn(btn, user, photo) {
    const initial = user.displayName ? user.displayName[0].toUpperCase() : user.email[0].toUpperCase();
    const avatarHtml = photo
      ? `<img src="${photo}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.5)">`
      : `<span style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff">${initial}</span>`;
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 3px;border-radius:99px;cursor:pointer;font-size:13px;text-decoration:none;background:rgba(255,255,255,0.1)';
    btn.innerHTML = `${avatarHtml}<span style="color:rgba(255,255,255,0.85);font-size:11px;line-height:1">&#9660;</span>`;
    btn.removeAttribute('href');
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      if (dropdownOpen) { closeDropdown(); return; }
      const rect = btn.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + 6) + 'px';
      dropdown.style.right = (window.innerWidth - rect.right) + 'px';
      dropdown.style.left = 'auto';
      dropdown.style.display = 'block';
      document.getElementById('nav-auth-email').textContent = user.email;
      dropdownOpen = true;
    };
  }

  firebase.auth().onAuthStateChanged(user => {
    const btn = document.getElementById('nav-login-btn');
    if (!btn) return;

    if (user) {
      // Show avatar immediately with initials, then swap in photo from Firestore if available
      renderNavBtn(btn, user, '');
      try {
        firebase.firestore().collection('directory').doc(user.uid).get().then(doc => {
          const photo = doc.exists && doc.data().photo ? doc.data().photo : '';
          renderNavBtn(btn, user, photo);
        }).catch(() => {});
      } catch(e) {}
    } else {
      btn.href = 'login.html';
      btn.innerHTML = 'Login/Register';
      btn.onclick = null;
      btn.style.cssText = '';
      closeDropdown();
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  initNavToggle();
  setActiveNav();
  initNavAuth();
  initHeroSlider();
  initHomePage();
  initEventsPage();
  initDirectoryPage();
  initShopPage();
  initVolunteerPage();
  initContactPage();

  // Banner ad rotation
  (function() {
    var ads = ['banner-ad-img-1','banner-ad-img-2','banner-ad-img-3'].map(function(id){ return document.getElementById(id); }).filter(Boolean);
    if (ads.length < 2) return;
    var idx = 0;
    setInterval(function() {
      ads[idx].style.display = 'none';
      idx = (idx + 1) % ads.length;
      ads[idx].style.display = 'block';
    }, 12000);
  })();

  // Footer ad rotation
  (function() {
    var ads = ['footer-ad-img-1','footer-ad-img-2','footer-ad-img-3'].map(function(id){ return document.getElementById(id); }).filter(Boolean);
    if (ads.length < 2) return;
    var idx = 0;
    setInterval(function() {
      ads[idx].style.display = 'none';
      idx = (idx + 1) % ads.length;
      ads[idx].style.display = 'block';
    }, 12000);
  })();

  // Calendar photo slider (lazy-loads from data-img)
  (function() {
    var slides = document.querySelectorAll('.cal-photo-slide');
    if (!slides.length) return;
    function loadSlide(s) {
      if (s && s.dataset.img && !s.style.backgroundImage) {
        s.style.backgroundImage = "url('" + s.dataset.img + "')";
      }
    }
    // Preload first two slides immediately
    loadSlide(slides[0]);
    if (slides[1]) loadSlide(slides[1]);
    var idx = 0;
    setInterval(function() {
      slides[idx].classList.remove('active');
      idx = (idx + 1) % slides.length;
      loadSlide(slides[idx]);
      loadSlide(slides[(idx + 1) % slides.length]);
      slides[idx].classList.add('active');
    }, 4000);
  })();

  // Sidebar collapsible submenu toggles
  document.querySelectorAll('.sidenav-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sub = document.getElementById(btn.getAttribute('data-target'));
      if (sub) { btn.classList.toggle('open'); sub.classList.toggle('open'); }
    });
  });

  initUpcCalButtons();
});

// ── Upcoming Events — Add to Calendar buttons ──────────────────────────────
function initUpcCalButtons() {
  document.querySelectorAll('.upc-item[data-gcal-dates]').forEach(function(li) {
    var dates = li.dataset.gcalDates || '';
    var text  = li.dataset.gcalText  || '';
    if (!dates || !text) return;

    var gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(text)
      + '&dates=' + dates;

    var startDate = dates.split('/')[0] || '';
    var endDate   = dates.split('/')[1] || '';
    var icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Schalmont PTO//EN',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:' + startDate,
      'DTEND;VALUE=DATE:' + endDate,
      'SUMMARY:' + text,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    var icsUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
    var icsFilename = text.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.ics';

    var wrap = document.createElement('div');
    wrap.className = 'upc-cal-links';

    var gcalLink = document.createElement('a');
    gcalLink.className = 'upc-cal-link';
    gcalLink.href = gcalUrl;
    gcalLink.target = '_blank';
    gcalLink.rel = 'noopener';
    gcalLink.title = 'Add to Google Calendar';
    gcalLink.innerHTML = '&#128197;';

    var icsLink = document.createElement('a');
    icsLink.className = 'upc-cal-link';
    icsLink.href = icsUri;
    icsLink.download = icsFilename;
    icsLink.title = 'Download for iCal / Outlook';
    icsLink.innerHTML = '&#128462;';

    wrap.appendChild(gcalLink);
    wrap.appendChild(icsLink);
    li.appendChild(wrap);
  });
}
