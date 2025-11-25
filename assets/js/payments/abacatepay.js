(function (window) {
    'use strict';

    const DEFAULT_CONFIG = {
        baseUrl: 'https://api.abacatepay.com/v1',
        apiKey: '',
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        returnUrl: window.location.origin,
        completionUrl: `${window.location.origin}?payment=completed`,
        customerDefaults: null
    };

    const config = { ...DEFAULT_CONFIG };

    const ensureApiKey = () => {
        if (!config.apiKey) {
            throw new Error('AbacatePay API key is not configured.');
        }
    };

    const buildHeaders = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
    });

    const request = async (path, body = {}) => {
        ensureApiKey();

        const response = await fetch(`${config.baseUrl}${path}`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body)
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMessage = payload?.error || payload?.message || response.statusText;
            throw new Error(`AbacatePay error ${response.status}: ${errorMessage}`);
        }

        return payload;
    };

    const buildProducts = (items = []) => {
        if (!items.length) {
            throw new Error('Carrinho vazio. Adicione itens antes de criar a cobrança.');
        }

        return items.map((item) => ({
            externalId: item.sku || item.id,
            name: item.name,
            description: '',
            quantity: item.quantity,
            price: Math.round(item.price * 100) // API utiliza centavos
        }));
    };

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
        async createBilling(cartSnapshot, customer = {}) {
            const products = buildProducts(cartSnapshot.items);

            const body = {
                frequency: config.frequency,
                methods: config.methods,
                products,
                returnUrl: config.returnUrl,
                completionUrl: config.completionUrl,
                customer: {
                    ...(config.customerDefaults || {}),
                    ...customer
                }
            };

            return request('/billing/create', body);
        }
    };

    window.AbacatePayService = AbacatePayService;
})(window);

