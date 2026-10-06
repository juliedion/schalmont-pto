<?php
/**
 * p.php — serves p.html (the back-office page viewer) with THIS page's own link-preview
 * tags filled in: title, blurb and picture.
 *
 * Texting apps, Facebook etc. never run the page's JavaScript -- they only read the
 * <meta> tags in the HTML as sent -- so without this every page link previews as the
 * generic PTO logo. .htaccess sends /ms/<slug>, /p/<slug>, /<slug> here instead of
 * straight to p.html. The page itself still renders client-side exactly as before;
 * if anything here fails, p.html goes out unchanged.
 *
 * Picture: the page's "Link preview" picture (shareImage), else its first photo,
 * else the PTO logo. Blurb: shareDesc, else the first paragraph's text.
 */

const SITE = 'https://schalmontpto.com';
const DEFAULT_IMAGE = SITE . '/images/Schalmont-PTO-logo.png';
const FIREBASE_PROJECT = 'schalmont-pto';
const FIREBASE_KEY = 'AIzaSyCaH3Xo14pCxhxgvtg31Co2gDi1VuAHoFk'; // public web key, same as js/firebase-config.js
const CACHE_SECONDS = 300;

$html = file_get_contents(__DIR__ . '/p.html');
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, must-revalidate');

$slug   = preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['slug'] ?? '');
$prefix = preg_replace('/[^a-z]/', '', $_GET['prefix'] ?? '');
if ($slug === '' || isset($_GET['preview'])) { echo $html; exit; }

$PREFIX_SCHOOL = ['woestina' => 'woestina', 'jefferson' => 'jefferson', 'ms' => 'middle', 'hs' => 'high', 'pto' => 'pto'];
$wantSchool = $PREFIX_SCHOOL[$prefix] ?? '';

$page = null;
try { $page = find_page($slug, $wantSchool); } catch (Throwable $e) { $page = null; }
if (!$page) { echo $html; exit; }

// Some titles are stored with HTML entities already in them ("Craft Fair &amp; ...").
$plain = fn($s) => trim(html_entity_decode((string)$s, ENT_QUOTES, 'UTF-8'));
$title = $plain($page['title'] ?? '') ?: 'Schalmont PTO';
$desc  = $plain($page['shareDesc'] ?? '') ?: first_text($page['blocks'] ?? []);
$image = trim($page['shareImage'] ?? '') ?: first_photo($page['blocks'] ?? []);
$image = absolute_url($image) ?: DEFAULT_IMAGE;
$url   = SITE . strtok($_SERVER['REQUEST_URI'] ?? '/', '?');

$h = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$tags = "  <meta property=\"og:title\" content=\"{$h($title)}\">\n" .
        "  <meta property=\"og:site_name\" content=\"Schalmont PTO\">\n" .
        "  <meta property=\"og:url\" content=\"{$h($url)}\">\n" .
        "  <meta property=\"og:image\" content=\"{$h($image)}\">\n" .
        "  <meta property=\"og:type\" content=\"website\">\n" .
        ($desc !== '' ? "  <meta property=\"og:description\" content=\"{$h($desc)}\">\n" .
                        "  <meta name=\"description\" content=\"{$h($desc)}\">\n" : '') .
        "  <meta name=\"twitter:card\" content=\"summary_large_image\">\n" .
        "  <meta name=\"twitter:image\" content=\"{$h($image)}\">\n" .
        "  <title>{$h($title)} — Schalmont PTO</title>\n";

// Swap out p.html's generic og:/twitter: tags and <title> for this page's own.
$out = preg_replace('/^\s*<meta (property="og:|name="twitter:)[^>]*>\s*\n/m', '', $html);
$out = preg_replace('/^\s*<title>.*?<\/title>\s*\n/m', $tags, $out, 1, $n);
echo ($out && $n) ? $out : $html;


/* ---------------------------------------------------------------------- */

