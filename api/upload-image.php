<?php
/* ============================================================
   Image upload for the back office (page flyers, photo blocks).
   Only signed-in PTO administrators can use it. Files are saved
   on this server under /uploads/pages/<school>/ and the public
   path is returned.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/_verify.php';

function out($c, $a) { http_response_code($c); echo json_encode($a); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

$user = firebase_current_user($_POST['idToken'] ?? null);
if (!$user) out(401, ['ok' => false, 'error' => 'Please sign in again.']);

$SCHOOLS   = ['woestina', 'jefferson', 'middle', 'high', 'pto'];
$MAX_BYTES = 12 * 1024 * 1024;
$EXT_OK    = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

$school = $_POST['school'] ?? '';
if (!in_array($school, $SCHOOLS, true)) out(400, ['ok' => false, 'error' => 'Unknown school.']);

if (empty($_FILES['image']) || ($_FILES['image']['error'] ?? 4) !== UPLOAD_ERR_OK) {
  out(400, ['ok' => false, 'error' => 'No image received.']);
}
$f = $_FILES['image'];
if ($f['size'] > $MAX_BYTES) out(400, ['ok' => false, 'error' => 'Image must be under 12 MB.']);
if (!is_uploaded_file($f['tmp_name'])) out(400, ['ok' => false, 'error' => 'Upload error.']);

$ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $EXT_OK, true)) out(400, ['ok' => false, 'error' => 'Use a JPG, PNG, WEBP or GIF image.']);
if (@getimagesize($f['tmp_name']) === false) out(400, ['ok' => false, 'error' => 'That file is not a valid image.']);

$dir = __DIR__ . "/../uploads/pages/$school";
if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
  out(500, ['ok' => false, 'error' => 'Server could not create the upload folder.']);
}
$fname = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
if (!move_uploaded_file($f['tmp_name'], "$dir/$fname")) {
  out(500, ['ok' => false, 'error' => 'Server could not save the image.']);
}
@chmod("$dir/$fname", 0644);

out(200, ['ok' => true, 'url' => "/uploads/pages/$school/$fname"]);
