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
  jefferson: 'jefferson',
  middle:    'ms',
  high:      'hs',
  pto:       'pto'
};
function pagePath(school, slug) { return school ? SCHOOL_PREFIX[school] + '/' + slug : slug; }

/* The top-level back-office sections, in nav order. `cat` is the page-category key
   stored on `pages` docs. `singular` (when set) turns on an "Add New ___ Web Page"
   button; `sheet:true` adds the "also add this to the planning spreadsheet" notice. */
const SECTIONS = [
  { cat: 'calendar',   label: 'Calendar',              icon: '📅', href: 'school.html?tab=calendar', tab: 'calendar' },
  { cat: 'events',     label: 'Events &amp; Programs', icon: '🎪', href: 'section.html?cat=events',     singular: 'Event',       sheet: true },
  { cat: 'signups',    label: 'Sign-Up Sheets',        icon: '🖊️', href: 'signups.html' },
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
// (No firebase.storage() -- the site is on the free Spark plan, which has no Storage.)

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
   "Working on" scope
   Officers start on ALL = the whole website (every school at once); anyone can narrow
   to one school with the "Working on" picker. The choice is remembered (localStorage)
   and sidebar links carry it as ?s=<school>. Opening a link that already names a
   school (e.g. a bookmarked ?s=high) switches the picker to match.
   ------------------------------------------------------------ */
const ALL = 'all';
function scopeLabel(s) { return s === ALL ? 'Whole website' : (SCHOOLS[s] || s); }
function scopeOptions() {
  // Woestina Pre-K is part of Jefferson on the website, so it's folded into Jefferson here too
  // (kept as its own choice only for someone who runs Woestina but not Jefferson).
  const mine = manageableSchools().filter(k => !(k === 'woestina' && manageableSchools().includes('jefferson')));
  return mine.concat(ME && ME.isSuper ? [ALL] : []);
}
/* How each school appears in the school switcher: name, grades line and colour. */
const HUB = {
  jefferson: { name: 'Jefferson Elementary', sub: 'Pre-K–4 · incl. Woestina', color: '#63E629', ink: '#0d3b1c' },
  woestina:  { name: 'Woestina Pre-K', sub: 'Pre-K', color: '#2bb3a3', ink: '#fff' },
  middle:    { name: 'Middle School', sub: 'Grades 5–8', color: '#007A3D', ink: '#fff' },
  high:      { name: 'High School', sub: 'Grades 9–12', color: '#044d2a', ink: '#fff' },
  pto:       { name: 'PTO-wide / District', sub: 'Every school', color: '#6b46c1', ink: '#fff' },
  all:       { name: 'Everything', sub: 'All schools at once', color: '#3b4a42', ink: '#fff' }
};
/* The school keys a hub covers (Jefferson's includes Woestina's pages and sheets). */
function hubKeys(W) { return W === ALL ? null : W === 'jefferson' ? ['jefferson', 'woestina'] : [W]; }
function workingSchool() {
  const opts = scopeOptions();
  let fromUrl = getParam('s');
  if (fromUrl === 'woestina' && opts.includes('jefferson')) fromUrl = 'jefferson';
  if (fromUrl && opts.includes(fromUrl)) {
    try { localStorage.setItem('boSchool', fromUrl); } catch (_) {}
    return fromUrl;
  }
  let saved = null;
  try { saved = localStorage.getItem('boSchool'); } catch (_) {}
  if (saved === 'woestina' && opts.includes('jefferson')) saved = 'jefferson';
  if (saved && opts.includes(saved)) return saved;
  return opts[0] || 'pto';
}
// Screens whose content depends on ?s= -- switching scope there reloads with the new one.
const SCHOOL_SCOPED_PAGES = ['index.html', 'school.html', 'section.html', 'signups.html', 'fundraising.html', 'yearbook.html', 'calendar.html', 'site.html'];
function switchWorkingSchool(s) {
  try { localStorage.setItem('boSchool', s); } catch (_) {}
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const u = new URL(window.location.href);
  if (SCHOOL_SCOPED_PAGES.includes(path) && !getParam('id')) {
    if (s === ALL && path === 'school.html') { window.location.href = 'site.html'; return; }   // a workspace is always one school
    if (s === ALL) u.searchParams.delete('s'); else u.searchParams.set('s', s);
    window.location.href = u.toString();
  } else {
    // Editing one page/sheet, or on a screen that isn't about one school: picking a school
    // takes you to that school's overview, where its pages and sign-up sheets are listed.
    window.location.href = 'index.html' + (s === ALL ? '' : '?s=' + s);
  }
}
/* Where each sidebar item goes for the current scope (whole website vs one school). */
function scopedHref(item, W) {
  const all = W === ALL, q = all ? '' : '?s=' + W;
  switch (item) {
    case 'site':     return 'site.html' + q;
    case 'events':   return 'section.html?cat=events' + (all ? '' : '&s=' + W);
    case 'calendar': return all ? 'calendar.html' : 'school.html?s=' + W + '&tab=calendar';
    case 'signups':  return 'signups.html' + q;
    case 'files':    return 'school.html?s=' + (all ? 'pto' : W) + '&tab=files';
    case 'fundraising': return 'fundraising.html' + q;
    case 'yearbook': return 'yearbook.html' + q;
    case 'ideas':    return 'school.html?s=' + (all ? 'pto' : W) + '&tab=ideas';
  }
  return 'index.html';
}

/* Line icons for the sidebar (24×24, drawn with the current text colour). */
const BO_ICON = (() => {
  const i = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return {
    home: i('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
    site: i('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r=".6" fill="currentColor"/><circle cx="9" cy="6.5" r=".6" fill="currentColor"/>'),
    events: i('<path d="M12 3l2.5 5.2 5.5.8-4 3.9.9 5.6L12 15.8 7.1 18.5 8 12.9 4 9l5.5-.8z"/>'),
    calendar: i('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    signups: i('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>'),
    files: i('<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/>'),
    fundraising: i('<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.6-.6-3.1-1.6M12 6v2M12 16v2"/>'),
    yearbook: i('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    meetings: i('<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.5 19c.6-3 2.9-5 5.5-5s4.9 2 5.5 5M14 14.3c2.6-.4 5.6 1.2 6.5 4.7"/>'),
    ideas: i('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
    tools: i('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    guides: i('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
    assistant: i('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
    people: i('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.6 3.4-6 6.5-6s5.8 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5c1.6.9 2.7 2.9 3 5.5"/>'),
    approve: i('<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    external: i('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    menu: i('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    plus: i('<path d="M12 5v14M5 12h14"/>'),
    edit: i('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>')
  };
})();

/* ------------------------------------------------------------
   The shared sidebar.
   Any page that includes a <div id="bo-shell"></div> gets it.
   Grouped by what volunteers come here to do, not by database
   structure: update the website, or run the PTO.
   ------------------------------------------------------------ */
function renderShell() {
  const shell = document.getElementById('bo-shell');
  if (!shell || !ME) return;

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const tab = getParam('tab') || (path === 'school.html' ? 'calendar' : '');
  const cat = getParam('cat');
  const W = workingSchool();
  const opts = scopeOptions();
  // A one-line hint for each item, shown on hover, so new volunteers know what's where.
  const HINT = {
    home: 'Your dashboard: drafts, to-dos and what\'s coming up', site: 'Add or change pages on the website',
    events: 'Event and program pages, by school', files: 'Photos and documents to use on pages',
    calendar: 'Every PTO event, with flyer and reminder dates', meetings: 'PTO meeting dates, agendas and notes',
    ideas: 'Ideas and to-dos for future events', signups: 'Volunteer shifts and sign-up sheets',
    fundraising: 'Fundraisers and their trackers', yearbook: 'Photos families sent in for the yearbook',
    people: 'Who can use the back office', approve: 'Approve new parent-directory families',
    guides: 'Step-by-step help for every part of the back office', assistant: 'Ask a question in plain English',
    tools: 'Orders, requests and one-time setup tools', edit: 'Click and type on any page of the website, then publish'
  };
  const link = (href, label, icon, active) =>
    `<a href="${href}" class="bo-navlink${active ? ' active' : ''}" title="${HINT[icon] || ''}"${active ? ' aria-current="page"' : ''}>
       <span class="bo-navicon">${BO_ICON[icon]}</span><span>${label}</span></a>`;
  const initials = String(ME.name || ME.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  // The school switcher: always visible, one button per school, so it's obvious which
  // school you're working on and how to change it (a dropdown hid this before).
  const hub = HUB[W] || HUB.pto;
  const schoolBtns = opts.map(k => {
    const h = HUB[k] || { name: SCHOOLS[k], sub: '', color: '#888' };
    return `<button type="button" class="bo-school${k === W ? ' on' : ''}" data-school="${k}" style="--sc:${h.color}" aria-pressed="${k === W}">
      <span class="bo-school-dot" aria-hidden="true"></span><span class="bo-school-txt"><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></span></button>`;
  }).join('');
  const picker = opts.length > 1
    ? `<div class="bo-schools" role="group" aria-label="Which school are you working on?">
         <span class="bo-working-lbl">1 · Pick a school</span>${schoolBtns}</div>`
    : `<div class="bo-schools"><span class="bo-working-lbl">Your school</span>${schoolBtns}</div>`;

  shell.innerHTML = `
    <aside class="bo-sidebar" id="bo-sidebar">
      <div class="bo-topbar">
        <a href="index.html" class="bo-brand">
          <span class="bo-brand-mark"><img src="../images/logo.png" alt=""></span>
          <span class="bo-brand-text"><b>Back Office</b><small>Schalmont PTO</small></span>
        </a>
        <button type="button" class="bo-menu-btn" id="bo-menu-btn" aria-expanded="false" aria-controls="bo-drawer">${BO_ICON.menu}<span>Menu</span></button>
      </div>
      <div class="bo-drawer" id="bo-drawer">
        ${picker}
        <nav class="bo-nav" aria-label="Back office">
          <div class="bo-navgroup-label bo-navgroup-school" style="--sc:${hub.color}">2 · Work on ${esc(W === ALL ? 'all schools' : hub.name)}</div>
          ${link('index.html' + (W === ALL ? '' : '?s=' + W), 'Overview', 'home', path === 'index.html')}
          ${link(scopedHref('site', W), 'Web pages', 'site', path === 'site.html' || path === 'page-editor.html' || (path === 'school.html' && tab === 'pages') || (path === 'section.html' && cat === 'events'))}
          ${link(scopedHref('signups', W), 'Sign-up sheets', 'signups', path === 'signups.html')}
          ${link(scopedHref('calendar', W), 'Calendar', 'calendar', (path === 'school.html' && tab === 'calendar') || path === 'calendar.html')}
          ${link(scopedHref('files', W), 'Photos &amp; files', 'files', path === 'school.html' && (tab === 'files' || tab === 'photos'))}
          ${link(scopedHref('fundraising', W), 'Fundraisers', 'fundraising', path === 'fundraising.html')}
          ${link(scopedHref('yearbook', W), 'Yearbook photos', 'yearbook', path === 'yearbook.html')}

          <div class="bo-navgroup-label">Whole PTO</div>
          ${link('meetings.html', 'Meetings', 'meetings', path === 'meetings.html')}
          ${link(scopedHref('ideas', W), 'Idea board', 'ideas', path === 'school.html' && tab === 'ideas')}
          ${ME.isSuper ? link('live-edit.html', 'Edit the website live', 'edit', path === 'live-edit.html') : ''}

          ${ME.isSuper ? `
          <div class="bo-navgroup-label">Officers</div>
          ${link('people.html', 'People &amp; roles', 'people', path === 'people.html')}
          ${link('directory.html', 'Directory sign-ups', 'approve', path === 'directory.html')}` : ''}
        </nav>
        <div class="bo-create">
          <button type="button" class="bo-create-btn" id="bo-create-btn" aria-expanded="false" aria-controls="bo-create-menu">${BO_ICON.plus}<span>Create something new</span></button>
          <div class="bo-create-menu" id="bo-create-menu" hidden>
            <button type="button" data-create="page">${BO_ICON.site}<span><b>Web page</b><small>An event, program or info page${W === ALL ? '' : ' for ' + esc(hub.name)}</small></span></button>
            <a href="${scopedHref('signups', W)}${W === ALL ? '?' : '&'}new=1">${BO_ICON.signups}<span><b>Sign-up sheet</b><small>Volunteer shifts or items to bring</small></span></a>
            <a href="calendar.html?new=1${W === ALL ? '' : '&s=' + W}">${BO_ICON.calendar}<span><b>Calendar event</b><small>Add a date to the PTO calendar</small></span></a>
          </div>
        </div>
        <nav class="bo-nav bo-nav-minor" aria-label="Help and more">
          ${link('help.html', 'How-to guides', 'guides', path === 'help.html')}
          ${link('assistant.html', 'Ask the assistant', 'assistant', path === 'assistant.html')}
          ${link('tools.html', 'More tools', 'tools', ['tools.html', 'tat-teacher-orders.html', 'chocolate-requests.html', 'roadmap.html'].includes(path) || (path === 'section.html' && cat && cat !== 'events'))}
        </nav>
        <div class="bo-sidebar-foot">
          <a class="bo-viewsite" href="../index.html" target="_blank" rel="noopener">View the live website ${BO_ICON.external}</a>
          <div class="bo-me">
            <span class="bo-avatar" aria-hidden="true">${esc(initials)}</span>
            <span class="bo-me-text"><b>${esc(ME.name)}</b>
              <span><a href="#" onclick="changePasswordNow();return false;">Password</a> · <a href="#" onclick="signOutNow();return false;">Sign out</a></span></span>
          </div>
        </div>
      </div>
    </aside>`;

  const cBtn = document.getElementById('bo-create-btn'), cMenu = document.getElementById('bo-create-menu');
  const setCreate = (open) => { cMenu.hidden = !open; cBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  cBtn.addEventListener('click', (e) => { e.stopPropagation(); setCreate(cMenu.hidden); });
  cMenu.querySelector('[data-create="page"]').addEventListener('click', () => { setCreate(false); newWebPage('events', W === ALL ? undefined : W); });
  document.addEventListener('click', (e) => { if (!cMenu.hidden && !cMenu.contains(e.target)) setCreate(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cMenu.hidden) { setCreate(false); cBtn.focus(); } });
  shell.querySelectorAll('.bo-school[data-school]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.school !== W) switchWorkingSchool(b.dataset.school);
  }));
  const btn = document.getElementById('bo-menu-btn'), sidebar = document.getElementById('bo-sidebar');
  btn.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.querySelector('span').textContent = open ? 'Close' : 'Menu';
  });

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
  const opts = manageableSchools();
  // Start with the school you're working on ticked (or the one the caller passed in).
  const first = presetSchool && opts.includes(presetSchool) ? presetSchool : (ME ? workingSchool() : '');
  const checks = opts.map(s =>
    `<label class="bo-chip"><input type="checkbox" class="nwp-school" value="${s}" ${s === first ? 'checked' : ''}><span>${esc(SCHOOLS[s])}</span></label>`
  ).join('');
  // Deliberately never pre-selects a type (even when a section like Fundraising passed
  // one in) -- the admin has to actively choose Event/Program/Club/etc. every time.
  const typeChips = NWP_TYPES.map(t =>
    `<label class="bo-chip"><input type="radio" name="nwp-type" value="${t.cat}"><span>${esc(t.label)}</span></label>`
  ).join('');

  const back = document.createElement('div');
  back.className = 'bo-modal-back';
  back.innerHTML = `
    <div class="bo-modal" role="dialog" aria-modal="true" aria-labelledby="nwp-h">
      <button type="button" class="bo-modal-x" id="nwp-x" aria-label="Cancel">✕</button>
      <h2 id="nwp-h">Create a new web page</h2>
      <p class="bo-modal-sub">It starts as a private draft with a ready-made layout. Nobody sees it until you press <strong>Publish</strong>.</p>
      ${presetDate ? `<p class="bo-modal-sub">Event date: <strong>${esc(new Date(presetDate + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</strong> (from the calendar).</p>` : ''}

      <label class="bo-modal-lbl" for="nwp-title">1. What's the page called?</label>
      <input type="text" id="nwp-title" placeholder="e.g. Fall Fun Run 2026" autocomplete="off">

      <div class="bo-modal-lbl" id="nwp-type-lbl">2. What kind of page is it?</div>
      <div class="bo-chips" role="radiogroup" aria-labelledby="nwp-type-lbl">${typeChips}</div>
      <div class="bo-notice" id="nwp-sheet" hidden>
        <strong>One more step after this:</strong> add it to the
        <a href="${PLANNING_SHEET_URL}" target="_blank" rel="noopener">planning spreadsheet ↗</a>
        too, so it shows on the calendar with flyer and reminder dates.
      </div>

      <div class="bo-modal-lbl" id="nwp-school-lbl">3. Which school is it for? <span class="bo-modal-opt">Tick more than one if it's shared.</span></div>
      <div class="bo-chips" role="group" aria-labelledby="nwp-school-lbl">${checks}</div>

      <details class="bo-modal-more">
        <summary>More options</summary>
        <div class="bo-modal-checklist">
          <label><input type="checkbox" id="nwp-topmenu"> Show in the website's top menu</label>
          <label><input type="checkbox" id="nwp-leftmenu" checked> Show in the left (Browse) menu</label>
        </div>
        <p class="bo-modal-sub">Its web address: one school → <code>schalmontpto.com/&lt;school&gt;/&hellip;</code>;
          several schools or PTO-wide → <code>schalmontpto.com/pto/&hellip;</code>; no school ticked →
          <code>schalmontpto.com/&hellip;</code>. Every published page also gets a card on its
          school's page automatically (you can turn that off in the editor).</p>
      </details>

      <p id="nwp-hint" class="bo-modal-sub" style="margin-top:12px">Add a name and pick a kind of page to continue.</p>
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
  const chosenType = () => (back.querySelector('input[name="nwp-type"]:checked') || {}).value || '';
  const revalidate = () => {
    const t = chosenType();
    const hasType   = t !== '';
    const sec = sectionByCat(t);
    back.querySelector('#nwp-sheet').hidden = !(sec && sec.sheet);
    const hasTitle  = back.querySelector('#nwp-title').value.trim().length > 0;
    goBtn.disabled = !(hasType && hasTitle);
    hint.style.display = goBtn.disabled ? '' : 'none';
  };
  back.querySelectorAll('.nwp-school').forEach(c => c.addEventListener('change', revalidate));
  back.querySelectorAll('input[name="nwp-type"]').forEach(r => r.addEventListener('change', revalidate));
  back.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  back.querySelector('#nwp-title').addEventListener('input', revalidate);
  revalidate();

  goBtn.onclick = async () => {
    const schools = [...back.querySelectorAll('.nwp-school:checked')].map(c => c.value);
    const title = back.querySelector('#nwp-title').value.trim();
    const chosenCat = chosenType();
    const showInTopMenu = back.querySelector('#nwp-topmenu').checked;
    const showInLeftMenu = back.querySelector('#nwp-leftmenu').checked;
    if (!title) { toast('Give it a working title', 'error'); return; }
    if (!canManageAll(schools)) {
      toast(schools.length ? 'You can only create pages for your own school(s)' : 'Only a PTO owner can create a page with no school', 'error');
      return;
    }
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

/* Watches a standard 12/8/4-column grid (see .bo-editor in admin.css) and puts up a
   loud on-page warning if its direct children's `grid-column: span N` declarations
   ever stop adding up to the current breakpoint's total -- so a future edit that
   breaks the column math (an extra child, a typo'd span, a missed breakpoint) gets
   caught visibly instead of silently shipping a gap or an overflowing row. Call once
   per grid, right after its content is in the DOM; it re-checks on every resize. */
function checkGridLayout(selector) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  const check = () => {
    const w = window.innerWidth;
    const total = w <= 860 ? 4 : w <= 1200 ? 8 : 12;
    let sum = 0;
    [...grid.children].forEach(k => {
      const m = /span\s+(\d+)/.exec(getComputedStyle(k).gridColumn || '');
      sum += m ? parseInt(m[1], 10) : 0;
    });
    let warn = document.getElementById('bo-grid-warn-' + selector.replace(/\W/g, ''));
    if (sum !== total) {
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'bo-grid-warn-' + selector.replace(/\W/g, '');
        warn.style.cssText = 'background:#fdecea;border:1px solid #f5c6c0;color:#8b1a14;' +
          'padding:10px 14px;border-radius:8px;margin-bottom:14px;font-weight:700;font-size:13px';
        grid.parentNode.insertBefore(warn, grid);
      }
      warn.textContent = '⚠️ Layout grid mismatch on ' + selector + ': columns add up to ' +
        sum + ', not the standard ' + total + ' for this screen width. This needs fixing.';
    } else if (warn) {
      warn.remove();
    }
  };
  check();
  window.addEventListener('resize', check);
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
     routingSchool() -> the school key used for the public URL / prefix:
                        a single-school page keeps its school; a page shared by
                        two or more schools lives under the PTO-wide prefix;
                        a page with NO school at all gets '' -- no prefix, just
                        schalmontpto.com/<slug> -- see pagePath(). */
function pageSchools(p) {
  if (!p) return [];
  if (Array.isArray(p.schools) && p.schools.length) return p.schools;
  return p.school ? [p.school] : [];
}
function routingSchool(schools) {
  const list = Array.isArray(schools) ? schools.filter(Boolean) : pageSchools(schools);
  if (list.length === 1) return list[0];
  if (list.length === 0) return '';
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
