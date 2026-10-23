<?php
/* ============================================================
   Yearbook photo upload — receives photos from the public
   submission form and saves them on this server under
   /uploads/yearbook/<school>/<event>/ . Returns the saved
   file paths as JSON. A PTO admin reviews them afterward in
   the back office before they count toward the yearbook.
   No configuration needed. The yearbook pages' form (js/yearbook-form.js) sends one
   photo per request with a shared batchId, so a big submission never hits the
   server's upload limit; event is optional there ("unsorted").
   If 'yearbook_drive_url' is set in config.php, each photo is also sent to the PTO's
   Google Drive (tools/yearbook-drive-script.gs files it by school / year / event).
   The copy here stays either way, so a Drive hiccup never loses a photo.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
function fail($msg) { out(400, ['ok' => false, 'error' => $msg]); }
require __DIR__ . '/_yearbook_drive.php';


if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

/* ---- limits ---- */
$SCHOOLS   = ['woestina', 'jefferson', 'middle', 'high', 'pto'];
$MAX_FILES = 12;
$MAX_BYTES = 20 * 1024 * 1024;                 // 20 MB per photo (see api/.user.ini)
$EXT_OK    = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
$RATE_MAX  = 80;                                // photos per hour per IP

/* ---- read + sanitize fields ---- */
$school   = $_POST['school']      ?? '';
$event    = strtolower(preg_replace('/[^a-z0-9-]/i', '', $_POST['event'] ?? ''));
$evLabel  = trim(strip_tags($_POST['eventLabel']   ?? ''));
$uploader = trim(strip_tags($_POST['uploaderName'] ?? ''));
$email    = trim(strip_tags($_POST['uploaderEmail'] ?? ''));
$people   = trim(strip_tags($_POST['people']       ?? ''));
$students = trim(strip_tags($_POST['students']     ?? ''));
$grades   = trim(strip_tags($_POST['grades']       ?? ''));
$batchIn  = preg_replace('/[^a-z0-9-]/i', '', $_POST['batchId'] ?? '');
$evFolder = trim(strip_tags($_POST['eventFolder'] ?? ''));   // a Drive event folder name picked on the form
$evSchool = $_POST['eventSchool'] ?? '';                       // ...and the school it belongs to
$schools  = array_values(array_unique(array_filter(explode(',', (string)($_POST['schools'] ?? '')))));
if ($event === '') $event = 'unsorted';

if (!in_array($school, $SCHOOLS, true)) fail('Please choose a school.');
// A photo of students from several schools goes to each of those schools in Drive.
$schools = array_values(array_filter($schools, function ($s) use ($SCHOOLS) { return in_array($s, $SCHOOLS, true); }));
if (!in_array($school, $schools, true)) array_unshift($schools, $school);
$evFolder = mb_substr($evFolder, 0, 120);
if (strlen($event) > 60) fail('Please choose an event folder.');
if ($uploader === '' || strlen($uploader) > 80) fail('Please enter your name.');
$evLabel  = mb_substr($evLabel, 0, 80);
$email    = mb_substr($email, 0, 120);
$people   = mb_substr($people, 0, 400);
$students = mb_substr($students, 0, 600);
$grades   = mb_substr($grades, 0, 120);

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
  if ($f['size'] > $MAX_BYTES)     fail('Each photo must be under 20 MB.');
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
  $saved[] = ['url' => "/uploads/yearbook/$school/$event/$fname", 'original' => $f['name'], 'path' => "$destDir/$fname", 'ext' => $ext];
}

/* ---- queue the copies to Google Drive, one per school in the photo ----
   Not done in this request: copying a big phone photo to Drive takes 20-40 seconds and
   the host holds the reply until a request finishes. The form pings
   api/yearbook-drive.php afterwards, which works through the queue (and retries).
   File name: "Students (grades) - who sent it - time.ext", so it sorts and reads well in Drive. */
$cfg = @include __DIR__ . '/config.php';
if (!is_array($cfg)) $cfg = [];
$who = $students !== '' ? $students : $people;
$jobs = [];   // [index, saved path, fields]
foreach ($saved as $i => $sv) {
  // The form already puts each student's grade in the names; older submissions send grades separately.
  $nice = trim(mb_substr($who, 0, 110) . ($grades !== '' && strpos($who, '(') === false ? " ($grades)" : '') . ' - ' . $uploader);
  foreach ($schools as $sc) {
    $jobs[] = [$i, $sv['path'], [
      'school' => $sc, 'eventLabel' => $evLabel, 'eventFolder' => ($sc === $evSchool ? $evFolder : ''),
      'students' => $who, 'grades' => $grades,
      'uploaderName' => $uploader, 'uploaderEmail' => $email, 'original' => $sv['original'], 'batchId' => $batchIn,
      'filename' => $nice . ' - ' . date('Ymd-His') . '-' . substr(md5($sv['url']), 0, 4) . '.' . ($sv['ext'] === 'jpeg' ? 'jpg' : $sv['ext']),
    ]];
  }
  unset($saved[$i]['path'], $saved[$i]['ext']);
}
$saved = array_values($saved);

/* ---- bump rate counter ---- */
$rate['count'] += count($saved);
@file_put_contents($rateFile, json_encode($rate), LOCK_EX);

/* ---- write a metadata sidecar (backup copy of the submission) ----
   A batchId from the form groups one-photo-per-request uploads into one record. */
$batchId = ($batchIn !== '' && strlen($batchIn) <= 40) ? $batchIn : date('Ymd-His') . '-' . bin2hex(random_bytes(4));
@mkdir("$destDir/.meta", 0755, true);
$metaFile = "$destDir/.meta/$batchId.json";
$prev = file_exists($metaFile) ? json_decode(file_get_contents($metaFile), true) : null;
@file_put_contents($metaFile, json_encode([
  'batchId' => $batchId, 'school' => $school, 'event' => $event, 'eventLabel' => $evLabel,
  'uploaderName' => $uploader, 'uploaderEmail' => $email, 'people' => $people,
  'students' => $students, 'grades' => $grades,
  'photos' => array_merge(is_array($prev['photos'] ?? null) ? $prev['photos'] : [], $saved),
  'submittedAt' => $prev['submittedAt'] ?? date('c'), 'ip' => $ip,
], JSON_PRETTY_PRINT), LOCK_EX);

/* ---- put the Drive copies in the queue (uploads/yearbook/.queue, .json = not web-readable) ---- */
if ($jobs && !empty($cfg['yearbook_drive_url'])) {
  @mkdir("$baseDir/.queue", 0755, true);
  foreach ($jobs as [$i, $path, $fields]) {
    @file_put_contents("$baseDir/.queue/" . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json',
      json_encode(['path' => $path, 'meta' => $metaFile, 'fields' => $fields, 'tries' => 0]), LOCK_EX);
  }
}

out(200, ['ok' => true, 'batchId' => $batchId, 'files' => $saved, 'drive' => $jobs ? 'queued' : 'off']);
