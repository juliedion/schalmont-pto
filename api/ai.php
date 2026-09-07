<?php
/* ============================================================
   Schalmont PTO — AI Assistant proxy
   ------------------------------------------------------------
   The browser never sees the API key. This script:
     1. checks the request comes from a signed-in PTO admin
     2. enforces a monthly usage cap
     3. forwards the conversation to Anthropic
     4. returns just the reply text
   Configure it by copying config.example.php to config.php.
   ============================================================ */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function bail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') bail(405, 'POST only');

$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) {
  bail(503, 'The AI assistant is not set up yet. See api/config.example.php for the 5-minute setup steps.');
}
$cfg = require $cfgPath;
$provider = strtolower($cfg['provider'] ?? (!empty($cfg['gemini_api_key']) ? 'gemini' : 'anthropic'));
$apiKey = $provider === 'gemini'
  ? ($cfg['gemini_api_key'] ?? '')
  : ($cfg['anthropic_api_key'] ?? '');
if (empty($apiKey) || strpos($apiKey, 'REPLACE') !== false) {
  bail(503, 'The AI assistant needs an API key in api/config.php.');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || empty($body['messages']) || empty($body['idToken'])) {
  bail(400, 'Malformed request.');
}

/* ---------- 1. Verify the Firebase sign-in token ---------- */
require __DIR__ . '/_verify.php';
$claims = firebase_verify_token($body['idToken'], $cfg['firebase_project_id']);
if (!$claims) bail(401, 'Please sign in again.');
$userEmail = $claims['email'] ?? 'unknown';

/* ---------- 2. Monthly usage cap ---------- */
$usageFile = __DIR__ . '/.ai-usage.json';
$month = date('Y-m');
$usage = ['month' => $month, 'count' => 0];
if (file_exists($usageFile)) {
  $u = json_decode(file_get_contents($usageFile), true);
  if (is_array($u) && ($u['month'] ?? '') === $month) $usage = $u;
}
if ($usage['count'] >= (int)($cfg['max_requests_per_month'] ?? 800)) {
  bail(429, 'The assistant has reached its monthly limit. It will reset on the 1st, or an owner can raise the limit in api/config.php.');
}

/* ---------- 3. Build the request ---------- */
$system =
  "You are the helpful assistant inside the Schalmont Central PTO 'Back Office', a private " .
  "website tool used by parent volunteers who are NOT web designers. Schools: Woestina Pre-K, " .
  "Jefferson Elementary, Middle School, High School. In the back office, admins can build web " .
  "pages from blocks (heading, paragraph, list, photo, button, divider, embed), upload files and " .
  "photos, keep a planning checklist, and (soon) build forms and sign-up sheets. Published pages " .
  "get a link like schalmontpto.com/p/page-name. " .
  "Answer in plain, friendly language. Give short numbered steps for how-to questions. " .
  "You can also help draft emails, newsletter blurbs, social posts, and event ideas for a K-12 PTA. " .
  "Keep answers concise. If asked something you can't do from here, say so and suggest who to ask.";

$rawMsgs = [];
foreach (array_slice($body['messages'], -12) as $m) {
  $isAsst = ($m['role'] === 'assistant');
  $text = mb_substr((string)$m['content'], 0, 6000);
  if ($text !== '') $rawMsgs[] = ['asst' => $isAsst, 'text' => $text];
}
if (!$rawMsgs) bail(400, 'No message to send.');

/* ---------- 4. Call the AI provider ---------- */
if ($provider === 'gemini') {
  $model = $cfg['model'] ?? 'gemini-2.5-flash';
  $contents = [];
  foreach ($rawMsgs as $m) {
    $contents[] = ['role' => $m['asst'] ? 'model' : 'user', 'parts' => [['text' => $m['text']]]];
  }
  $payload = json_encode([
    'system_instruction' => ['parts' => [['text' => $system]]],
    'contents' => $contents,
    'generationConfig' => ['maxOutputTokens' => 1024, 'temperature' => 0.6],
  ]);
  $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
  $headers = ['Content-Type: application/json', 'x-goog-api-key: ' . $apiKey];
} else {
  $model = $cfg['model'] ?? 'claude-haiku-4-5-20251001';
  $msgs = [];
  foreach ($rawMsgs as $m) $msgs[] = ['role' => $m['asst'] ? 'assistant' : 'user', 'content' => $m['text']];
  $payload = json_encode(['model' => $model, 'max_tokens' => 1024, 'system' => $system, 'messages' => $msgs]);
  $url = 'https://api.anthropic.com/v1/messages';
  $headers = ['Content-Type: application/json', 'x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'];
}

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_TIMEOUT => 45,
  CURLOPT_HTTPHEADER => $headers,
]);
$resp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($resp === false) bail(502, 'Could not reach the AI service: ' . curl_error($ch));
curl_close($ch);

$data = json_decode($resp, true);
if ($httpCode !== 200) {
  $detail = $data['error']['message'] ?? ('HTTP ' . $httpCode);
  bail(502, 'AI service error: ' . $detail);
}

$reply = '';
if ($provider === 'gemini') {
  foreach (($data['candidates'][0]['content']['parts'] ?? []) as $part) {
    if (isset($part['text'])) $reply .= $part['text'];
  }
} else {
  foreach (($data['content'] ?? []) as $part) {
    if (($part['type'] ?? '') === 'text') $reply .= $part['text'];
  }
}
if ($reply === '') $reply = "Sorry, I didn't get a response. Please try again.";

/* ---------- 5. Record usage ---------- */
$usage['count']++;
@file_put_contents($usageFile, json_encode($usage), LOCK_EX);

echo json_encode(['reply' => $reply]);
