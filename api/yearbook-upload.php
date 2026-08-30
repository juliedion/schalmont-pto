<?php
/* ============================================================
   Yearbook photo upload — receives photos from the public
   submission form and saves them on this server under
   /uploads/yearbook/<school>/<event>/ . Returns the saved
   file paths as JSON. A PTO admin reviews them afterward in
   the back office before they count toward the yearbook.
   No configuration needed.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
function fail($msg) { out(400, ['ok' => false, 'error' => $msg]); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

/* ---- limits ---- */
$SCHOOLS   = ['woestina', 'jefferson', 'middle', 'high', 'pto'];
$MAX_FILES = 12;
$MAX_BYTES = 12 * 1024 * 1024;                 // 12 MB per photo
$EXT_OK    = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
$RATE_MAX  = 80;                                // photos per hour per IP

/* ---- read + sanitize fields ---- */
$school   = $_POST['school']      ?? '';
$event    = strtolower(preg_replace('/[^a-z0-9-]/i', '', $_POST['event'] ?? ''));
$evLabel  = trim(strip_tags($_POST['eventLabel']   ?? ''));
$uploader = trim(strip_tags($_POST['uploaderName'] ?? ''));
$email    = trim(strip_tags($_POST['uploaderEmail'] ?? ''));
$people   = trim(strip_tags($_POST['people']       ?? ''));

if (!in_array($school, $SCHOOLS, true)) fail('Please choose a school.');
if ($event === '' || strlen($event) > 60) fail('Please choose an event folder.');
if ($uploader === '' || strlen($uploader) > 80) fail('Please enter your name.');
$evLabel  = mb_substr($evLabel, 0, 80);
$email    = mb_substr($email, 0, 120);
$people   = mb_substr($people, 0, 400);

if (empty($_FILES['photos'])) fail('Please choose at least one photo.');

/* Normalize $_FILES['photos'] (single or multiple) into a list */
$in = $_FILES['photos'];
$files = [];
if (is_array($in['name'])) {
  for ($i = 0; $i < count($in['name']); $i++) {
    if (($in['error'][$i] ?? 4) === 4) continue;
    $files[] = ['name' => $in['name'][$i], 'tmp' => $in['tmp_name'][$i],
                'err' => $in['error'][$i], 'size' => $in['size'][$i]];
  }
} else {
  $files[] = ['name' => $in['name'], 'tmp' => $in['tmp_name'],
              'err' => $in['error'], 'size' => $in['size']];
}
if (!$files) fail('Please choose at least one photo.');
if (count($files) > $MAX_FILES) fail("Please upload at most $MAX_FILES photos at a time.");

/* ---- simple per-IP hourly rate limit ---- */
$baseDir = __DIR__ . '/../uploads/yearbook';
@mkdir($baseDir . '/.rate', 0755, true);
$ip = preg_replace('/[^a-f0-9.:]/i', '_', $_SERVER['REMOTE_ADDR'] ?? 'x');
$rateFile = $baseDir . '/.rate/' . md5($ip) . '.json';
$hour = date('Y-m-d-H');
$rate = ['hour' => $hour, 'count' => 0];
if (file_exists($rateFile)) {
  $r = json_decode(file_get_contents($rateFile), true);
  if (is_array($r) && ($r['hour'] ?? '') === $hour) $rate = $r;
}
if ($rate['count'] + count($files) > $RATE_MAX) {
  out(429, ['ok' => false, 'error' => 'Too many uploads from this connection right now. Please try again later.']);
}

/* ---- save each file ---- */
$destDir = "$baseDir/$school/$event";
if (!is_dir($destDir) && !@mkdir($destDir, 0755, true)) {
  out(500, ['ok' => false, 'error' => 'Server could not create the upload folder. Ask the site owner to check /uploads permissions.']);
}

$saved = [];
foreach ($files as $f) {
  if ($f['err'] !== UPLOAD_ERR_OK) fail('One of the files did not upload correctly. Try again.');
  if ($f['size'] > $MAX_BYTES)     fail('Each photo must be under 12 MB. Please resize and retry.');
  if (!is_uploaded_file($f['tmp'])) fail('Upload error.');

  $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
  if (!in_array($ext, $EXT_OK, true)) fail('Only photo files are allowed (JPG, PNG, WEBP, GIF, HEIC).');

  // For common formats, confirm it is really an image
  if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
    $info = @getimagesize($f['tmp']);
    if ($info === false) fail('One file is not a valid image.');
  }

  $fname = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
  if (!move_uploaded_file($f['tmp'], "$destDir/$fname")) {
    out(500, ['ok' => false, 'error' => 'Server could not save a file.']);
  }
  @chmod("$destDir/$fname", 0644);
  $saved[] = ['url' => "/uploads/yearbook/$school/$event/$fname", 'original' => $f['name']];
}

/* ---- bump rate counter ---- */
$rate['count'] += count($saved);
@file_put_contents($rateFile, json_encode($rate), LOCK_EX);

/* ---- write a metadata sidecar (backup copy of the submission) ---- */
$batchId = date('Ymd-His') . '-' . bin2hex(random_bytes(4));
@mkdir("$destDir/.meta", 0755, true);
@file_put_contents("$destDir/.meta/$batchId.json", json_encode([
  'batchId' => $batchId, 'school' => $school, 'event' => $event, 'eventLabel' => $evLabel,
  'uploaderName' => $uploader, 'uploaderEmail' => $email, 'people' => $people,
  'photos' => $saved, 'submittedAt' => date('c'), 'ip' => $ip,
], JSON_PRETTY_PRINT), LOCK_EX);

out(200, ['ok' => true, 'batchId' => $batchId, 'files' => $saved]);
