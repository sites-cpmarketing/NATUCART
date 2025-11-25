<?php
declare(strict_types=1);

/**
 * Endpoint para criar preferência de pagamento (Checkout Pro)
 * 
 * Configure o Access Token via variável de ambiente MP_ACCESS_TOKEN
 * ou defina a constante MP_FALLBACK_ACCESS_TOKEN abaixo.
 */

// Access Token do Mercado Pago (NUNCA exponha no frontend)
// IMPORTANTE: Use credenciais de TESTE para desenvolvimento
const MP_FALLBACK_ACCESS_TOKEN = 'TEST-174327649585109-112508-b5556707665f235f4eb8c89fe2ac9346-3000462520';

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

if (!is_array($payload) || !isset($payload['preference'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload inválido.']);
    exit;
}

$preferenceData = $payload['preference'];

// Obter Access Token
$accessToken = getenv('MP_ACCESS_TOKEN') ?: MP_FALLBACK_ACCESS_TOKEN;

if (!$accessToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Access Token do Mercado Pago não configurado.']);
    exit;
}

// Enviar para API do Mercado Pago
$response = createPreference($preferenceData, $accessToken);

http_response_code($response['status']);
echo json_encode($response['body']);
exit;

/**
 * Cria uma preferência de pagamento no Mercado Pago
 * 
 * @param array $preferenceData Dados da preferência
 * @param string $accessToken Token de acesso
 * @return array{status:int,body:array}
 */
function createPreference(array $preferenceData, string $accessToken): array
{
    $endpoint = 'https://api.mercadopago.com/checkout/preferences';

    try {
        $jsonPayload = json_encode($preferenceData, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    } catch (JsonException $exception) {
        return [
            'status' => 500,
            'body' => [
                'error' => 'payload_encoding_error',
                'message' => 'Falha ao preparar dados da preferência.',
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
            'X-Idempotency-Key: ' . uniqid('pref_', true)
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
        $errorMessage = 'Erro ao criar preferência de pagamento.';
        
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

