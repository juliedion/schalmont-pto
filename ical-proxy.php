<?php
/**
 * ical-proxy.php — Server-side iCal fetch proxy for Schalmont PTO
 * Fetches Google Calendar iCal feeds server-side (bypasses browser CORS).
 * Only allows requests to calendar.google.com.
 */
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$url = isset($_GET['url']) ? trim($_GET['url']) : '';

// Security: only allow Google Calendar iCal URLs
if (
    empty($url) ||
    strpos($url, 'https://calendar.google.com/calendar/ical/') !== 0 ||
    strpos($url, '/public/basic.ics') === false
) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$data = false;

// Try curl first (more reliable on shared hosting)
if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; SchalmontPTO/1.0)');
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($data === false || $httpCode < 200 || $httpCode >= 300) {
        $data = false;
    }
}

// Fall back to file_get_contents if curl failed or unavailable
if ($data === false) {
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => 10,
            'header'  => "User-Agent: Mozilla/5.0 (compatible; SchalmontPTO/1.0)\r\n",
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);
    $data = @file_get_contents($url, false, $ctx);
}

if ($data === false) {
    http_response_code(502);
    echo 'Failed to fetch calendar';
    exit;
}

echo $data;
