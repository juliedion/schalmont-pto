<?php
/* ============================================================
   Works through the queue of yearbook photos waiting to be copied to Google Drive
   (uploads/yearbook/.queue, filled by api/yearbook-upload.php). The photo form pings this
   after an upload without waiting for the answer, and again whenever the form is opened,
   so anything that failed gets retried. One worker at a time; up to ~4 minutes per run.
   A photo that fails 6 times is set aside as .queue/*.failed.json (still on the server).
   ============================================================ */
header('Content-Type: application/json');
require __DIR__ . '/_yearbook_drive.php';

ignore_user_abort(true);      // keep going after the parent's page moves on
@set_time_limit(280);

$cfg = @include __DIR__ . '/config.php';
if (!is_array($cfg) || empty($cfg['yearbook_drive_url'])) { echo json_encode(['ok' => true, 'sent' => 0, 'note' => 'Drive not connected']); exit; }

$dir = __DIR__ . '/../uploads/yearbook/.queue';
if (!is_dir($dir)) { echo json_encode(['ok' => true, 'sent' => 0, 'left' => 0]); exit; }
$lock = fopen("$dir/.lock", 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { echo json_encode(['ok' => true, 'busy' => true]); exit; }   // another run is on it

$start = time(); $sent = 0;
$files = glob("$dir/*.json") ?: [];
$files = array_values(array_filter($files, function ($f) { return substr($f, -12) !== '.failed.json'; }));
sort($files);
foreach ($files as $qf) {
  if (time() - $start > 230) break;
  $job = json_decode((string)@file_get_contents($qf), true);
  if (!is_array($job) || empty($job['path'])) { @unlink($qf); continue; }
  $link = to_drive($cfg, $job['path'], $job['fields'] ?? []);
  if ($link !== '') {
    @unlink($qf); $sent++;
    if (!empty($job['meta']) && is_file($job['meta'])) {   // note it in the submission's backup copy
      $m = json_decode((string)@file_get_contents($job['meta']), true) ?: [];
      $m['drive'][] = ['file' => basename($job['path']), 'school' => $job['fields']['school'] ?? '', 'drive' => $link, 'at' => date('c')];
      @file_put_contents($job['meta'], json_encode($m, JSON_PRETTY_PRINT), LOCK_EX);
    }
  } else {
    $job['tries'] = ($job['tries'] ?? 0) + 1; $job['lastTry'] = date('c');
    if ($job['tries'] >= 6) { @file_put_contents(substr($qf, 0, -5) . '.failed.json', json_encode($job)); @unlink($qf); }
    else @file_put_contents($qf, json_encode($job), LOCK_EX);
  }
}
$left = count(array_filter(glob("$dir/*.json") ?: [], function ($f) { return substr($f, -12) !== '.failed.json'; }));
flock($lock, LOCK_UN);
echo json_encode(['ok' => true, 'sent' => $sent, 'left' => $left]);
