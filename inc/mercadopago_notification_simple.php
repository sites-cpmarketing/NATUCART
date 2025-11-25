<?php
/**
 * Webhook SIMPLIFICADO do Mercado Pago
 * 
 * Este endpoint apenas recebe a notificação e repassa para o n8n.
 * Todo o processamento (criar envio, gerar etiqueta) é feito no n8n.
 */

header('Content-Type: application/json; charset=utf-8');

// URL do webhook n8n que vai processar tudo
const N8N_WEBHOOK_URL = 'https://n8n-auto.cpmarketingbr.com/webhook/mercadopago-payment';

// Ler dados da notificação
$rawBody = file_get_contents('php://input');
$queryParams = $_GET;
$headers = getallheaders();

// Log simples
$logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$timestamp = date('Y-m-d H:i:s');
@file_put_contents($logFile, "[{$timestamp}] Notificação recebida\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] Query params: " . json_encode($queryParams) . "\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] Body: {$rawBody}\n", FILE_APPEND);

// Extrair payment ID
$paymentId = $queryParams['data.id'] ?? $queryParams['id'] ?? null;
$topic = $queryParams['type'] ?? $queryParams['topic'] ?? 'payment';

if (!$paymentId) {
    // Tentar extrair do body
    $bodyData = json_decode($rawBody, true);
    if (isset($bodyData['data']['id'])) {
        $paymentId = $bodyData['data']['id'];
    }
}

if (!$paymentId) {
    http_response_code(200); // Responder 200 para evitar retries
    echo json_encode(['status' => 'ok', 'message' => 'Payment ID não encontrado']);
    exit;
}

// Repassar para o n8n
$n8nPayload = [
    'paymentId' => $paymentId,
    'topic' => $topic,
    'queryParams' => $queryParams,
    'rawBody' => $rawBody,
    'headers' => $headers,
    'timestamp' => date('Y-m-d H:i:s')
];

$ch = curl_init(N8N_WEBHOOK_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode($n8nPayload),
    CURLOPT_TIMEOUT => 10
]);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

@file_put_contents($logFile, "[{$timestamp}] Enviado para n8n. HTTP: {$httpCode}, Response: {$response}\n", FILE_APPEND);

// Sempre responder 200 OK para o Mercado Pago
http_response_code(200);
echo json_encode([
    'status' => 'ok',
    'processed' => true,
    'n8n_response_code' => $httpCode
]);

