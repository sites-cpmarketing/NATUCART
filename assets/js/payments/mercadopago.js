(function (window, document) {
    'use strict';

    const DEFAULT_CONFIG = {
        publicKey: '',
        paymentEndpoint: '/inc/mercadopago_checkout.php',
        notificationUrl: '',
        locale: 'pt-BR'
    };

    const config = { ...DEFAULT_CONFIG };

    const callbackRegistry = {
        onPaymentSuccess: null,
        onPaymentPending: null,
        onPaymentError: null,
        onPixGenerated: null,
        onBoletoGenerated: null
    };

    let mercadoPagoInstance = null;
    let sdkReadyPromise = null;

    const waitForSDK = () => {
        if (window.MercadoPago) {
            return Promise.resolve();
        }
        if (sdkReadyPromise) {
            return sdkReadyPromise;
        }
        sdkReadyPromise = new Promise((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts += 1;
                if (window.MercadoPago) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts > 200) {
                    clearInterval(interval);
                    reject(new Error('SDK do Mercado Pago não foi carregado.'));
                }
            }, 50);
        });
        return sdkReadyPromise;
    };

    const ensureInstance = async () => {
        await waitForSDK();
        if (!config.publicKey) {
            throw new Error('Public Key do Mercado Pago não configurada.');
        }
        if (!mercadoPagoInstance) {
            mercadoPagoInstance = new window.MercadoPago(config.publicKey, {
                locale: config.locale
            });
        }
        return mercadoPagoInstance;
    };

    /**
     * Tokeniza os dados do cartão usando o SDK do Mercado Pago
     * Cria campos temporários para tokenização
     * @param {Object} cardData - Dados do cartão
     * @returns {Promise<string>} Token do cartão
     */
    const createCardToken = async (cardData) => {
        const mp = await ensureInstance();
        
        // Criar container temporário para os campos
        let tempContainer = document.getElementById('mp-temp-token-container');
        if (!tempContainer) {
            tempContainer = document.createElement('div');
            tempContainer.id = 'mp-temp-token-container';
            tempContainer.style.cssText = 'position: absolute; left: -9999px; opacity: 0; pointer-events: none;';
            document.body.appendChild(tempContainer);
        }

        // Limpar campos anteriores
        tempContainer.innerHTML = `
            <div id="mp-card-number"></div>
            <div id="mp-cardholder-name"></div>
            <div id="mp-expiration-date"></div>
            <div id="mp-security-code"></div>
        `;

        try {
            // Criar e montar campos
            const cardNumberField = mp.fields.create('cardNumber', {
                placeholder: 'Número do cartão'
            }).mount('#mp-card-number');

            const cardholderNameField = mp.fields.create('cardholderName', {
                placeholder: 'Nome do titular'
            }).mount('#mp-cardholder-name');

            const expirationDateField = mp.fields.create('expirationDate', {
                placeholder: 'MM/AA'
            }).mount('#mp-expiration-date');

            const securityCodeField = mp.fields.create('securityCode', {
                placeholder: 'CVV'
            }).mount('#mp-security-code');

            // Preencher campos com os dados
            cardNumberField.setValue(cardData.cardNumber.replace(/\s/g, ''));
            cardholderNameField.setValue(cardData.cardholderName);
            expirationDateField.setValue(`${cardData.expirationMonth}/${cardData.expirationYear.slice(-2)}`);
            securityCodeField.setValue(cardData.securityCode);

            // Aguardar um pouco para os campos processarem
            await new Promise(resolve => setTimeout(resolve, 500));

            // Criar token
            return new Promise((resolve, reject) => {
                const tokenData = {
                    cardholderName: cardData.cardholderName,
                    identificationType: cardData.identificationType || 'CPF',
                    identificationNumber: cardData.identificationNumber.replace(/\D/g, '')
                };

                mp.fields.createCardToken(tokenData, (status, response) => {
                    // Limpar campos temporários
                    if (tempContainer) {
                        tempContainer.innerHTML = '';
                    }

                    if (status === 200 || status === 201) {
                        if (response && response.id) {
                            resolve(response.id);
                        } else {
                            reject(new Error('Resposta inválida ao tokenizar cartão.'));
                        }
                    } else {
                        const errorMessage = response?.message || response?.error || 'Erro ao tokenizar cartão.';
                        reject(new Error(errorMessage));
                    }
                });
            });
        } catch (error) {
            // Limpar campos temporários em caso de erro
            if (tempContainer) {
                tempContainer.innerHTML = '';
            }
            console.error('[MercadoPago] Erro ao tokenizar cartão:', error);
            throw new Error(error.message || 'Erro ao processar dados do cartão.');
        }
    };

    /**
     * Obtém os métodos de pagamento disponíveis
     * @param {string} bin - Primeiros 6 dígitos do cartão
     * @returns {Promise<Object>} Informações do método de pagamento
     */
    const getPaymentMethods = async (bin) => {
        const mp = await ensureInstance();
        return new Promise((resolve) => {
            try {
                mp.getPaymentMethods({ bin }, (status, response) => {
                    if (status === 200 && response && response.results && response.results.length > 0) {
                        resolve(response.results[0]);
                    } else {
                        resolve(null);
                    }
                });
            } catch (error) {
                console.error('[MercadoPago] Erro ao obter métodos de pagamento:', error);
                resolve(null);
            }
        });
    };

    /**
     * Obtém as parcelas disponíveis
     * @param {Object} params - Parâmetros (amount, bin, paymentTypeId)
     * @returns {Promise<Array>} Lista de parcelas
     */
    const getInstallments = async (params) => {
        const mp = await ensureInstance();
        return new Promise((resolve) => {
            try {
                mp.getInstallments({
                    amount: String(params.amount),
                    bin: params.bin,
                    paymentTypeId: params.paymentTypeId || 'credit_card'
                }, (status, response) => {
                    if (status === 200 && response && response.length > 0) {
                        resolve(response[0].payer_costs || []);
                    } else {
                        resolve([]);
                    }
                });
            } catch (error) {
                console.error('[MercadoPago] Erro ao obter parcelas:', error);
                resolve([]);
            }
        });
    };

    /**
     * Obtém os tipos de documento disponíveis
     * @returns {Promise<Array>} Lista de tipos de documento
     */
    const getIdentificationTypes = async () => {
        const mp = await ensureInstance();
        return new Promise((resolve) => {
            try {
                mp.getIdentificationTypes((status, response) => {
                    if (status === 200 && response) {
                        resolve(response);
                    } else {
                        resolve([{ id: 'CPF', name: 'CPF' }]);
                    }
                });
            } catch (error) {
                console.error('[MercadoPago] Erro ao obter tipos de documento:', error);
                resolve([{ id: 'CPF', name: 'CPF' }]);
            }
        });
    };

    /**
     * Envia o pagamento para o backend
     * @param {Object} paymentData - Dados do pagamento
     * @param {Object} orderContext - Contexto do pedido
     * @returns {Promise<Object>} Resposta do pagamento
     */
    const sendPaymentToBackend = async (paymentData, orderContext) => {
        if (!orderContext) {
            throw new Error('Dados do pedido não configurados.');
        }

        try {
            const response = await fetch(config.paymentEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paymentData,
                    order: orderContext
                })
            });

            // Verificar se o endpoint existe
            if (response.status === 404) {
                throw new Error('Endpoint de pagamento não encontrado. Verifique se o arquivo PHP está no servidor.');
            }

            // Verificar se o método é permitido
            if (response.status === 405) {
                throw new Error('Servidor não permite requisições POST. Verifique a configuração do servidor PHP.');
            }

            const payload = await response.json().catch(() => {
                // Se não conseguir parsear JSON, pode ser erro do servidor
                return { 
                    error: 'server_error',
                    message: `Erro do servidor (${response.status}): ${response.statusText}`
                };
            });
            
            if (!response.ok || payload?.error) {
                const errorMessage = payload?.message || payload?.error || `Erro ao processar pagamento (${response.status}).`;
                const error = new Error(errorMessage);
                error.details = payload;
                error.status = response.status;
                throw error;
            }

            return payload;
        } catch (error) {
            // Se for erro de rede
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Não foi possível conectar ao servidor. Verifique se o servidor PHP está rodando e acessível.');
            }
            throw error;
        }
    };

    /**
     * Processa a resposta do pagamento e dispara callbacks apropriados
     * @param {Object} paymentResponse - Resposta do Mercado Pago
     */
    const handlePaymentResponse = (paymentResponse) => {
        const status = paymentResponse?.status;
        
        console.log('[MercadoPago] Resposta do pagamento:', paymentResponse);

        if (status === 'approved') {
            callbackRegistry.onPaymentSuccess?.(paymentResponse);
            return paymentResponse;
        }

        if (status === 'pending' || status === 'in_process') {
            // Verificar se é PIX ou Boleto
            const paymentMethodId = paymentResponse?.payment_method_id;
            const pointOfInteraction = paymentResponse?.point_of_interaction;
            
            if (paymentMethodId === 'pix') {
                // Extrair dados do QR Code PIX
                const transactionData = pointOfInteraction?.transaction_data || {};
                const pixData = {
                    qrCode: transactionData.qr_code || '',
                    qrCodeBase64: transactionData.qr_code_base64 || '',
                    ticketUrl: transactionData.ticket_url || '',
                    expirationDate: paymentResponse?.date_of_expiration || ''
                };
                
                // Se não encontrou no transaction_data, tentar outros lugares
                if (!pixData.qrCode && pointOfInteraction?.transaction_data?.qr_code_base64) {
                    pixData.qrCodeBase64 = pointOfInteraction.transaction_data.qr_code_base64;
                }
                
                callbackRegistry.onPixGenerated?.(pixData, paymentResponse);
            } else if (paymentMethodId === 'bolbradesco' || paymentResponse?.payment_type_id === 'ticket') {
                // Extrair dados do Boleto
                const transactionDetails = paymentResponse?.transaction_details || {};
                const boletoData = {
                    barcode: paymentResponse?.barcode?.content || paymentResponse?.barcode || '',
                    ticketUrl: transactionDetails.external_resource_url || paymentResponse?.transaction_details?.external_resource_url || '',
                    expirationDate: paymentResponse?.date_of_expiration || ''
                };
                
                callbackRegistry.onBoletoGenerated?.(boletoData, paymentResponse);
            }

            callbackRegistry.onPaymentPending?.(paymentResponse);
            return paymentResponse;
        }

        // Pagamento rejeitado
        const statusDetail = paymentResponse?.status_detail || 'unknown';
        const errorMessages = {
            'cc_rejected_bad_filled_card_number': 'Número do cartão inválido.',
            'cc_rejected_bad_filled_date': 'Data de validade inválida.',
            'cc_rejected_bad_filled_other': 'Dados do cartão inválidos.',
            'cc_rejected_bad_filled_security_code': 'Código de segurança inválido.',
            'cc_rejected_blacklist': 'Pagamento não autorizado.',
            'cc_rejected_call_for_authorize': 'Ligue para a operadora do cartão.',
            'cc_rejected_card_disabled': 'Cartão desabilitado. Ative-o primeiro.',
            'cc_rejected_duplicated_payment': 'Pagamento duplicado.',
            'cc_rejected_high_risk': 'Pagamento recusado por segurança.',
            'cc_rejected_insufficient_amount': 'Saldo insuficiente.',
            'cc_rejected_invalid_installments': 'Parcelas inválidas.',
            'cc_rejected_max_attempts': 'Limite de tentativas atingido.',
            'cc_rejected_other_reason': 'Pagamento recusado.'
        };

        const error = new Error(errorMessages[statusDetail] || 'Pagamento não aprovado.');
        error.details = paymentResponse;
        callbackRegistry.onPaymentError?.(error);
        throw error;
    };

    /**
     * Cria um pagamento com cartão de crédito/débito
     * @param {Object} cardData - Dados do cartão
     * @param {Object} orderContext - Contexto do pedido
     * @returns {Promise<Object>} Resposta do pagamento
     */
    const payWithCard = async (cardData, orderContext) => {
        // Tokenizar o cartão
        const token = await createCardToken(cardData);

        const paymentData = {
            token,
            payment_method_id: cardData.paymentMethodId,
            installments: cardData.installments || 1,
            payer: {
                email: orderContext.customer?.email,
                identification: {
                    type: cardData.identificationType || 'CPF',
                    number: cardData.identificationNumber.replace(/\D/g, '')
                }
            }
        };

        const response = await sendPaymentToBackend(paymentData, orderContext);
        return handlePaymentResponse(response);
    };

    /**
     * Cria um pagamento com PIX
     * @param {Object} orderContext - Contexto do pedido
     * @returns {Promise<Object>} Resposta do pagamento
     */
    const payWithPix = async (orderContext) => {
        const paymentData = {
            payment_method_id: 'pix',
            payer: {
                email: orderContext.customer?.email,
                identification: {
                    type: 'CPF',
                    number: (orderContext.customer?.taxId || '').replace(/\D/g, '')
                }
            }
        };

        const response = await sendPaymentToBackend(paymentData, orderContext);
        return handlePaymentResponse(response);
    };

    /**
     * Cria um pagamento com Boleto
     * @param {Object} orderContext - Contexto do pedido
     * @returns {Promise<Object>} Resposta do pagamento
     */
    const payWithBoleto = async (orderContext) => {
        const paymentData = {
            payment_method_id: 'bolbradesco',
            payer: {
                email: orderContext.customer?.email,
                first_name: orderContext.customer?.name?.split(' ')[0] || '',
                last_name: orderContext.customer?.name?.split(' ').slice(1).join(' ') || '',
                identification: {
                    type: 'CPF',
                    number: (orderContext.customer?.taxId || '').replace(/\D/g, '')
                },
                address: {
                    zip_code: orderContext.address?.postalCode || '',
                    street_name: orderContext.address?.street || '',
                    street_number: orderContext.address?.number || '',
                    neighborhood: orderContext.address?.district || '',
                    city: orderContext.address?.city || '',
                    federal_unit: orderContext.address?.state || ''
                }
            }
        };

        const response = await sendPaymentToBackend(paymentData, orderContext);
        return handlePaymentResponse(response);
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

    /**
     * Define os callbacks de eventos
     * @param {Object} callbacks - Callbacks
     */
    const setCallbacks = (callbacks = {}) => {
        Object.keys(callbacks).forEach((key) => {
            if (typeof callbacks[key] === 'function' && key in callbackRegistry) {
                callbackRegistry[key] = callbacks[key];
            }
        });
    };

    const MercadoPagoService = {
        configure,
        getConfig,
        setCallbacks,
        // Tokenização e informações
        createCardToken,
        getPaymentMethods,
        getInstallments,
        getIdentificationTypes,
        // Métodos de pagamento
        payWithCard,
        payWithPix,
        payWithBoleto
    };

    window.MercadoPagoService = MercadoPagoService;
})(window, document);
