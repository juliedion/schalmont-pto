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

## 3. Turn on file storage

1. Same console → **Build → Storage**
2. If you've never opened it: click **Get started**, accept the default rules for now,
   choose a **US** location, finish
3. Open the **Rules** tab → select all → delete → paste the entire contents of
   [`storage.rules`](../storage.rules) → **Publish**

---

## 4. Create the database indexes

The back office runs a few sorted searches that Firestore needs "indexes" for.
Easiest way:

- Open **https://schalmontpto.com/admin/school.html?s=jefferson** and click around the
  **Pages**, **Files & Photos**, and **Planning** tabs.
- If something says *"Could not load … this mentions an index"*, press **F12**, open the
  **Console**, and click the long `https://console.firebase.google.com/...` link in the red
  error. It opens the console with the index pre-filled — press **Create index**, wait a
  minute, refresh.
- There are 5 total (listed in [`firestore.indexes.json`](../firestore.indexes.json)). You
  only need to do this once ever.

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
- Storage uploads are capped at 15 MB/file.
