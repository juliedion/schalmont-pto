/* ============================================================
   Schalmont PTO — Back Office core
   ------------------------------------------------------------
   Shared by every page in /admin/. Handles:
     • Firebase startup
     • "Are you signed in and allowed here?" checks
     • Loading the current person's role + which schools they run
     • Small helper functions used everywhere (toasts, dates, escaping)
     • The dark sidebar / top bar that every back-office page shows
   You should not need to edit this file to add content or pages.
   ============================================================ */

/* The four schools plus a PTO-wide bucket.
   The KEY (left side) is stored in the database — never change those.
   The LABEL (right side) is what people see and is safe to reword. */
const SCHOOLS = {
  woestina:  'Woestina Pre-K',
  jefferson: 'Jefferson Elementary',
  middle:    'Middle School',
  high:      'High School',
  pto:       'PTO-wide (all schools)'
};

/* The short web-address prefix each school's published pages use,
   e.g. schalmontpto.com/ms/spring-concert   (KEY -> prefix).
   These must also be listed in .htaccess and p.html. */
const SCHOOL_PREFIX = {
  woestina:  'woestina',
  jefferson: 'jes',
  middle:    'ms',
  high:      'hs',
  pto:       'pto'
};
function pagePath(school, slug) { return SCHOOL_PREFIX[school] + '/' + slug; }

/* The top-level back-office sections, in nav order. `cat` is the page-category key
   stored on `pages` docs. `singular` (when set) turns on an "Add New ___ Web Page"
   button; `sheet:true` adds the "also add this to the planning spreadsheet" notice. */
const SECTIONS = [
  { cat: 'calendar',   label: 'Calendar',              icon: '📅', href: 'calendar.html' },
  { cat: 'events',     label: 'Events',                icon: '🎪', href: 'section.html?cat=events',     singular: 'Event',       sheet: true },
  { cat: 'clubs',      label: 'Clubs',                 icon: '🤝', href: 'section.html?cat=clubs',      singular: 'Club',        sheet: true },
  { cat: 'programs',   label: 'Programs',              icon: '🎓', href: 'section.html?cat=programs',   singular: 'Program',     sheet: true },
  { cat: 'spiritwear', label: 'Spiritwear',            icon: '👕', href: 'section.html?cat=spiritwear', singular: 'Spiritwear page' },
  { cat: 'fundraising',label: 'Fundraising',           icon: '💰', href: 'fundraising.html',            singular: 'Fundraiser',  sheet: true },
  { cat: 'facilities', label: 'Building &amp; Facilities', icon: '🏫', href: 'section.html?cat=facilities', singular: 'Facilities page' },
  { cat: 'yearbook',   label: 'Yearbook Photos',       icon: '📸', href: 'yearbook.html' },
  { cat: 'ideas',      label: 'Extra Ideas',           icon: '💡', href: 'section.html?cat=ideas',      singular: 'Idea page' }
];
function sectionByCat(cat) { return SECTIONS.find(s => s.cat === cat) || null; }

/* Bootstrap super-admin. This email is ALWAYS treated as the owner,
   even before any roles are set up in the database. Additional
   super-admins are granted from the People & Roles page. */
const OWNER_EMAIL = 'julie@schalmontpto.com';

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

/* Holds info about the signed-in person once loaded:
   { uid, email, name, isSuper, schools: ['jefferson', ...] } */
let ME = null;

/* ------------------------------------------------------------
   requireAdmin(callback)
   Put this at the top of every back-office page. It:
     1. sends people who aren't signed in to the login page
     2. blocks people with no back-office access
     3. otherwise fills ME and runs your callback(ME)
   ------------------------------------------------------------ */
function requireAdmin(onReady) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      const here = window.location.pathname.split('/').slice(-2).join('/') + window.location.search;
      window.location.href = '../login.html?next=' + encodeURIComponent(here);
      return;
    }

    // Look up this person's record for their role + assigned schools
    let data = {};
    let docExists = false;
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      docExists = snap.exists;
      data = snap.exists ? snap.data() : {};
    } catch (e) { /* rules may block; fall through to owner check */ }

    const isOwner = user.email === OWNER_EMAIL ||
                    (typeof adminEmails !== 'undefined' && adminEmails.includes(user.email));

    // Self-heal: a trusted-list officer who has no user record yet gets one on first sign-in,
    // so they show up in People & Roles and task-assignment lists.
    if (isOwner && !docExists) {
      try {
        await db.collection('users').doc(user.uid).set({
          displayName: user.displayName || user.email,
          email: user.email,
          role: 'superadmin',
          status: 'approved',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          selfProvisioned: true
        }, { merge: true });
        data = { role: 'superadmin', status: 'approved' };
      } catch (_) { /* not fatal — access still granted below via the trusted list */ }
    }
    const isSuper = isOwner || data.role === 'superadmin';
    const schools = isSuper ? Object.keys(SCHOOLS) : (data.adminSchools || []);

    if (!isSuper && schools.length === 0) {
      showDenied();
      return;
    }

    ME = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || data.displayName || user.email,
      isSuper,
      schools
    };

    renderShell();
    const gate = document.getElementById('bo-loading');
    if (gate) gate.remove();
    const main = document.getElementById('bo-main');
    if (main) main.style.display = '';
    onReady(ME);
  });
}

