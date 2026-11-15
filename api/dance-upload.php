<?php
/* ============================================================
   8th Grade Dance photos — families share photos of their 8th grader, plus an
   optional message from the family (8thgradedance.html, "Share photos" form).
   Each request carries ONE photo (or just the message), with a shared batchId.
   Saved here under /uploads/dance8/<student>/ and queued for the PTO's Google Drive
   (same queue + Apps Script as the yearbook photos: tools/yearbook-drive-script.gs),
   where each student gets a folder:  <top folder> / 8th Grade Dance 2027 / <First Last> /
   The family message + optional fun facts (nickname, favorite food/place, superhero, favorite
   memories) go into that folder as "Sabre's Story from <family>.txt".
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
function fail($msg) { out(400, ['ok' => false, 'error' => $msg]); }
function clean($s, $max) { return mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string)$s))), 0, $max); }
function title_name($s) { return mb_convert_case(mb_strtolower($s), MB_CASE_TITLE, 'UTF-8'); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

$DRIVE_TOP = '8th Grade Dance 2027';
$MAX_BYTES = 20 * 1024 * 1024;                 // 20 MB per photo (see api/.user.ini)
$EXT_OK    = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
$RATE_MAX  = 120;                               // requests per hour per IP

/* ---- fields ---- */
$first   = title_name(clean($_POST['studentFirst'] ?? '', 40));
$last    = title_name(clean($_POST['studentLast']  ?? '', 40));
$family  = clean($_POST['familyName'] ?? '', 80);
$email   = clean($_POST['email'] ?? '', 120);
$message = mb_substr(trim(strip_tags((string)($_POST['message'] ?? ''))), 0, 2000);
// Sabre's Story fun facts (all optional)
$facts = [];
foreach (['nickname' => 'Special nickname', 'food' => 'Favorite food', 'place' => 'Favorite place to be', 'hero' => 'If they were a superhero'] as $k => $label) {
  $v = clean($_POST[$k] ?? '', 150);
  if ($v !== '') $facts[$label] = $v;
}
$memories = [];
foreach ((array)($_POST['memories'] ?? []) as $m) {
  $m = mb_substr(trim(strip_tags((string)$m)), 0, 1000);
  if ($m !== '' && count($memories) < 10) $memories[] = $m;
}
$hasStory = $message !== '' || $facts || $memories;
$batchIn = preg_replace('/[^a-z0-9-]/i', '', $_POST['batchId'] ?? '');
$batchId = ($batchIn !== '' && strlen($batchIn) <= 40) ? $batchIn : date('Ymd-His') . '-' . bin2hex(random_bytes(4));

if ($first === '' || $last === '') fail("Please enter your 8th grader's first and last name.");
if ($family === '') fail('Please enter your name.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.');
$hasPhoto = !empty($_FILES['photo']) && ($_FILES['photo']['error'] ?? 4) !== 4;
if (!$hasPhoto && !$hasStory) fail('Please add at least one photo, a message or a fun fact.');

/* ---- per-IP hourly rate limit ---- */
$baseDir = __DIR__ . '/../uploads/dance8';
@mkdir("$baseDir/.rate", 0755, true);
$ip = preg_replace('/[^a-f0-9.:]/i', '_', $_SERVER['REMOTE_ADDR'] ?? 'x');
$rateFile = "$baseDir/.rate/" . md5($ip) . '.json';
$hour = date('Y-m-d-H'); $rate = ['hour' => $hour, 'count' => 0];
if (is_file($rateFile)) { $r = json_decode((string)file_get_contents($rateFile), true); if (is_array($r) && ($r['hour'] ?? '') === $hour) $rate = $r; }
if ($rate['count'] >= $RATE_MAX) out(429, ['ok' => false, 'error' => 'Too many uploads from this connection right now. Please try again later.']);
$rate['count']++; @file_put_contents($rateFile, json_encode($rate), LOCK_EX);

/* ---- the student's folder ---- */
$student = "$first $last";
$slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', "$last-$first"), '-')) ?: 'student';
$destDir = "$baseDir/$slug";
if (!is_dir($destDir) && !@mkdir($destDir, 0755, true)) out(500, ['ok' => false, 'error' => 'Server could not create the upload folder.']);
@mkdir("$destDir/.meta", 0755, true);

