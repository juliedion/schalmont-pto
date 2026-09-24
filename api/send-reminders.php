<?php
/* ============================================================
   Schalmont PTO — email every signed-up volunteer a reminder:
     - 3 days before their slot's date
     - the day of, roughly 2 hours before their slot's start time
   ------------------------------------------------------------
   Unlike notify-signup.php (triggered by a page load), this has
   to run on its own on a timer -- nothing on the site "calls" it.
   That means TWO one-time setup steps beyond the usual config.php,
   see api/config.example.php for both:

     1. The same Google service account used for Calendar sync
        also needs the "Cloud Datastore User" IAM role on the
        schalmont-pto Google Cloud project, so it can read the
        private contacts (email) records -- those are intentionally
        admin-only, a plain unauthenticated request can't see them.
     2. Something has to actually hit this URL on a schedule -- a
        Bluehost cPanel Cron Job, or a free external pinger like
        cron-job.org, calling it every 15-30 minutes with the
        secret key below. Without that, this file just sits here
        and nothing is ever sent.

   Sending state lives on each entry doc (reminder3dSent /
   reminder2hSent) so a slot that's checked on multiple runs never
   double-emails anyone.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function bail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) bail(503, 'Not set up yet — see api/config.example.php.');
$cfg = require $cfgPath;

$key = $cfg['reminders_secret_key'] ?? '';
if (!$key || ($_GET['key'] ?? '') !== $key) bail(403, 'Missing or wrong key.');

$saJson = $cfg['google_service_account_json'] ?? '';
if (!$saJson) bail(503, 'Reminders need the same Google service account as Calendar sync — see config.example.php.');

$PROJECT_ID = $cfg['firebase_project_id'] ?? 'schalmont-pto';
$BASE = "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents";

/* ---------- 1. Trade the service account key for a Firestore-scoped token ---------- */
function google_access_token($saJson, $scope) {
  $sa = json_decode($saJson, true);
  if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) return null;
  $now = time();
  $b64 = function ($d) {
    $s = is_string($d) ? $d : json_encode($d);
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
  };
  $unsigned = $b64(['alg' => 'RS256', 'typ' => 'JWT']) . '.' . $b64([
    'iss' => $sa['client_email'], 'scope' => $scope,
    'aud' => 'https://oauth2.googleapis.com/token',
    'iat' => $now, 'exp' => $now + 3300,
  ]);
  $ok = openssl_sign($unsigned, $signature, $sa['private_key'], 'sha256WithRSAEncryption');
  if (!$ok) return null;
  $jwt = $unsigned . '.' . $b64($signature);
  $ch = curl_init('https://oauth2.googleapis.com/token');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 20,
    CURLOPT_POSTFIELDS => http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]),
  ]);
  $res = curl_exec($ch);
  curl_close($ch);
  $data = json_decode((string)$res, true);
  return is_array($data) ? ($data['access_token'] ?? null) : null;
}

$token = google_access_token($saJson, 'https://www.googleapis.com/auth/datastore');
if (!$token) bail(502, 'Could not authenticate with Firestore — check the service account key and its Cloud Datastore User role.');

function fsAuthed($method, $url, $token, $payload = null) {
  $ch = curl_init($url);
  $headers = ['Authorization: Bearer ' . $token, 'Content-Type: application/json'];
  $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers];
  if ($payload !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($payload);
  curl_setopt_array($ch, $opts);
  $res = curl_exec($ch);
  curl_close($ch);
  return json_decode((string)$res, true);
}
function fsVal($doc, $field, $default = '') {
  $f = $doc['fields'][$field] ?? null;
  if ($f === null) return $default;
  if (isset($f['stringValue'])) return $f['stringValue'];
  if (isset($f['integerValue'])) return (int)$f['integerValue'];
  if (isset($f['booleanValue'])) return $f['booleanValue'];
  return $default;
}
function docId($doc) { $parts = explode('/', $doc['name']); return end($parts); }
// The sheet's own doc id is the second-to-last segment of an entries/slots doc path
// (.../signups/{sheetId}/entries/{entryId}).
function parentSheetId($doc) { $parts = explode('/', $doc['name']); return $parts[count($parts) - 3]; }

/* ---------- 2. Find every slot happening in +3 days, or later today ---------- */
function queryByDate($base, $token, $dateStr) {
  $result = fsAuthed('POST', "$base:runQuery", $token, [
    'structuredQuery' => [
      'from' => [['collectionId' => 'slots', 'allDescendants' => true]],
      'where' => ['fieldFilter' => ['field' => ['fieldPath' => 'date'], 'op' => 'EQUAL', 'value' => ['stringValue' => $dateStr]]],
    ],
  ]);
  $out = [];
  foreach ((array)$result as $row) { if (!empty($row['document'])) $out[] = $row['document']; }
  return $out;
}

