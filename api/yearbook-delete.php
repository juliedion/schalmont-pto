<?php
/* ============================================================
   Delete a yearbook photo file from the server.
   Only signed-in PTO administrators can call this (used by the
   back office when an admin rejects or removes a photo).
   ============================================================ */

header('Content-Type: application/json');
require __DIR__ . '/_verify.php';

function out($c, $a) { http_response_code($c); echo json_encode($a); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only']);

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$user  = firebase_current_user($body['idToken'] ?? null);
if (!$user) out(401, ['ok' => false, 'error' => 'Sign in again.']);

$paths = $body['paths'] ?? [];
if (!is_array($paths)) out(400, ['ok' => false, 'error' => 'Bad request.']);

$root = realpath(__DIR__ . '/../uploads/yearbook');
$deleted = 0;
foreach ($paths as $p) {
  // must be a path we handed out: /uploads/yearbook/<school>/<event>/<file>
  if (!preg_match('#^/uploads/yearbook/[a-z]+/[a-z0-9-]+/[A-Za-z0-9.\-]+$#', (string)$p)) continue;
  $full = realpath(__DIR__ . '/../' . ltrim($p, '/'));
  if ($full && strpos($full, $root) === 0 && is_file($full)) { @unlink($full); $deleted++; }
}
out(200, ['ok' => true, 'deleted' => $deleted]);
