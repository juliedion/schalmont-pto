<?php
/* ============================================================
   Parent dashboard (dashboard.html): the 8th Grade Dance "Share your Sabre's Story"
   submissions made with the signed-in parent's (verified) email: answers + photos.
   POST idToken=<Firebase ID token>. Photos come back as short-lived signed links to
   api/my-dance-photo.php, so nobody else can open them.
   ============================================================ */
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
function out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

require __DIR__ . '/lib-firebase-user.php';
$user = firebase_user($_POST['idToken'] ?? '');
if (!$user) out(401, ['ok' => false, 'error' => 'Please sign in again.']);
if (!$user['verified']) out(403, ['ok' => false, 'error' => 'Please verify your email address first.']);

$cfg = @include __DIR__ . '/config.php';
$secret = is_array($cfg) ? ($cfg['yearbook_drive_secret'] ?? '') : '';
if ($secret === '') out(500, ['ok' => false, 'error' => 'Not set up yet.']);

$base = realpath(__DIR__ . '/../uploads/dance8');
$exp = time() + 3600;
$sign = function ($slug, $f) use ($secret, $exp) {
  return 'api/my-dance-photo.php?' . http_build_query(['d' => $slug, 'f' => $f, 'e' => $exp, 's' => hash_hmac('sha256', "$slug|$f|$exp", $secret)]);
};

$subs = [];
if ($base) foreach (glob("$base/*/.meta/*.json") ?: [] as $file) {
  if (substr($file, -13) === '-message.json') continue;
  $m = json_decode((string)@file_get_contents($file), true);
  if (!is_array($m) || strtolower(trim((string)($m['email'] ?? ''))) !== $user['email']) continue;
  $slug = basename(dirname(dirname($file)));
  $photos = [];
  foreach ((array)($m['photos'] ?? []) as $f) {
    if (!is_string($f) || !preg_match('/^[A-Za-z0-9._-]+$/', $f) || !is_file("$base/$slug/$f")) continue;
    $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
    $photos[] = ['url' => $sign($slug, $f), 'viewable' => in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true), 'ext' => $ext];
  }
  $subs[] = [
    'student' => (string)($m['student'] ?? ''), 'familyName' => (string)($m['familyName'] ?? ''),
    'submittedAt' => (string)($m['submittedAt'] ?? ''), 'message' => (string)($m['message'] ?? ''),
    'funFacts' => (object)(is_array($m['funFacts'] ?? null) ? $m['funFacts'] : []),
    'memories' => array_values(array_filter((array)($m['memories'] ?? []), 'is_string')),
    'photos' => $photos,
  ];
}
usort($subs, function ($a, $b) { return strcmp($b['submittedAt'], $a['submittedAt']); });
out(200, ['ok' => true, 'email' => $user['email'], 'submissions' => $subs]);
