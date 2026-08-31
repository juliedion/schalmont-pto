<?php
/* ============================================================
   Google Sheet reader — fetches the PTO planning spreadsheet
   as CSV, server-side (browsers can't fetch Google directly).
   Only signed-in PTO administrators can call this.
   The sheet must be shared "Anyone with the link can view".
   ============================================================ */

header('Content-Type: application/json');
require __DIR__ . '/_verify.php';

function out($c, $a) { http_response_code($c); echo json_encode($a); exit; }

/* Friendly names for known sheets (optional; any valid id is accepted below). */
$KNOWN = [
  '125BxlKchxGULKFtK_nl9pE67UdJwU0kqKU_ftEUC7SA' => 'PTO Planning Calendar',
];

$user = firebase_current_user($_GET['idToken'] ?? ($_POST['idToken'] ?? null));
if (!$user) out(401, ['ok' => false, 'error' => 'Please sign in again.']);

$id  = $_GET['id'] ?? '';
$gid = preg_replace('/[^0-9]/', '', $_GET['gid'] ?? '0');
// Admin-only, read-only fetch of a public Google Sheet as CSV — any well-formed id is fine.
if (!preg_match('/^[A-Za-z0-9_-]{20,64}$/', $id)) {
  out(400, ['ok' => false, 'error' => 'That does not look like a Google Sheet link.']);
}

$url = "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid";
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 25,
  CURLOPT_USERAGENT => 'SchalmontPTO-BackOffice/1.0',
]);
$csv = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($csv === false || $code !== 200) {
  out(502, ['ok' => false, 'error' => "Could not read the sheet (HTTP $code). Make sure it is shared 'Anyone with the link can view'."]);
}
if (stripos(ltrim($csv), '<!doctype html') === 0 || stripos(ltrim($csv), '<html') === 0) {
  out(502, ['ok' => false, 'error' => "Google returned a sign-in page. Set the sheet's sharing to 'Anyone with the link can view'."]);
}

out(200, ['ok' => true, 'name' => $KNOWN[$id] ?? 'Google Sheet', 'csv' => $csv]);
