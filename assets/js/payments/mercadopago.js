(function (window, document) {
    'use strict';

    const DEFAULT_CONFIG = {
        publicKey: '',
        accessToken: '', // Para criar preferência (pode ser feito no backend)
        preferenceEndpoint: '/inc/mercadopago_preference.php', // Endpoint para criar preferência
        baseUrl: 'https://natucart.vercel.app', // URL base do site
        locale: 'pt-BR'
    };

    const config = { ...DEFAULT_CONFIG };

    /**
     * Formata itens para o formato do Mercado Pago
     * @param {Array} items - Itens do carrinho
     * @param {Object} freight - Dados do frete
     * @returns {Array} Itens formatados
     */
    const formatItems = (items = [], freight = null) => {
        const formattedItems = items.map((item) => ({
            title: item.name,
            description: item.description || `${item.name} - Natucart`,
            quantity: item.quantity,
            unit_price: parseFloat(item.price)
        }));

        // Adicionar frete como item separado
        if (freight && freight.price > 0) {
            formattedItems.push({
                title: `Frete - ${freight.service || 'Entrega'}`,
                description: `Frete: ${freight.service || 'Entrega'} - Prazo: ${freight.deliveryTime || 'N/A'} dia(s) útil(eis)`,
                quantity: 1,
                unit_price: parseFloat(freight.price)
            });
        }

        return formattedItems;
    };

    /**
     * Formata dados do pagador
     * @param {Object} customer - Dados do cliente
     * @returns {Object} Pagador formatado
     */
    const formatPayer = (customer = {}) => {
        const phone = (customer.cellphone || '').replace(/\D/g, '');
        const areaCode = phone.substring(0, 2) || '11';
        const number = phone.substring(2) || '999999999';
        const taxId = (customer.taxId || '').replace(/\D/g, '');

        return {
            name: customer.name || '',
            surname: customer.name?.split(' ').slice(1).join(' ') || customer.name || '',
            email: customer.email || '',
            phone: {
                area_code: areaCode,
                number: number
            },
            identification: {
                type: 'CPF',
                number: taxId
            }
        };
    };

    /**
     * Cria uma preferência de pagamento (Checkout Pro)
     * @param {Object} orderContext - Contexto do pedido
     * @returns {Promise<string>} URL de pagamento (init_point)
     */
    const createPreference = async (orderContext) => {
        const items = formatItems(orderContext.items || [], orderContext.freight);
        const payer = formatPayer(orderContext.customer);

        // Construir URLs de retorno usando a URL base configurada
        const baseUrl = config.baseUrl || 'https://natucart.vercel.app';
        
        // URLs de retorno para o Checkout Pro
        const successUrl = `${baseUrl}/checkout.html?payment=completed`;
        const failureUrl = `${baseUrl}/checkout.html?payment=failed`;
        const pendingUrl = `${baseUrl}/checkout.html?payment=pending`;

        // Validar URLs
        try {
            const successUrlObj = new URL(successUrl);
            const failureUrlObj = new URL(failureUrl);
            const pendingUrlObj = new URL(pendingUrl);
            
            // Garantir que as URLs são HTTPS válidas
            if (successUrlObj.protocol !== 'https:') {
                throw new Error('URLs de retorno devem usar HTTPS');
            }
            
            if (!successUrlObj.hostname || successUrlObj.hostname === 'localhost' || successUrlObj.hostname === '127.0.0.1') {
                console.warn('[MercadoPago] Aviso: URLs de retorno devem apontar para um domínio real, não localhost');
            }
        } catch (e) {
            throw new Error(`Erro ao construir URLs de retorno: ${e.message}`);
        }

        // Validar dados antes de criar preferência
        if (!items || items.length === 0) {
            throw new Error('Nenhum item encontrado no pedido.');
        }

        if (!payer || !payer.email) {
            throw new Error('Dados do pagador incompletos.');
        }

        // Montar objeto de preferência conforme documentação do Mercado Pago
        const preferenceData = {
            items: items,
            payer: payer,
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl
            },
            external_reference: orderContext.externalReference || orderContext.orderId || `natucart_${Date.now()}`,
            statement_descriptor: 'NATUCART'
        };

        // Adicionar auto_return apenas se back_urls.success estiver definido e válido
        // Isso evita o erro "back_url.success must be defined"
        if (successUrl && successUrl.startsWith('http')) {
            preferenceData.auto_return = 'approved';
        }

        // Adicionar metadata apenas se houver dados
        if (orderContext.orderId || orderContext.customer?.email) {
            preferenceData.metadata = {
                orderId: orderContext.orderId || '',
                customerEmail: orderContext.customer?.email || '',
                ...(orderContext.metadata || {})
            };
        }

        // Adicionar notification_url apenas se configurado (não é obrigatório)
        if (config.notificationUrl && config.notificationUrl.trim() !== '') {
            preferenceData.notification_url = config.notificationUrl.trim();
        }

        // Log para debug
        console.log('[MercadoPago] Criando preferência:', {
            itemsCount: items.length,
            payerEmail: payer.email,
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl
            },
            external_reference: preferenceData.external_reference
        });

        // Tentar criar preferência via backend primeiro
        if (config.preferenceEndpoint) {
            try {
                const response = await fetch(config.preferenceEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        preference: preferenceData
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.init_point || result.initPoint) {
                        return result.init_point || result.initPoint;
                    }
                } else if (response.status === 405 || response.status === 404) {
                    // Servidor não suporta PHP ou endpoint não existe - usar fallback
                    console.warn('[MercadoPago] Endpoint PHP não disponível (405/404), usando fallback direto com API do Mercado Pago');
                    // Continuar para o fallback abaixo
                } else {
                    // Outro erro - tentar parsear e mostrar
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Erro do servidor: ${response.status}`);
                }
            } catch (error) {
                // Se for erro de rede ou 405/404, tentar fallback
                if (error.message.includes('Failed to fetch') || error.message.includes('405') || error.message.includes('404')) {
                    console.warn('[MercadoPago] Erro ao criar preferência via backend, tentando fallback direto:', error.message);
                } else {
                    // Outro erro - relançar
                    throw error;
                }
            }
        }

        // Fallback: criar preferência via frontend (requer Access Token - não recomendado em produção)
        if (config.accessToken) {
            try {
                // Log do payload que será enviado
                console.log('[MercadoPago] Payload completo:', JSON.stringify(preferenceData, null, 2));
                
                const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.accessToken}`
                    },
                    body: JSON.stringify(preferenceData)
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.init_point) {
                        console.log('[MercadoPago] Preferência criada com sucesso:', result.id);
                        return result.init_point;
                    }
                    throw new Error('Resposta inválida: init_point não encontrado.');
                } else {
                    // Tentar extrair mensagem de erro detalhada
                    const errorData = await response.json().catch(() => ({}));
                    
                    // Extrair mensagem de erro do Mercado Pago
                    let errorMessage = 'Erro ao criar preferência de pagamento.';
                    
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.cause && Array.isArray(errorData.cause) && errorData.cause.length > 0) {
                        // Mercado Pago retorna erros em cause[]
                        const causes = errorData.cause.map(c => c.description || c.message || '').filter(Boolean);
                        if (causes.length > 0) {
                            errorMessage = causes.join(' ');
                        }
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                    
                    console.error('[MercadoPago] Erro da API:', {
                        status: response.status,
                        error: errorData
                    });
                    
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('[MercadoPago] Erro ao criar preferência:', error);
                // Se já é um Error com mensagem, relançar
                if (error instanceof Error) {
                    throw error;
                }
                throw new Error(error.message || 'Não foi possível criar a preferência de pagamento.');
            }
        }

        throw new Error('Endpoint de preferência não configurado. Configure preferenceEndpoint ou accessToken.');
    };

    /**
     * Configura o serviço
     * @param {Object} options - Opções de configuração
     */
    const configure = (options = {}) => {
        Object.assign(config, options);
    };

    /**
     * Obtém a configuração atual
     * @returns {Object} Configuração
     */
    const getConfig = () => ({ ...config });

    const MercadoPagoService = {
        configure,
        getConfig,
        createPreference
    };

    window.MercadoPagoService = MercadoPagoService;
})(window, document);
