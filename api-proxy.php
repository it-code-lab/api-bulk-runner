<?php
/**
 * Optional hosted PHP proxy for API Bulk Runner.
 * Recommended only for trusted/private use because API keys flow through this server.
 *
 * Setup:
 * 1. Upload this file outside public access if possible, or protect it.
 * 2. Set an environment variable PROXY_TOKEN, or edit $PROXY_TOKEN below.
 * 3. In the app, use this file URL as the proxy endpoint and paste the token.
 */

$PROXY_TOKEN = getenv('PROXY_TOKEN') ?: 'CHANGE_ME_TO_A_LONG_RANDOM_TOKEN';
$MAX_BODY_BYTES = 10 * 1024 * 1024;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Local-Agent-Token');
header('Access-Control-Max-Age: 86400');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response($status, $data) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$token = $_SERVER['HTTP_X_LOCAL_AGENT_TOKEN'] ?? '';
if (!$token || !hash_equals($PROXY_TOKEN, $token)) {
    json_response(401, ['ok' => false, 'error' => 'Invalid or missing X-Local-Agent-Token.']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response(200, [
        'ok' => true,
        'name' => 'ReaderNook API Bulk Runner PHP Proxy',
        'version' => '1.0.0',
        'startedAt' => date('c')
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['ok' => false, 'error' => 'Use POST for request forwarding.']);
}

$raw = file_get_contents('php://input', false, null, 0, $MAX_BODY_BYTES + 1);
if (strlen($raw) > $MAX_BODY_BYTES) {
    json_response(413, ['ok' => false, 'error' => 'Request body too large.']);
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    json_response(400, ['ok' => false, 'error' => 'Invalid JSON body.']);
}

$method = strtoupper($payload['method'] ?? 'GET');
$allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
if (!in_array($method, $allowedMethods, true)) {
    json_response(400, ['ok' => false, 'error' => 'Unsupported HTTP method.']);
}

$url = $payload['url'] ?? '';
if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('/^https?:\/\//i', $url)) {
    json_response(400, ['ok' => false, 'error' => 'Only http and https target URLs are supported.']);
}

$headers = [];
if (isset($payload['headers']) && is_array($payload['headers'])) {
    foreach ($payload['headers'] as $key => $value) {
        $lower = strtolower($key);
        if (in_array($lower, ['host', 'connection', 'content-length'], true)) continue;
        $headers[] = $key . ': ' . $value;
    }
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT_MS, max(1000, min((int)($payload['timeoutMs'] ?? 60000), 300000)));

if (!in_array($method, ['GET', 'HEAD'], true) && array_key_exists('body', $payload)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, (string)$payload['body']);
}

$start = microtime(true);
$response = curl_exec($ch);
if ($response === false) {
    json_response(502, ['ok' => false, 'error' => curl_error($ch)]);
}

$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$body = substr($response, $headerSize);
$elapsedMs = (int)round((microtime(true) - $start) * 1000);
curl_close($ch);

json_response(200, [
    'ok' => $status >= 200 && $status < 300,
    'status' => $status,
    'statusText' => '',
    'headers' => new stdClass(),
    'body' => $body,
    'elapsedMs' => $elapsedMs,
    'targetUrl' => $url
]);
