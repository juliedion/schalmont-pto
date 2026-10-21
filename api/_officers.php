<?php
/* ============================================================
   Who may change the website itself (the Live Editor).
   Officers = the `adminEmails` list in js/firebase-config.js -- the same list the
   back office uses -- so adding or removing an officer there is all it takes.
   The demo/presentation login can look around but never publish.
   ============================================================ */

require_once __DIR__ . '/_verify.php';

function officer_emails() {
  $src = @file_get_contents(__DIR__ . '/../js/firebase-config.js');
  if (!$src || !preg_match('/adminEmails\s*=\s*\[(.*?)\]/s', $src, $m)) return [];
  preg_match_all('/["\']([^"\']+@[^"\']+)["\']/', $m[1], $e);
  return array_map('strtolower', $e[1]);
}

/* The signed-in officer's token claims, or null. $canPublish = false also lets the demo login in. */
function current_officer($bodyToken = null, $canPublish = true) {
  $u = firebase_current_user($bodyToken);
  if (!$u || empty($u['email'])) return null;
  $email = strtolower($u['email']);
  if (!in_array($email, officer_emails(), true)) return null;
  if ($canPublish && strpos($email, 'demo@') === 0) return null;   // presentation login: read-only
  return $u;
}

/* Pages the Live Editor may open: top-level public pages only. */
const LIVE_EDIT_BLOCKED = [
  'login.html', 'signup.html', 'pending.html', 'p.html', 'admin-users.html', 'send-blast.html',
  'cancel-booking.html', 'massage-signup.html', 'raffle-signup.html', 'tat-teacher-order.html',
];
function live_edit_page_ok($page) {
  $page = (string)$page;
  return preg_match('/^[a-z0-9][a-z0-9-]*\.html$/', $page) && !in_array($page, LIVE_EDIT_BLOCKED, true)
    && is_file(__DIR__ . '/../' . $page);
}
