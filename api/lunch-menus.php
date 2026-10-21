<?php
/**
 * api/lunch-menus.php — links to each school's CURRENT monthly lunch (and breakfast)
 * menu, for the homepage's "School Lunch Menus" card.
 *
 * The district only publishes menus as monthly PDFs on its Food Services page — there's
 * no structured daily feed — so this does NOT read the PDFs or invent menu items. It
 * reads the links on that page (e.g. "High School Lunch" -> HS_Lunch_Menu_Oct_2026.pdf),
 * works out which month each file is for, and returns this month's (or the newest one
 * posted). Jefferson and the Middle School share one menu. Cached for a few hours; if
 * the page can't be read, the homepage just links to the Food Services page itself.
 *
 * Output: { page, month: "October 2026", schools: { woestina: { lunch, breakfast, month },
 *           jefferson: {…}, middle: {…}, high: {…} } }
 */

// A PHP notice or warning printed into the response would break the JSON (and the card).
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600');
date_default_timezone_set('America/New_York');

const PAGE = 'https://www.schalmont.org/district-office-services/food-services/';
const CACHE_SECONDS = 6 * 3600;

$cacheFile = sys_get_temp_dir() . '/pto_lunch_menus.json';
$cached = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
// The month can roll over inside the cache window -- only trust a copy made this month.
if ($cached && time() - filemtime($cacheFile) < CACHE_SECONDS && date('Y-m', filemtime($cacheFile)) === date('Y-m')
    && empty($_GET['refresh'])) { echo json_encode($cached); exit; }

$html = fetch(PAGE);
if ($html === null) { echo json_encode($cached ?: ['page' => PAGE, 'schools' => new stdClass()]); exit; }

$MONTHS = ['jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7,
           'aug' => 8, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12];
$now = (int)date('Y') * 12 + (int)date('n');

// Every PDF link on the page, sorted into school + meal by its link text.
$found = [];   // "school|meal" => [ [monthIndex, url], ... ]
preg_match_all('#<a\s[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>#is', $html, $links, PREG_SET_ORDER);
foreach ($links as $l) {
  $url = html_entity_decode($l[1], ENT_QUOTES);
  $text = strtolower(trim(html_entity_decode(strip_tags($l[2]), ENT_QUOTES)));
  $meal = strpos($text, 'breakfast') !== false ? 'breakfast' : (strpos($text, 'lunch') !== false ? 'lunch' : '');
  if ($meal === '') continue;
  $schools = [];
  if (strpos($text, 'woestina') !== false) $schools[] = 'woestina';
  if (strpos($text, 'jefferson') !== false) $schools[] = 'jefferson';
  if (strpos($text, 'middle') !== false) $schools[] = 'middle';
  if (strpos($text, 'high') !== false) $schools[] = 'high';
  if (!$schools) continue;

  // Month + year from the file name, e.g. ..._Oct_2026.pdf or ..._Sept_2026.pdf
  $file = basename(parse_url($url, PHP_URL_PATH));
  if (!preg_match('/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[_\-\s]*(20\d\d)/i', $file, $m)) continue;
  $idx = (int)$m[2] * 12 + $MONTHS[strtolower(substr($m[1], 0, 3))];
  foreach ($schools as $s) $found["$s|$meal"][] = [$idx, $url];
}

$out = ['page' => PAGE, 'generated' => date('c'), 'schools' => []];
foreach (['woestina', 'jefferson', 'middle', 'high'] as $s) {
  foreach (['lunch', 'breakfast'] as $meal) {
    $pick = best($found["$s|$meal"] ?? [], $now);
    if (!$pick) continue;
    $out['schools'][$s][$meal] = $pick[1];
    $out['schools'][$s][$meal . 'Month'] = date('F Y', mktime(0, 0, 0, ($pick[0] - 1) % 12 + 1, 1, intdiv($pick[0] - 1, 12)));
    $out['schools'][$s][$meal . 'Current'] = ($pick[0] === $now);
  }
}
if (!$out['schools']) $out['schools'] = new stdClass();
@file_put_contents($cacheFile, json_encode($out));
echo json_encode($out);


/* ---------------------------------------------------------------------- */

// This month's file if there is one, else the newest that isn't for a future month,
// else the soonest upcoming one (e.g. next month's menu posted early in summer).
function best($list, $now) {
  if (!$list) return null;
  usort($list, fn($a, $b) => $b[0] <=> $a[0]);
  foreach ($list as $x) if ($x[0] <= $now) return $x;
  return end($list);
}

function fetch($url) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_ENCODING => '',
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; SchalmontPTO/1.0; +https://schalmontpto.com)',
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  return ($body !== false && $code === 200) ? $body : null;
}
