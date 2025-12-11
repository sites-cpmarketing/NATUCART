<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$orderId = $_GET['orderId'] ?? $_GET['external_reference'] ?? '';

if (!$orderId) {
    http_response_code(400);
    echo json_encode(['error' => 'orderId ou external_reference é obrigatório']);
    exit;
}

$accessToken = getenv('MP_ACCESS_TOKEN') ?: 'APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520';
if (!$accessToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Access Token do Mercado Pago não configurado.']);
    exit;
}

$endpoint = 'https://api.mercadopago.com/v1/payments/search?external_reference=' . urlencode($orderId);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken
    ],
    CURLOPT_TIMEOUT => 10,
    CURLOPT_CONNECTTIMEOUT => 5
]);

$result = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'connection_error', 'detail' => $curlError]);
    exit;
}

$data = json_decode($result, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode(['error' => 'invalid_response', 'detail' => 'JSON decode error']);
    exit;
}

$results = $data['results'] ?? [];
$payment = $results[0] ?? null;

if (!$payment) {
    http_response_code(404);
    echo json_encode(['error' => 'payment_not_found', 'orderId' => $orderId]);
    exit;
}

$response = [
    'status' => $payment['status'] ?? null,
    'status_detail' => $payment['status_detail'] ?? null,
    'payment_id' => $payment['id'] ?? null,
    'orderId' => $orderId
];

http_response_code(200);
echo json_encode($response);