function showDenied() {
  document.body.innerHTML =
    '<div class="bo-denied">' +
      '<h1>You\'re signed in, but this area is for PTO administrators.</h1>' +
      '<p>If you should have access, ask the PTO president to add you on the ' +
      '<strong>People &amp; Roles</strong> page.</p>' +
      '<p><a href="../index.html">← Back to the website</a> &nbsp;·&nbsp; ' +
      '<a href="#" onclick="signOutNow();return false;">Sign out</a></p>' +
    '</div>';
}

function signOutNow() { auth.signOut().then(() => window.location.href = '../login.html'); }

/* ------------------------------------------------------------
   The shared dark sidebar + top bar.
   Any page that includes a <div id="bo-shell"></div> gets it.
   ------------------------------------------------------------ */
function renderShell() {
  const shell = document.getElementById('bo-shell');
  if (!shell || !ME) return;

  const path = window.location.pathname.split('/').pop();
  const cat = getParam('cat');
  const link = (href, label, icon, active) =>
    `<a href="${href}" class="bo-navlink${active ? ' active' : ''}">
       <span class="bo-navicon">${icon}</span>${label}</a>`;

  const sectionLinks = SECTIONS.map(s => {
    const base = s.href.split('?')[0];
    const active = s.href.includes('?cat=') ? (path === 'section.html' && cat === s.cat) : (path === base);
    return link(s.href, s.label, s.icon, active);
  }).join('');

  shell.innerHTML = `
    <aside class="bo-sidebar">
      <a href="index.html" class="bo-brand">
        <img src="../images/logo.png" alt=""> <span>PTO Back Office</span>
      </a>
      <nav class="bo-nav">
        ${link('index.html', 'Home', '🏠', path === 'index.html')}
        ${sectionLinks}
        <div class="bo-navgroup-label">More</div>
        ${link('help.html', 'Help &amp; How-To', '📖', path === 'help.html')}
        ${ME.isSuper ? link('directory.html', 'Parent Directory', '📇', path === 'directory.html') : ''}
        ${ME.isSuper ? link('people.html', 'People &amp; Roles', '👥', path === 'people.html') : ''}
      </nav>
      <div class="bo-sidebar-foot">
        <div class="bo-me">${esc(ME.name)}</div>
        <a href="../index.html">View website ↗</a> ·
        <a href="#" onclick="signOutNow();return false;">Sign out</a>
      </div>
    </aside>`;

  document.body.classList.add('bo-has-shell');
  renderHelpWidget();
}

/* A floating "get help" button on every back-office page:
   ask the AI assistant, or email Julie. */
function renderHelpWidget() {
  if (document.getElementById('bo-help')) return;
  const here = window.location.pathname.split('/').pop();
  const subject = encodeURIComponent('Back Office help — ' + here);
  const body = encodeURIComponent(
    'Hi Julie,\n\nI need help with the PTO Back Office.\n\n' +
    'Page: ' + window.location.href + '\n' +
    'What I was trying to do:\n\n');
  const el = document.createElement('div');
  el.id = 'bo-help';
  el.innerHTML = `
    <div id="bo-help-menu">
      <a href="assistant.html">💬 Ask the AI Assistant</a>
      <a href="mailto:julie@schalmontpto.com?subject=${subject}&body=${body}">✉️ Email Julie for help</a>
    </div>
    <button id="bo-help-toggle" type="button" aria-label="Get help">＋ Need help?</button>`;
  document.body.appendChild(el);
  const toggle = el.querySelector('#bo-help-toggle');
  toggle.addEventListener('click', () => {
    const open = el.classList.toggle('open');
    toggle.textContent = open ? '✕ Close' : '＋ Need help?';
  });
  document.addEventListener('click', (e) => {
    if (!el.contains(e.target) && el.classList.contains('open')) {
      el.classList.remove('open');
      toggle.textContent = '＋ Need help?';
    }
  });
}

