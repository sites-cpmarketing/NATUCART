(function (window) {
    'use strict';

    const DEFAULT_CONFIG = {
        baseUrl: 'https://api.abacatepay.com/v1',
        publicKey: '',
        secretKey: '',
        environment: 'sandbox'
    };

    const config = { ...DEFAULT_CONFIG };

    const shouldMock = () => !config.publicKey || !config.secretKey;

    const randomId = () => `abp_${Math.random().toString(36).slice(2, 10)}`;

    const mockDelay = (result) => new Promise((resolve) => {
        setTimeout(() => resolve(result), 300);
    });

    const mockResponse = (type, payload = {}) => {
        switch (type) {
            case 'session':
                return mockDelay({
                    sessionId: randomId(),
                    checkoutUrl: 'https://sandbox.abacatepay.com/checkout/mock',
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    payload
                });
            case 'payment':
                return mockDelay({
                    paymentId: randomId(),
                    status: 'authorized',
                    receivedAt: new Date().toISOString()
                });
            default:
                return mockDelay({ ok: true });
        }
    };

    const buildHeaders = () => ({
        'Content-Type': 'application/json',
        'x-api-key': config.publicKey,
        Authorization: `Bearer ${config.secretKey}`
    });

    const request = async (path, options = {}) => {
        if (shouldMock()) {
            console.info('[AbacatePay] Executando em modo mock', path);
            return mockResponse(options.mockType || 'default', options.mockPayload);
        }

        const response = await fetch(`${config.baseUrl}${path}`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(options.body || {})
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`AbacatePay error ${response.status}: ${errorBody}`);
        }

        return response.json();
    };

    const sanitizeCartItems = (items = []) => items.map((item) => ({
        sku: item.sku || item.id,
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.price,
        totalAmount: item.price * item.quantity
    }));

    const AbacatePayService = {
        configure(options = {}) {
            Object.assign(config, options);
        },
        resetConfig() {
            Object.assign(config, { ...DEFAULT_CONFIG });
        },
        getConfig() {
            return { ...config };
        },
        async createCheckoutSession(cartSnapshot) {
            const body = {
                currency: 'BRL',
                items: sanitizeCartItems(cartSnapshot.items),
                subtotal: cartSnapshot.subtotal,
                freight: cartSnapshot.freight?.price || 0,
                total: cartSnapshot.total,
                metadata: {
                    generatedAt: new Date().toISOString()
                }
            };

            return request('/checkout/sessions', {
                body,
                mockType: 'session',
                mockPayload: body
            });
        },
        async submitPayment(paymentData) {
            return request('/payments', {
                body: paymentData,
                mockType: 'payment'
            });
        },
        async tokenizeCard(cardData) {
            return request('/tokens/card', {
                body: cardData,
                mockType: 'token',
                mockPayload: { tokenId: randomId(), last4: cardData.number?.slice(-4) }
            });
        }
    };

    window.AbacatePayService = AbacatePayService;
})(window);

