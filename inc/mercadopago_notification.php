<?php
declare(strict_types=1);

/**
 * Endpoint para receber notificações do Mercado Pago (Webhook)
 * 
 * Este endpoint recebe notificações quando o status de um pagamento muda.
 * Configure a URL deste arquivo no painel do Mercado Pago:
 * https://www.mercadopago.com.br/developers/panel/app/{APP_ID}/webhooks
 * 
 * URL completa: https://natucart.vercel.app/inc/mercadopago_notification.php
 * 
 * ATENÇÃO: Este arquivo está configurado com credenciais de PRODUÇÃO.
 * Certifique-se de que o servidor está seguro e protegido.
 */

// Access Token do Mercado Pago (para validar notificações)
const MP_FALLBACK_ACCESS_TOKEN = 'APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520';

// Headers
header('Content-Type: application/json; charset=utf-8');

// Log de todas as notificações recebidas (para debug)
function logNotification(string $data): void
{
    $logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
    $logDir = dirname($logFile);
    
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$data}\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// Ler dados da notificação
$rawBody = file_get_contents('php://input');
$headers = getallheaders();

// Log da notificação recebida
logNotification("Headers: " . json_encode($headers) . "\nBody: " . $rawBody);

// Verificar se é uma notificação do Mercado Pago
$topic = '';
$paymentId = '';
$merchantOrderId = '';

if (!isset($_GET['topic']) && !isset($_GET['id']) && !isset($_GET['type']) && !isset($_GET['data.id'])) {
    // Pode ser uma notificação via POST (webhook)
    $payload = json_decode($rawBody, true);
    
    if (is_array($payload) && isset($payload['data']['id'])) {
        $paymentId = $payload['data']['id'];
        $topic = $payload['type'] ?? 'payment';
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Notificação inválida']);
        exit;
    }
} else {
    // Notificação via GET (IPN - Instant Payment Notification)
    $topic = $_GET['topic'] ?? ($_GET['type'] ?? '');
    $id = $_GET['id'] ?? ($_GET['data.id'] ?? ($_GET['data_id'] ?? ''));
    
    // Se for merchant_order, buscar os pagamentos dentro da ordem
    if ($topic === 'merchant_order' || strpos($topic, 'merchant_order') !== false) {
        $merchantOrderId = $id;
        logNotification("Notificação de merchant_order recebida: {$merchantOrderId}");
        // Vamos buscar a ordem e processar os pagamentos dentro dela
        // Por enquanto, vamos apenas logar e retornar OK
        http_response_code(200);
        echo json_encode(['status' => 'ok', 'processed' => true, 'type' => 'merchant_order']);
        exit;
    } else {
        $paymentId = $id;
    }
}

if (empty($paymentId) && empty($merchantOrderId)) {
    http_response_code(400);
    echo json_encode(['error' => 'ID do pagamento ou ordem não encontrado']);
    exit;
}

// Obter Access Token
$accessToken = getenv('MP_ACCESS_TOKEN') ?: MP_FALLBACK_ACCESS_TOKEN;

if (!$accessToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Access Token não configurado']);
    exit;
}

// Se for merchant_order, já respondemos acima
if (!empty($merchantOrderId)) {
    exit;
}

// Buscar informações do pagamento no Mercado Pago
logNotification("Buscando informações do pagamento {$paymentId}...");
$paymentInfo = getPaymentInfo($paymentId, $accessToken);

if (!$paymentInfo) {
    logNotification("Pagamento {$paymentId} não encontrado. Respondendo 200 para evitar retries.");
    http_response_code(200);
    echo json_encode(['status' => 'ok', 'processed' => false, 'reason' => 'payment_not_found']);
    exit;
}

logNotification("Pagamento encontrado. Status: " . ($paymentInfo['status'] ?? 'N/A') . ", External Reference: " . ($paymentInfo['external_reference'] ?? 'N/A'));

// Processar notificação
processNotification($paymentInfo, $topic);

