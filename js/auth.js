/* ============================================================
   Schalmont PTO — Firebase Auth Helper
   ============================================================ */

// Initialize Firebase (runs on every page that includes this script)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

/* ============================================================
   AUTH GATE — redirect to login if not signed in
   Call this at the top of any page that requires login.
   Usage:  requireAuth();
   ============================================================ */
function requireAuth(redirectTo = 'login.html') {
  // Show loading overlay immediately so content isn't briefly visible
  const overlay = document.getElementById('auth-loading');
  if (overlay) overlay.style.display = 'flex';

  auth.onAuthStateChanged(user => {
    if (user) {
      // Signed in — show the page
      if (overlay) overlay.style.display = 'none';
      const content = document.getElementById('auth-content');
      if (content) content.style.display = 'block';
      // Populate user info wherever it appears
      document.querySelectorAll('.auth-user-email').forEach(el => {
        el.textContent = user.email;
      });
    } else {
      // Not signed in — redirect to login, remembering where to return
      const returnUrl = encodeURIComponent(window.location.pathname.split('/').pop());
      window.location.href = `${redirectTo}?next=${returnUrl}`;
    }
  });
}

/* ============================================================
   SIGN UP with email + password
   New accounts are saved as "pending" in Firestore and require
   admin approval before they can access the directory.
   Admin emails (defined in firebase-config.js) are auto-approved.
   ============================================================ */
async function signUp(email, password, displayName) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  if (displayName) {
    await cred.user.updateProfile({ displayName });
  }
  // Send email verification — user must confirm before accessing anything
  await cred.user.sendEmailVerification();

  // Sign out immediately — user must verify email then submit family info before appearing in admin panel
  await auth.signOut();

  return cred.user;
}

/* ============================================================
   SIGN IN with email + password
   ============================================================ */
async function signIn(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

/* ============================================================
   SIGN OUT
   ============================================================ */
async function signOut() {
  await auth.signOut();
  window.location.href = 'login.html';
}

/* ============================================================
   SEND PASSWORD RESET EMAIL
   ============================================================ */
async function resetPassword(email) {
  await auth.sendPasswordResetEmail(email);
}

/* ============================================================
   LOGIN PAGE LOGIC — only runs on login.html
   ============================================================ */
function initLoginPage() {
  if (!document.getElementById('login-form')) return;

  // If already signed in AND email verified (or admin), redirect away from login page
  auth.onAuthStateChanged(user => {
    if (user && (user.emailVerified || (typeof adminEmails !== 'undefined' && adminEmails.includes(user.email)))) {
      const params  = new URLSearchParams(window.location.search);
      const next    = params.get('next') || 'directory.html';
      window.location.href = next;
    }
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Friendly Firebase error messages
  function friendlyError(code) {
    const map = {
      'auth/email-already-in-use':   'An account with this email already exists. Try signing in instead.',
      'auth/invalid-email':           'Please enter a valid email address.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/user-not-found':          'No account found with that email address.',
      'auth/wrong-password':          'Incorrect password. Try again or reset your password.',
      'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed':  'Network error. Please check your connection.',
      'auth/invalid-credential':      'Incorrect email or password. Please try again.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  function setLoading(form, loading) {
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }

  // SIGN IN form
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('login-alert');
    alertEl.innerHTML = '';
    const fd = new FormData(loginForm);
    setLoading(loginForm, true);
    try {
      const user = await signIn(fd.get('email'), fd.get('password'));
      const isAdmin = typeof adminEmails !== 'undefined' && adminEmails.includes(user.email);
      if (!user.emailVerified && !isAdmin) {
        await auth.signOut();
        alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>Please verify your email first. Check your inbox for the verification link sent when you registered.</span></div>`;
        setLoading(loginForm, false);
        return;
      }
      // Verified — onAuthStateChanged will handle redirect
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>${friendlyError(err.code)}</span></div>`;
      setLoading(loginForm, false);
    }
  });

  // SIGN UP form
  const signupForm = document.getElementById('signup-form');
  signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('signup-alert');
    alertEl.innerHTML = '';
    const fd = new FormData(signupForm);
    if (fd.get('password') !== fd.get('confirm')) {
      alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>Passwords do not match.</span></div>`;
      return;
    }
    setLoading(signupForm, true);
    try {
      const name = `${fd.get('firstName').trim()} ${fd.get('lastName').trim()}`;
      const email = fd.get('email');
      await signUp(email, fd.get('password'), name);
      // Sign-up succeeded and user is now signed out — show email verification prompt
      signupForm.style.display = 'none';
      alertEl.innerHTML = `<div class="alert alert-success"><span>✓</span><span><strong>Account created!</strong> We sent a verification email to <strong>${email}</strong>. Click the link in that email, then come back and sign in. A PTO admin will review your account before you can access the directory.</span></div>`;
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>${friendlyError(err.code)}</span></div>`;
      setLoading(signupForm, false);
    }
  });

  // FORGOT PASSWORD link
  document.getElementById('forgot-link')?.addEventListener('click', async e => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const email = emailInput?.value?.trim();
    const alertEl = document.getElementById('login-alert');
    if (!email) {
      alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>Enter your email address above first, then click "Forgot password".</span></div>`;
      return;
    }
    try {
      await resetPassword(email);
      alertEl.innerHTML = `<div class="alert alert-success"><span>✓</span><span>Password reset email sent to <strong>${email}</strong>. Check your inbox.</span></div>`;
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error"><span>✕</span><span>${friendlyError(err.code)}</span></div>`;
    }
  });
}

// Run login page logic after DOM is ready
document.addEventListener('DOMContentLoaded', initLoginPage);
