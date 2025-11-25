<?php
declare(strict_types=1);

/**
 * Endpoint para salvar dados do pedido no backend
 * 
 * Chamado pelo frontend após criar a preferência de pagamento,
 * para que o webhook possa recuperar os dados quando o pagamento for aprovado.
 */

require_once __DIR__ . '/order_storage.php';

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Apenas POST permitido
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

// Ler payload
$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!$payload || empty($payload['orderId']) || empty($payload['orderData'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados inválidos']);
    exit;
}

$orderId = $payload['orderId'];
$orderData = $payload['orderData'];

// Log para debug
$logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$timestamp = date('Y-m-d H:i:s');
@file_put_contents($logFile, "[{$timestamp}] [Save Order] Recebendo pedido para salvar\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] [Save Order] OrderId: {$orderId}\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] [Save Order] OrderData keys: " . implode(', ', array_keys($orderData)) . "\n", FILE_APPEND);

// Adicionar timestamp
$orderData['createdAt'] = date('Y-m-d H:i:s');
$orderData['status'] = 'pending_payment';
$orderData['orderId'] = $orderId; // Garantir que orderId está nos dados
$orderData['externalReference'] = $orderId; // Garantir que externalReference está nos dados

// Salvar pedido
$success = saveOrder($orderId, $orderData);

if ($success) {
    @file_put_contents($logFile, "[{$timestamp}] [Save Order] Pedido salvo com sucesso: {$orderId}\n", FILE_APPEND);
    http_response_code(201);
    echo json_encode([
        'status' => 'ok',
        'orderId' => $orderId,
        'message' => 'Pedido salvo com sucesso'
    ]);
} else {
    @file_put_contents($logFile, "[{$timestamp}] [Save Order] ERRO ao salvar pedido: {$orderId}\n", FILE_APPEND);
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao salvar pedido']);
}

