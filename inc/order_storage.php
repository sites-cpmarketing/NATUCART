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
    
    // Log para debug
    $logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Buscando pedido: {$orderId}\n", FILE_APPEND);
    @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Caminho do arquivo: {$filePath}\n", FILE_APPEND);
    
    if (!file_exists($filePath)) {
        @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Arquivo não encontrado: {$filePath}\n", FILE_APPEND);
        return null;
    }
    
    $content = @file_get_contents($filePath);
    if ($content === false) {
        @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Erro ao ler arquivo: {$filePath}\n", FILE_APPEND);
        return null;
    }
    
    $data = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Erro ao decodificar JSON: " . json_last_error_msg() . "\n", FILE_APPEND);
        return null;
    }
    
    @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Dados decodificados: " . json_encode($data, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
    
    $orderData = $data['data'] ?? null;
    if (!$orderData) {
        @file_put_contents($logFile, "[{$timestamp}] [Order Storage] Chave 'data' não encontrada no JSON. Chaves disponíveis: " . implode(', ', array_keys($data)) . "\n", FILE_APPEND);
    }
    
    return $orderData;
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

