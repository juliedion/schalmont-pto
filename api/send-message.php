<?php
/* ============================================================
   Schalmont PTO — Back Office "Message a PTO Officer"
   ------------------------------------------------------------
   Sends a real email from one signed-in back-office admin to
   another. The browser never sees an email password or API key —
   this just uses the server's own PHP mail() function.
     1. checks the request comes from a signed-in PTO admin
     2. looks up the recipient's OWN user record (server-side, so a
        caller can't be tricked into emailing an arbitrary address)
     3. enforces a small daily cap so this can't become a spam relay
     4. sends the email with Reply-To set to the real sender
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function bail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

function clean_header($s) {
  return trim(str_replace(["\r", "\n"], '', (string)$s));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') bail(405, 'POST only');

$cfgPath = __DIR__ . '/config.php';
$cfg = file_exists($cfgPath) ? require $cfgPath : [];

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || empty($body['idToken']) || empty($body['toUid']) ||
    empty($body['subject']) || empty($body['body'])) {
  bail(400, 'Malformed request.');
}

/* ---------- 1. Verify the Firebase sign-in token ---------- */
require __DIR__ . '/_verify.php';
$pid = $cfg['firebase_project_id'] ?? 'schalmont-pto';
$claims = firebase_verify_token($body['idToken'], $pid);
if (!$claims) bail(401, 'Please sign in again.');
$senderEmail = strtolower($claims['email'] ?? '');
$senderName  = $claims['name'] ?? $senderEmail;
$senderUid   = $claims['sub'] ?? '';
if (!$senderEmail || !$senderUid) bail(401, 'Please sign in again.');

/* ---------- 1b. Caller must be a back-office admin ---------- */
function fetch_user_doc($pid, $uid, $idToken) {
  $url = "https://firestore.googleapis.com/v1/projects/{$pid}/databases/(default)/documents/users/" . rawurlencode($uid);
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $idToken],
  ]);
  $res = curl_exec($ch);
  curl_close($ch);
  $doc = json_decode((string)$res, true);
  if (!is_array($doc) || empty($doc['fields'])) return null;
  $f = $doc['fields'];
  return [
    'role' => $f['role']['stringValue'] ?? '',
    'email' => $f['email']['stringValue'] ?? '',
    'displayName' => $f['displayName']['stringValue'] ?? '',
  ];
}

$ownerEmails = array_map('strtolower', $cfg['admin_emails'] ?? ['julie@schalmontpto.com']);
$isAdmin = in_array($senderEmail, $ownerEmails, true);
if (!$isAdmin) {
  $me = fetch_user_doc($pid, $senderUid, $body['idToken']);
  if ($me && in_array($me['role'], ['admin', 'superadmin'], true)) $isAdmin = true;
}
if (!$isAdmin) bail(403, 'Messaging is for PTO back-office administrators only.');

/* ---------- 2. Look up the recipient's OWN record (never trust a client-supplied email) ---------- */
$recipient = fetch_user_doc($pid, $body['toUid'], $body['idToken']);
if (!$recipient || !in_array($recipient['role'], ['admin', 'superadmin'], true) || empty($recipient['email'])) {
  bail(404, 'That officer could not be found.');
}
$toEmail = $recipient['email'];
$toName  = $recipient['displayName'] ?: $toEmail;

/* ---------- 3. A small daily cap so this can't become a spam relay ---------- */
$usageFile = __DIR__ . '/.message-usage.json';
$today = date('Y-m-d');
$usage = ['day' => $today, 'count' => 0];
if (file_exists($usageFile)) {
  $u = json_decode(file_get_contents($usageFile), true);
  if (is_array($u) && ($u['day'] ?? '') === $today) $usage = $u;
}
if ($usage['count'] >= (int)($cfg['max_messages_per_day'] ?? 100)) {
  bail(429, 'The daily message limit has been reached — try again tomorrow.');
}

/* ---------- 4. Build and send the email ---------- */
$subject = mb_substr(trim((string)$body['subject']), 0, 200);
$message = mb_substr(trim((string)$body['body']), 0, 8000);

$fromAddr = $cfg['message_from_email'] ?? 'noreply@schalmontpto.com';
$safeSenderName = clean_header($senderName);
$safeSenderEmail = clean_header($senderEmail);

$mailSubject = '[PTO Back Office] ' . $subject;
$mailBody =
  $message . "\n\n" .
  "---\n" .
  "Sent via the Schalmont PTO Back Office by {$safeSenderName} ({$safeSenderEmail}).\n" .
  "Just hit Reply to write back to them directly.";

$headers = [
  'From: Schalmont PTO Back Office <' . clean_header($fromAddr) . '>',
  'Reply-To: ' . $safeSenderName . ' <' . $safeSenderEmail . '>',
  'Content-Type: text/plain; charset=UTF-8',
];

$ok = @mail(clean_header($toEmail), $mailSubject, $mailBody, implode("\r\n", $headers));
if (!$ok) bail(502, 'The message could not be sent — please try again or email them directly.');

$usage['count']++;
@file_put_contents($usageFile, json_encode($usage), LOCK_EX);

echo json_encode(['ok' => true, 'to' => $toName]);
