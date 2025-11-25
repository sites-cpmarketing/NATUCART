<?php
/**
 * Endpoint para buscar dados de um pedido pelo external_reference
 * 
 * Usado pelo n8n para obter dados completos do pedido após pagamento aprovado
 */

require_once __DIR__ . '/order_storage.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Apenas GET permitido
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$orderId = $_GET['orderId'] ?? $_GET['external_reference'] ?? '';

if (empty($orderId)) {
    http_response_code(400);
    echo json_encode(['error' => 'orderId ou external_reference é obrigatório']);
    exit;
}

$orderData = getOrder($orderId);

if (!$orderData) {
    http_response_code(404);
    echo json_encode(['error' => 'Pedido não encontrado', 'orderId' => $orderId]);
    exit;
}

// Log para debug
$logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
$timestamp = date('Y-m-d H:i:s');
@file_put_contents($logFile, "[{$timestamp}] [Get Order] Retornando dados do pedido {$orderId}\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] [Get Order] Estrutura: " . json_encode([
    'hasCustomer' => !empty($orderData['customer']),
    'hasAddress' => !empty($orderData['address']),
    'hasItems' => !empty($orderData['items']),
    'hasFreight' => !empty($orderData['freight']),
    'hasTotals' => !empty($orderData['totals']),
    'keys' => array_keys($orderData)
], JSON_PRETTY_PRINT) . "\n", FILE_APPEND);

http_response_code(200);
echo json_encode([
    'status' => 'ok',
    'orderId' => $orderId,
    'orderData' => $orderData
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

