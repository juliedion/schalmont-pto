<?php
/* Shared helpers for the 8th Grade Dance "Share your Sabre's Story" form (included only):
   api/dance-upload.php (the form) and api/dance-story.php (the private view/edit link).
   A submission lives in uploads/dance8/<slug>/ with its record in .meta/<batchId>.json. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

const DANCE_DRIVE_TOP = '8th Grade Dance 2027';
const DANCE_MAX_BYTES = 20 * 1024 * 1024;   // 20 MB per photo (see api/.user.ini)
const DANCE_EXT_OK = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
const DANCE_SHIRTS = ['Youth Small', 'Youth Medium', 'Youth Large', 'Youth XL', 'Adult Small', 'Adult Medium', 'Adult Large', 'Adult XL', 'Adult 2XL', 'Adult 3XL'];
const DANCE_FACTS = ['nickname' => 'Special nickname', 'food' => 'Favorite food', 'place' => 'Favorite place to be', 'hero' => 'If they were a superhero'];

function d_out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
function d_fail($msg) { d_out(400, ['ok' => false, 'error' => $msg]); }
function d_clean($s, $max) { return mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string)$s))), 0, $max); }
function d_base() { return __DIR__ . '/../uploads/dance8'; }
function d_cfg() { $c = @include __DIR__ . '/config.php'; return is_array($c) ? $c : []; }

/* The answers from a POST: message, fun facts, memories. */
function d_answers($post) {
  $message = mb_substr(trim(strip_tags((string)($post['message'] ?? ''))), 0, 2000);
  $facts = [];
  foreach (DANCE_FACTS as $k => $label) { $v = d_clean($post[$k] ?? '', 150); if ($v !== '') $facts[$label] = $v; }
  $memories = [];
  foreach ((array)($post['memories'] ?? []) as $m) {
    $m = mb_substr(trim(strip_tags((string)$m)), 0, 1000);
    if ($m !== '' && count($memories) < 10) $memories[] = $m;
  }
  return [$message, $facts, $memories];
}
/* Shirt size from a POST: one of DANCE_SHIRTS, or ''. */
function d_shirt($post) { $v = (string)($post['shirtSize'] ?? ''); return in_array($v, DANCE_SHIRTS, true) ? $v : ''; }

/* The private view/edit link for one submission (no account needed; the key is an HMAC). */
function d_story_key($slug, $batch) {
  $secret = d_cfg()['yearbook_drive_secret'] ?? '';
  return $secret === '' ? '' : substr(hash_hmac('sha256', "story|$slug|$batch", $secret), 0, 32);
}
function d_story_url($slug, $batch) {
  return 'https://schalmontpto.com/sabres-story?' . http_build_query(['d' => $slug, 'b' => $batch, 'k' => d_story_key($slug, $batch)]);
}
function d_check_link($slug, $batch, $key) {
  if (!preg_match('/^[a-z0-9-]{1,90}$/', $slug) || !preg_match('/^[A-Za-z0-9-]{1,40}$/', $batch)) return false;
  $want = d_story_key($slug, $batch);
  return $want !== '' && is_string($key) && hash_equals($want, $key) && is_file(d_base() . "/$slug/.meta/$batch.json");
}

/* Read / merge-write a submission record (keeps keys added elsewhere, e.g. the Drive links). */
function d_meta_read($metaFile) { return is_file($metaFile) ? (json_decode((string)file_get_contents($metaFile), true) ?: []) : []; }
function d_meta_merge($metaFile, $changes) {
  $m = array_merge(d_meta_read($metaFile), $changes);
  @file_put_contents($metaFile, json_encode($m, JSON_PRETTY_PRINT), LOCK_EX);
  return $m;
}

