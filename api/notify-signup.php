<?php
/* ============================================================
   Schalmont PTO — email the people watching a sign-up sheet
   whenever someone new signs up.
   ------------------------------------------------------------
   Called (best-effort, fire-and-forget) from signup.html and
   js/signup-embed.js right after a sign-up transaction commits.
   Takes only a sheet id + entry id -- everything else (who to
   notify, what slot, who signed up) is looked up here from
   Firestore's public REST API, so nobody can make this endpoint
   email an address of their choosing by hand-crafting a request.

   Uses PHP's built-in mail() -- no account or API key needed, but
   delivery isn't guaranteed the way a real transactional-email
   service is (it can land in spam). Failures here never affect
   the sign-up itself, which has already been saved by the time
   this runs.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function bail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') bail(405, 'POST only');

$body = json_decode(file_get_contents('php://input'), true);
$sheetId = trim($body['sheetId'] ?? '');
$entryId = trim($body['entryId'] ?? '');
if (!preg_match('/^[A-Za-z0-9_-]{10,40}$/', $sheetId) || !preg_match('/^[A-Za-z0-9_-]{10,40}$/', $entryId)) {
  bail(400, 'Malformed request.');
}

$PROJECT_ID = 'schalmont-pto';
$BASE = "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents";

function fsGet($url) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code !== 200) return null;
  return json_decode($res, true);
}
// Firestore's REST documents come back as {fields: {key: {stringValue: ...}}} —
// this pulls out plain values for just the field types this endpoint reads.
function fsVal($doc, $field, $default = '') {
  $f = $doc['fields'][$field] ?? null;
  if ($f === null) return $default;
  if (isset($f['stringValue'])) return $f['stringValue'];
  if (isset($f['integerValue'])) return (int)$f['integerValue'];
  if (isset($f['booleanValue'])) return $f['booleanValue'];
  return $default;
}

$sheet = fsGet("$BASE/signups/$sheetId");
if (!$sheet) bail(404, 'Sign-up sheet not found.');
$notifyRaw = fsVal($sheet, 'notifyEmails', '');
$notifyList = array_values(array_filter(array_map('trim', explode(',', $notifyRaw)), function ($e) {
  return $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL);
}));
if (!$notifyList) { echo json_encode(['ok' => true, 'skipped' => 'no notify emails set']); exit; }

$entry = fsGet("$BASE/signups/$sheetId/entries/$entryId");
if (!$entry) bail(404, 'Sign-up entry not found.');

$slotId = fsVal($entry, 'slotId');
$slot = $slotId ? fsGet("$BASE/signups/$sheetId/slots/$slotId") : null;

$sheetTitle = fsVal($sheet, 'title', 'Sign-Up Sheet');
$signerName = fsVal($entry, 'name', '(no name)');
$item = fsVal($entry, 'item', '');
$slotLabel = $slot ? fsVal($slot, 'label', '') : '';
$slotDate = $slot ? fsVal($slot, 'date', '') : '';
$slotStart = $slot ? fsVal($slot, 'start', '') : '';

$when = trim(implode(' · ', array_filter([$slotLabel, $slotDate, $slotStart])));
$viewUrl = 'https://schalmontpto.com/admin/signups.html?id=' . urlencode($sheetId);

$subject = 'New sign-up: ' . $sheetTitle;
$lines = [
  "$signerName just signed up for \"$sheetTitle\".",
  '',
  $when ? "Slot: $when" : null,
  $item ? "Bringing: $item" : null,
  '',
  "View the full list (Back Office sign-in required): $viewUrl",
];
$msg = implode("\n", array_filter($lines, function ($l) { return $l !== null; }));

$headers = "From: Schalmont PTO Sign-Ups <noreply@schalmontpto.com>\r\n" .
           "Content-Type: text/plain; charset=UTF-8";

$sent = 0;
foreach ($notifyList as $to) {
  if (@mail($to, $subject, $msg, $headers)) $sent++;
}

echo json_encode(['ok' => true, 'notified' => $sent, 'of' => count($notifyList)]);
