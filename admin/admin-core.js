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
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      data = snap.exists ? snap.data() : {};
    } catch (e) { /* rules may block; fall through to owner check */ }

    const isOwner = user.email === OWNER_EMAIL ||
                    (typeof adminEmails !== 'undefined' && adminEmails.includes(user.email));
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
  const link = (href, label, icon) =>
    `<a href="${href}" class="bo-navlink${path === href ? ' active' : ''}">
       <span class="bo-navicon">${icon}</span>${label}</a>`;

  let schoolLinks = ME.schools.map(s =>
    `<a href="school.html?s=${s}" class="bo-navlink bo-navsub${
        (path === 'school.html' && getParam('s') === s) ? ' active' : ''}">${SCHOOLS[s]}</a>`
  ).join('');

  shell.innerHTML = `
    <aside class="bo-sidebar">
      <a href="index.html" class="bo-brand">
        <img src="../images/logo.png" alt=""> <span>PTO Back Office</span>
      </a>
      <nav class="bo-nav">
        ${link('index.html', 'Home', '🏠')}
        <div class="bo-navgroup-label">Schools</div>
        ${schoolLinks}
        <div class="bo-navgroup-label">Tools</div>
        ${link('assistant.html', 'AI Assistant', '💬')}
        ${link('help.html', 'Help &amp; How-To', '📖')}
        ${ME.isSuper ? link('people.html', 'People &amp; Roles', '👥') : ''}
      </nav>
      <div class="bo-sidebar-foot">
        <div class="bo-me">${esc(ME.name)}</div>
        <a href="../index.html">View website ↗</a> ·
        <a href="#" onclick="signOutNow();return false;">Sign out</a>
      </div>
    </aside>`;

  document.body.classList.add('bo-has-shell');
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
