<?php
/* ============================================================
   Yearbook events for the photo form (js/yearbook-form.js): the event folders inside
   each school's folder in the PTO's Google Drive, read through the Apps Script in
   tools/yearbook-drive-script.gs. Returns {ok, events: {jefferson: [...], ...}}.
   Cached here for 2 minutes. Needs 'yearbook_drive_url' in config.php; without it
   the form just offers "Not sure" and "Other".
   ============================================================ */

header('Content-Type: application/json');
header('Cache-Control: public, max-age=60');

$cfg = @include __DIR__ . '/config.php';
$url = is_array($cfg) ? ($cfg['yearbook_drive_url'] ?? '') : '';
if ($url === '' || !function_exists('curl_init')) { echo json_encode(['ok' => false, 'events' => (object)[]]); exit; }

$cache = sys_get_temp_dir() . '/schalmont-yearbook-events-' . md5($url) . '.json';
if (is_file($cache) && time() - filemtime($cache) < 120) { readfile($cache); exit; }

$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 25]);
$res = json_decode((string)curl_exec($ch), true);
curl_close($ch);

if (is_array($res) && !empty($res['ok']) && is_array($res['events'] ?? null)) {
  $out = json_encode(['ok' => true, 'events' => $res['events']]);
  @file_put_contents($cache, $out, LOCK_EX);
  echo $out;
} elseif (is_file($cache)) {
  readfile($cache);   // Google hiccup: an older list beats none
} else {
  echo json_encode(['ok' => false, 'events' => (object)[]]);
}
