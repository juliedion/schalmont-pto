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
  { cat: 'calendar',   label: 'Calendar',              icon: '📅', href: 'school.html?tab=calendar', tab: 'calendar' },
  { cat: 'events',     label: 'Events &amp; Programs', icon: '🎪', href: 'section.html?cat=events',     singular: 'Event',       sheet: true },
  { cat: 'pages',      label: 'All Pages',             icon: '📄', href: 'school.html?tab=pages', tab: 'pages' },
  { cat: 'files',      label: 'Files',                 icon: '📁', href: 'school.html?tab=files', tab: 'files' },
  { cat: 'photos',     label: 'Photos',                icon: '🖼️', href: 'school.html?tab=photos', tab: 'photos' },
  { cat: 'facilities', label: 'Building &amp; Facilities', icon: '🏫', href: 'section.html?cat=facilities', singular: 'Facilities page' },
  { cat: 'spiritwear', label: 'Spiritwear',            icon: '👕', href: 'section.html?cat=spiritwear', singular: 'Spiritwear page' },
  { cat: 'fundraising',label: 'Fundraisers',           icon: '💰', href: 'fundraising.html',            singular: 'Fundraiser',  sheet: true },
  { cat: 'yearbook',   label: 'Yearbook Photos',       icon: '📸', href: 'yearbook.html' },
  { cat: 'ideaboard',  label: 'Idea Board',            icon: '📝', href: 'school.html?tab=ideas', tab: 'ideas' },
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

    // Look up this person's record for their role + assigned schools. Every back-office
    // page (and the calendar tool's own iframe embed) re-runs this from scratch on load,
    // so a cold Firestore round-trip here delays every single click into a new page --
    // cache it in sessionStorage for a few minutes to skip that read on repeat navigations
    // within the same visit. A role change mid-session takes up to CACHE_MS to take effect.
    const CACHE_MS = 5 * 60000;
    const CACHE_KEY = 'boMe_' + user.uid;
    let data = {};
    let docExists = false;
    let usedCache = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_MS) {
        docExists = cached.docExists;
        data = cached.data;
        usedCache = true;
      }
    } catch (_) { /* sessionStorage blocked or corrupt -- fetch fresh below */ }

    if (!usedCache) {
      try {
        const snap = await db.collection('users').doc(user.uid).get();
        docExists = snap.exists;
        data = snap.exists ? snap.data() : {};
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), docExists, data }));
        } catch (_) { /* private mode etc. -- just skip caching */ }
      } catch (e) { /* rules may block; fall through to owner check */ }
    }

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
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), docExists: true, data })); } catch (_) {}
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

    // A page opened with ?embed=1 (e.g. the calendar tool inside a school workspace's
    // own Calendar tab) skips the sidebar/header entirely -- it's already inside a page
    // that has its own back-office chrome. A page can also opt out of just the sidebar
    // (keeping the help widget) by setting window.BO_NO_SIDEBAR before calling
    // requireAdmin -- the page editor does this so building a page isn't squeezed
    // next to the full Schools/sections nav.
    if (getParam('embed') !== '1') {
      if (window.BO_NO_SIDEBAR) renderHelpWidget();
      else renderShell();
    }
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

/* Let a signed-in admin set a new password without leaving the back office.
   Firebase blocks this if the session is old ("requires-recent-login") — in that
   case we send them to sign out and back in, then try again. */
async function changePasswordNow() {
  const user = auth.currentUser;
  if (!user) { window.location.href = '../login.html'; return; }
  const pw = prompt('Enter a new password (at least 6 characters):');
  if (pw === null) return;
  if (pw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  if (prompt('Type the new password again to confirm:') !== pw) {
    toast('The two passwords did not match — nothing changed', 'error');
    return;
  }
  try {
    await user.updatePassword(pw);
    toast('Password updated — use it next time you sign in');
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      toast('For security, sign out and sign back in, then change it again', 'error');
    } else {
      toast('Could not change password: ' + e.message, 'error');
    }
  }
}

/* ------------------------------------------------------------
   The shared dark sidebar + top bar.
   Any page that includes a <div id="bo-shell"></div> gets it.
   ------------------------------------------------------------ */
