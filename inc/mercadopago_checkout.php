<?php
declare(strict_types=1);

/**
 * Endpoint para processar pagamentos via API do Mercado Pago (Checkout Transparente)
 * 
 * Suporta:
 * - Cartão de Crédito/Débito (tokenizado)
 * - PIX
 * - Boleto Bancário
 * 
 * Configure o Access Token via variável de ambiente MP_ACCESS_TOKEN
 * ou defina a constante MP_FALLBACK_ACCESS_TOKEN abaixo.
 */

// Access Token do Mercado Pago (NUNCA exponha no frontend)
const MP_FALLBACK_ACCESS_TOKEN = 'APP_USR-8299035095139301-112408-70fe93db2c237b11dcc4b5140d33aaff-3010611918';

// Headers CORS e Content-Type
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
    echo json_encode(['error' => 'Método não permitido.']);
    exit;
}

// Ler body da requisição
$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload inválido.']);
    exit;
}

$paymentData = $payload['paymentData'] ?? null;
$orderData = $payload['order'] ?? null;

if (!$paymentData || !$orderData) {
    http_response_code(422);
    echo json_encode(['error' => 'Dados do pagamento ou do pedido não foram enviados.']);
    exit;
}

// Obter Access Token
$accessToken = getenv('MP_ACCESS_TOKEN') ?: MP_FALLBACK_ACCESS_TOKEN;

if (!$accessToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Access Token do Mercado Pago não configurado.']);
    exit;
}

// Validar valor da transação
$transactionAmount = isset($orderData['transactionAmount']) ? (float) $orderData['transactionAmount'] : 0.0;

if ($transactionAmount <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'Valor da transação inválido.']);
    exit;
}

// Extrair dados
$paymentMethodId = $paymentData['payment_method_id'] ?? '';
$token = $paymentData['token'] ?? null;
$installments = isset($paymentData['installments']) ? (int) $paymentData['installments'] : 1;

$customer = is_array($orderData['customer'] ?? null) ? $orderData['customer'] : [];
$address = is_array($orderData['address'] ?? null) ? $orderData['address'] : [];
$freight = is_array($orderData['freight'] ?? null) ? $orderData['freight'] : [];
$items = is_array($orderData['items'] ?? null) ? $orderData['items'] : [];
$metadata = is_array($orderData['metadata'] ?? null) ? $orderData['metadata'] : [];

// Dados do pagador
$payerEmail = $customer['email'] ?? '';
$payerName = $customer['name'] ?? '';
$payerFirstName = explode(' ', $payerName)[0] ?? '';
$payerLastName = implode(' ', array_slice(explode(' ', $payerName), 1)) ?: $payerFirstName;

// Identificação do pagador (do paymentData ou do customer)
$payerIdentification = $paymentData['payer']['identification'] ?? [];
$payerIdentificationType = $payerIdentification['type'] ?? 'CPF';
$payerIdentificationNumber = preg_replace('/\D/', '', $payerIdentification['number'] ?? ($customer['taxId'] ?? ''));

// Montar payload base do pagamento
$paymentPayload = [
    'transaction_amount' => $transactionAmount,
    'description' => $orderData['description'] ?? sprintf('Pedido %s - Natucart', $orderData['orderId'] ?? ''),
    'payment_method_id' => $paymentMethodId,
    'external_reference' => $orderData['externalReference'] ?? $orderData['orderId'] ?? uniqid('natucart_', true),
    'statement_descriptor' => substr($orderData['statementDescriptor'] ?? 'NATUCART', 0, 22),
    'payer' => [
        'email' => $payerEmail,
        'first_name' => $payerFirstName,
        'last_name' => $payerLastName,
        'identification' => [
            'type' => $payerIdentificationType,
            'number' => $payerIdentificationNumber
        ]
    ],
    'metadata' => array_merge([
        'orderId' => $orderData['orderId'] ?? null,
        'customerEmail' => $customer['email'] ?? null,
        'source' => 'natucart_checkout'
    ], $metadata)
];

// Adicionar notification_url se configurado
if (!empty($orderData['notificationUrl'])) {
    $paymentPayload['notification_url'] = $orderData['notificationUrl'];
}