// Responder ao Mercado Pago (200 OK)
http_response_code(200);
echo json_encode(['status' => 'ok', 'processed' => true]);
exit;

/**
 * Busca informações do pagamento no Mercado Pago
 * 
 * @param string $paymentId ID do pagamento
 * @param string $accessToken Token de acesso
 * @return array|null Dados do pagamento ou null em caso de erro
 */
function getPaymentInfo(string $paymentId, string $accessToken): ?array
{
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
        logNotification("Erro ao buscar pagamento {$paymentId}: HTTP {$httpCode} - {$result}");
        return null;
    }
    
    $data = json_decode($result, true);
    return is_array($data) ? $data : null;
}

/**
 * Processa a notificação do pagamento
 * 
 * @param array $paymentInfo Dados do pagamento
 * @param string $topic Tipo de notificação
 * @return void
 */
function processNotification(array $paymentInfo, string $topic): void
{
    $paymentId = $paymentInfo['id'] ?? 'unknown';
    $status = $paymentInfo['status'] ?? 'unknown';
    $statusDetail = $paymentInfo['status_detail'] ?? 'unknown';
    $externalReference = $paymentInfo['external_reference'] ?? '';
    $transactionAmount = $paymentInfo['transaction_amount'] ?? 0;
    $paymentMethodId = $paymentInfo['payment_method_id'] ?? '';
    $paymentTypeId = $paymentInfo['payment_type_id'] ?? '';
    
    // Log do processamento
    $logData = [
        'payment_id' => $paymentId,
        'status' => $status,
        'status_detail' => $statusDetail,
        'external_reference' => $externalReference,
        'transaction_amount' => $transactionAmount,
        'payment_method' => $paymentMethodId,
        'payment_type' => $paymentTypeId,
        'topic' => $topic,
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    logNotification("Processando notificação: " . json_encode($logData, JSON_PRETTY_PRINT));
    
    // Processar conforme o status
    switch ($status) {
        case 'approved':
            handleApprovedPayment($paymentInfo);
            break;
            
        case 'pending':
            handlePendingPayment($paymentInfo);
            break;
            
        case 'rejected':
        case 'cancelled':
        case 'refunded':
        case 'charged_back':
            handleRejectedPayment($paymentInfo);
            break;
            
        default:
            logNotification("Status desconhecido: {$status}");
    }
}

/**
 * Processa pagamento aprovado
 * 
 * @param array $paymentInfo Dados do pagamento
 * @return void
 */
function handleApprovedPayment(array $paymentInfo): void
{
    $externalReference = $paymentInfo['external_reference'] ?? '';
    $paymentId = $paymentInfo['id'] ?? '';
    
    logNotification("Pagamento APROVADO - ID: {$paymentId}, Pedido: {$externalReference}");
    
    // Carregar funções de armazenamento de pedidos
    require_once __DIR__ . '/order_storage.php';
    
    // Carregar funções do Melhor Envio
    require_once __DIR__ . '/melhorenvio_shipment.php';
    
    // 1. Recuperar dados do pedido
    logNotification("Buscando pedido com external_reference: {$externalReference}");
    $orderData = getOrder($externalReference);
    
    if (!$orderData) {
        logNotification("ERRO: Pedido {$externalReference} não encontrado no storage. Verificando estrutura de arquivos...");
        
        // Tentar listar arquivos para debug
        $ordersDir = __DIR__ . '/../data/orders';
        if (is_dir($ordersDir)) {
            $files = glob($ordersDir . '/*.json');
            logNotification("Arquivos encontrados no diretório de pedidos: " . count($files));
            foreach ($files as $file) {
                $filename = basename($file);
                logNotification("  - Arquivo: {$filename}");
            }
        } else {
            logNotification("Diretório de pedidos não existe: {$ordersDir}");
        }
        
        return;
    }
    
    logNotification("Pedido encontrado! Dados: " . json_encode($orderData, JSON_PRETTY_PRINT));
    
    // 2. Atualizar status do pedido
    updateOrderStatus($externalReference, 'approved', [
        'paymentId' => $paymentId,
        'paymentStatus' => 'approved',
        'approvedAt' => date('Y-m-d H:i:s')
    ]);
    
    // 3. Criar envio no Melhor Envio
    try {
        logNotification("Iniciando criação de envio no Melhor Envio para pedido {$externalReference}...");
        logNotification("Dados do pedido que serão enviados: " . json_encode([
            'customer' => $orderData['customer'] ?? 'N/A',
            'address' => $orderData['address'] ?? 'N/A',
            'items' => $orderData['items'] ?? 'N/A',
            'freight' => $orderData['freight'] ?? 'N/A'
        ], JSON_PRETTY_PRINT));
        
        $shipmentResult = processMelhorEnvioShipment($orderData);
        
        logNotification("Resultado do processMelhorEnvioShipment: " . json_encode($shipmentResult, JSON_PRETTY_PRINT));
        
        if ($shipmentResult && isset($shipmentResult['shipmentId'])) {
            // Salvar informações do envio
            updateOrderStatus($externalReference, 'shipping_created', [
                'shipmentId' => $shipmentResult['shipmentId'],
                'labelUrl' => $shipmentResult['labelUrl'] ?? null,
                'shipmentCreatedAt' => date('Y-m-d H:i:s')
            ]);
            
            logNotification("SUCESSO: Envio criado! ID: {$shipmentResult['shipmentId']}, URL Etiqueta: " . ($shipmentResult['labelUrl'] ?? 'N/A'));
        } else {
            logNotification("ERRO: processMelhorEnvioShipment retornou null ou sem shipmentId. Resultado: " . json_encode($shipmentResult));
        }
    } catch (Exception $e) {
        logNotification("EXCEÇÃO ao criar envio: " . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
    }
    
    // 4. Aqui você pode também:
    // - Enviar e-mail de confirmação para o cliente
    // - Gerar nota fiscal
    // - Integrar com sistema de estoque
    // - Notificar administrador
    
    // Exemplo: Enviar e-mail
    // sendConfirmationEmail($externalReference, $paymentId);
}

/**
 * Processa pagamento pendente
 * 
 * @param array $paymentInfo Dados do pagamento
 * @return void
 */
function handlePendingPayment(array $paymentInfo): void
{
    $externalReference = $paymentInfo['external_reference'] ?? '';
    $paymentId = $paymentInfo['id'] ?? '';
    $statusDetail = $paymentInfo['status_detail'] ?? '';
    
    logNotification("Pagamento PENDENTE - ID: {$paymentId}, Pedido: {$externalReference}, Detalhe: {$statusDetail}");
    
    // Pagamentos pendentes podem ser:
    // - pending_waiting_payment (aguardando pagamento - boleto/PIX)
    // - pending_review (em análise)
    // - pending_contingency (contingência)
    
    // Aqui você pode:
    // 1. Atualizar status do pedido para "aguardando pagamento"
    // 2. Enviar instruções de pagamento (boleto/PIX)
    // 3. Notificar o cliente
}

/**
 * Processa pagamento rejeitado/cancelado
 * 
 * @param array $paymentInfo Dados do pagamento
 * @return void
 */
function handleRejectedPayment(array $paymentInfo): void
{
    $externalReference = $paymentInfo['external_reference'] ?? '';
    $paymentId = $paymentInfo['id'] ?? '';
    $status = $paymentInfo['status'] ?? '';
    $statusDetail = $paymentInfo['status_detail'] ?? '';
    
    logNotification("Pagamento {$status} - ID: {$paymentId}, Pedido: {$externalReference}, Detalhe: {$statusDetail}");
    
    // Aqui você pode:
    // 1. Atualizar status do pedido para "cancelado" ou "rejeitado"
    // 2. Liberar estoque
    // 3. Notificar o cliente
    // 4. Oferecer alternativa de pagamento
}

