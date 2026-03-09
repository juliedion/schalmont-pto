<?php
/**
 * fix-permissions.php — Called by GitHub Actions after each deploy
 * Sets correct permissions on all files (644) and directories (755)
 */
$token = isset($_GET['token']) ? $_GET['token'] : '';
if ($token !== getenv('FIX_PERMS_TOKEN') && $token !== 'schalmontpto2026fix') {
    http_response_code(403);
    exit('Forbidden');
}

$root = __DIR__;
$count = 0;

$iter = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);

foreach ($iter as $path) {
    if ($path->isDir()) {
        chmod($path->getPathname(), 0755);
    } else {
        chmod($path->getPathname(), 0644);
        $count++;
    }
}

echo "Done. Fixed permissions on $count files.";
