<?php
/**
 * api/weather.php — today's weather + a short forecast for the Schalmont Central School
 * District (Rotterdam / Schenectady, NY), for the homepage's "Daily Weather" card.
 *
 * Tries Open-Meteo first, then falls back to the National Weather Service (weather.gov),
 * so one free service having a bad day doesn't blank the card. Neither needs an API key.
 * Cached for 20 minutes so visitors' browsers never call either service directly; if
 * both fail, the last good copy is served (marked stale), or { ok:false }.
 *
 * Output: { ok, source, updated, stale, current: { temp, code, desc },
 *           today: { hi, lo, pop }, days: [ { date, hi, lo, code, desc }, ×4 ], alert }
 * `code` is a WMO weather code (both sources are mapped to it) so the page has one icon set.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=600');
date_default_timezone_set('America/New_York');

const LAT = 42.7765, LON = -73.9278;
const NWS_GRID = 'ALY/65,68';
const NWS_STATION = 'KALB';          // Albany airport -- the grid's primary observation station
const UA = 'SchalmontPTO/1.0 (schalmontpto.com; julie@schalmontpto.com)';
const CACHE_SECONDS = 20 * 60;

$cacheFile = sys_get_temp_dir() . '/pto_weather.json';
$cached = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
if ($cached && time() - filemtime($cacheFile) < CACHE_SECONDS && empty($_GET['refresh'])) { echo json_encode($cached); exit; }

$out = null;
try { $out = open_meteo(); } catch (Throwable $e) { $out = null; }
if (!$out) { try { $out = nws(); } catch (Throwable $e) { $out = null; } }

if ($out) {
  $out['alert'] = nws_alert();
  @file_put_contents($cacheFile, json_encode($out));
  echo json_encode($out);
} elseif ($cached) {
  $cached['stale'] = true;
  echo json_encode($cached);
} else {
  echo json_encode(['ok' => false]);
}


/* ---------------------------------------------------------------------- */

function get_json($url, $timeout = 8) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_ENCODING => '',
    CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_HTTPHEADER => ['User-Agent: ' . UA, 'Accept: application/geo+json, application/json'],
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($body === false || $code !== 200) return null;
  $j = json_decode($body, true);
  return is_array($j) ? $j : null;
}

function open_meteo() {
  $d = get_json('https://api.open-meteo.com/v1/forecast?latitude=' . LAT . '&longitude=' . LON .
    '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' .
    '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=5');
  if (!$d || !isset($d['current']['temperature_2m'], $d['daily']['time'][4])) return null;
  $c = $d['current']; $dl = $d['daily'];
  $days = [];
  for ($i = 1; $i <= 4; $i++) {
    $days[] = ['date' => $dl['time'][$i], 'hi' => round($dl['temperature_2m_max'][$i]), 'lo' => round($dl['temperature_2m_min'][$i]),
               'code' => (int)$dl['weather_code'][$i], 'desc' => ''];
  }
  return [
    'ok' => true, 'source' => 'Open-Meteo', 'updated' => date('c'), 'stale' => false,
    'current' => ['temp' => round($c['temperature_2m']), 'code' => (int)$c['weather_code'], 'desc' => ''],
    'today' => ['hi' => round($dl['temperature_2m_max'][0]), 'lo' => round($dl['temperature_2m_min'][0]),
                'pop' => $dl['precipitation_probability_max'][0] ?? null],
    'days' => $days,
  ];
}