$cfg = @include __DIR__ . '/config.php';
if (!is_array($cfg)) $cfg = [];
$jobs = [];
$common = [
  'folderPath' => [$DRIVE_TOP, $student],
  // Fallback for an Apps Script that hasn't been updated yet: lands in <top>/Other/<student>.
  'school' => 'dance8', 'eventFolder' => $student, 'eventLabel' => "8th Grade Dance - $student",
  'students' => $student, 'grades' => '8th grade',
  'uploaderName' => $family, 'uploaderEmail' => $email, 'batchId' => $batchId,
];
$safeFamily = trim(preg_replace('/[\/\\\\:*?"<>|]+/', ' ', $family));

/* ---- the photo ---- */
$saved = null;
if ($hasPhoto) {
  $f = $_FILES['photo'];
  if (($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('The photo did not upload correctly. Try again.');
  if ($f['size'] > $MAX_BYTES) fail('Each photo must be under 20 MB.');
  if (!is_uploaded_file($f['tmp_name'])) fail('Upload error.');
  $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
  if (!in_array($ext, $EXT_OK, true)) fail('Only photo files are allowed (JPG, PNG, WEBP, GIF, HEIC).');
  if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) && @getimagesize($f['tmp_name']) === false) fail('That file is not a valid image.');
  $ext = $ext === 'jpeg' ? 'jpg' : $ext;
  $fname = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . ".$ext";
  if (!move_uploaded_file($f['tmp_name'], "$destDir/$fname")) out(500, ['ok' => false, 'error' => 'Server could not save the photo.']);
  @chmod("$destDir/$fname", 0644);
  $saved = $fname;
  $jobs[] = ["$destDir/$fname", $common + [
    'original' => clean($f['name'], 120),
    'filename' => "$student - from $safeFamily - " . date('Ymd-His') . '-' . substr(md5($fname), 0, 4) . ".$ext",
  ]];
}

/* ---- the family message (once per submission) ----
   Kept as .json on the server (uploads/.htaccess keeps .json private); sent to Drive as a .txt. */
$msgFile = "$destDir/.meta/$batchId-message.json";
if ($hasStory && !is_file($msgFile)) {
  $txt = "SABRE'S STORY\nFor: $student\nFrom: $family <$email>\nSent: " . date('F j, Y g:i A') . "\n";
  if ($message !== '') $txt .= "\nMESSAGE FROM FAMILY AND/OR FRIENDS\n" . $message . "\n";
  if ($facts) { $txt .= "\nFUN FACTS\n"; foreach ($facts as $label => $v) $txt .= "$label: $v\n"; }
  if ($memories) { $txt .= "\nFAVORITE MEMORIES\n"; foreach ($memories as $i => $m) $txt .= ($i + 1) . ". $m\n"; }
  @file_put_contents($msgFile, $txt, LOCK_EX);
  $jobs[] = [$msgFile, $common + [
    'mimeType' => 'text/plain', 'original' => 'family message',
    'filename' => "Sabre's Story from $safeFamily - " . date('Ymd-His') . '.txt',
  ]];
}

/* ---- backup record of the submission ---- */
$metaFile = "$destDir/.meta/$batchId.json";
$prev = is_file($metaFile) ? (json_decode((string)file_get_contents($metaFile), true) ?: []) : [];
@file_put_contents($metaFile, json_encode([
  'batchId' => $batchId, 'student' => $student, 'familyName' => $family, 'email' => $email,
  'message' => $message !== '' ? $message : ($prev['message'] ?? ''),
  'funFacts' => $facts ?: ($prev['funFacts'] ?? new stdClass()),
  'memories' => $memories ?: ($prev['memories'] ?? []),
  'photos' => array_values(array_filter(array_merge($prev['photos'] ?? [], [$saved]))),
  'submittedAt' => $prev['submittedAt'] ?? date('c'), 'ip' => $ip,
], JSON_PRETTY_PRINT), LOCK_EX);

/* ---- queue the Drive copies (shared queue, sent by api/yearbook-drive.php) ---- */
if ($jobs && !empty($cfg['yearbook_drive_url'])) {
  $q = __DIR__ . '/../uploads/yearbook/.queue';
  @mkdir($q, 0755, true);
  foreach ($jobs as [$path, $fields]) {
    @file_put_contents("$q/" . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json',
      json_encode(['path' => $path, 'meta' => $metaFile, 'fields' => $fields, 'tries' => 0]), LOCK_EX);
  }
}

out(200, ['ok' => true, 'batchId' => $batchId, 'student' => $student, 'photo' => $saved !== null, 'drive' => (!empty($cfg['yearbook_drive_url']) ? 'queued' : 'off')]);
