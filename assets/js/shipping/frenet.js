(function (window, document) {
    'use strict';

    const DEFAULT_CONFIG = {
        baseUrl: 'https://api.frenet.com.br/shipping',
        token: '',
        password: '',
        sellerPostalCode: '01001000'
    };

    const config = { ...DEFAULT_CONFIG };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);

    const shouldMock = () => !config.token || !config.password;

    const sanitizePostalCode = (value = '') => value.replace(/\D/g, '').slice(0, 8);
    const formatPostalCode = (value = '') => {
        const digits = sanitizePostalCode(value);
        if (digits.length <= 5) return digits;
        return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
    };

    const mockResponse = (postalCode) => ({
        service: 'Frenet Expresso',
        price: 29.9,
        deliveryTime: 5,
        postalCode
    });

    const request = async (postalCode, cartSnapshot) => {
        if (shouldMock()) {
            console.info('[Frenet] Executando em modo mock');
            return mockResponse(postalCode);
        }

        const body = {
            SellerCEP: config.sellerPostalCode,
            RecipientCEP: postalCode,
            ShipmentInvoiceValue: cartSnapshot.total || cartSnapshot.subtotal || 0,
            ShippingItemArray: cartSnapshot.items.map((item) => ({
                Peso: 0.2,
                Altura: 15,
                Largura: 12,
                Comprimento: 12,
                Valor: item.price,
                Quantidade: item.quantity,
                SKU: item.sku || item.id
            }))
        };

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                token: config.token,
                senha: config.password
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Frenet error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const service = Array.isArray(data?.Services) ? data.Services.find((srv) => srv?.ServiceAvailable) : null;

        if (!service) {
            throw new Error('Nenhum serviço de frete disponível.');
        }

        return {
            service: service.ServiceDescription,
            price: service.ShippingPrice,
            deliveryTime: service.DeliveryTime,
            postalCode
        };
    };

    const FrenetService = {
        configure(options = {}) {
            Object.assign(config, options);
        },
        resetConfig() {
            Object.assign(config, { ...DEFAULT_CONFIG });
        },
        getConfig() {
            return { ...config };
        },
        async getFreightRates({ postalCode, cartSnapshot }) {
            const sanitizedPostalCode = sanitizePostalCode(postalCode);
            if (sanitizedPostalCode.length < 8) {
                throw new Error('CEP inválido.');
            }
            return request(sanitizedPostalCode, cartSnapshot);
        }
    };

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
            const rawPostalCode = postalCodeInput ? postalCodeInput.value : '';
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

            if (resultBox) {
                resultBox.textContent = 'Calculando frete...';
            }
            setLoading(true);

            try {
                const cartSnapshot = window.NatucartCart ? window.NatucartCart.getSnapshot() : { items: [], subtotal: 0, total: 0 };
                const quote = await FrenetService.getFreightRates({
                    postalCode: sanitizedPostal,
                    cartSnapshot
                });

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
                }
            } catch (error) {
                console.error('[Frenet] Falha ao calcular frete', error);
                if (resultBox) {
                    resultBox.textContent = 'Não foi possível calcular o frete no momento.';
                }
            } finally {
                setLoading(false);
            }
        });
    }

    window.FrenetService = FrenetService;
})(window, document);

