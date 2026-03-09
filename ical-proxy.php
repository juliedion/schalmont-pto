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

$ctx = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 8,
        'header'  => "User-Agent: Mozilla/5.0 (compatible; SchalmonPTO/1.0)\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$data = @file_get_contents($url, false, $ctx);

if ($data === false) {
    http_response_code(502);
    echo 'Failed to fetch calendar';
    exit;
}

echo $data;
