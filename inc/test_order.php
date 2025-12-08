<?php
/**
 * Endpoint de teste para verificar se os dados estão sendo salvos corretamente
 */

require_once __DIR__ . '/order_storage.php';

header('Content-Type: application/json; charset=utf-8');

// Listar todos os pedidos
$ordersDir = __DIR__ . '/../data/orders';
$orders = [];

if (is_dir($ordersDir)) {
    $files = glob($ordersDir . '/*.json');
    foreach ($files as $file) {
        $filename = basename($file, '.json');
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        $orderData = $data['data'] ?? null;
        
        $orders[] = [
            'orderId' => $filename,
            'createdAt' => $data['createdAt'] ?? 'N/A',
            'hasData' => !empty($orderData),
            'hasCustomer' => !empty($orderData['customer']),
            'hasAddress' => !empty($orderData['address']),
            'hasItems' => !empty($orderData['items']),
            'hasFreight' => !empty($orderData['freight']),
            'customerKeys' => $orderData ? array_keys($orderData['customer'] ?? []) : [],
            'addressKeys' => $orderData ? array_keys($orderData['address'] ?? []) : [],
            'fullData' => $orderData // Mostrar dados completos
        ];
    }
}

echo json_encode([
    'status' => 'ok',
    'ordersCount' => count($orders),
    'orders' => $orders
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

