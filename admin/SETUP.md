# PTO Back Office — one-time setup (for Julie)

The back office is a set of pages in the `/admin/` folder plus a small PHP script in
`/api/`. It reuses the Firebase project you already have (`schalmont-pto`).

Do these steps once. Takes about 15 minutes. Nothing here changes the existing website.

---

## 1. Deploy the files

Just push to `main` like always — the GitHub Action FTPs everything to Bluehost.
After it runs, the back office lives at:

**https://schalmontpto.com/admin/**

(You'll be asked to sign in with your existing PTO account — `julie@schalmontpto.com`
is automatically the owner.)

---

## 2. Install the database security rules

1. Go to <https://console.firebase.google.com> → project **schalmont-pto**
2. **Build → Firestore Database → Rules** tab
3. Select everything in the box, delete it, paste the entire contents of
   [`firestore.rules`](../firestore.rules), press **Publish**

---

## 3. File storage

**Files & Photos** tab: a *link library* — admins paste links to photos/PDFs that live in
Google Drive, an image host, or on the web. Nothing stored in Firebase.

**Yearbook photos:** parents' uploads are saved on **Bluehost** under `/uploads/yearbook/…`
by `api/yearbook-upload.php`. Nothing to set up — the folder is created automatically on the
first upload. If uploads ever fail with a "could not create folder" message, create a folder
named `uploads` in **Bluehost File Manager** (inside `public_html`) and set its permissions
to **755**, then re-run `fix-permissions.php` (it runs after every deploy anyway).

Re-paste [`firestore.rules`](../firestore.rules) into the Firebase console whenever it
changes (it now also covers `yearbook_folders`, `yearbook_photos`, `pto_events`, `ideas`,
and lets admins read the user roster to assign tasks).

**Calendar → Google Sheet:** the planning spreadsheet must be shared **Anyone with the link
→ Viewer** for the "Import from Google Sheet" button to work. The allowed sheet id is set in
`api/sheet-proxy.php` (`$ALLOWED`).

---

## 4. Database indexes — none needed

The back office only uses simple searches, so Firestore does not need any custom indexes.
If you ever see a red *"requires an index"* error, it means a query was changed — tell the
developer; don't create indexes by hand.

---

## 5. Add your co-administrators

1. Each person signs up at <https://schalmontpto.com/login.html> (normal account).
2. You open **Back Office → People & Roles**, find them, set **School administrator**,
   check their school(s), **Save**.
3. Co-presidents who need everything: set them to **Owner** instead.

---

## 6. Turn on the AI Assistant

1. Get an API key at <https://console.anthropic.com> (Settings → API keys). Set a low
   monthly spend cap under Settings → Limits (e.g. $10).
2. In **Bluehost → File Manager → `public_html/api/`**, copy `config.example.php` to a new
   file named exactly **`config.php`** (same folder).
3. Edit `config.php`, paste your key, save.
4. Done — <https://schalmontpto.com/admin/assistant.html> now works.

`config.php` is git-ignored so the key never goes to GitHub; it lives only on Bluehost.

---

## Notes / limitations of this first version

- Published pages appear at `/p/<link>` but are **not** auto-added to the site's top
  navigation — link to them from existing pages or Facebook, or ask the site owner to add
  them to the menu.
- The built-in **form / sign-up builder** is the next update. For now admins embed a Google
  Form (there's a help section explaining it).
- **Files & Photos** is a link library (paste links), not file upload — see Step 3.
