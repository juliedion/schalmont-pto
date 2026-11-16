<?php
/* Shared helper (included, never called directly): checks a Firebase sign-in token with
   Google and returns ['uid','email','verified'] or null. The web API key is the same public
   key that's in js/firebase-config.js. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

function firebase_user($idToken) {
  if (!is_string($idToken) || strlen($idToken) < 100 || strlen($idToken) > 4096 || !function_exists('curl_init')) return null;
  $key = 'AIzaSyCaH3Xo14pCxhxgvtg31Co2gDi1VuAHoFk';
  $ch = curl_init('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . $key);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode(['idToken' => $idToken])]);
  $res = json_decode((string)curl_exec($ch), true);
  curl_close($ch);
  $u = $res['users'][0] ?? null;
  if (!is_array($u) || empty($u['email'])) return null;
  return ['uid' => (string)($u['localId'] ?? ''), 'email' => strtolower((string)$u['email']), 'verified' => !empty($u['emailVerified'])];
}
