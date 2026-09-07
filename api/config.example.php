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
  'gemini_api_key' => 'AQ.Ab8RN6LyShezzL1908FPLutzeaFNCEojMvo4Lpak3woOO9QfNw
',
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
];
