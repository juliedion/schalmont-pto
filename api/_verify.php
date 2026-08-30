<?php
/* ============================================================
   Shared Firebase ID-token verification
   Used by api/ai.php and api/yearbook-delete.php to make sure a
   request really comes from a signed-in PTO administrator.
   Nothing to configure here.
   ============================================================ */

function firebase_project_id() {
  $cfg = @include __DIR__ . '/config.php';
  if (is_array($cfg) && !empty($cfg['firebase_project_id'])) return $cfg['firebase_project_id'];
  return 'schalmont-pto';
}

/* Returns the token claims (incl. 'email', 'sub') or null. */
function firebase_verify_token($jwt, $projectId = null) {
  $projectId = $projectId ?: firebase_project_id();
  $parts = explode('.', (string)$jwt);
  if (count($parts) !== 3) return null;
  [$h64, $p64, $s64] = $parts;

  $header  = json_decode(_b64url($h64), true);
  $payload = json_decode(_b64url($p64), true);
  $sig     = _b64url($s64);
  if (!$header || !$payload || !$sig) return null;
  if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) return null;

  $now = time();
  if (($payload['aud'] ?? '') !== $projectId) return null;
  if (($payload['iss'] ?? '') !== "https://securetoken.google.com/$projectId") return null;
  if (($payload['exp'] ?? 0) < $now - 60) return null;
  if (($payload['iat'] ?? 0) > $now + 300) return null;
  if (empty($payload['sub'])) return null;

  $certs = _google_certs();
  $pem = $certs[$header['kid']] ?? null;
  if (!$pem) return null;

  return openssl_verify("$h64.$p64", $sig, $pem, OPENSSL_ALGO_SHA256) === 1 ? $payload : null;
}

/* Pulls the token from an Authorization: Bearer header or an
   idToken field in JSON / form body, and verifies it. */
function firebase_current_user($bodyToken = null) {
  $tok = $bodyToken;
  if (!$tok) {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (stripos($hdr, 'bearer ') === 0) $tok = trim(substr($hdr, 7));
  }
  if (!$tok) return null;
  return firebase_verify_token($tok);
}

function _b64url($s) {
  return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

function _google_certs() {
  $cacheFile = __DIR__ . '/.google-certs.json';
  if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
    $c = json_decode(file_get_contents($cacheFile), true);
    if (is_array($c)) return $c;
  }
  $ch = curl_init('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
  $json = curl_exec($ch);
  curl_close($ch);
  $certs = json_decode($json, true);
  if (is_array($certs)) @file_put_contents($cacheFile, json_encode($certs), LOCK_EX);
  return is_array($certs) ? $certs : [];
}
