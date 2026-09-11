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
          <a href="/book-fairs.html" class="sidenav-item sub">Book Fairs</a>
          <a href="/appreciation-days.html" class="sidenav-item sub">Appreciation Days</a>
          <a href="/incoming-kindergarten.html" class="sidenav-item sub">Incoming Kindergarten</a>
          <a href="/picture-days.html" class="sidenav-item sub">Picture Days</a>
          <a href="/shop.html" class="sidenav-item sub">Spiritwear</a>
          <a href="/classof2040.html" class="sidenav-item sub">Class of 2040 — Pre-Kindergarten</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-jefferson">Jefferson Elementary <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-jefferson">
          <a href="/jefferson.html" class="sidenav-item sub">Overview</a>
          <a href="/k2-glow-dance.html" class="sidenav-item sub">K-2 Dance</a>
          <a href="/glitz-and-glam-dance.html" class="sidenav-item sub">3rd/4th Dance</a>
          <a href="/school-banking.html" class="sidenav-item sub">School Banking</a>
          <a href="/birthdays-jefferson.html" class="sidenav-item sub">Birthdays</a>
          <a href="/book-fairs.html" class="sidenav-item sub">Book Fairs</a>
          <a href="/fundraisers-jefferson.html" class="sidenav-item sub">Fundraisers</a>
          <a href="/craft-fair-santa.html" class="sidenav-item sub">Craft Fair &amp; Santa</a>
          <a href="/holiday-shoppe.html" class="sidenav-item sub">Holiday Shoppe</a>
          <a href="/journey-to-jefferson.html" class="sidenav-item sub">Journey to Jefferson</a>
          <a href="/k-lunch-volunteers.html" class="sidenav-item sub">K Lunch Team</a>
          <a href="/scholarships-jefferson.html" class="sidenav-item sub">Scholarships</a>
          <a href="/sports.html" class="sidenav-item sub">Sports &amp; Cheer</a>
          <a href="/school-supplies.html" class="sidenav-item sub">School Supplies</a>
          <a href="/trunk-or-treat.html" class="sidenav-item sub">Trunk or Treat</a>
          <a href="/turn-off-screens.html" class="sidenav-item sub">Turn Off the Screens</a>
          <a href="/yearbook-jefferson.html" class="sidenav-item sub">Yearbook</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-middle">Middle School <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-middle">
          <a href="/middle-school.html" class="sidenav-item sub">Overview</a>
          <a href="/casinoroyale.html" class="sidenav-item sub">6/7 Casino Night</a>
          <a href="/book-fairs-middle.html" class="sidenav-item sub">Book Fairs</a>
          <a href="/sports.html" class="sidenav-item sub">Sports &amp; Athletics</a>
          <a href="/student-council.html" class="sidenav-item sub">Student Council</a>
          <a href="/middle-school.html#yearbook" class="sidenav-item sub">Yearbook</a>
        </div>
      </div>

      <div class="sidenav-group">
        <button class="sidenav-item sidenav-toggle" data-target="snav-high">High School <span class="sidenav-arrow">&#9660;</span></button>
        <div class="sidenav-submenu" id="snav-high">
          <a href="/high-school.html" class="sidenav-item sub">Overview</a>
          <a href="/shop.html" class="sidenav-item sub">Spiritwear</a>
          <a href="/sports.html" class="sidenav-item sub">Sports &amp; Athletics</a>
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

      <div class="sidenav-heading">Connect</div>
      <a href="/about.html" class="sidenav-item">About the PTO</a>
      <a href="/contact.html" class="sidenav-item">Contact Us</a>
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
    // sidebar collapsible submenus
    document.querySelectorAll('.sidenav-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = document.getElementById(btn.getAttribute('data-target'));
        if (sub) { btn.classList.toggle('open'); sub.classList.toggle('open'); }
      });
    });
  };
})(window);
