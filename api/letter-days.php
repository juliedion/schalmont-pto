<?php
/**
 * api/letter-days.php — official letter days for Jefferson, the Middle School and the
 * High School, for the homepage's "Today's Letter Days" card.
 *
 * Source: each school's own public Google Calendar, maintained by the district. Every
 * instructional day has one all-day event titled "A" Day / "B" Day / … — Jefferson
 * rotates A–E, the MS and HS rotate A–D, each on its own sequence. (Checked against the
 * official JES 2026–27 Letter Day Calendar PDF: all 180 school days match.) Days off
 * carry a "NO SCHOOL - …" event instead. Nothing is calculated here — a date with no
 * letter event simply has no letter, and the homepage says so instead of guessing.
 *
 * The three feeds are ~650 KB each, so they're read here at most every few hours and
 * boiled down to a few KB of JSON covering the next couple of months.
 *
 * Output: { generated, schools: { jefferson: { ok, letters: {"2026-10-13":"C",…},
 *           noSchool: {"2026-10-12":"Columbus Day",…}, lastLetter: "2027-06-23" }, … } }
 */

// A PHP notice or warning printed into the response would break the JSON (and the card).
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=1800');
date_default_timezone_set('America/New_York');

const CACHE_SECONDS = 4 * 3600;
const FEEDS = [
  'jefferson' => 'b8ps3245btumu5q6psc3cmvs8c@group.calendar.google.com',
  'middle'    => 'eumk9qp2llrljnfkp64k1dgk5g@group.calendar.google.com',
  'high'      => '8b7ohsc70vgab6398itc7e73q0@group.calendar.google.com',
];

$cacheFile = sys_get_temp_dir() . '/pto_letter_days.json';
$cached = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
$fresh = $cached && (time() - filemtime($cacheFile) < CACHE_SECONDS) && empty($_GET['refresh']);
if ($fresh) { echo json_encode($cached); exit; }

$from = date('Y-m-d', strtotime('-7 days'));
$to   = date('Y-m-d', strtotime('+75 days'));
$out = ['generated' => date('c'), 'tz' => 'America/New_York', 'schools' => []];
$anyOk = false;

foreach (FEEDS as $school => $calId) {
  $ics = fetch('https://calendar.google.com/calendar/ical/' . rawurlencode($calId) . '/public/basic.ics');
  if ($ics === null || strpos($ics, 'BEGIN:VCALENDAR') === false) {
    // Keep yesterday's data for this school rather than going blank on a hiccup.
    $out['schools'][$school] = $cached['schools'][$school] ?? ['ok' => false];
    continue;
  }
  $out['schools'][$school] = summarize($ics, $from, $to);
  $anyOk = true;
}

if ($anyOk) @file_put_contents($cacheFile, json_encode($out));
elseif ($cached) $out = $cached;   // every feed failed -- serve the last good copy
echo json_encode($out);


/* ---------------------------------------------------------------------- */

function fetch($url) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_ENCODING => '', CURLOPT_USERAGENT => 'SchalmontPTO/1.0',
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  return ($body !== false && $code === 200) ? $body : null;
}

function summarize($ics, $from, $to) {
  $ics = preg_replace("/\r?\n[ \t]/", '', $ics);   // unfold continuation lines
  $letters = []; $noSchool = []; $lastLetter = '';
  foreach (explode('BEGIN:VEVENT', $ics) as $i => $ev) {
    if ($i === 0) continue;
    if (!preg_match('/^SUMMARY[^:]*:(.*)$/m', $ev, $s)) continue;
    if (!preg_match('/^DTSTART[^:]*:(\d{8})/m', $ev, $d)) continue;
    if (preg_match('/^STATUS:CANCELLED/m', $ev)) continue;
    $summary = trim(str_replace(['\\,', '\\;', '\\n'], [',', ';', ' '], $s[1]));
    $start = ymd($d[1]);

    // "A" Day, A Day, A-Day -- the letter alone, nothing else in the title.
    if (preg_match('/^["“”\']?([A-F])["“”\']?\s*-?\s*Day$/i', $summary, $m)) {
      $letter = strtoupper($m[1]);
      if ($start > $lastLetter) $lastLetter = $start;
      if ($start >= $from && $start <= $to) $letters[$start] = $letter;
      continue;
    }

    if (preg_match('/\bno school\b/i', $summary)) {
      // All-day events run DTSTART..DTEND-1 (DTEND is exclusive).
      $end = $start;
      if (preg_match('/^DTEND[^:]*:(\d{8})/m', $ev, $e)) {
        $end = date('Y-m-d', strtotime(ymd($e[1]) . ' -1 day'));
        if ($end < $start) $end = $start;
      }
      $reason = trim(preg_replace('/^\s*no school\s*[-–—:]*\s*/i', '', $summary)) ?: 'No School';
      for ($t = max($start, $from); $t <= min($end, $to); $t = date('Y-m-d', strtotime($t . ' +1 day'))) {
        $noSchool[$t] = $reason;
      }
    }
  }
  ksort($letters); ksort($noSchool);
  return ['ok' => true, 'letters' => $letters, 'noSchool' => $noSchool, 'lastLetter' => $lastLetter];
}

function ymd($compact) { return substr($compact, 0, 4) . '-' . substr($compact, 4, 2) . '-' . substr($compact, 6, 2); }
