<?php
/**
 * Endpoint de debug para verificar último pagamento processado
 * 
 * Acesse: https://sites-wordpress-natucart-back.8szsdx.easypanel.host/inc/debug_payment.php?paymentId=SEU_PAYMENT_ID
 */

// Access Token do Mercado Pago
const MP_FALLBACK_ACCESS_TOKEN = 'APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520';

header('Content-Type: application/json; charset=utf-8');

$paymentId = $_GET['paymentId'] ?? '';

if (empty($paymentId)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Informe o paymentId: ?paymentId=SEU_PAYMENT_ID'
    ], JSON_PRETTY_PRINT);
    exit;
}

// Buscar informações do pagamento
$accessToken = getenv('MP_ACCESS_TOKEN') ?: MP_FALLBACK_ACCESS_TOKEN;
$endpoint = "https://api.mercadopago.com/v1/payments/{$paymentId}";

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken
    ],
    CURLOPT_TIMEOUT => 10
]);

$result = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao buscar pagamento',
        'httpCode' => $httpCode,
        'response' => $result
    ], JSON_PRETTY_PRINT);
    exit;
}

$paymentInfo = json_decode($result, true);

// Buscar pedido pelo external_reference
require_once __DIR__ . '/order_storage.php';
$externalReference = $paymentInfo['external_reference'] ?? '';
$orderData = null;

if (!empty($externalReference)) {
    $orderData = getOrder($externalReference);
}

echo json_encode([
    'status' => 'ok',
    'payment' => [
        'id' => $paymentInfo['id'] ?? 'N/A',
        'status' => $paymentInfo['status'] ?? 'N/A',
        'status_detail' => $paymentInfo['status_detail'] ?? 'N/A',
        'external_reference' => $externalReference,
        'transaction_amount' => $paymentInfo['transaction_amount'] ?? 0,
        'payment_method_id' => $paymentInfo['payment_method_id'] ?? 'N/A',
        'date_created' => $paymentInfo['date_created'] ?? 'N/A'
    ],
    'order' => $orderData ? [
        'found' => true,
        'orderId' => $externalReference,
        'hasCustomer' => !empty($orderData['customer']),
        'hasAddress' => !empty($orderData['address']),
        'hasItems' => !empty($orderData['items']),
        'hasFreight' => !empty($orderData['freight'])
    ] : [
        'found' => false,
        'orderId' => $externalReference,
        'message' => 'Pedido não encontrado no storage'
    ]
], JSON_PRETTY_PRINT);

