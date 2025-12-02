<?php
declare(strict_types=1);

/**
 * Serviço para criar envios e gerar etiquetas no Melhor Envio
 * 
 * Este arquivo contém funções para:
 * 1. Criar um envio (shipment) no Melhor Envio
 * 2. Gerar etiqueta do envio
 * 3. Imprimir etiqueta (retornar URL do PDF)
 */

// Incluir configurações de produto (peso e dimensões)
require_once __DIR__ . '/product_config.php';

// Configurações do Melhor Envio
const ME_CLIENT_ID = '21160';
const ME_CLIENT_SECRET = '466oHb5sHMqmvhc8Etbc70gTWGD75IVeQy3jiF1i';
const ME_API_BASE = 'https://melhorenvio.com.br/api/v2/me';
const ME_SELLER_POSTAL_CODE = '74805100'; // CEP do remetente (Goiânia, GO)

// Token OAuth (deve ser obtido via OAuth flow ou armazenado após autenticação)
// Por enquanto, vamos usar o n8n como proxy (já configurado)
const ME_N8N_WEBHOOK = 'https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-shipment';

/**
 * Cria um envio no Melhor Envio
 * 
 * @param array $orderData Dados do pedido (cliente, endereço, itens, frete)
 * @return array|null Dados do envio criado ou null em caso de erro
 */
