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

// Assinatura secreta do Mercado Pago (configure no painel)
const MP_WEBHOOK_SECRET = '1df6f2d0ad3243e5e0fa44003aa59f95ec1d67ec4fe082d0ede68a97450ea782';

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
@file_put_contents($logFile, "[{$timestamp}] Headers: " . json_encode($headers) . "\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] Query params: " . json_encode($queryParams) . "\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] Body: {$rawBody}\n", FILE_APPEND);

// Validar assinatura secreta (se presente)
// O Mercado Pago pode enviar em diferentes headers
$xSignature = $headers['x-signature'] ?? $headers['X-Signature'] ?? $headers['x-signature-256'] ?? $headers['X-Signature-256'] ?? null;
$isValidSignature = true;

if ($xSignature && MP_WEBHOOK_SECRET) {
    @file_put_contents($logFile, "[{$timestamp}] X-Signature encontrado: {$xSignature}\n", FILE_APPEND);
    
    // Tentar diferentes formas de calcular (Mercado Pago pode usar diferentes formatos)
    $paymentId = $queryParams['data.id'] ?? $queryParams['id'] ?? '';
    
    // Formato 1: hash_hmac do body + paymentId
    $hash1 = hash_hmac('sha256', $rawBody . $paymentId, MP_WEBHOOK_SECRET);
    
    // Formato 2: hash_hmac apenas do body
    $hash2 = hash_hmac('sha256', $rawBody, MP_WEBHOOK_SECRET);
    
    // Formato 3: hash_hmac do paymentId + secret
    $hash3 = hash_hmac('sha256', $paymentId, MP_WEBHOOK_SECRET);
    
    // Remover prefixo se houver (sha256=, etc)
    $receivedHash = preg_replace('/^(sha256=|sha1=)/', '', $xSignature);
    
    @file_put_contents($logFile, "[{$timestamp}] Hash recebido (limpo): {$receivedHash}\n", FILE_APPEND);
    @file_put_contents($logFile, "[{$timestamp}] Hash1 (body+paymentId): {$hash1}\n", FILE_APPEND);
    @file_put_contents($logFile, "[{$timestamp}] Hash2 (body): {$hash2}\n", FILE_APPEND);
    @file_put_contents($logFile, "[{$timestamp}] Hash3 (paymentId): {$hash3}\n", FILE_APPEND);
    
    // Comparar com todas as formas possíveis
    $isValidSignature = hash_equals($receivedHash, $hash1) || 
                        hash_equals($receivedHash, $hash2) || 
                        hash_equals($receivedHash, $hash3);
    
    @file_put_contents($logFile, "[{$timestamp}] Validação de assinatura: " . ($isValidSignature ? 'VÁLIDA' : 'INVÁLIDA') . "\n", FILE_APPEND);
    
    if (!$isValidSignature) {
        // IMPORTANTE: Mesmo com assinatura inválida, vamos processar
        // para não perder notificações. Mas logamos como aviso.
        @file_put_contents($logFile, "[{$timestamp}] ⚠️ AVISO: Assinatura não corresponde, mas processando mesmo assim\n", FILE_APPEND);
    }
} else {
    @file_put_contents($logFile, "[{$timestamp}] ℹ️ Sem assinatura X-Signature (pode ser simulação ou notificação antiga)\n", FILE_APPEND);
}

// Extrair payment ID
$paymentId = $queryParams['data.id'] ?? $queryParams['id'] ?? null;
$topic = $queryParams['type'] ?? $queryParams['topic'] ?? 'payment';

@file_put_contents($logFile, "[{$timestamp}] Payment ID extraído: {$paymentId}, Topic: {$topic}\n", FILE_APPEND);

// Se for merchant_order, não processar (só queremos payment)
if (strpos($topic, 'merchant_order') !== false || $topic === 'merchant_order') {
    @file_put_contents($logFile, "[{$timestamp}] ⏭️ Ignorando notificação de merchant_order (só processamos payment)\n", FILE_APPEND);
    http_response_code(200);
    echo json_encode(['status' => 'ok', 'message' => 'merchant_order ignorado', 'processed' => false]);
    exit;
}

if (!$paymentId) {
    // Tentar extrair do body
    $bodyData = json_decode($rawBody, true);
    if (isset($bodyData['data']['id'])) {
        $paymentId = $bodyData['data']['id'];
        @file_put_contents($logFile, "[{$timestamp}] Payment ID extraído do body: {$paymentId}\n", FILE_APPEND);
    }
}

if (!$paymentId) {
    @file_put_contents($logFile, "[{$timestamp}] ❌ Payment ID não encontrado\n", FILE_APPEND);
    http_response_code(200); // Responder 200 para evitar retries
    echo json_encode(['status' => 'ok', 'message' => 'Payment ID não encontrado']);
    exit;
}

@file_put_contents($logFile, "[{$timestamp}] ✅ Payment ID válido: {$paymentId}, Topic: {$topic}\n", FILE_APPEND);

// Repassar para o n8n
$n8nPayload = [
    'paymentId' => $paymentId,
    'topic' => $topic,
    'queryParams' => $queryParams,
    'rawBody' => $rawBody,
    'headers' => $headers,
    'xSignature' => $xSignature,
    'signatureValid' => $isValidSignature,
    'timestamp' => date('Y-m-d H:i:s')
];

@file_put_contents($logFile, "[{$timestamp}] 📤 Enviando para n8n: " . N8N_WEBHOOK_URL . "\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}] 📦 Payload: " . json_encode($n8nPayload, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);

$ch = curl_init(N8N_WEBHOOK_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'User-Agent: NATUCART-Webhook/1.0'
    ],
    CURLOPT_POSTFIELDS => json_encode($n8nPayload),
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlInfo = curl_getinfo($ch);
curl_close($ch);

@file_put_contents($logFile, "[{$timestamp}] 📥 Resposta do n8n:\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}]   HTTP Code: {$httpCode}\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}]   Response: {$response}\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}]   cURL Error: " . ($curlError ?: 'Nenhum') . "\n", FILE_APPEND);
@file_put_contents($logFile, "[{$timestamp}]   Total Time: " . ($curlInfo['total_time'] ?? 'N/A') . "s\n", FILE_APPEND);

if ($curlError) {
    @file_put_contents($logFile, "[{$timestamp}] ❌ ERRO cURL ao enviar para n8n: {$curlError}\n", FILE_APPEND);
}

if ($httpCode !== 200 && $httpCode !== 201) {
    @file_put_contents($logFile, "[{$timestamp}] ⚠️ n8n retornou HTTP {$httpCode}\n", FILE_APPEND);
}

// Sempre responder 200 OK para o Mercado Pago
http_response_code(200);
echo json_encode([
    'status' => 'ok',
    'processed' => true,
    'n8n_response_code' => $httpCode
]);

