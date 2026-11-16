<?php
/* ============================================================
   8th Grade Dance — the private "view / edit your Sabre's Story" link (sabres-story.html).
   Every request carries d (student folder), b (submission id) and k (HMAC key from the
   thank-you email / thank-you message), checked by d_check_link().
     GET                 -> the answers + photos (short-lived signed photo links)
     POST action=save    -> new message / fun facts / memories; the Drive .txt is replaced
     POST action=photo   -> adds one more photo to the student's folder
     POST action=remove  -> removes one of their photos (server + Drive)
     POST action=delete  -> deletes the whole submission (photos, story, record; Drive copies trashed)
   ============================================================ */
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
require __DIR__ . '/lib-dance.php';

$in = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
$slug = (string)($in['d'] ?? ''); $batch = (string)($in['b'] ?? ''); $key = (string)($in['k'] ?? '');
if (!d_check_link($slug, $batch, $key)) d_out(403, ['ok' => false, 'error' => 'This link is not valid. Please use the link from your thank-you email.']);

$destDir = d_base() . "/$slug";
$metaFile = "$destDir/.meta/$batch.json";
$m = d_meta_read($metaFile);

function view($slug, $m) {
  return ['ok' => true, 'student' => $m['student'] ?? '', 'familyName' => $m['familyName'] ?? '', 'email' => $m['email'] ?? '',
    'submittedAt' => $m['submittedAt'] ?? '', 'updatedAt' => $m['updatedAt'] ?? '',
    'message' => $m['message'] ?? '', 'funFacts' => (object)(array)($m['funFacts'] ?? []), 'memories' => array_values((array)($m['memories'] ?? [])), 'shirtSize' => $m['shirtSize'] ?? '', 'shirtSizes' => DANCE_SHIRTS,
    'factLabels' => DANCE_FACTS, 'photos' => d_photo_list($slug, $m)];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') d_out(200, view($slug, $m));

$action = (string)($_POST['action'] ?? '');
if ($action === 'save') {
  [$message, $facts, $memories] = d_answers($_POST);
  // The Drive copy being replaced: the latest one the queue noted for this story file.
  $replace = '';
  foreach ((array)($m['drive'] ?? []) as $d) if (($d['file'] ?? '') === "$batch-message.json") $replace = (string)($d['drive'] ?? '');
  $shirt = d_shirt($_POST);
  $m = d_meta_merge($metaFile, ['shirtSize' => $shirt, 'message' => $message, 'funFacts' => $facts ?: new stdClass(), 'memories' => $memories, 'updatedAt' => date('c')]);
  if ($message !== '' || $facts || $memories || $shirt !== '') d_queue([d_story_job($destDir, $m, true, $replace)], $metaFile);
  d_out(200, view($slug, $m) + ['saved' => true]);
}
if ($action === 'photo') {
  if (empty($_FILES['photo']) || ($_FILES['photo']['error'] ?? 4) === 4) d_fail('Please choose a photo.');
  if (count((array)($m['photos'] ?? [])) >= 60) d_fail('That is the most photos one submission can hold. Please email julie@schalmontpto.com.');
  [$saved, $job] = d_save_photo($_FILES['photo'], $destDir, $m);
  $m = d_meta_merge($metaFile, ['photos' => array_values(array_merge((array)($m['photos'] ?? []), [$saved])), 'updatedAt' => date('c')]);
  d_queue([$job], $metaFile);
  d_out(200, view($slug, $m) + ['added' => true]);
}
if ($action === 'remove') {
  $m = d_remove_photo($slug, $metaFile, $m, (string)($_POST['photo'] ?? ''));
  d_out(200, view($slug, $m) + ['removed' => true]);
}
if ($action === 'delete') {
  d_delete_submission($slug, $metaFile, $m);
  d_out(200, ['ok' => true, 'deleted' => true]);
}
d_fail('Unknown request.');
