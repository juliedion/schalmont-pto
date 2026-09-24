<?php
/* ============================================================
   Schalmont PTO — email on a new sign-up:
     1. a confirmation to the person who just signed up, and
     2. a notification to whoever's watching the sheet.
   ------------------------------------------------------------
   Called (best-effort, fire-and-forget) from signup.html and
   js/signup-embed.js right after a sign-up transaction commits.
   Takes a sheet id + entry id -- everything except the signer's
   own email is looked up here from Firestore's public REST API,
   so nobody can make this endpoint email an address of their
   choosing by hand-crafting a request. The signer's email is
   passed straight from the form they just filled in (their own
   contacts record is private/admin-only, so this endpoint can't
   read it back out of Firestore itself) -- worst case someone
   mistypes their own address, there's no way to target anyone
   else's.

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
$signerEmail = trim($body['signerEmail'] ?? '');
if (!preg_match('/^[A-Za-z0-9_-]{10,40}$/', $sheetId) || !preg_match('/^[A-Za-z0-9_-]{10,40}$/', $entryId)) {
  bail(400, 'Malformed request.');
}
if ($signerEmail !== '' && !filter_var($signerEmail, FILTER_VALIDATE_EMAIL)) $signerEmail = '';

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

$entry = fsGet("$BASE/signups/$sheetId/entries/$entryId");
if (!$entry) bail(404, 'Sign-up entry not found.');

$slotId = fsVal($entry, 'slotId');
$slot = $slotId ? fsGet("$BASE/signups/$sheetId/slots/$slotId") : null;

$sheetTitle = fsVal($sheet, 'title', 'Sign-Up Sheet');
$signerName = fsVal($entry, 'name', '(no name)');
$item = fsVal($entry, 'item', '');
$orgName = fsVal($sheet, 'contactName', '');
$orgEmail = fsVal($sheet, 'contactEmail', '');
$slotLabel = $slot ? fsVal($slot, 'label', '') : '';
$slotDate = $slot ? fsVal($slot, 'date', '') : '';
$slotStart = $slot ? fsVal($slot, 'start', '') : '';

$when = trim(implode(' · ', array_filter([$slotLabel, $slotDate, $slotStart])));
$headers = "From: Schalmont PTO Sign-Ups <noreply@schalmontpto.com>\r\n" .
           "Content-Type: text/plain; charset=UTF-8";

$confirmed = false;
if ($signerEmail) {
  $lines = [
    "Hi $signerName,",
    '',
    "You're confirmed for \"$sheetTitle\"" . ($when ? ", $when" : '') . '.',
    $item ? "You said you're bringing: $item" : null,
    '',
    ($orgName || $orgEmail) ? trim("Questions? Contact $orgName" . ($orgEmail ? " ($orgEmail)" : '')) : null,
    '',
    "— Schalmont PTO",
  ];
  $msg = implode("\n", array_filter($lines, function ($l) { return $l !== null; }));
  $confirmed = @mail($signerEmail, "You're signed up: $sheetTitle", $msg, $headers);
}

$notified = 0;
if ($notifyList) {
  $viewUrl = 'https://schalmontpto.com/admin/signups.html?id=' . urlencode($sheetId);
  $lines = [
    "$signerName just signed up for \"$sheetTitle\".",
    '',
    $when ? "Slot: $when" : null,
    $item ? "Bringing: $item" : null,
    '',
    "View the full list (Back Office sign-in required): $viewUrl",
  ];
  $msg = implode("\n", array_filter($lines, function ($l) { return $l !== null; }));
  foreach ($notifyList as $to) {
    if (@mail($to, 'New sign-up: ' . $sheetTitle, $msg, $headers)) $notified++;
  }
}

echo json_encode(['ok' => true, 'confirmed' => $confirmed, 'notified' => $notified, 'of' => count($notifyList)]);
