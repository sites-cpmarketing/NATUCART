<?php
declare(strict_types=1);

/**
 * Sistema simples de armazenamento de pedidos
 * 
 * Por enquanto usa arquivos JSON. Em produção, recomenda-se usar banco de dados.
 */

const ORDERS_DIR = __DIR__ . '/../data/orders';

/**
 * Garante que o diretório de pedidos existe
 */
function ensureOrdersDirectory(): void
{
    if (!is_dir(ORDERS_DIR)) {
        @mkdir(ORDERS_DIR, 0755, true);
    }
}

/**
 * Salva dados de um pedido
 * 
 * @param string $orderId ID do pedido
 * @param array $orderData Dados do pedido
 * @return bool Sucesso
 */
function saveOrder(string $orderId, array $orderData): bool
{
    ensureOrdersDirectory();
    
    $filePath = ORDERS_DIR . '/' . $orderId . '.json';
    $dataToSave = [
        'orderId' => $orderId,
        'createdAt' => date('Y-m-d H:i:s'),
        'data' => $orderData
    ];
    
    return @file_put_contents($filePath, json_encode($dataToSave, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
}

/**
 * Recupera dados de um pedido
 * 
 * @param string $orderId ID do pedido
 * @return array|null Dados do pedido ou null se não encontrado
 */
function getOrder(string $orderId): ?array
{
    $filePath = ORDERS_DIR . '/' . $orderId . '.json';
    
    if (!file_exists($filePath)) {
        return null;
    }
    
    $content = @file_get_contents($filePath);
    if ($content === false) {
        return null;
    }
    
    $data = json_decode($content, true);
    return $data['data'] ?? null;
}

/**
 * Atualiza status de um pedido
 * 
 * @param string $orderId ID do pedido
 * @param string $status Novo status
 * @param array $additionalData Dados adicionais (ex: paymentId, shipmentId)
 * @return bool Sucesso
 */
function updateOrderStatus(string $orderId, string $status, array $additionalData = []): bool
{
    $order = getOrder($orderId);
    if (!$order) {
        return false;
    }
    
    $order['status'] = $status;
    $order['updatedAt'] = date('Y-m-d H:i:s');
    $order = array_merge($order, $additionalData);
    
    return saveOrder($orderId, $order);
}

