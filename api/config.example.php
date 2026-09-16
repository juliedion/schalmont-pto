<?php
/* ============================================================
   AI Assistant configuration  —  EXAMPLE FILE
   ------------------------------------------------------------
   HOW TO TURN ON THE AI ASSISTANT (one time, ~3 minutes):

   1. Get a Google Gemini API key (free tier is generous):
        https://aistudio.google.com/apikey   → "Create API key" → copy it.
   2. In your Bluehost File Manager, open the  /api  folder.
   3. Make a COPY of this file named exactly  config.php  (same folder).
      Never rename this example file itself.
   4. Edit  config.php  and paste your key on the 'gemini_api_key' line.
   5. Save. The assistant is live at  /admin/assistant.html  and behind
      the "Need help?" button on every back-office page.

   config.php is ignored by Git on purpose so your key is never
   uploaded to GitHub. It lives only on the Bluehost server.
   ============================================================ */

return [
  // Which AI service to use: 'gemini' (Google) or 'anthropic' (Claude).
  'provider' => 'gemini',

  // ---- Google Gemini (used when provider = 'gemini') ----
  // Paste your key here ONLY in your private copy named config.php — never in this
  // example file (this one is on GitHub and any key added here becomes public).
  'gemini_api_key' => 'REPLACE-WITH-YOUR-GEMINI-KEY',
  // Model. gemini-2.5-flash is fast and cheap; gemini-2.5-pro is smarter.
  // (This 'model' line is also used for Anthropic when provider = 'anthropic'.)
  'model' => 'gemini-2.5-flash',

  // ---- Anthropic Claude (only if provider = 'anthropic') ----
  'anthropic_api_key' => 'sk-ant-REPLACE-ME',
  // If you switch provider to 'anthropic', also set 'model' above to e.g.
  // 'claude-haiku-4-5-20251001'.

  // Safety cap: stop answering after this many questions in a calendar month.
  // (Resets automatically on the 1st.) Raise or lower as you like.
  'max_requests_per_month' => 800,

  // Your Firebase project id — used to check that only signed-in
  // PTO administrators can use the assistant. Do not change unless
  // your Firebase project changes.
  'firebase_project_id' => 'schalmont-pto',

  // Email addresses that always count as an admin, even before they have a
  // role set in the database. Used by the AI assistant's admin check.
  'admin_emails' => ['julie@schalmontpto.com'],

  /* ============================================================
     GOOGLE CALENDAR WRITE-SYNC  —  optional, ~10 minute one-time setup
     ------------------------------------------------------------
     Without this, the back office's own calendar and the tracker
     spreadsheet stay in sync with each other, but NOT with the real
     Google Calendars embedded on the public school pages — those
     still have to be edited by hand at calendar.google.com. Doing
     this setup lets the back office create/update/delete events on
     the real calendars directly, so everything finally flows through
     automatically end to end.

     HOW TO SET IT UP:
     1. Go to https://console.cloud.google.com and create a new
        project (or pick an existing one) — name doesn't matter,
        e.g. "Schalmont PTO Calendar Sync".
     2. In the search bar, find and open "Google Calendar API", then
        press "Enable".
     3. Left menu → "Credentials" → "+ Create Credentials" →
        "Service account". Give it any name, click through, "Done".
     4. Click into the new service account → "Keys" tab → "Add Key"
        → "Create new key" → type JSON → "Create". A .json file
        downloads to your computer.
     5. Open that downloaded .json file in a text editor, select ALL
        of its contents, and paste them as a single-quoted PHP string
        on the 'google_service_account_json' line below, in your own
        config.php only (never in this example file).
     6. Copy the "client_email" value out of that same JSON file
        (looks like something@your-project.iam.gserviceaccount.com).
     7. For EACH school's Google Calendar: open calendar.google.com,
        find that calendar in the left sidebar → the "⋮" menu →
        "Settings and sharing" → "Share with specific people" →
        "+ Add people" → paste the client_email from step 6 → set
        permission to "Make changes to events" → "Send".
     8. Save config.php. New events created in the back office (or
        pulled in from the tracker spreadsheet) will now also be
        created on the real calendar automatically.
     ============================================================ */

  // Paste the ENTIRE contents of the downloaded service-account JSON key
  // file here as a string. Leave blank to keep write-sync turned off.
  'google_service_account_json' => '',

  // Which real Google Calendar each school's events get written to.
  // These already match the calendars embedded on the public pages —
  // only change them if a school gets a different calendar later.
  // Woestina has no calendar of its own yet, so it shares the main
  // Schalmont PTO calendar, same as the public Woestina page does.
  'google_calendars' => [
    'pto'       => 'c_2ccf0495db5e7ffcf4129ac6965b5cbe82ec743a13050f3aeecc9a18c84a53f5@group.calendar.google.com',
    'woestina'  => 'c_2ccf0495db5e7ffcf4129ac6965b5cbe82ec743a13050f3aeecc9a18c84a53f5@group.calendar.google.com',
    'jefferson' => 'b8ps3245btumu5q6psc3cmvs8c@group.calendar.google.com',
    'middle'    => 'eumk9qp2llrljnfkp64k1dgk5g@group.calendar.google.com',
    'high'      => '8b7ohsc70vgab6398itc7e73q0@group.calendar.google.com',
  ],
];
