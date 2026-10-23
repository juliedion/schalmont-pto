<?php
/* Shared by api/yearbook-upload.php and api/yearbook-drive.php: sending yearbook photos to
   the PTO's Google Drive through the Apps Script in tools/yearbook-drive-script.gs. */

/* Send one saved photo to the Google Drive script. Returns the Drive link or '' on failure. */
function to_drive($cfg, $path, $fields) {
  $url = $cfg['yearbook_drive_url'] ?? ''; $key = $cfg['yearbook_drive_secret'] ?? '';
  if ($url === '' || $key === '' || !function_exists('curl_init') || !is_file($path)) return '';
  $mime = function_exists('mime_content_type') ? (@mime_content_type($path) ?: 'application/octet-stream') : 'application/octet-stream';
  $body = json_encode($fields + ['secret' => $key, 'mimeType' => $mime, 'data' => base64_encode(file_get_contents($path))]);
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,   // Apps Script answers with a redirect
    CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => 120,
  ]);
  $res = json_decode((string)curl_exec($ch), true);
  curl_close($ch);
  return (is_array($res) && !empty($res['ok'])) ? (string)($res['url'] ?? 'ok') : '';
}