// Configurar conforme método de pagamento
if ($paymentMethodId === 'pix') {
    // PIX - não precisa de token nem parcelas
    $paymentPayload['installments'] = 1;
    
} elseif ($paymentMethodId === 'bolbradesco') {
    // Boleto - precisa de endereço do pagador
    $paymentPayload['installments'] = 1;
    $paymentPayload['payer']['address'] = [
        'zip_code' => $address['postalCode'] ?? '',
        'street_name' => $address['street'] ?? '',
        'street_number' => $address['number'] ?? '',
        'neighborhood' => $address['district'] ?? '',
        'city' => $address['city'] ?? '',
        'federal_unit' => $address['state'] ?? ''
    ];
    
} else {
    // Cartão de Crédito/Débito - precisa de token
    if (!$token) {
        http_response_code(422);
        echo json_encode(['error' => 'Token do cartão não fornecido.']);
        exit;
    }
    
    $paymentPayload['token'] = $token;
    $paymentPayload['installments'] = $installments;
    
    // Issuer ID se disponível
    if (!empty($paymentData['issuer_id'])) {
        $paymentPayload['issuer_id'] = $paymentData['issuer_id'];
    }
}

// Adicionar informações adicionais (ajuda no antifraude)
$paymentPayload['additional_info'] = [
    'items' => array_values(array_map(static function ($item) {
        return [
            'id' => $item['id'] ?? $item['sku'] ?? uniqid('item_', true),
            'title' => $item['name'] ?? 'Produto',
            'description' => $item['description'] ?? ($item['name'] ?? 'Produto Natucart'),
            'quantity' => (int) ($item['quantity'] ?? 1),
            'unit_price' => (float) ($item['price'] ?? 0),
            'category_id' => 'others'
        ];
    }, $items)),
    'payer' => [
        'first_name' => $payerFirstName,
        'last_name' => $payerLastName,
        'phone' => [
            'area_code' => substr($customer['cellphone'] ?? '', 0, 2),
            'number' => substr($customer['cellphone'] ?? '', 2)
        ],
        'address' => [
            'zip_code' => $address['postalCode'] ?? '',
            'street_name' => $address['street'] ?? '',
            'street_number' => $address['number'] ?? ''
        ]
    ],
    'shipments' => [
        'receiver_address' => [
            'zip_code' => $address['postalCode'] ?? '',
            'street_name' => $address['street'] ?? '',
            'street_number' => $address['number'] ?? '',
            'floor' => '',
            'apartment' => $address['complement'] ?? ''
        ]
    ]
];

// Log para debug (remover em produção)
error_log('[MercadoPago] Payload: ' . json_encode($paymentPayload, JSON_PRETTY_PRINT));

// Enviar para API do Mercado Pago
$response = sendToMercadoPago($paymentPayload, $accessToken);

// Log da resposta (remover em produção)
error_log('[MercadoPago] Response: ' . json_encode($response, JSON_PRETTY_PRINT));

http_response_code($response['status']);
echo json_encode($response['body']);
exit;

/**
 * Envia requisição para a API de Pagamentos do Mercado Pago
 * 
 * @param array $payload Dados do pagamento
 * @param string $accessToken Token de acesso
 * @return array{status:int,body:array}
 */
function sendToMercadoPago(array $payload, string $accessToken): array
{
    $endpoint = 'https://api.mercadopago.com/v1/payments';

    try {
        $jsonPayload = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    } catch (JsonException $exception) {
        return [
            'status' => 500,
            'body' => [
                'error' => 'payload_encoding_error',
                'message' => 'Falha ao preparar dados do pagamento.',
                'detail' => $exception->getMessage()
            ]
        ];
    }

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'X-Idempotency-Key: ' . uniqid('natucart_', true)
        ],
        CURLOPT_POSTFIELDS => $jsonPayload,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10
    ]);

    $result = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curlError) {
        return [
            'status' => 502,
            'body' => [
                'error' => 'connection_error',
                'message' => 'Não foi possível conectar ao Mercado Pago. Tente novamente.',
                'detail' => $curlError
            ]
        ];
    }

    $body = json_decode($result, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'status' => 500,
            'body' => [
                'error' => 'invalid_response',
                'message' => 'Resposta inválida do Mercado Pago.'
            ]
        ];
    }

    // Tratar erros da API
    if ($httpCode >= 400) {
        $errorMessage = 'Erro ao processar pagamento.';
        
        // Mensagens de erro mais amigáveis
        if (isset($body['cause']) && is_array($body['cause'])) {
            $causes = array_column($body['cause'], 'description');
            if (!empty($causes)) {
                $errorMessage = implode(' ', $causes);
            }
        } elseif (!empty($body['message'])) {
            $errorMessage = $body['message'];
        }

        return [
            'status' => $httpCode,
            'body' => [
                'error' => $body['error'] ?? 'mp_error',
                'message' => $errorMessage,
                'status' => $body['status'] ?? 'error',
                'status_detail' => $body['status_detail'] ?? null,
                'detail' => $body['cause'] ?? $body
            ]
        ];
    }

    // Sucesso - retornar resposta completa do Mercado Pago
    return [
        'status' => $httpCode,
        'body' => $body
    ];
}
