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

// Adicionar timestamp
$orderData['createdAt'] = date('Y-m-d H:i:s');
$orderData['status'] = 'pending_payment';

// Salvar pedido
$success = saveOrder($orderId, $orderData);

if ($success) {
    http_response_code(201);
    echo json_encode([
        'status' => 'ok',
        'orderId' => $orderId,
        'message' => 'Pedido salvo com sucesso'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao salvar pedido']);
}