function renderShell() {
  const shell = document.getElementById('bo-shell');
  if (!shell || !ME) return;

  const path = window.location.pathname.split('/').pop();
  const cat = getParam('cat');
  // The school we're currently working inside, if any (school.html, section.html?s=,
  // calendar/fundraising/yearbook?s=, page-editor of a single-school page…).
  const ctxSchool = getParam('s');
  const inSchool = ctxSchool && SCHOOLS[ctxSchool] && canManage(ctxSchool);
  const link = (href, label, icon, active) =>
    `<a href="${href}" class="bo-navlink${active ? ' active' : ''}">
       <span class="bo-navicon">${icon}</span>${label}</a>`;

  // Each school's own brand color (matches the public site) tints its "sections" group
  // in the sidebar, so it's obviously distinct from the schools list above it.
  const SCHOOL_TINT = { woestina: '#8bc341', jefferson: '#6bb044', middle: '#087d40', high: '#044d2a', pto: '#295c38' };

  // Section links only make sense inside a school — scope each one with ?s=<school>.
  // Three link shapes: a school-workspace sub-tab (?tab=), a page-category listing
  // (?cat=), or a standalone tool page (fundraising.html, yearbook.html) with no query.
  const currentTab = getParam('tab') || 'calendar';
  const sectionLinksFor = (school) => SECTIONS.map(s => {
    const base = s.href.split('?')[0];
    let scoped, active;
    if (s.tab) {
      scoped = base + '?s=' + school + '&tab=' + s.tab;
      active = path === base && ctxSchool === school && currentTab === s.tab;
    } else if (s.href.includes('?cat=')) {
      scoped = s.href + '&s=' + school;
      active = path === 'section.html' && ctxSchool === school && cat === s.cat;
    } else {
      scoped = base + '?s=' + school;
      active = path === base && ctxSchool === school;
    }
    return link(scoped, s.label, s.icon, active);
  }).join('');

  // Every school in the sidebar is its own accordion: the school button opens its
  // workspace overview (like every other nav link) AND toggles its sections open right
  // underneath it, so you can jump straight to e.g. Calendar without landing on the
  // overview first. Whichever school you're currently inside starts pre-opened.
  const mySchools = (ME.isSuper ? Object.keys(SCHOOLS) : (ME.schools || []));
  const schoolGroups = mySchools.map(s => {
    const isOpen = ctxSchool === s;
    return `
    <div class="bo-school-group">
      <a href="school.html?s=${s}" class="bo-navlink bo-school-toggle${isOpen ? ' open' : ''}" data-school-target="bosec-${s}">
        <span class="bo-school-toggle-label"><span class="bo-navicon">🏫</span>${esc(SCHOOLS[s])}</span>
        <span class="bo-navarrow">&#9660;</span>
      </a>
      <div class="bo-school-sections${isOpen ? ' open' : ''}" id="bosec-${s}"
           style="background:${SCHOOL_TINT[s] || 'transparent'}">
        ${sectionLinksFor(s)}
      </div>
    </div>`;
  }).join('');

  shell.innerHTML = `
    <aside class="bo-sidebar">
      <a href="index.html" class="bo-brand">
        <img src="../images/logo.png" alt=""> <span>PTO Back Office</span>
      </a>
      <nav class="bo-nav">
        ${link('index.html', 'Home', '🏠', path === 'index.html')}
        <div class="bo-navgroup-label">Schools</div>
        ${schoolGroups}
        <div class="bo-navgroup-label">More</div>
        ${link('meetings.html', 'Meetings', '🗓️', path === 'meetings.html')}
        ${link('signups.html', 'Sign-Up Sheets', '🖊️', path === 'signups.html')}
        ${link('tat-teacher-orders.html', 'Tat the Teacher Orders', '🐯', path === 'tat-teacher-orders.html')}
        ${link('help.html', 'Help &amp; How-To', '📖', path === 'help.html')}
        ${ME.isSuper ? link('directory.html', 'Directory Sign-Ups', '✅', path === 'directory.html') : ''}
        ${ME.isSuper ? link('people.html', 'People &amp; Roles', '👥', path === 'people.html') : ''}
        ${link('roadmap.html', 'Feature Roadmap', '🛠️', path === 'roadmap.html')}
      </nav>
      <div class="bo-sidebar-foot">
        <div class="bo-me">${esc(ME.name)}</div>
        <a href="#" onclick="changePasswordNow();return false;">Change password</a> ·
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

/* Every brand-new page starts from this skeleton instead of a blank page -- same
   rhythm as the Middle School Book Fair page (photo, intro, a CTA section, then a
   spot for sign-ups), but with placeholder text so nothing real gets copied in. A
   function (not a plain array) so every new page gets its own fresh block objects,
   never a shared reference. */
function defaultPageTemplateBlocks() {
  return [
    { type: 'image', url: '', alt: 'Replace with your flyer or event photo', caption: '' },
    { type: 'button', align: 'center', style: 'solid', label: 'Download the Flyer', href: '' },
    { type: 'paragraph', align: 'center', text: 'Write a short introduction here — what this event or program is, when it happens, and why people should get involved.' },
    { type: 'divider' },
    { type: 'heading', align: 'center', level: 2, text: 'SECTION HEADING' },
    { type: 'button', align: 'center', style: 'solid', label: 'Call to Action', href: '' },
    { type: 'paragraph', align: 'center', text: 'Add a short supporting sentence under your button.' },
    { type: 'divider' },
    { type: 'heading', align: 'center', level: 2, text: 'Get Involved' },
    { type: 'paragraph', align: 'center', text: 'If this needs volunteers, registrations, or orders, add a Sign-up sheet or Embed block right here.' }
  ];
}

/* Start a brand-new web page for a section (Events & Programs, Facilities, …).
   Shows the "you'll also need the spreadsheet" notice, collects a school + working
   title, creates the draft, then opens the guided page editor. */
const NWP_TYPES = [
  { cat: 'events',   label: 'Event / Program' },
  { cat: 'spiritwear', label: 'Spiritwear' },
  { cat: 'fundraising', label: 'Fundraiser' },
  { cat: 'facilities', label: 'Building & Facilities' },
  { cat: 'ideas',    label: 'Other' }
];

function newWebPage(cat, presetSchool, presetDate) {
  const sec = sectionByCat(cat);
  const singular = (sec && sec.singular) || 'Web';
  const opts = manageableSchools();
  const preset = new Set(
    presetSchool && opts.includes(presetSchool) ? [presetSchool] : []
  );
  const checks = opts.map(s =>
    `<label><input type="checkbox" class="nwp-school" value="${s}" ${preset.has(s) ? 'checked' : ''}> ${esc(SCHOOLS[s])}</label>`
  ).join('');
  // Deliberately never pre-selects a type (even when a section like Fundraising passed
  // one in) -- the admin has to actively choose Event/Program/Club/etc. every time.
  const typeOpts = '<option value="" disabled selected>Select a type…</option>' +
    NWP_TYPES.map(t => `<option value="${t.cat}">${esc(t.label)}</option>`).join('');

  const back = document.createElement('div');
  back.className = 'bo-modal-back';
  back.innerHTML = `
    <div class="bo-modal">
      <button type="button" class="bo-modal-x" id="nwp-x" aria-label="Cancel">✕</button>
      <h2>Add a new ${esc(singular)} web page</h2>
      ${presetDate ? `<p style="font-size:12.5px;color:var(--text-light);margin:-4px 0 12px">
        Event date set to <strong>${esc(new Date(presetDate + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</strong>
        from the calendar — change it later in the page editor if needed.</p>` : ''}
      ${sec && sec.sheet ? `
      <div class="bo-notice">
        <strong>Heads up:</strong> a web page lives on the website, but it does <em>not</em>
        add itself to the planning spreadsheet. After you create the page, also add this
        ${esc(singular).toLowerCase()} to the master planning sheet so the calendar, flyer
        dates, and reminders stay in sync.
        <a href="${PLANNING_SHEET_URL}" target="_blank" rel="noopener">Open the planning spreadsheet ↗</a>
      </div>` : ''}
      <label class="bo-modal-lbl">Which school(s) is this for? <span style="font-weight:400;color:var(--text-light)">— tick every one it belongs to</span></label>
      <div class="bo-modal-checklist">${checks}</div>
      <p style="font-size:12px;color:var(--text-light);margin:0 0 8px">
        Tick more than one and the page gets a shared address at
        <code>schalmontpto.com/pto/&hellip;</code>.
      </p>
      <label class="bo-modal-lbl">What kind of page is this?</label>
      <select id="nwp-type">${typeOpts}</select>
      <label class="bo-modal-lbl">Working title <span style="font-weight:400;color:var(--text-light)">— you can change it later</span></label>
      <input type="text" id="nwp-title" placeholder="e.g. Fall Fun Run 2026">
      <label class="bo-modal-lbl">Where should this show up?</label>
      <p style="font-size:12px;color:var(--text-light);margin:0 0 6px">
        Every page gets a landing-page card automatically once you publish it — no need to
        pick that here. You can turn it off, or fine-tune the card, from the page editor.
      </p>
      <div class="bo-modal-checklist">
        <label><input type="checkbox" id="nwp-topmenu"> Show in the top menu</label>
        <label><input type="checkbox" id="nwp-leftmenu" checked> Show in the left (Browse) menu</label>
      </div>
      <p id="nwp-hint" style="font-size:12px;color:var(--text-light);margin:8px 0 0">
        Tick at least one school, choose a type, and enter a title to continue.
      </p>
      <div class="bo-modal-actions">
        <button class="bo-btn ghost sm" id="nwp-cancel">Cancel</button>
        <button class="bo-btn sm" id="nwp-go" disabled>Create &amp; start building →</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('#nwp-cancel').onclick = close;
  back.querySelector('#nwp-x').onclick = close;
  back.querySelector('#nwp-title').focus();

  // Gate the "Create" button on: at least one school ticked, a type chosen, AND a title entered.
  const goBtn = back.querySelector('#nwp-go');
  const hint  = back.querySelector('#nwp-hint');
  const revalidate = () => {
    const hasSchool = back.querySelectorAll('.nwp-school:checked').length > 0;
    const hasType   = back.querySelector('#nwp-type').value !== '';
    const hasTitle  = back.querySelector('#nwp-title').value.trim().length > 0;
    goBtn.disabled = !(hasSchool && hasType && hasTitle);
    hint.style.display = goBtn.disabled ? '' : 'none';
  };
  back.querySelectorAll('.nwp-school').forEach(c => c.addEventListener('change', revalidate));
  back.querySelector('#nwp-type').addEventListener('change', revalidate);
  back.querySelector('#nwp-title').addEventListener('input', revalidate);
  revalidate();

  goBtn.onclick = async () => {
    const schools = [...back.querySelectorAll('.nwp-school:checked')].map(c => c.value);
    const title = back.querySelector('#nwp-title').value.trim();
    const chosenCat = back.querySelector('#nwp-type').value;
    const showInTopMenu = back.querySelector('#nwp-topmenu').checked;
    const showInLeftMenu = back.querySelector('#nwp-leftmenu').checked;
    if (!schools.length) { toast('Pick at least one school', 'error'); return; }
    if (!title) { toast('Give it a working title', 'error'); return; }
    if (!canManageAll(schools)) { toast('You can only create pages for your own school(s)', 'error'); return; }
    back.querySelector('#nwp-go').disabled = true;
    try {
      const key = title.toLowerCase();
      const [pagesSnap, eventsSnap] = await Promise.all([
        db.collection('pages').get(),
        db.collection('pto_events').get()
      ]);
      const pageHit = pagesSnap.docs.find(d => (d.data().title || '').trim().toLowerCase() === key);
      const eventHit = !pageHit && eventsSnap.docs.find(d =>
        !d.id.startsWith('__') && d.id !== 'meta_deleted' && d.id !== 'meta_gcal' &&
        (d.data().title || '').trim().toLowerCase() === key);
      if (pageHit || eventHit) {
        const where = pageHit ? 'already has a web page' : 'is already on the calendar (from the tracker)';
        const proceed = confirm(`"${title}" ${where}. Create a duplicate anyway?\n\n` +
          (pageHit ? 'Edit the existing page instead from its section list.' :
                     'Use "↻ Sync with tracker" to make a page for the existing tracker row instead.'));
        if (!proceed) { back.querySelector('#nwp-go').disabled = false; return; }
      }
      const ref = await db.collection('pages').add({
        category: chosenCat, schools, school: routingSchool(schools),
        title, slug: slugify(title),
        showInTopMenu, showInLeftMenu,
        eventDate: presetDate || '',
        status: 'draft', blocks: defaultPageTemplateBlocks(),
        createdBy: ME.email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // The landing-page card itself is created automatically the first time this page
      // is published (see page-editor.html's syncCard) -- not here.
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
  toast._t = setTimeout(() => t.className = '', kind === 'error' ? 7000 : 3200);
}

/* Guard: can the current person manage this school? */
function canManage(school) {
  return ME && (ME.isSuper || ME.schools.includes(school));
}

/* A page can belong to more than one school. These helpers keep the rest of the
   app simple:
     pageSchools(p)  -> always an array, even for old single-school docs
     routingSchool() -> the ONE school key used for the public URL / prefix:
                        a single-school page keeps its school; a page shared by
                        two or more schools lives under the PTO-wide prefix. */
function pageSchools(p) {
  if (!p) return [];
  if (Array.isArray(p.schools) && p.schools.length) return p.schools;
  return p.school ? [p.school] : [];
}
function routingSchool(schools) {
  const list = Array.isArray(schools) ? schools.filter(Boolean) : pageSchools(schools);
  if (list.length === 1) return list[0];
  return 'pto';
}
/* Can the current person manage EVERY school in the list? (super-admins always can) */
function canManageAll(list) {
  if (!ME) return false;
  if (ME.isSuper) return true;
  return (list || []).length > 0 && (list || []).every(s => ME.schools.includes(s));
}
/* The schools the current person is allowed to publish pages for, in nav order. */
function manageableSchools() {
  const keys = Object.keys(SCHOOLS);
  return ME && ME.isSuper ? keys : keys.filter(s => ME && ME.schools.includes(s));
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