function createMelhorEnvioShipment(array $orderData): ?array
{
    // Log para debug
    $logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[{$timestamp}] [Melhor Envio] createMelhorEnvioShipment chamado. Dados recebidos: " . json_encode($orderData, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
    
    // Validar dados obrigatórios
    if (empty($orderData['customer']) || empty($orderData['address']) || empty($orderData['items'])) {
        $errorMsg = '[Melhor Envio] Dados incompletos para criar envio. customer: ' . (empty($orderData['customer']) ? 'VAZIO' : 'OK') . ', address: ' . (empty($orderData['address']) ? 'VAZIO' : 'OK') . ', items: ' . (empty($orderData['items']) ? 'VAZIO' : 'OK');
        error_log($errorMsg);
        @file_put_contents($logFile, "[{$timestamp}] {$errorMsg}\n", FILE_APPEND);
        return null;
    }

    $customer = $orderData['customer'];
    $address = $orderData['address'];
    $items = $orderData['items'];
    $freight = $orderData['freight'] ?? null;

    // Construir payload conforme API do Melhor Envio
    // Documentação: https://melhorenvio.com.br/api/v2/me/shipment
    $payload = [
        'service' => $freight['serviceCode'] ?? '1', // ID do serviço (1 = PAC, 2 = SEDEX, etc.)
        'from' => [
            'name' => 'NATUCART',
            'phone' => '62985803598',
            'email' => 'Natucart1@gmail.com',
            'document' => '04509188153', // CNPJ do remetente
            'company_document' => '',
            'state_register' => '',
            'address' => 'Rua Rio Branco',
            'complement' => 'Q 3 L 6',
            'number' => '316',
            'district' => 'Panorama Parque',
            'city' => 'Goiânia',
            'state_abbr' => 'GO',
            'country_id' => 'BR',
            'postal_code' => ME_SELLER_POSTAL_CODE
        ],
        'to' => [
            'name' => $customer['name'] ?? '',
            'phone' => $customer['cellphone'] ?? '',
            'email' => $customer['email'] ?? '',
            'document' => $customer['taxId'] ?? '',
            'address' => $address['street'] ?? '',
            'complement' => $address['complement'] ?? '',
            'number' => $address['number'] ?? '',
            'district' => $address['district'] ?? '',
            'city' => $address['city'] ?? '',
            'state_abbr' => $address['state'] ?? '',
            'country_id' => 'BR',
            'postal_code' => preg_replace('/\D/', '', $address['postalCode'] ?? '')
        ],
        'products' => array_map(function($item) {
            $quantity = intval($item['quantity'] ?? 1);
            
            // Obter configuração baseada na quantidade
            $productConfig = getProductConfigByQuantity($quantity);
            
            return [
                'name' => $item['name'] ?? 'Produto',
                'quantity' => $quantity,
                'unitary_value' => floatval($item['price'] ?? 0),
                'weight' => $productConfig['weight'],
                'width' => $productConfig['width'],
                'height' => $productConfig['height'],
                'length' => $productConfig['length']
            ];
        }, $items),
        'volumes' => count($items), // Número de volumes
        'options' => [
            'insurance_value' => floatval($orderData['totals']['total'] ?? 0),
            'receipt' => false,
            'own_hand' => false,
            'reverse' => false,
            'non_commercial' => false,
            'invoice' => [
                'key' => '' // Chave da NF-e se disponível
            ],
            'platform' => 'NATUCART'
        ]
    ];

    // Preparar payload para n8n
    $n8nPayload = [
        'action' => 'create_shipment',
        'melhorEnvioUrl' => ME_API_BASE . '/shipment',
        'payload' => $payload,
        'clientId' => ME_CLIENT_ID,
        'clientSecret' => ME_CLIENT_SECRET
    ];
    
    $timestamp = date('Y-m-d H:i:s');
    $logFile = __DIR__ . '/../logs/mercadopago_notifications.log';
    @file_put_contents($logFile, "[{$timestamp}] [Melhor Envio] Enviando requisição para n8n: " . ME_N8N_WEBHOOK . "\n", FILE_APPEND);
    @file_put_contents($logFile, "[{$timestamp}] [Melhor Envio] Payload completo: " . json_encode($n8nPayload, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
    
    // Enviar requisição via n8n (já configurado para gerenciar OAuth)
    $ch = curl_init(ME_N8N_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($n8nPayload),
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    @file_put_contents($logFile, "[{$timestamp}] [Melhor Envio] Resposta do n8n - HTTP {$httpCode}: {$response}\n", FILE_APPEND);

    if ($curlError) {
        $errorMsg = "[Melhor Envio] Erro cURL: {$curlError}";
        error_log($errorMsg);
        @file_put_contents($logFile, "[{$timestamp}] {$errorMsg}\n", FILE_APPEND);
        return null;
    }

    if ($httpCode !== 200 && $httpCode !== 201) {
        $errorMsg = "[Melhor Envio] Erro HTTP {$httpCode}: {$response}";
        error_log($errorMsg);
        @file_put_contents($logFile, "[{$timestamp}] {$errorMsg}\n", FILE_APPEND);
        return null;
    }

    $result = json_decode($response, true);
    
    // O n8n pode retornar a resposta em diferentes formatos
    $shipmentData = $result['data'] ?? $result['body'] ?? $result['result'] ?? $result;
    
    if (empty($shipmentData['id'])) {
        error_log("[Melhor Envio] Resposta inválida: {$response}");
        return null;
    }

    return $shipmentData;
}

/**
 * Gera etiqueta de um envio
 * 
 * @param int|string $shipmentId ID do envio no Melhor Envio
 * @return array|null Dados da etiqueta ou null em caso de erro
 */
function generateMelhorEnvioLabel($shipmentId): ?array
{
    // Enviar requisição via n8n
    $ch = curl_init(ME_N8N_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'action' => 'generate_label',
            'melhorEnvioUrl' => ME_API_BASE . '/shipment/generate',
            'shipmentId' => $shipmentId,
            'clientId' => ME_CLIENT_ID,
            'clientSecret' => ME_CLIENT_SECRET
        ]),
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        error_log("[Melhor Envio] Erro ao gerar etiqueta {$shipmentId}: HTTP {$httpCode} - {$response}");
        return null;
    }

    $result = json_decode($response, true);
    return $result['data'] ?? $result['body'] ?? $result['result'] ?? $result;
}

/**
 * Obtém URL da etiqueta para impressão
 * 
 * @param int|string $shipmentId ID do envio
 * @return string|null URL da etiqueta em PDF ou null
 */
function getMelhorEnvioLabelUrl($shipmentId): ?string
{
    // Enviar requisição via n8n
    $ch = curl_init(ME_N8N_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'action' => 'get_label_url',
            'melhorEnvioUrl' => ME_API_BASE . '/shipment/print',
            'shipmentId' => $shipmentId,
            'clientId' => ME_CLIENT_ID,
            'clientSecret' => ME_CLIENT_SECRET
        ]),
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        error_log("[Melhor Envio] Erro ao obter URL da etiqueta {$shipmentId}: HTTP {$httpCode}");
        return null;
    }

    $result = json_decode($response, true);
    $labelData = $result['data'] ?? $result['body'] ?? $result['result'] ?? $result;
    
    return $labelData['url'] ?? $labelData['pdf'] ?? null;
}

/**
 * Processa criação de envio completo (criar + gerar etiqueta)
 * 
 * @param array $orderData Dados do pedido
 * @return array|null Dados do envio criado com etiqueta ou null
 */
function processMelhorEnvioShipment(array $orderData): ?array
{
    // 1. Criar envio
    $shipment = createMelhorEnvioShipment($orderData);
    if (!$shipment) {
        return null;
    }

    $shipmentId = $shipment['id'] ?? null;
    if (!$shipmentId) {
        error_log('[Melhor Envio] Envio criado mas sem ID');
        return null;
    }

    // 2. Gerar etiqueta
    $label = generateMelhorEnvioLabel($shipmentId);
    if (!$label) {
        error_log("[Melhor Envio] Erro ao gerar etiqueta para envio {$shipmentId}");
        // Mesmo sem etiqueta, retornar dados do envio
        return $shipment;
    }

    // 3. Obter URL da etiqueta
    $labelUrl = getMelhorEnvioLabelUrl($shipmentId);

    return [
        'shipment' => $shipment,
        'label' => $label,
        'labelUrl' => $labelUrl,
        'shipmentId' => $shipmentId
    ];
}

