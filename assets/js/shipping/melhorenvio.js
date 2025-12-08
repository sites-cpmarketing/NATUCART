(function (window, document) {
    'use strict';

    const DEFAULT_CONFIG = {
        baseUrl: 'https://melhorenvio.com.br/api/v2/me/shipment/calculate',
        token: '', // Token de acesso OAuth do Melhor Envio (gerenciado pelo n8n)
        clientId: '', // Client ID do aplicativo Melhor Envio
        clientSecret: '', // Client Secret do aplicativo Melhor Envio
        sellerPostalCode: '01001000',
        n8nWebhookUrl: 'https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-natucart' // Webhook n8n para proxy
    };

    const config = { ...DEFAULT_CONFIG };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);

    const shouldMock = () => {
        // Se houver n8nWebhookUrl configurado, não usar mock (o n8n gerencia a autenticação)
        if (config.n8nWebhookUrl && config.n8nWebhookUrl.length > 0) {
            return false;
        }
        // Se não houver token E não houver n8nWebhookUrl, usar mock
        return !config.token;
    };

    const sanitizePostalCode = (value = '') => value.replace(/\D/g, '').slice(0, 8);
    const formatPostalCode = (value = '') => {
        const digits = sanitizePostalCode(value);
        if (digits.length <= 5) return digits;
        return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
    };

    const mockResponse = (postalCode) => ({
        options: [
            {
                service: 'PAC',
                carrier: 'Correios',
                price: 15.50,
                deliveryTime: 7,
                serviceCode: 'PAC',
                postalCode
            },
            {
                service: 'SEDEX',
                carrier: 'Correios',
                price: 25.90,
                deliveryTime: 3,
                serviceCode: 'SEDEX',
                postalCode
            }
        ],
        postalCode
    });

    const request = async (addressData, cartSnapshot) => {
        if (shouldMock()) {
            console.info('[Melhor Envio] Executando em modo mock');
            return mockResponse(addressData.postalCode);
        }

        // Construir body conforme documentação do Melhor Envio
        // Documentação: https://melhorenvio.com.br/api/v2/me/shipment/calculate
        const body = {
            from: {
                postal_code: config.sellerPostalCode
            },
            to: {
                postal_code: addressData.postalCode
            },
            // Enviar cada unidade como um produto separado
            // Exemplo: se quantity = 3, criar 3 produtos separados
            products: cartSnapshot.items.flatMap((item) => {
                // Usar configurações baseadas na quantidade do produto
                const ProductConfig = window.ProductConfig || {
                    getConfigByQuantity: function(qty) {
                        // Fallback se ProductConfig não estiver disponível
                        if (qty === 1) return { weight: 0.05, width: 16.5, height: 1, length: 18 };
                        if (qty >= 2 && qty <= 3) return { weight: 0.16, width: 20.5, height: 7.5, length: 12 };
                        if (qty >= 4 && qty <= 6) return { weight: 0.28, width: 19, height: 10, length: 14.5 };
                        const base = { weight: 0.28, width: 19, height: 10, length: 14.5 };
                        return { ...base, weight: (base.weight / 6) * qty };
                    }
                };
                
                // Obter configuração baseada na quantidade deste item
                const productConfig = ProductConfig.getConfigByQuantity(item.quantity);
                
                // Enviar como 1 produto com as dimensões do pacote completo
                // O Melhor Envio calcula o frete baseado nas dimensões e peso totais
                return [{
                    id: item.sku || item.id,
                    width: productConfig.width,
                    height: productConfig.height,
                    length: productConfig.length,
                    weight: productConfig.weight, // Peso total do pacote
                    insurance_value: item.price * item.quantity, // Valor total do item
                    quantity: item.quantity
                }];
            }),
            services: '1,2,3,4,17' // IDs dos serviços (PAC, SEDEX, etc.)
        };

        // Adicionar dados de endereço completo se disponíveis
        if (addressData.street) {
            body.to.address = addressData.street;
        }
        if (addressData.number) {
            body.to.number = addressData.number;
        }
        if (addressData.complement) {
            body.to.complement = addressData.complement;
        }
        if (addressData.district) {
            body.to.district = addressData.district;
        }
        if (addressData.city) {
            body.to.city = addressData.city;
        }
        if (addressData.state) {
            body.to.state = addressData.state;
        }

        // Verificar se deve usar n8n como proxy
        const useN8N = config.n8nWebhookUrl && config.n8nWebhookUrl.length > 0;

        // Headers conforme documentação do Melhor Envio
        // Nota: Quando usando n8n como proxy, o token será gerenciado pelo n8n
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Natucart/1.0'
        };
        
        // Adicionar Authorization apenas se houver token E não estiver usando n8n (requisição direta)
        if (config.token && !useN8N) {
            headers['Authorization'] = `Bearer ${config.token}`;
        }

        let response;
        
        if (useN8N) {
            // Enviar requisição via n8n webhook
            try {
                console.info('[Melhor Envio] Enviando requisição via n8n webhook...');
                response = await fetch(config.n8nWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        // Dados para o n8n fazer a requisição ao Melhor Envio
                        melhorEnvioUrl: config.baseUrl,
                        melhorEnvioHeaders: headers,
                        melhorEnvioBody: body,
                        // Credenciais OAuth (o n8n usará para obter/renovar token)
                        clientId: config.clientId,
                        clientSecret: config.clientSecret,
                        // Informações adicionais úteis
                        address: addressData,
                        cartSnapshot: {
                            itemsCount: cartSnapshot.items.length,
                            subtotal: cartSnapshot.subtotal,
                            total: cartSnapshot.total
                        }
                    }),
                    mode: 'cors'
                });
            } catch (n8nError) {
                console.error('[Melhor Envio] Erro ao chamar webhook n8n:', n8nError);
                throw new Error(`Não foi possível conectar ao webhook n8n. Verifique se o webhook está configurado corretamente. Erro: ${n8nError.message}`);
            }
        } else {
            // Tentar requisição direta (provavelmente falhará por CORS)
            try {
                response = await fetch(config.baseUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body),
                    mode: 'cors'
                });
            } catch (fetchError) {
                console.error('[Melhor Envio] Erro na requisição direta:', fetchError);
                
                // Se for erro de CORS, informar que precisa configurar n8n
                if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('CORS')) {
                    throw new Error('Erro de CORS: A API do Melhor Envio não permite requisições diretas do navegador. Configure o n8nWebhookUrl na configuração do MelhorEnvioService para usar o webhook n8n como proxy.');
                }
                
                throw new Error(`Não foi possível conectar à API do Melhor Envio. Erro: ${fetchError.message}`);
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Melhor Envio error ${response.status}: ${errorText}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    errorMessage = errorJson.message;
                } else if (errorJson.error) {
                    errorMessage = errorJson.error;
                }
            } catch (e) {
                // Manter mensagem original se não for JSON
            }
            throw new Error(errorMessage);
        }

        let responseData = await response.json();
        console.log('[Melhor Envio] Resposta bruta do n8n:', responseData);
        console.log('[Melhor Envio] Tipo da resposta:', typeof responseData, Array.isArray(responseData));
        
        // Se o n8n retornar a resposta do Melhor Envio dentro de um campo (ex: data, body, result)
        // extrair o conteúdo real
        let data = responseData;
        if (useN8N) {
            // O n8n pode retornar a resposta em diferentes formatos
            // Verificar múltiplos níveis de aninhamento
            if (Array.isArray(responseData)) {
                // Se já estiver no formato correto (array direto), usar diretamente
                data = responseData;
                console.log('[Melhor Envio] Dados são um array direto:', data.length, 'itens');
            } else if (responseData.data) {
                data = responseData.data;
                console.log('[Melhor Envio] Dados extraídos de responseData.data:', Array.isArray(data) ? `${data.length} itens` : 'objeto único');
            } else if (responseData.body) {
                data = responseData.body;
                console.log('[Melhor Envio] Dados extraídos de responseData.body:', Array.isArray(data) ? `${data.length} itens` : 'objeto único');
            } else if (responseData.result) {
                data = responseData.result;
                console.log('[Melhor Envio] Dados extraídos de responseData.result:', Array.isArray(data) ? `${data.length} itens` : 'objeto único');
            } else if (responseData.json) {
                // n8n pode retornar em responseData.json
                data = responseData.json;
                console.log('[Melhor Envio] Dados extraídos de responseData.json:', Array.isArray(data) ? `${data.length} itens` : 'objeto único');
            } else if (responseData && typeof responseData === 'object') {
                // Verificar se é um objeto com propriedades que podem ser arrays
                if (Array.isArray(responseData.items)) {
                    data = responseData.items;
                    console.log('[Melhor Envio] Dados extraídos de responseData.items:', data.length, 'itens');
                } else if (Array.isArray(responseData.services)) {
                    data = responseData.services;
                    console.log('[Melhor Envio] Dados extraídos de responseData.services:', data.length, 'itens');
                } else {
                    data = responseData;
                    console.log('[Melhor Envio] Dados são um objeto único:', data);
                }
            }
        }
        
        console.log('[Melhor Envio] Dados finais para processamento:', data);
        
        // Processar resposta conforme documentação do Melhor Envio
        // A API pode retornar um array de opções de frete ou um objeto único
        let availableServices = [];
        
        // Função auxiliar para processar um serviço individual
        const processService = (srv) => ({
            serviceCode: srv.id?.toString() || srv.name?.toUpperCase() || '',
            service: srv.name || srv.service_name || 'Serviço de Entrega',
            carrier: srv.company?.name || srv.carrier || 'Transportadora',
            carrierCode: srv.company?.id?.toString() || '',
            price: parseFloat(srv.price) || parseFloat(srv.custom_price) || 0,
            deliveryTime: parseInt(srv.delivery_time) || parseInt(srv.delivery_range?.min) || parseInt(srv.delivery_range?.max) || 0,
            originalPrice: parseFloat(srv.custom_price) || parseFloat(srv.price) || 0,
            postalCode: addressData.postalCode,
            // Dados adicionais do Melhor Envio
            serviceId: srv.id,
            companyId: srv.company?.id,
            error: srv.error || null
        });
        
        if (Array.isArray(data)) {
            // Resposta é um array de serviços
            availableServices = data
                .filter(srv => {
                    const price = parseFloat(srv.price) || parseFloat(srv.custom_price) || 0;
                    return price > 0 && !srv.error;
                })
                .map(processService);
        } else if (data && Array.isArray(data.services)) {
            // Formato alternativo com propriedade services
            availableServices = data.services
                .filter(srv => {
                    const price = parseFloat(srv.price) || parseFloat(srv.custom_price) || 0;
                    return price > 0 && !srv.error;
                })
                .map(processService);
        } else if (data && typeof data === 'object' && data.id) {
            // Resposta é um objeto único (caso do n8n retornar apenas um serviço)
            const price = parseFloat(data.price) || parseFloat(data.custom_price) || 0;
            if (price > 0 && !data.error) {
                availableServices = [processService(data)];
            }
        }

        console.log('[Melhor Envio] Serviços processados:', availableServices.length, 'opções');
        if (availableServices.length > 0) {
            console.log('[Melhor Envio] Detalhes dos serviços:', availableServices);
            // Retornar todas as opções disponíveis
            console.log('[Melhor Envio] Retornando', availableServices.length, 'opções de frete');
            return {
                options: availableServices,
                postalCode: addressData.postalCode
            };
        }

        // Se nenhum serviço disponível, lançar erro
        console.warn('[Melhor Envio] Nenhum serviço disponível. Resposta original:', responseData);
        console.warn('[Melhor Envio] Dados processados:', data);
        throw new Error('Nenhum serviço de frete disponível para este endereço.');
    };

    const MelhorEnvioService = {
        configure(options = {}) {
            Object.assign(config, options);
        },
        resetConfig() {
            Object.assign(config, { ...DEFAULT_CONFIG });
        },
        getConfig() {
            return { ...config };
        },
        async getFreightRates({ postalCode, cartSnapshot, address = {} }) {
            const sanitizedPostalCode = sanitizePostalCode(postalCode || address.postalCode);
            if (sanitizedPostalCode.length < 8) {
                throw new Error('CEP inválido.');
            }

            const addressData = {
                postalCode: sanitizedPostalCode,
                street: address.street || '',
                number: address.number || '',
                complement: address.complement || '',
                district: address.district || address.neighborhood || '',
                city: address.city || '',
                state: address.state || '',
                country: address.country || 'BR'
            };

            return request(addressData, cartSnapshot);
        }
    };

    // Integração com formulário (se existir)
    const resultBox = document.querySelector('[data-freight-result]');
    const form = document.querySelector('[data-freight-form]');

    if (form) {
        const postalCodeInput = form.querySelector('input[name="postalCode"]');
        const submitButton = form.querySelector('button[type="submit"]');
        const submitDefaultLabel = submitButton ? submitButton.textContent : 'Calcular Frete';

        const setLoading = (loading) => {
            if (!submitButton) return;
            submitButton.disabled = loading;
            submitButton.textContent = loading ? 'Calculando...' : submitDefaultLabel;
        };

        if (postalCodeInput) {
            postalCodeInput.addEventListener('input', (event) => {
                const formatted = formatPostalCode(event.target.value);
                event.target.value = formatted;
            });
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Coletar todos os dados do formulário
            const formData = new FormData(form);
            const rawPostalCode = formData.get('postalCode') || '';
            const sanitizedPostal = sanitizePostalCode(rawPostalCode);

            if (!sanitizedPostal || sanitizedPostal.length < 8) {
                if (resultBox) {
                    resultBox.textContent = 'Informe um CEP válido.';
                }
                if (postalCodeInput) {
                    postalCodeInput.focus();
                }
                return;
            }

            // Validar campos obrigatórios
            const state = formData.get('state') || '';
            const city = formData.get('city') || '';
            const street = formData.get('street') || '';
            const number = formData.get('number') || '';
            const district = formData.get('district') || '';

            if (!state || !city || !street || !number || !district) {
                if (resultBox) {
                    resultBox.textContent = 'Preencha todos os campos obrigatórios do endereço.';
                }
                return;
            }

            if (resultBox) {
                resultBox.textContent = 'Calculando frete...';
            }
            setLoading(true);

            try {
                const cartSnapshot = window.NatucartCart ? window.NatucartCart.getSnapshot() : { items: [], subtotal: 0, total: 0 };
                
                // Coletar dados completos do endereço
                const addressData = {
                    postalCode: sanitizedPostal,
                    state: state,
                    city: city.trim(),
                    street: street.trim(),
                    number: number.trim(),
                    district: district.trim(),
                    complement: formData.get('complement') || ''
                };

                const quote = await MelhorEnvioService.getFreightRates({
                    postalCode: sanitizedPostal,
                    cartSnapshot,
                    address: addressData
                });

                // Processar resposta com múltiplas opções
                if (quote.options && quote.options.length > 0) {
                    // Salvar todas as opções no carrinho
                    if (window.NatucartCart) {
                        window.NatucartCart.setFreight({
                            service: quote.options[0].service,
                            price: quote.options[0].price,
                            deliveryTime: quote.options[0].deliveryTime,
                            postalCode: quote.postalCode,
                            options: quote.options
                        });
                    }

                    if (resultBox) {
                        const cheapest = quote.options.reduce((min, opt) => opt.price < min.price ? opt : min, quote.options[0]);
                        resultBox.textContent = `${quote.options.length} opção(ões) disponível(eis). A partir de ${formatCurrency(cheapest.price)}. Selecione uma opção abaixo.`;
                        resultBox.classList.add('has-result');
                    }
                } else if (quote.service) {
                    // Formato antigo (uma única opção)
                    if (window.NatucartCart) {
                        window.NatucartCart.setFreight({
                            service: quote.service,
                            price: quote.price,
                            deliveryTime: quote.deliveryTime,
                            postalCode: quote.postalCode
                        });
                    }

                    if (resultBox) {
                        resultBox.textContent = `${quote.service} - ${formatCurrency(quote.price)} · Prazo: ${quote.deliveryTime} dia(s) úteis`;
                        resultBox.classList.add('has-result');
                    }
                }
            } catch (error) {
                console.error('[Melhor Envio] Falha ao calcular frete', error);
                if (resultBox) {
                    resultBox.textContent = error.message || 'Não foi possível calcular o frete no momento.';
                    resultBox.classList.remove('has-result');
                }
            } finally {
                setLoading(false);
            }
        });
    }

    window.MelhorEnvioService = MelhorEnvioService;
})(window, document);