$tz = new DateTimeZone('America/New_York');
$now = new DateTime('now', $tz);
$in3days = (clone $now)->modify('+3 days')->format('Y-m-d');
$today = $now->format('Y-m-d');

$slots3d = queryByDate($BASE, $token, $in3days);
$slotsToday = queryByDate($BASE, $token, $today);

$sheetCache = [];
function getSheet($base, $token, $sheetId, &$cache) {
  if (!isset($cache[$sheetId])) $cache[$sheetId] = fsAuthed('GET', "$base/signups/$sheetId", $token);
  return $cache[$sheetId];
}

$sent3d = 0; $sent2h = 0; $checked = 0;

function sendReminder($base, $token, $sheetId, $sheet, $slot, $field, $subjectPrefix) {
  global $sent3d, $sent2h, $checked;
  $slotId = docId($slot);
  $sheetTitle = fsVal($sheet, 'title', 'Sign-Up Sheet');
  // Scoped to this one sheet's "entries" subcollection by POSTing to its own
  // :runQuery URL -- a structuredQuery has no field for that, it's the URL itself.
  $entriesRes = fsAuthed('POST', "$base/signups/$sheetId:runQuery", $token, [
    'structuredQuery' => [
      'from' => [['collectionId' => 'entries']],
      'where' => ['fieldFilter' => ['field' => ['fieldPath' => 'slotId'], 'op' => 'EQUAL', 'value' => ['stringValue' => $slotId]]],
    ],
  ]);
  foreach ((array)$entriesRes as $row) {
    if (empty($row['document'])) continue;
    $entry = $row['document'];
    $checked++;
    if (fsVal($entry, 'cancelled', false)) continue;
    if (fsVal($entry, $field, false)) continue;   // already sent this stage
    $entryId = docId($entry);
    $contact = fsAuthed('GET', "$base/signups/$sheetId/contacts/$entryId", $token);
    $email = $contact ? fsVal($contact, 'email', '') : '';
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
    $name = fsVal($entry, 'name', 'there');
    $when = trim(implode(' · ', array_filter([fsVal($slot, 'label', ''), fsVal($slot, 'date', ''), fsVal($slot, 'start', '')])));
    $msg = "Hi $name,\n\nA reminder about \"$sheetTitle\"" . ($when ? ", $when" : '') . ".\n\n— Schalmont PTO";
    $headers = "From: Schalmont PTO Sign-Ups <noreply@schalmontpto.com>\r\nContent-Type: text/plain; charset=UTF-8";
    if (@mail($email, "$subjectPrefix: $sheetTitle", $msg, $headers)) {
      if ($field === 'reminder3dSent') $sent3d++; else $sent2h++;
    }
    // Mark sent regardless of mail() success -- a host-level mail hiccup shouldn't
    // cause the same reminder to be retried (and potentially land) hours later,
    // confusingly out of context.
    fsAuthed('PATCH', "$base/signups/$sheetId/entries/$entryId?updateMask.fieldPaths=$field", $token,
      ['fields' => [$field => ['booleanValue' => true]]]);
  }
}

foreach ($slots3d as $slot) {
  $sheetId = parentSheetId($slot);
  $sheet = getSheet($BASE, $token, $sheetId, $sheetCache);
  if ($sheet) sendReminder($BASE, $token, $sheetId, $sheet, $slot, 'reminder3dSent', 'Reminder (in 3 days)');
}

foreach ($slotsToday as $slot) {
  $start = fsVal($slot, 'start', '');
  if (!preg_match('/^\d{2}:\d{2}$/', $start)) continue;   // no time on this slot -- can't do a "2 hours before"
  $slotDateTime = DateTime::createFromFormat('Y-m-d H:i', $today . ' ' . $start, $tz);
  if (!$slotDateTime) continue;
  $minsUntil = ($slotDateTime->getTimestamp() - $now->getTimestamp()) / 60;
  // Window matches how often this is expected to run (every 15-30 min) so a slot
  // starting at, say, 2:00pm gets exactly one "2 hours before" email around noon.
  if ($minsUntil < 105 || $minsUntil > 135) continue;
  $sheetId = parentSheetId($slot);
  $sheet = getSheet($BASE, $token, $sheetId, $sheetCache);
  if ($sheet) sendReminder($BASE, $token, $sheetId, $sheet, $slot, 'reminder2hSent', 'Reminder (starting soon)');
}

echo json_encode(['ok' => true, 'slots3d' => count($slots3d), 'slotsToday' => count($slotsToday), 'entriesChecked' => $checked, 'sent3d' => $sent3d, 'sent2h' => $sent2h]);
