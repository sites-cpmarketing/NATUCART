<?php
declare(strict_types=1);

/**
 * Configurações de Produto para Cálculo de Frete
 * 
 * Este arquivo centraliza todas as configurações de peso e dimensões dos produtos.
 * As configurações variam baseado na quantidade de produtos no pacote.
 * 
 * IMPORTANTE: O sistema escolhe automaticamente a configuração baseada na quantidade.
 */

/**
 * Retorna a configuração de peso e dimensões baseada na quantidade de produtos
 * 
 * @param int $quantity Quantidade de produtos no pacote
 * @return array Array com 'weight', 'width', 'height', 'length'
 */
function getProductConfigByQuantity(int $quantity): array
{
    // Configurações baseadas nas medidas reais dos pacotes
    if ($quantity === 1) {
        // Pacote 1: Envelope
        return [
            'weight' => 0.05,    // 50g em kg
            'width' => 16.5,     // Largura em cm
            'height' => 1,        // Envelope (altura mínima)
            'length' => 18       // Comprimento em cm
        ];
    } elseif ($quantity >= 2 && $quantity <= 3) {
        // Pacote com 3 produtos
        return [
            'weight' => 0.16,    // 160g em kg
            'width' => 20.5,     // Largura em cm
            'height' => 7.5,     // Altura em cm
            'length' => 12       // Comprimento em cm
        ];
    } elseif ($quantity >= 4 && $quantity <= 6) {
        // Pacote com 6 produtos
        return [
            'weight' => 0.28,    // 280g em kg
            'width' => 19,       // Largura em cm
            'height' => 10,      // Altura em cm
            'length' => 14.5     // Comprimento em cm
        ];
    } else {
        // Para quantidades maiores que 6, usar a configuração do pacote de 6
        // e multiplicar o peso proporcionalmente
        $baseConfig = getProductConfigByQuantity(6);
        $weightPerUnit = $baseConfig['weight'] / 6;
        return [
            'weight' => $weightPerUnit * $quantity,
            'width' => $baseConfig['width'],
            'height' => $baseConfig['height'],
            'length' => $baseConfig['length']
        ];
    }
}

// Constantes mantidas para compatibilidade (usam configuração de 1 produto)
define('PRODUCT_WEIGHT_KG', 0.05);
define('PRODUCT_WIDTH_CM', 16.5);
define('PRODUCT_HEIGHT_CM', 1);
define('PRODUCT_LENGTH_CM', 18);