// Same lookup p.html does: a published page with this slug, on the right school's
// address. Cached a few minutes on disk so ordinary visits don't each pay for it.
function find_page($slug, $wantSchool) {
  $cacheFile = sys_get_temp_dir() . '/ptopage_' . md5($slug . '|' . $wantSchool) . '.json';
  if (is_file($cacheFile) && time() - filemtime($cacheFile) < CACHE_SECONDS) {
    $c = json_decode(file_get_contents($cacheFile), true);
    if (is_array($c)) return $c['page'];
  }
  $eq = fn($f, $v) => ['fieldFilter' => ['field' => ['fieldPath' => $f], 'op' => 'EQUAL', 'value' => ['stringValue' => $v]]];
  $query = ['structuredQuery' => [
    'from' => [['collectionId' => 'pages']],
    'where' => ['compositeFilter' => ['op' => 'AND', 'filters' => [$eq('slug', $slug), $eq('status', 'published')]]],
    'limit' => 10,
  ]];
  $ch = curl_init('https://firestore.googleapis.com/v1/projects/' . FIREBASE_PROJECT .
                  '/databases/(default)/documents:runQuery?key=' . FIREBASE_KEY);
  curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($query),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 4, CURLOPT_CONNECTTIMEOUT => 3,
  ]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code !== 200 || !$res) return null;   // don't cache failures

  $page = null;
  foreach (json_decode($res, true) ?: [] as $row) {
    if (empty($row['document']['fields'])) continue;
    $d = fs_value(['mapValue' => ['fields' => $row['document']['fields']]]);
    if ($wantSchool === '' || route_of($d) === $wantSchool) { $page = $d; break; }
  }
  @file_put_contents($cacheFile, json_encode(['page' => $page]));
  return $page;
}

// Firestore REST value -> plain PHP value.
function fs_value($v) {
  if (isset($v['mapValue'])) {
    $o = [];
    foreach ($v['mapValue']['fields'] ?? [] as $k => $x) $o[$k] = fs_value($x);
    return $o;
  }
  if (isset($v['arrayValue'])) return array_map('fs_value', $v['arrayValue']['values'] ?? []);
  foreach (['stringValue', 'booleanValue', 'doubleValue', 'timestampValue'] as $k)
    if (array_key_exists($k, $v)) return $v[$k];
  if (isset($v['integerValue'])) return (int)$v['integerValue'];
  return null;
}

// Mirrors routeOf() in p.html: one school -> that school, several -> 'pto', none -> ''.
function route_of($d) {
  $list = (!empty($d['schools']) && is_array($d['schools'])) ? $d['schools'] : (!empty($d['school']) ? [$d['school']] : []);
  if (count($list) === 1) return $list[0];
  return count($list) === 0 ? '' : 'pto';
}

function first_photo($blocks) {
  foreach ((array)$blocks as $b) {
    if (($b['type'] ?? '') === 'image' && !empty($b['url'])) return $b['url'];
    if (($b['type'] ?? '') === 'columns') foreach ((array)($b['cells'] ?? []) as $c) {
      foreach ((array)($c['blocks'] ?? []) as $cb)
        if (($cb['type'] ?? '') === 'image' && !empty($cb['url'])) return $cb['url'];
      if (!empty($c['imageUrl'])) return $c['imageUrl'];
    }
  }
  return '';
}

// First paragraph (or paragraph-style heading) as plain text, trimmed to ~200 chars.
function first_text($blocks) {
  foreach ((array)$blocks as $b) {
    $t = $b['type'] ?? '';
    if ($t === 'paragraph' || ($t === 'heading' && ($b['level'] ?? '') === 'p')) {
      $s = preg_replace('/<br\s*\/?>|<\/(li|div|p)>/i', ' ', (string)($b['text'] ?? ''));
      $s = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($s), ENT_QUOTES, 'UTF-8')));
      if ($s === '') continue;
      return mb_strlen($s) > 200 ? rtrim(mb_substr($s, 0, 197)) . '…' : $s;
    }
  }
  return '';
}

// Previews need a full https:// address; uploads are saved as /uploads/...
function absolute_url($u) {
  $u = trim((string)$u);
  if ($u === '') return '';
  if (preg_match('#^https?://#i', $u)) return $u;
  if ($u[0] === '/') return SITE . $u;
  return '';
}