/* The Sabre's Story text file that goes to the student's Drive folder. */
function d_story_text($m, $updated = false) {
  $txt = "SABRE'S STORY" . ($updated ? ' (UPDATED ' . date('F j, Y g:i A') . ')' : '') . "\nFor: " . ($m['student'] ?? '') .
    "\nFrom: " . ($m['familyName'] ?? '') . ' <' . ($m['email'] ?? '') . "> (certified parent/guardian)\nSent: " .
    date('F j, Y g:i A', strtotime($m['submittedAt'] ?? 'now')) . "\n";
  if (($m['shirtSize'] ?? '') !== '') $txt .= 'Shirt size: ' . $m['shirtSize'] . "\n";
  if (($m['message'] ?? '') !== '') $txt .= "\nMESSAGE FROM FAMILY AND/OR FRIENDS\n" . $m['message'] . "\n";
  $facts = (array)($m['funFacts'] ?? []);
  if ($facts) { $txt .= "\nFUN FACTS\n"; foreach ($facts as $label => $v) $txt .= "$label: $v\n"; }
  $mem = (array)($m['memories'] ?? []);
  if ($mem) { $txt .= "\nFAVORITE MEMORIES\n"; foreach (array_values($mem) as $i => $x) $txt .= ($i + 1) . ". $x\n"; }
  return $txt;
}

/* Drive fields shared by every file of one submission. */
function d_common($m) {
  $student = $m['student'] ?? '';
  $folder = $m['folder'] ?? $student;
  return [
    'folderPath' => [DANCE_DRIVE_TOP, $folder],
    'school' => 'dance8', 'eventFolder' => $folder, 'eventLabel' => "8th Grade Dance - $student",
    'students' => $student, 'grades' => '8th grade',
    'uploaderName' => $m['familyName'] ?? '', 'uploaderEmail' => $m['email'] ?? '', 'batchId' => $m['batchId'] ?? '',
  ];
}
function d_safe($s) { return trim(preg_replace('/[\/\\\\:*?"<>|]+/', ' ', (string)$s)); }

/* Save one uploaded photo into the student's folder; returns [filename, drive job] or fails. */
function d_save_photo($f, $destDir, $m) {
  if (($f['error'] ?? 1) !== UPLOAD_ERR_OK) d_fail('The photo did not upload correctly. Try again.');
  if ($f['size'] > DANCE_MAX_BYTES) d_fail('Each photo must be under 20 MB.');
  if (!is_uploaded_file($f['tmp_name'])) d_fail('Upload error.');
  $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
  if (!in_array($ext, DANCE_EXT_OK, true)) d_fail('Only photo files are allowed (JPG, PNG, WEBP, GIF, HEIC).');
  if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) && @getimagesize($f['tmp_name']) === false) d_fail('That file is not a valid image.');
  $ext = $ext === 'jpeg' ? 'jpg' : $ext;
  $fname = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . ".$ext";
  if (!move_uploaded_file($f['tmp_name'], "$destDir/$fname")) d_out(500, ['ok' => false, 'error' => 'Server could not save the photo.']);
  @chmod("$destDir/$fname", 0644);
  return [$fname, ["$destDir/$fname", d_common($m) + [
    'original' => d_clean($f['name'], 120),
    'filename' => ($m['student'] ?? '') . ' - from ' . d_safe($m['familyName'] ?? '') . ' - ' . date('Ymd-His') . '-' . substr(md5($fname), 0, 4) . ".$ext",
  ]]];
}

/* Write the story text and return its Drive job. $replace = the Drive link of the version it replaces. */
function d_story_job($destDir, $m, $updated = false, $replace = '') {
  $msgFile = "$destDir/.meta/" . $m['batchId'] . '-message.json';   // .json: uploads/.htaccess keeps it private
  @file_put_contents($msgFile, d_story_text($m, $updated), LOCK_EX);
  $fields = d_common($m) + ['mimeType' => 'text/plain', 'original' => 'family message',
    'filename' => "Sabre's Story from " . d_safe($m['familyName'] ?? '') . ($updated ? ' (updated)' : '') . ' - ' . date('Ymd-His') . '.txt'];
  if ($replace !== '' && preg_match('#/d/([A-Za-z0-9_-]{10,})#', $replace, $mm)) $fields['replaceId'] = $mm[1];
  return [$msgFile, $fields];
}

/* Queue Drive copies (shared queue, sent by api/yearbook-drive.php). */
function d_queue($jobs, $metaFile) {
  if (!$jobs || empty(d_cfg()['yearbook_drive_url'])) return;
  $q = __DIR__ . '/../uploads/yearbook/.queue';
  @mkdir($q, 0755, true);
  foreach ($jobs as [$path, $fields]) {
    @file_put_contents("$q/" . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json',
      json_encode(['path' => $path, 'meta' => $metaFile, 'fields' => $fields, 'tries' => 0]), LOCK_EX);
  }
}

