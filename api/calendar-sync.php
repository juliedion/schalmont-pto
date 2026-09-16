<?php
/* ============================================================
   Schalmont PTO — push a back-office calendar event onto the
   REAL Google Calendar shown on the public school pages.
   ------------------------------------------------------------
   The back office's own calendar (pto_events in Firestore) and
   the public site's embedded Google Calendars are two separate
   systems. This is the bridge between them: it uses a Google
   Cloud "service account" to create/update/delete events on the
   real calendars, so what an admin does here actually shows up
   on schalmontpto.com.

   Requires one-time setup — see api/config.example.php for the
   exact steps. Until that's done, this endpoint returns a clear
   "not set up yet" error and the rest of the back office keeps
   working normally (this is a bonus feature, not a dependency).
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function bail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') bail(405, 'POST only');

$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) bail(503, 'Not set up yet — see api/config.example.php.');
$cfg = require $cfgPath;

$saJson = $cfg['google_service_account_json'] ?? '';
$calendars = $cfg['google_calendars'] ?? [];
if (empty($saJson) || empty($calendars)) {
  bail(503, 'Google Calendar sync is not set up yet — see api/config.example.php for the one-time setup steps.');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || empty($body['idToken']) || empty($body['action']) || empty($body['school'])) {
  bail(400, 'Malformed request.');
}

/* ---------- 1. Verify the caller is a signed-in back-office admin ---------- */
require __DIR__ . '/_verify.php';
$pid = $cfg['firebase_project_id'] ?? 'schalmont-pto';
$claims = firebase_verify_token($body['idToken'], $pid);
if (!$claims) bail(401, 'Please sign in again.');
$userEmail = strtolower($claims['email'] ?? '');
$userUid = $claims['sub'] ?? '';

$isAdmin = false;
$ownerEmails = array_map('strtolower', $cfg['admin_emails'] ?? ['julie@schalmontpto.com']);
if (in_array($userEmail, $ownerEmails, true)) {
  $isAdmin = true;
} elseif ($userUid) {
  $furl = "https://firestore.googleapis.com/v1/projects/{$pid}/databases/(default)/documents/users/" . rawurlencode($userUid);
  $fch = curl_init($furl);
  curl_setopt_array($fch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $body['idToken']],
  ]);
  $fres = curl_exec($fch);
  curl_close($fch);
  $fdoc = json_decode((string)$fres, true);
  $role = is_array($fdoc) ? ($fdoc['fields']['role']['stringValue'] ?? '') : '';
  if ($role === 'admin' || $role === 'superadmin') $isAdmin = true;
}
if (!$isAdmin) bail(403, 'Back-office administrators only.');

/* ---------- 2. Which real Google Calendar does this school write to? ---------- */
$school = $body['school'];
$calendarId = $calendars[$school] ?? null;
if (!$calendarId) bail(400, "No Google Calendar is configured for '$school'.");

/* ---------- 3. Trade the service account key for a short-lived access token ---------- */
function google_access_token($saJson) {
  $sa = json_decode($saJson, true);
  if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) return null;
  $now = time();
  $b64 = function ($d) {
    $s = is_string($d) ? $d : json_encode($d);
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
  };
  $unsigned = $b64(['alg' => 'RS256', 'typ' => 'JWT']) . '.' . $b64([
    'iss' => $sa['client_email'],
    'scope' => 'https://www.googleapis.com/auth/calendar',
    'aud' => 'https://oauth2.googleapis.com/token',
    'iat' => $now, 'exp' => $now + 3300,
  ]);
  $ok = openssl_sign($unsigned, $signature, $sa['private_key'], 'sha256WithRSAEncryption');
  if (!$ok) return null;
  $jwt = $unsigned . '.' . $b64($signature);

  $ch = curl_init('https://oauth2.googleapis.com/token');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 20,
    CURLOPT_POSTFIELDS => http_build_query([
      'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      'assertion' => $jwt,
    ]),
  ]);
  $res = curl_exec($ch);
  curl_close($ch);
  $data = json_decode((string)$res, true);
  return is_array($data) ? ($data['access_token'] ?? null) : null;
}

$token = google_access_token($saJson);
if (!$token) bail(502, 'Could not authenticate with Google Calendar — check the service account key in config.php.');

/* ---------- 4. Build the event body and call the Calendar API ---------- */
function calendar_api($method, $url, $token, $payload = null) {
  $ch = curl_init($url);
  $headers = ['Authorization: Bearer ' . $token, 'Content-Type: application/json'];
  $opts = [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
    CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
  ];
  if ($payload !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($payload);
  curl_setopt_array($ch, $opts);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$code, json_decode((string)$res, true)];
}

$base = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events';
$action = $body['action'];

if ($action === 'delete') {
  if (empty($body['googleEventId'])) bail(400, 'Missing googleEventId.');
  [$code, ] = calendar_api('DELETE', $base . '/' . rawurlencode($body['googleEventId']), $token);
  // Google returns 410 if it was already deleted -- treat that as success too.
  if ($code >= 200 && $code < 300 || $code === 410 || $code === 404) { echo json_encode(['ok' => true]); exit; }
  bail(502, 'Could not delete the calendar event (HTTP ' . $code . ').');
}

$title = trim((string)($body['title'] ?? ''));
$date = (string)($body['date'] ?? '');
if (!$title || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) bail(400, 'A title and a valid date are required.');
$endDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($body['endDate'] ?? '')) ? $body['endDate'] : $date;
$time = (string)($body['time'] ?? '');

$event = ['summary' => $title];
if ($body['location'] ?? '') $event['location'] = $body['location'];
if ($body['notes'] ?? '') $event['description'] = $body['notes'];

if (preg_match('/^\d{2}:\d{2}$/', $time)) {
  $event['start'] = ['dateTime' => $date . 'T' . $time . ':00', 'timeZone' => 'America/New_York'];
  $event['end']   = ['dateTime' => $endDate . 'T' . $time . ':00', 'timeZone' => 'America/New_York'];
} else {
  // All-day events are exclusive of the end date in Google's API, so add one day.
  $endPlusOne = date('Y-m-d', strtotime($endDate . ' +1 day'));
  $event['start'] = ['date' => $date];
  $event['end'] = ['date' => $endPlusOne];
}

if ($action === 'update' && !empty($body['googleEventId'])) {
  [$code, $data] = calendar_api('PATCH', $base . '/' . rawurlencode($body['googleEventId']), $token, $event);
  if ($code >= 200 && $code < 300) { echo json_encode(['ok' => true, 'googleEventId' => $data['id'] ?? $body['googleEventId']]); exit; }
  bail(502, 'Could not update the calendar event (HTTP ' . $code . ').');
}

// Create (also used as a fallback if an "update" target no longer exists on the calendar)
[$code, $data] = calendar_api('POST', $base, $token, $event);
if ($code >= 200 && $code < 300) { echo json_encode(['ok' => true, 'googleEventId' => $data['id'] ?? null, 'htmlLink' => $data['htmlLink'] ?? null]); exit; }
bail(502, 'Could not create the calendar event (HTTP ' . $code . '): ' . ($data['error']['message'] ?? ''));