/* The master planning spreadsheet (also used by the calendar importer). */
const PLANNING_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vIPpzz79LgBSm2lWDkFgjwKjb-h7JrSLFzdbtTf4JyM/edit';

/* Start a brand-new web page for a section (Events, Clubs, Programs, …).
   Shows the "you'll also need the spreadsheet" notice, collects a school + working
   title, creates the draft, then opens the guided page editor. */
function newWebPage(cat) {
  const sec = sectionByCat(cat);
  const singular = (sec && sec.singular) || 'Web';
  const schools = (ME.schools || []).filter(s => s !== 'pto');
  const schoolOpts = [['pto', 'PTO-wide / all schools']]
    .concat(schools.map(s => [s, SCHOOLS[s]]))
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  const back = document.createElement('div');
  back.className = 'bo-modal-back';
  back.innerHTML = `
    <div class="bo-modal">
      <h2>Add a new ${esc(singular)} web page</h2>
      ${sec && sec.sheet ? `
      <div class="bo-notice">
        <strong>Heads up:</strong> a web page lives on the website, but it does <em>not</em>
        add itself to the planning spreadsheet. After you create the page, also add this
        ${esc(singular).toLowerCase()} to the master planning sheet so the calendar, flyer
        dates, and reminders stay in sync.
        <a href="${PLANNING_SHEET_URL}" target="_blank" rel="noopener">Open the planning spreadsheet ↗</a>
      </div>` : ''}
      <label class="bo-modal-lbl">Which school is this for?</label>
      <select id="nwp-school">${schoolOpts}</select>
      <label class="bo-modal-lbl">Working title <span style="font-weight:400;color:var(--text-light)">— you can change it later</span></label>
      <input type="text" id="nwp-title" placeholder="e.g. Fall Fun Run 2026">
      <div class="bo-modal-actions">
        <button class="bo-btn ghost sm" id="nwp-cancel">Cancel</button>
        <button class="bo-btn sm" id="nwp-go">Create &amp; start building →</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('#nwp-cancel').onclick = close;
  back.querySelector('#nwp-title').focus();
  back.querySelector('#nwp-go').onclick = async () => {
    const school = back.querySelector('#nwp-school').value;
    const title = back.querySelector('#nwp-title').value.trim();
    if (!title) { toast('Give it a working title', 'error'); return; }
    back.querySelector('#nwp-go').disabled = true;
    try {
      const ref = await db.collection('pages').add({
        category: cat, school, title, slug: slugify(title),
        status: 'draft', blocks: [],
        createdBy: ME.email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      location.href = 'page-editor.html?id=' + ref.id + '&guide=1';
    } catch (e) {
      toast('Could not create the page: ' + e.message, 'error');
      back.querySelector('#nwp-go').disabled = false;
    }
  };
}

/* ---- small helpers ---------------------------------------- */
function getParam(k) { return new URLSearchParams(location.search).get(k); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg, kind) {
  let t = document.getElementById('bo-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'bo-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'show' + (kind === 'error' ? ' error' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.className = '', 3200);
}

/* Guard: can the current person manage this school? */
function canManage(school) {
  return ME && (ME.isSuper || ME.schools.includes(school));
}

/* ---- date helpers (used by the calendar) ---- */
function toYMD(d) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function ymdToDate(s) {
  if (!s) return null;
  const p = String(s).split('-');
  if (p.length !== 3) return null;
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return isNaN(d) ? null : d;
}
function addDays(ymd, delta) {
  const d = ymdToDate(ymd);
  if (!d) return '';
  d.setDate(d.getDate() + delta);
  return toYMD(d);
}

/* How far ahead of an event each promo task should happen (days before).
   Editable per event afterward. */
const PROMO_OFFSETS = { planningStart: 42, flyer: 21, firstSocial: 14, reminder: 3 };
const PROMO_LABELS  = {
  planningStart: 'Start planning',
  flyer:         'Flyer / take-home goes out',
  firstSocial:   'First social post',
  reminder:      'Reminder post'
};
function computePromo(dateYMD, existing) {
  const p = existing || {};
  const out = {};
  for (const k in PROMO_OFFSETS) {
    out[k] = p[k] || addDays(dateYMD, -PROMO_OFFSETS[k]);
  }
  return out;
}
function prettyYMD(s) {
  const d = ymdToDate(s);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : (s || '');
}