/* Short-lived signed link for showing one photo (api/my-dance-photo.php). */
function d_photo_url($slug, $f) {
  $secret = d_cfg()['yearbook_drive_secret'] ?? ''; $exp = time() + 3600;
  return '/api/my-dance-photo.php?' . http_build_query(['d' => $slug, 'f' => $f, 'e' => $exp, 's' => hash_hmac('sha256', "$slug|$f|$exp", $secret)]);
}
function d_photo_list($slug, $m) {
  $out = [];
  foreach ((array)($m['photos'] ?? []) as $f) {
    if (!is_string($f) || !preg_match('/^[A-Za-z0-9._-]+$/', $f) || !is_file(d_base() . "/$slug/$f")) continue;
    $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
    $out[] = ['id' => $f, 'url' => d_photo_url($slug, $f), 'viewable' => in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true), 'ext' => $ext];
  }
  return $out;
}

/* Remove one photo: off the record, off the server, out of the Drive queue if it hasn't gone yet,
   and (if it already reached Drive) a "trash it" request for the Apps Script. */
function d_remove_photo($slug, $metaFile, $m, $f) {
  $photos = array_values((array)($m['photos'] ?? []));
  if (!is_string($f) || !in_array($f, $photos, true)) d_fail('That photo was already removed.');
  $path = d_base() . "/$slug/$f";
  $q = __DIR__ . '/../uploads/yearbook/.queue';
  foreach (glob("$q/*.json") ?: [] as $qf) {   // not sent yet: just drop it from the queue
    $job = json_decode((string)@file_get_contents($qf), true);
    if (is_array($job) && ($job['path'] ?? '') === $path) @unlink($qf);
  }
  $driveId = '';
  foreach ((array)($m['drive'] ?? []) as $d)
    if (($d['file'] ?? '') === $f && preg_match('#/d/([A-Za-z0-9_-]{10,})#', (string)($d['drive'] ?? ''), $mm)) $driveId = $mm[1];
  if ($driveId !== '' && !empty(d_cfg()['yearbook_drive_url'])) {
    @mkdir($q, 0755, true);
    @file_put_contents("$q/" . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json',
      json_encode(['trashId' => $driveId, 'meta' => $metaFile, 'fields' => d_common($m), 'tries' => 0]), LOCK_EX);
  }
  if (is_file($path)) @unlink($path);
  return d_meta_merge($metaFile, ['photos' => array_values(array_diff($photos, [$f])),
    'removedPhotos' => array_merge((array)($m['removedPhotos'] ?? []), [['file' => $f, 'at' => date('c')]]), 'updatedAt' => date('c')]);
}

/* Delete a whole submission: every photo (as above), the story file (and its Drive copy),
   then the record itself, so the private link stops working. */
function d_delete_submission($slug, $metaFile, $m) {
  foreach (array_values((array)($m['photos'] ?? [])) as $f) $m = d_remove_photo($slug, $metaFile, $m, $f);
  $batch = (string)($m['batchId'] ?? '');
  $msgFile = d_base() . "/$slug/.meta/$batch-message.json";
  $q = __DIR__ . '/../uploads/yearbook/.queue';
  foreach (glob("$q/*.json") ?: [] as $qf) {
    $job = json_decode((string)@file_get_contents($qf), true);
    if (is_array($job) && ($job['path'] ?? '') === $msgFile) @unlink($qf);
  }
  $ids = [];
  foreach ((array)($m['drive'] ?? []) as $d)
    if (($d['file'] ?? '') === "$batch-message.json" && preg_match('#/d/([A-Za-z0-9_-]{10,})#', (string)($d['drive'] ?? ''), $mm)) $ids[] = $mm[1];
  if ($ids && !empty(d_cfg()['yearbook_drive_url'])) {
    @mkdir($q, 0755, true);
    foreach (array_unique($ids) as $id)
      @file_put_contents("$q/" . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json', json_encode(['trashId' => $id, 'tries' => 0]), LOCK_EX);
  }
  if (is_file($msgFile)) @unlink($msgFile);
  @unlink($metaFile);
  @file_put_contents(substr($metaFile, 0, -5) . '.deleted', date('c'));   // so the old link can say it was deleted
}
