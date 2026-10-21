<?php
/* ============================================================
   Live Editor ⇄ GitHub. The website's pages live in GitHub; this reads them and
   saves edits back there as ordinary commits. The normal deploy (GitHub Actions →
   Bluehost) then puts the change live a minute later. This file never writes any
   website file on this server.

   GET  ?action=source&page=about.html            → { html, sha }        (current version)
   GET  ?action=history&page=about.html           → { versions:[{sha, when, who, message}] }
   GET  ?action=version&page=about.html&ref=<sha> → { html }             (an older version)
   POST { action:"publish", page, html, sha, idToken } → { commit }
        sha = the version the editor started from; GitHub refuses the save if someone
        else published in between, so nobody silently overwrites anyone.

   Officers only (api/_officers.php). Needs github_token in api/config.php.
   ============================================================ */

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
require __DIR__ . '/_officers.php';

function out($c, $a) { http_response_code($c); echo json_encode($a); exit; }

$cfg = @include __DIR__ . '/config.php';
if (!is_array($cfg) || empty($cfg['github_token'])) {
  out(503, ['ok' => false, 'setup' => true, 'error' => 'The Live Editor isn\'t connected to GitHub yet. See api/config.example.php (one-time setup).']);
}
$REPO = $cfg['github_repo'] ?? 'juliedion/schalmont-pto';
$BRANCH = $cfg['github_branch'] ?? 'main';

$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = $isPost ? (json_decode(file_get_contents('php://input'), true) ?: []) : $_GET;
$action = $in['action'] ?? '';
$user = current_officer($in['idToken'] ?? null, $action === 'publish');
if (!$user) {
  out(403, ['ok' => false, 'error' => $action === 'publish'
    ? 'Only PTO officers can publish website changes (the demo login can only look).'
    : 'The Live Editor is for PTO officers.']);
}

$page = (string)($in['page'] ?? '');
if (!live_edit_page_ok($page)) out(400, ['ok' => false, 'error' => 'That page can\'t be edited here.']);

function gh($method, $path, $body = null) {
  global $cfg, $REPO;
  $ch = curl_init("https://api.github.com/repos/$REPO/$path");
  $hdr = ['Authorization: Bearer ' . $cfg['github_token'], 'Accept: application/vnd.github+json',
          'User-Agent: SchalmontPTO-LiveEditor', 'X-GitHub-Api-Version: 2022-11-28'];
  if ($body !== null) $hdr[] = 'Content-Type: application/json';
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $hdr]);
  if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
  $res = curl_exec($ch);
  return [curl_getinfo($ch, CURLINFO_HTTP_CODE), json_decode((string)$res, true)];
}
function file_at($page, $ref) {
  [$code, $f] = gh('GET', 'contents/' . rawurlencode($page) . '?ref=' . rawurlencode($ref));
  if ($code !== 200 || empty($f['content'])) return null;
  return ['html' => base64_decode($f['content']), 'sha' => $f['sha']];
}

if ($action === 'source') {
  $f = file_at($page, $BRANCH);
  if (!$f) out(502, ['ok' => false, 'error' => 'Couldn\'t read that page from GitHub. Try again in a minute.']);
  out(200, ['ok' => true, 'html' => $f['html'], 'sha' => $f['sha'], 'branch' => $BRANCH]);
}

if ($action === 'history') {
  [$code, $list] = gh('GET', 'commits?path=' . rawurlencode($page) . '&sha=' . rawurlencode($BRANCH) . '&per_page=30');
  if ($code !== 200 || !is_array($list)) out(502, ['ok' => false, 'error' => 'Couldn\'t load the history.']);
  out(200, ['ok' => true, 'versions' => array_map(function ($c) {
    return ['sha' => $c['sha'], 'when' => $c['commit']['author']['date'] ?? '',
            'who' => $c['commit']['author']['name'] ?? '', 'message' => strtok($c['commit']['message'] ?? '', "\n")];
  }, $list)]);
}

if ($action === 'version') {
  $ref = (string)($in['ref'] ?? '');
  if (!preg_match('/^[0-9a-f]{40}$/', $ref)) out(400, ['ok' => false, 'error' => 'Unknown version.']);
  $f = file_at($page, $ref);
  if (!$f) out(404, ['ok' => false, 'error' => 'That version couldn\'t be found.']);
  out(200, ['ok' => true, 'html' => $f['html']]);
}

if ($action === 'publish' && $isPost) {
  $html = (string)($in['html'] ?? '');
  $sha = (string)($in['sha'] ?? '');
  if (!preg_match('/^[0-9a-f]{40}$/', $sha)) out(400, ['ok' => false, 'error' => 'Reload the page in the editor and try again.']);
  if (strlen($html) < 200 || strlen($html) > 3 * 1024 * 1024 || stripos($html, '</html>') === false || stripos($html, '<body') === false) {
    out(400, ['ok' => false, 'error' => 'The page came through incomplete. Nothing was published.']);
  }
  // The editor changes words, links and pictures -- never code. Compare with the current
  // version: same scripts, no new event-handler attributes, no javascript: links.
  $cur = file_at($page, $BRANCH);
  if (!$cur) out(502, ['ok' => false, 'error' => 'Couldn\'t reach GitHub. Nothing was published.']);
  // Compare which scripts load (count + sources), not the exact tag text -- a browser
  // writes `defer` back as `defer=""`.
  $scripts = function ($h) {
    preg_match_all('/<script\b([^>]*)>/i', $h, $m);
    return array_map(function ($a) { return preg_match('/\ssrc\s*=\s*["\']?([^"\'\s>]+)/i', $a, $s) ? $s[1] : '(inline)'; }, $m[1]);
  };
  if ($scripts($html) !== $scripts($cur['html'])
      || preg_match_all('/\son[a-z]+\s*=/i', $html) > preg_match_all('/\son[a-z]+\s*=/i', $cur['html'])
      || preg_match('/(href|src)\s*=\s*["\']?\s*javascript:/i', $html)) {
    out(400, ['ok' => false, 'error' => 'The page contains code the editor doesn\'t allow. Nothing was published.']);
  }
  $who = $user['email'];
  [$code, $res] = gh('PUT', 'contents/' . rawurlencode($page), [
    'message' => "Live edit: $page\n\nPublished from the PTO Back Office by $who.",
    'content' => base64_encode($html), 'sha' => $sha, 'branch' => $BRANCH,
    'author' => ['name' => $user['name'] ?? $who, 'email' => $who],
  ]);
  if ($code === 409 || $code === 422) {
    out(409, ['ok' => false, 'conflict' => true, 'error' => 'Someone else published this page since you opened it. Reload it to see their version, then redo your change.']);
  }
  if ($code !== 200 && $code !== 201) out(502, ['ok' => false, 'error' => 'GitHub didn\'t accept the change (error ' . $code . '). Nothing was published.']);
  out(200, ['ok' => true, 'sha' => $res['content']['sha'] ?? '', 'commit' => $res['commit']['html_url'] ?? '']);
}

out(400, ['ok' => false, 'error' => 'Unknown request.']);
