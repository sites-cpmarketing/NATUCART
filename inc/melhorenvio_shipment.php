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

// Configurações do Melhor Envio
const ME_CLIENT_ID = '7496';
const ME_CLIENT_SECRET = 'An6nMKUyzuHyA1TWHWWYZklA8jryl5v0YMCgqYLL';
const ME_API_BASE = 'https://melhorenvio.com.br/api/v2/me';
const ME_SELLER_POSTAL_CODE = '01001000'; // CEP do remetente

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
    // Validar dados obrigatórios
    if (empty($orderData['customer']) || empty($orderData['address']) || empty($orderData['items'])) {
        error_log('[Melhor Envio] Dados incompletos para criar envio');
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
            'phone' => '', // Adicionar telefone do remetente se disponível
            'email' => 'alladistribuidora@gmail.com',
            'document' => '', // CNPJ do remetente se disponível
            'company_document' => '',
            'state_register' => '',
            'address' => '',
            'complement' => '',
            'number' => '',
            'district' => '',
            'city' => '',
            'state_abbr' => '',
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
            return [
                'name' => $item['name'] ?? 'Produto',
                'quantity' => intval($item['quantity'] ?? 1),
                'unitary_value' => floatval($item['price'] ?? 0),
                'weight' => 1.18, // Peso em kg (ajustar conforme produto)
                'width' => 33,   // Largura em cm
                'height' => 2,    // Altura em cm
                'length' => 47    // Comprimento em cm
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

    // Enviar requisição via n8n (já configurado para gerenciar OAuth)
    $ch = curl_init(ME_N8N_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'action' => 'create_shipment',
            'melhorEnvioUrl' => ME_API_BASE . '/shipment',
            'payload' => $payload,
            'clientId' => ME_CLIENT_ID,
            'clientSecret' => ME_CLIENT_SECRET
        ]),
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("[Melhor Envio] Erro cURL: {$curlError}");
        return null;
    }

    if ($httpCode !== 200 && $httpCode !== 201) {
        error_log("[Melhor Envio] Erro HTTP {$httpCode}: {$response}");
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

