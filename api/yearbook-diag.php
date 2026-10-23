<?php
/* ============================================================
   Temporary troubleshooting log for the yearbook photo form (js/yearbook-form.js).
   The form POSTs short notes ("submit pressed", "blocked: <message>", "upload 200",
   "done", JavaScript errors) -- never names, emails or photos. GET shows the last
   60 notes. Remove this file (and the diag() calls in the form) once fixed.
   ============================================================ */
header('Content-Type: application/json');
header('Cache-Control: no-store');
$log = __DIR__ . '/../uploads/yearbook/.diag/log.txt';
@mkdir(dirname($log), 0755, true);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $in = json_decode((string)file_get_contents('php://input'), true);
  if (!is_array($in)) { echo '{"ok":false}'; exit; }
  $clip = function ($v, $n) { return mb_substr(preg_replace('/[\r\n\t]+/', ' ', strip_tags((string)$v)), 0, $n); };
  $line = date('c') . ' | ' . $clip($in['page'] ?? '', 60) . ' | v' . $clip($in['v'] ?? '', 8) . ' | ' . $clip($in['step'] ?? '', 300)
        . ' | ' . $clip($_SERVER['HTTP_USER_AGENT'] ?? '', 160) . "\n";
  if (is_file($log) && filesize($log) > 300000) @rename($log, $log . '.old');
  @file_put_contents($log, $line, FILE_APPEND | LOCK_EX);
  echo '{"ok":true}'; exit;
}
$lines = is_file($log) ? file($log) : [];
echo json_encode(['ok' => true, 'lines' => array_slice($lines, -60)], JSON_PRETTY_PRINT);