function nws() {
  $f = get_json('https://api.weather.gov/gridpoints/' . NWS_GRID . '/forecast');
  $periods = $f['properties']['periods'] ?? null;
  if (!$periods) return null;

  // Group the day/night periods by date: daytime = high, the night that follows = low.
  $byDate = [];
  foreach ($periods as $p) {
    $date = substr($p['startTime'], 0, 10);
    $t = (int)$p['temperature'];
    if (!isset($byDate[$date])) $byDate[$date] = ['hi' => null, 'lo' => null, 'desc' => '', 'pop' => null];
    if ($p['isDaytime']) {
      $byDate[$date]['hi'] = $t;
      $byDate[$date]['desc'] = $p['shortForecast'];
      $byDate[$date]['pop'] = $p['probabilityOfPrecipitation']['value'] ?? null;
    } else {
      $byDate[$date]['lo'] = $t;
      if ($byDate[$date]['desc'] === '') $byDate[$date]['desc'] = $p['shortForecast'];
    }
  }
  $today = date('Y-m-d');
  $todayRow = $byDate[$today] ?? reset($byDate);
  $first = $periods[0];

  // Current conditions from the nearest observation station (falls back to the forecast).
  $obs = get_json('https://api.weather.gov/stations/' . NWS_STATION . '/observations/latest', 6);
  $tempC = $obs['properties']['temperature']['value'] ?? null;
  $obsDesc = trim($obs['properties']['textDescription'] ?? '');
  $obsAge = isset($obs['properties']['timestamp']) ? time() - strtotime($obs['properties']['timestamp']) : 99999;
  $useObs = $tempC !== null && $obsAge < 2 * 3600;
  $curTemp = $useObs ? round($tempC * 9 / 5 + 32) : (int)$first['temperature'];
  $curDesc = ($useObs && $obsDesc !== '') ? $obsDesc : $first['shortForecast'];

  $days = [];
  foreach ($byDate as $date => $row) {
    if ($date <= $today || count($days) >= 4) continue;
    $days[] = ['date' => $date, 'hi' => $row['hi'], 'lo' => $row['lo'], 'code' => text_to_wmo($row['desc']), 'desc' => $row['desc']];
  }
  if (count($days) < 4) return null;

  return [
    'ok' => true, 'source' => 'National Weather Service', 'updated' => date('c'), 'stale' => false,
    'current' => ['temp' => $curTemp, 'code' => text_to_wmo($curDesc), 'desc' => $curDesc],
    'today' => ['hi' => $todayRow['hi'] ?? (int)$first['temperature'], 'lo' => $todayRow['lo'], 'pop' => $todayRow['pop']],
    'days' => $days,
  ];
}

// Active NWS alert headline for this spot, if any (winter storm warning etc.).
function nws_alert() {
  $a = get_json('https://api.weather.gov/alerts/active?point=' . LAT . ',' . LON, 5);
  return $a['features'][0]['properties']['event'] ?? null;
}

// NWS describes weather in words; map them onto the same WMO codes Open-Meteo uses.
function text_to_wmo($t) {
  $t = strtolower($t);
  if (strpos($t, 'thunder') !== false) return 95;
  if (strpos($t, 'freezing') !== false) return 66;
  if (strpos($t, 'heavy snow') !== false || strpos($t, 'blizzard') !== false) return 75;
  if (strpos($t, 'snow') !== false || strpos($t, 'flurr') !== false) return strpos($t, 'shower') !== false ? 85 : 73;
  if (strpos($t, 'sleet') !== false) return 66;
  if (strpos($t, 'heavy rain') !== false) return 65;
  if (strpos($t, 'shower') !== false) return (strpos($t, 'chance') !== false ? 80 : 81);
  if (strpos($t, 'rain') !== false) return (strpos($t, 'light') !== false || strpos($t, 'chance') !== false) ? 61 : 63;
  if (strpos($t, 'drizzle') !== false) return 53;
  if (strpos($t, 'fog') !== false || strpos($t, 'haze') !== false || strpos($t, 'smoke') !== false) return 45;
  if (strpos($t, 'mostly cloudy') !== false || strpos($t, 'overcast') !== false || $t === 'cloudy') return 3;
  if (strpos($t, 'partly') !== false) return 2;
  if (strpos($t, 'mostly sunny') !== false || strpos($t, 'mostly clear') !== false) return 1;
  if (strpos($t, 'sunny') !== false || strpos($t, 'clear') !== false || strpos($t, 'fair') !== false) return 0;
  if (strpos($t, 'cloud') !== false) return 3;
  return 2;
}
