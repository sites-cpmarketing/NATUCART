<?php
/**
 * Endpoint de debug para verificar notificações e pedidos
 * 
 * Acesse: https://sites-wordpress-natucart-back.8szsdx.easypanel.host/inc/debug_notification.php?orderId=SEU_ORDER_ID
 */

require_once __DIR__ . '/order_storage.php';

header('Content-Type: application/json; charset=utf-8');

$orderId = $_GET['orderId'] ?? '';

if (empty($orderId)) {
    // Listar todos os pedidos
    $ordersDir = __DIR__ . '/../data/orders';
    $orders = [];
    
    if (is_dir($ordersDir)) {
        $files = glob($ordersDir . '/*.json');
        foreach ($files as $file) {
            $filename = basename($file, '.json');
            $content = file_get_contents($file);
            $data = json_decode($content, true);
            $orders[] = [
                'orderId' => $filename,
                'createdAt' => $data['createdAt'] ?? 'N/A',
                'hasData' => isset($data['data']),
                'dataKeys' => isset($data['data']) ? array_keys($data['data']) : []
            ];
        }
    }
    
    echo json_encode([
        'status' => 'ok',
        'message' => 'Lista de pedidos',
        'orders' => $orders,
        'count' => count($orders)
    ], JSON_PRETTY_PRINT);
    exit;
}

// Buscar pedido específico
$orderData = getOrder($orderId);

if (!$orderData) {
    http_response_code(404);
    echo json_encode([
        'status' => 'error',
        'message' => 'Pedido não encontrado',
        'orderId' => $orderId
    ], JSON_PRETTY_PRINT);
    exit;
}

echo json_encode([
    'status' => 'ok',
    'orderId' => $orderId,
    'orderData' => $orderData
], JSON_PRETTY_PRINT);

