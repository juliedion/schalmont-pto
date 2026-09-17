/* ============================================================
   Shared public-site chrome (header nav + left sidebar + footer)
   for pages that are generated at runtime (p.html, signup.html).
   Call renderSiteChrome() after the DOM has:
     <div id="sc-header"></div>
     <div class="homepage-layout">
       <div id="sc-sidenav"></div>
       <div class="homepage-main"> …page content… </div>
     </div>
     <div id="sc-footer"></div>
   ============================================================ */
(function (global) {
  const HEADER = `
  <header class="site-header">
    <nav class="container nav-inner">
      <a href="/index.html" class="nav-brand">
        <img src="/images/logo.png" alt="Schalmont Central PTO" class="nav-logo-img">
      </a>
      <ul class="nav-links">
        <li><a href="/index.html">Home</a></li>
        <li class="has-dropdown">
          <a href="/schools.html">Schools</a>
          <ul class="nav-dropdown">
            <li><a href="/woestina.html">🌱 Woestina Pre-K</a></li>
            <li><a href="/jefferson.html">🏫 Jefferson Elementary</a></li>
            <li><a href="/middle-school.html">📚 Middle School</a></li>
            <li><a href="/high-school.html">🎓 High School</a></li>
          </ul>
        </li>
        <li><a href="/events.html">Events</a></li>
        <li class="has-dropdown">
          <a href="/shop.html">Shop</a>
          <ul class="nav-dropdown">
            <li><a href="/shop.html">👕 Spiritwear</a></li>
            <li><a href="/fundraisers.html">💰 Fundraisers</a></li>
          </ul>
        </li>
        <li><a href="/fundraisers.html">Fundraisers</a></li>
        <li><a href="/directory.html">Directory</a></li>
        <li class="has-dropdown">
          <a href="/contact.html">Contact</a>
          <ul class="nav-dropdown">
            <li><a href="/about.html">About</a></li>
            <li><a href="/social.html">Social</a></li>
            <li><a href="/gallery.html">Gallery</a></li>
          </ul>
        </li>
        <li><a href="/login.html" class="btn btn-primary" style="padding:6px 16px;font-size:14px;color:#000000">Login/Register</a></li>
        <li><a href="https://www.facebook.com/groups/schalmontpto/" target="_blank" rel="noopener" class="nav-social-icon" aria-label="Facebook" style="background:#1877F2;color:#fff"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a></li>
        <li><a href="https://www.instagram.com/schalmontpto/" target="_blank" rel="noopener" class="nav-social-icon" aria-label="Instagram" style="background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%);color:#fff"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a></li>
      </ul>
      <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
    </nav>
  </header>`;

  const SIDENAV = `
    <aside class="homepage-sidenav">
      <div class="sidenav-heading">Browse</div>
      <a href="/index.html" class="sidenav-item">Home</a>
      <a href="/events.html" class="sidenav-item">Events Calendar</a>

      <div class="sidenav-heading">Schools</div>
      <a href="/schools.html" class="sidenav-item">All Schools</a>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-woestina">Woestina Pre-K <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-woestina">
          <a href="/woestina.html" class="sidenav-item sub">Overview</a>
          <a href="/woestina.html#yearbook" class="sidenav-item sub">Yearbook</a>
          <a href="/classof2040.html" class="sidenav-item sub">Class of 2040 — Pre-Kindergarten</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-jefferson">Jefferson Elementary <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-jefferson">
          <a href="/jefferson.html" class="sidenav-item sub">Overview</a>
          <a href="/jefferson.html#yearbook" class="sidenav-item sub">Yearbook</a>
          <a href="/classof2035.html" class="sidenav-item sub">Class of 2035 — 4th Grade</a>
          <a href="/classof2036.html" class="sidenav-item sub">Class of 2036 — 3rd Grade</a>
          <a href="/classof2037.html" class="sidenav-item sub">Class of 2037 — 2nd Grade</a>
          <a href="/classof2038.html" class="sidenav-item sub">Class of 2038 — 1st Grade</a>
          <a href="/classof2039.html" class="sidenav-item sub">Class of 2039 — Kindergarten</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-middle">Middle School <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-middle">
          <a href="/middle-school.html" class="sidenav-item sub">Overview</a>
          <a href="/middle-school.html#yearbook" class="sidenav-item sub">Yearbook</a>
          <a href="/classof2031.html" class="sidenav-item sub">Class of 2031 — 8th Grade</a>
          <a href="/classof2032.html" class="sidenav-item sub">Class of 2032 — 7th Grade</a>
          <a href="/classof2033.html" class="sidenav-item sub">Class of 2033 — 6th Grade</a>
          <a href="/classof2034.html" class="sidenav-item sub">Class of 2034 — 5th Grade</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-high">High School <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-high">
          <a href="/high-school.html" class="sidenav-item sub">Overview</a>
          <a href="/high-school.html#yearbook" class="sidenav-item sub">Yearbook</a>
          <a href="/classof2027.html" class="sidenav-item sub">Class of 2027 — Seniors</a>
          <a href="/classof2028.html" class="sidenav-item sub">Class of 2028 — Juniors</a>
          <a href="/classof2029.html" class="sidenav-item sub">Class of 2029 — Sophomores</a>
          <a href="/classof2030.html" class="sidenav-item sub">Class of 2030 — Freshmen</a>
        </div>
      </div>

      <div class="sidenav-heading">Resources</div>
      <a href="/directory.html" class="sidenav-item">Directory</a>
      <a href="/donate.html" class="sidenav-item">Donate</a>
      <a href="/events.html" class="sidenav-item">Events</a>
      <a href="/fundraisers.html" class="sidenav-item">Fundraisers</a>
      <a href="/gallery.html" class="sidenav-item">Gallery</a>
      <a href="/schools.html" class="sidenav-item">Schools</a>
      <a href="/family-scouts.html" class="sidenav-item">Scouts</a>
      <a href="/shop.html" class="sidenav-item">Shop</a>
      <a href="/social.html" class="sidenav-item">Social Media</a>
      <a href="/sports.html" class="sidenav-item">Sports</a>
      <a href="/yearbooks.html" class="sidenav-item">Yearbooks</a>

      <div class="sidenav-heading">Connect</div>
      <a href="/about.html" class="sidenav-item">About the PTO</a>
      <a href="/social.html" class="sidenav-item">Social Media Links</a>
      <a href="/contact.html" class="sidenav-item">Contact Us</a>
      <div class="sidenav-donate-wrap" style="display:flex;flex-direction:column;gap:5px;padding:10px 8px 8px">

      </div>
    </aside>`;

  const FOOTER = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="nav-brand" style="margin-bottom:12px">
            <img src="/images/logo.png" alt="Schalmont Central PTO" class="nav-logo-img">
          </div>
          <p>Supporting students, connecting families, and building community in the Schalmont Central School District.</p>
          <div style="display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap">
            <a href="/login.html" class="btn btn-primary" style="padding:6px 14px;font-size:13px;color:#000000">Login/Register</a>
            <div class="footer-social-icons" style="margin-top:0">
              <a href="https://www.facebook.com/groups/schalmontpto/" target="_blank" rel="noopener" class="footer-social-icon" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
              <a href="https://www.instagram.com/schalmontpto/" target="_blank" rel="noopener" class="footer-social-icon" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
            </div>
          </div>
        </div>
        <div>
          <div class="footer-heading">Quick Links</div>
          <ul class="footer-links">
            <li><a href="/events.html">Events Calendar</a></li>
            <li><a href="/directory.html">Parent Directory</a></li>
            <li><a href="/shop.html">Shop</a></li>
            <li><a href="/fundraisers.html">Fundraisers</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">About &amp; Help</div>
          <ul class="footer-links">
            <li><a href="/about.html">About the PTO</a></li>
            <li><a href="/contact.html">Contact Us</a></li>
            <li><a href="https://www.schalmont.org" target="_blank" rel="noopener">School District Website</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Schalmont Parent-Teacher Organization. All rights reserved.</span>
        <span>Schenectady, NY</span>
      </div>
    </div>
  </footer>`;

  global.renderSiteChrome = function () {
    const h = document.getElementById('sc-header');
    const s = document.getElementById('sc-sidenav');
    const f = document.getElementById('sc-footer');
    if (h) h.outerHTML = HEADER;
    if (s) s.outerHTML = SIDENAV;
    if (f) f.outerHTML = FOOTER;

    // mobile nav toggle
    const nt = document.getElementById('nav-toggle');
    const nl = document.querySelector('.nav-links');
    if (nt && nl) nt.addEventListener('click', () => {
      const open = nl.classList.toggle('open');
      nt.setAttribute('aria-expanded', open);
    });
    // sidebar collapsible submenus — clicking a school also opens its page. Clicking
    // navigates away immediately, so whichever school's page you're already on has its
    // own submenu pre-opened instead, since the click-to-open animation is never seen there.
    const SIDENAV_SCHOOL_PAGE = {
      'snav-woestina': '/woestina.html', 'snav-jefferson': '/jefferson.html',
      'snav-middle': '/middle-school.html', 'snav-high': '/high-school.html'
    };
    // The live site's .htaccess strips ".html" from every URL, so compare extensionless.
    const currentPath = (location.pathname.replace(/\/$/, '').replace(/\.html$/, '')) || '/index';
    document.querySelectorAll('.sidenav-toggle').forEach(btn => {
      const target = btn.getAttribute('data-target');
      const sub = document.getElementById(target);
      if ((SIDENAV_SCHOOL_PAGE[target] || '').replace(/\.html$/, '') === currentPath && sub) {
        btn.classList.add('open'); sub.classList.add('open');
      }
      btn.addEventListener('click', () => {
        if (sub) { btn.classList.toggle('open'); sub.classList.toggle('open'); }
        const page = SIDENAV_SCHOOL_PAGE[target];
        if (page) location.href = page;
      });
    });
  };
})(window);
