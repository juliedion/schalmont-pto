<?php
/* ============================================================
   8th Grade Dance — "Share your Sabre's Story" form (8thgradedance.html #photos).
   Each request carries ONE photo (or just the story), with a shared batchId.
   Saved here under /uploads/dance8/<student>/ and queued for the PTO's Google Drive
   (same queue + Apps Script as the yearbook photos: tools/yearbook-drive-script.gs),
   where each student gets a folder:  <top folder> / 8th Grade Dance 2027 / <Last, First> /
   The family message + optional fun facts (nickname, favorite food/place, superhero, favorite
   memories) go into that folder as "Sabre's Story from <family>.txt".
   After the last upload the page sends action=finish: the parent gets a thank-you email with
   a private link to view/edit their answers (sabres-story.html, api/dance-story.php).
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/lib-dance.php';

// all-lowercase or ALL-CAPS gets capitalized; anything else (DiSanto, McDaniel, O'Brien) is kept as typed.
function title_name($s) { return ($s === mb_strtolower($s) || $s === mb_strtoupper($s)) ? mb_convert_case(mb_strtolower($s), MB_CASE_TITLE, 'UTF-8') : $s; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') d_out(405, ['ok' => false, 'error' => 'POST only']);
$RATE_MAX = 120;   // requests per hour per IP
$baseDir = d_base();

/* ---- finish: thank-you email with the private view/edit link (once per submission) ---- */
if (($_POST['action'] ?? '') === 'finish') {
  $slug = (string)($_POST['slug'] ?? ''); $batch = (string)($_POST['batchId'] ?? '');
  if (!preg_match('/^[a-z0-9-]{1,90}$/', $slug) || !preg_match('/^[A-Za-z0-9-]{1,40}$/', $batch)) d_fail('Missing submission.');
  $metaFile = "$baseDir/$slug/.meta/$batch.json";
  $m = d_meta_read($metaFile);
  if (!$m) d_fail('Missing submission.');
  $link = d_story_url($slug, $batch);
  $sent = !empty($m['emailedAt']);
  if (!$sent && filter_var($m['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
    $student = $m['student'] ?? 'your 8th grader';
    $n = count((array)($m['photos'] ?? []));
    $hasStory = ($m['message'] ?? '') !== '' || !empty($m['funFacts']) || !empty($m['memories']);
    $what = trim(($n ? "$n photo" . ($n === 1 ? '' : 's') : '') . ($n && $hasStory ? ' and ' : '') . ($hasStory ? "your Sabre's Story" : ''));
    $body = implode("\n", [
      'Hi ' . ($m['familyName'] ?? '') . ',',
      '',
      "Thank you for sharing $student's Sabre's Story with the 8th Grade Dance Team Leadership! We received $what for the 8th Grade Dance: A Night Under the Stars.",
      'Your photos and story will be part of the slideshow at the dance and at graduation.',
      '',
      'To view or edit your answers, or add more photos, use your private link:',
      $link,
      '',
      'Please keep this link to yourself: anyone with it can see and change your answers.',
      '',
      'The dance is Saturday, June 12, 2027, 6:00 to 9:00 PM in the Schalmont Middle School Gymnasium.',
      'Questions? Reply to this email or write to julie@schalmontpto.com.',
      '',
      '— 8th Grade Dance Team Leadership',
      'https://schalmontpto.com/8thgradedance',
    ]);
    $headers = "From: 8th Grade Dance Team Leadership <noreply@schalmontpto.com>\r\nReply-To: julie@schalmontpto.com\r\nContent-Type: text/plain; charset=UTF-8";
    $subject = '=?UTF-8?B?' . base64_encode("Thank you for sharing $student's Sabre's Story") . '?=';
    $sent = @mail($m['email'], $subject, $body, $headers);
    if ($sent) d_meta_merge($metaFile, ['emailedAt' => date('c')]);
  }
  d_out(200, ['ok' => true, 'link' => $link, 'emailed' => (bool)$sent, 'email' => $m['email'] ?? '']);
}

/* ---- fields ---- */
$first  = title_name(d_clean($_POST['studentFirst'] ?? '', 40));
$last   = title_name(d_clean($_POST['studentLast']  ?? '', 40));
$family = d_clean($_POST['familyName'] ?? '', 80);
$email  = d_clean($_POST['email'] ?? '', 120);
[$message, $facts, $memories] = d_answers($_POST);
$shirt = d_shirt($_POST);
$hasStory = $message !== '' || $facts || $memories || $shirt !== '';
$batchIn = preg_replace('/[^a-z0-9-]/i', '', $_POST['batchId'] ?? '');
$batchId = ($batchIn !== '' && strlen($batchIn) <= 40) ? $batchIn : date('Ymd-His') . '-' . bin2hex(random_bytes(4));

// A folder picked from the search can have a name that isn't "Last, First" (e.g. "Schalmont PTO Test Folder").
$pickedFolder = d_clean($_POST['folder'] ?? '', 120);
if ($pickedFolder !== '' && strpos($pickedFolder, ',') === false) { $first = ''; $last = $pickedFolder; }
else $pickedFolder = '';
if ($last === '' || ($first === '' && $pickedFolder === '')) d_fail("Please enter your 8th grader's first and last name.");
if ($family === '') d_fail('Please enter the parent/guardian name.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) d_fail('Please enter a valid email address.');
if (($_POST['certify'] ?? '') !== '1') d_fail("Please confirm you are this student's parent or guardian.");
$hasPhoto = !empty($_FILES['photo']) && ($_FILES['photo']['error'] ?? 4) !== 4;
if (!$hasPhoto && !$hasStory) d_fail('Please add at least one photo, a message, a fun fact or a shirt size.');

/* ---- per-IP hourly rate limit ---- */
@mkdir("$baseDir/.rate", 0755, true);
$ip = preg_replace('/[^a-f0-9.:]/i', '_', $_SERVER['REMOTE_ADDR'] ?? 'x');
$rateFile = "$baseDir/.rate/" . md5($ip) . '.json';
$hour = date('Y-m-d-H'); $rate = ['hour' => $hour, 'count' => 0];
if (is_file($rateFile)) { $r = json_decode((string)file_get_contents($rateFile), true); if (is_array($r) && ($r['hour'] ?? '') === $hour) $rate = $r; }
if ($rate['count'] >= $RATE_MAX) d_out(429, ['ok' => false, 'error' => 'Too many uploads from this connection right now. Please try again later.']);
$rate['count']++; @file_put_contents($rateFile, json_encode($rate), LOCK_EX);

/* ---- the student's folder ---- */
$student = $pickedFolder !== '' ? $pickedFolder : "$first $last";
$folderName = $pickedFolder !== '' ? $pickedFolder : "$last, $first";   // Drive folders are "Last, First" (Julie, Nov 2026)
$slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', "$last-$first"), '-')) ?: 'student';
$destDir = "$baseDir/$slug";
if (!is_dir($destDir) && !@mkdir($destDir, 0755, true)) d_out(500, ['ok' => false, 'error' => 'Server could not create the upload folder.']);
@mkdir("$destDir/.meta", 0755, true);

/* ---- the submission record (merged, so the Drive links noted by the queue aren't lost) ---- */
$metaFile = "$destDir/.meta/$batchId.json";
$prev = d_meta_read($metaFile);
$m = d_meta_merge($metaFile, [
  'batchId' => $batchId, 'student' => $student, 'folder' => $folderName, 'slug' => $slug,
  'familyName' => $family, 'email' => $email,
  'message' => $message !== '' ? $message : ($prev['message'] ?? ''),
  'funFacts' => $facts ?: ($prev['funFacts'] ?? new stdClass()),
  'memories' => $memories ?: ($prev['memories'] ?? []),
  'shirtSize' => $shirt !== '' ? $shirt : ($prev['shirtSize'] ?? ''),
  'photos' => $prev['photos'] ?? [],
  'certifiedParentOrGuardian' => true,
  'submittedAt' => $prev['submittedAt'] ?? date('c'), 'ip' => $ip,
]);

$jobs = [];
/* ---- the photo ---- */
$saved = null;
if ($hasPhoto) {
  [$saved, $job] = d_save_photo($_FILES['photo'], $destDir, $m);
  $jobs[] = $job;
  $m = d_meta_merge($metaFile, ['photos' => array_values(array_merge((array)($m['photos'] ?? []), [$saved]))]);
}
/* ---- the story (once per submission; later changes come from the view/edit link) ---- */
if ($hasStory && !is_file("$destDir/.meta/$batchId-message.json")) $jobs[] = d_story_job($destDir, $m);

d_queue($jobs, $metaFile);
d_out(200, ['ok' => true, 'batchId' => $batchId, 'slug' => $slug, 'student' => $student, 'photo' => $saved !== null,
  'drive' => (!empty(d_cfg()['yearbook_drive_url']) ? 'queued' : 'off')]);
