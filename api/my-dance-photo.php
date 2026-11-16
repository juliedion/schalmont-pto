<?php
/* Serves one 8th Grade Dance photo to the parent who uploaded it, from a signed link made by
   api/my-dance.php (expires after an hour). */
$d = (string)($_GET['d'] ?? ''); $f = (string)($_GET['f'] ?? ''); $e = (int)($_GET['e'] ?? 0); $s = (string)($_GET['s'] ?? '');
if (!preg_match('/^[a-z0-9-]{1,90}$/', $d) || !preg_match('/^[A-Za-z0-9._-]{1,80}$/', $f) || strpos($f, '..') !== false || $e < time()) { http_response_code(404); exit; }
$cfg = @include __DIR__ . '/config.php';
$secret = is_array($cfg) ? ($cfg['yearbook_drive_secret'] ?? '') : '';
if ($secret === '' || !hash_equals(hash_hmac('sha256', "$d|$f|$e", $secret), $s)) { http_response_code(403); exit; }
$path = __DIR__ . "/../uploads/dance8/$d/$f";
if (!is_file($path)) { http_response_code(404); exit; }
$types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif'];
$ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
if (!isset($types[$ext]) || in_array($ext, ['heic', 'heif'], true)) header('Content-Disposition: attachment; filename="' . $f . '"');
readfile($path);
