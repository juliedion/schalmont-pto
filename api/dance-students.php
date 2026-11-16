<?php
/* ============================================================
   8th Grade Dance: student folder search for the "Share your Sabre's Story" form
   (8thgradedance.html). Returns up to 8 folder names ("Last, First") from
   <yearbook top folder>/8th Grade Dance 2027 in the PTO's Google Drive whose first or
   last name starts with what the family typed (2+ letters). The full list is never sent.
   Reads Drive through tools/yearbook-drive-script.gs (doGet ?list=dance + the secret),
   cached here for 2 minutes so a family's new folder shows up quickly.
   ============================================================ */

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function done($arr) { echo json_encode($arr); exit; }

$q = strtolower(preg_replace('/[^a-z0-9 ]/i', '', (string)($_GET['q'] ?? '')));
$q = trim(preg_replace('/\s+/', ' ', $q));
if (strlen(str_replace(' ', '', $q)) < 2) done(['ok' => true, 'names' => []]);

$cfg = @include __DIR__ . '/config.php';
$url = is_array($cfg) ? ($cfg['yearbook_drive_url'] ?? '') : '';
$secret = is_array($cfg) ? ($cfg['yearbook_drive_secret'] ?? '') : '';
if ($url === '' || $secret === '' || !function_exists('curl_init')) done(['ok' => false, 'names' => []]);

/* ---- the folder list (cached outside the website folder) ---- */
$cache = sys_get_temp_dir() . '/schalmont-dance-students-' . md5($url) . '.json';
$names = null;
if (is_file($cache) && time() - filemtime($cache) < 120) $names = json_decode((string)file_get_contents($cache), true);
if (!is_array($names)) {
  $ch = curl_init($url . (strpos($url, '?') === false ? '?' : '&') . http_build_query(['list' => 'dance', 'secret' => $secret]));
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 25]);
  $res = json_decode((string)curl_exec($ch), true);
  curl_close($ch);
  if (is_array($res) && !empty($res['ok']) && is_array($res['names'] ?? null)) {
    $names = array_values(array_filter($res['names'], 'is_string'));
    @file_put_contents($cache, json_encode($names), LOCK_EX);
  } elseif (is_file($cache)) {
    $names = json_decode((string)file_get_contents($cache), true);   // Google hiccup: an older list beats none
  }
}
if (!is_array($names)) done(['ok' => false, 'names' => []]);

/* ---- match: every typed word must start one of the name's words ("dis", "henry dis", "disanto h") ---- */
$typed = explode(' ', $q);
$hits = [];
foreach ($names as $n) {
  $words = preg_split('/\s+/', strtolower(preg_replace('/[^a-z0-9 ]/i', '', str_replace([',', '-'], ' ', $n))), -1, PREG_SPLIT_NO_EMPTY);
  $ok = true;
  foreach ($typed as $t) {
    $found = false;
    foreach ($words as $w) if (strpos($w, $t) === 0) { $found = true; break; }
    if (!$found) { $ok = false; break; }
  }
  if ($ok) $hits[] = $n;
}
usort($hits, 'strcasecmp');
done(['ok' => true, 'names' => array_slice($hits, 0, 8)]);
