<?php
/* ============================================================
   AI Assistant configuration  —  EXAMPLE FILE
   ------------------------------------------------------------
   HOW TO TURN ON THE AI ASSISTANT (one time, ~5 minutes):

   1. Go to  https://console.anthropic.com  → sign in / sign up.
   2. Add a payment method, then open  Settings → Limits  and set a
      low monthly spend cap (e.g. $10) so there are no surprises.
   3. Open  Settings → API keys  → "Create key" → copy it
      (it starts with  sk-ant-...).
   4. In your Bluehost File Manager, go to the  /api  folder.
   5. Make a COPY of this file named exactly  config.php
      (same folder). Never rename this example file itself.
   6. Edit  config.php  and paste your key between the quotes below.
   7. Save. The assistant is now live at  /admin/assistant.html

   config.php is ignored by Git on purpose so your key is never
   uploaded to GitHub. It lives only on the Bluehost server.
   ============================================================ */

return [
  // Your Anthropic API key (keep this secret):
  'anthropic_api_key' => 'sk-ant-REPLACE-ME',

  // Which model to use. claude-haiku is cheapest; claude-sonnet is smarter.
  'model' => 'claude-haiku-4-5-20251001',

  // Safety cap: stop answering after this many questions in a calendar month.
  // (Resets automatically on the 1st.) Raise or lower as you like.
  'max_requests_per_month' => 800,

  // Your Firebase project id — used to check that only signed-in
  // PTO administrators can use the assistant. Do not change unless
  // your Firebase project changes.
  'firebase_project_id' => 'schalmont-pto',
];
