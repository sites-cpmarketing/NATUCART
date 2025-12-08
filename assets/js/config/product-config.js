/**
 * Configurações de Produto para Cálculo de Frete
 * 
 * Este arquivo centraliza todas as configurações de peso e dimensões dos produtos.
 * As configurações variam baseado na quantidade de produtos no pacote.
 * 
 * IMPORTANTE: O sistema escolhe automaticamente a configuração baseada na quantidade.
 */

const ProductConfig = {
    /**
     * Retorna a configuração de peso e dimensões baseada na quantidade de produtos
     * @param {number} quantity - Quantidade de produtos no pacote
     * @returns {Object} Objeto com weight, width, height, length
     */
    getConfigByQuantity: function(quantity) {
        // Configurações baseadas nas medidas reais dos pacotes
        if (quantity === 1) {
            // Pacote 1: Envelope
            return {
                weight: 0.05,    // 50g em kg
                width: 16.5,     // Largura em cm
                height: 1,       // Envelope (altura mínima)
                length: 18       // Comprimento em cm
            };
        } else if (quantity >= 2 && quantity <= 3) {
            // Pacote com 3 produtos
            return {
                weight: 0.16,    // 160g em kg
                width: 20.5,     // Largura em cm
                height: 7.5,     // Altura em cm
                length: 12       // Comprimento em cm
            };
        } else if (quantity >= 4 && quantity <= 6) {
            // Pacote com 6 produtos
            return {
                weight: 0.28,    // 280g em kg
                width: 19,       // Largura em cm
                height: 10,      // Altura em cm
                length: 14.5     // Comprimento em cm
            };
        } else {
            // Para quantidades maiores que 6, usar a configuração do pacote de 6
            // e multiplicar o peso proporcionalmente
            const baseConfig = this.getConfigByQuantity(6);
            const weightPerUnit = baseConfig.weight / 6;
            return {
                weight: weightPerUnit * quantity,
                width: baseConfig.width,
                height: baseConfig.height,
                length: baseConfig.length
            };
        }
    },
    
    /**
     * Retorna a configuração padrão (para compatibilidade)
     * @deprecated Use getConfigByQuantity() ao invés disso
     */
    getDefault: function() {
        return this.getConfigByQuantity(1);
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductConfig = ProductConfig;
}

