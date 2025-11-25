(function (window) {
    'use strict';

    const DEFAULT_CONFIG = {
        preferenceEndpoint: '/inc/mercadopago_preference.php',
        baseUrl: 'https://natucart.vercel.app',
        notificationUrl: '',
        paymentMethods: {
            excludedPaymentMethods: [],
            excludedPaymentTypes: [],
            installments: 12
        },
        binaryMode: false,
        expires: false,
        expirationDateFrom: null,
        expirationDateTo: null
    };

    const config = { ...DEFAULT_CONFIG };

    const buildPreferencePayload = (order) => {
        const baseUrl = config.baseUrl.replace(/\/$/, '');
        const items = (order.items || []).map((item) => ({
            title: item.name,
            quantity: item.quantity,
            unit_price: Number(item.price),
            currency_id: 'BRL'
        }));

        if (order.freight && order.freight.price) {
            items.push({
                title: `Frete - ${order.freight.service || 'Entrega'}`,
                quantity: 1,
                unit_price: Number(order.freight.price),
                currency_id: 'BRL'
            });
        }

        return {
            items,
            payer: {
                name: order.customer?.name || '',
                email: order.customer?.email || '',
                identification: {
                    type: 'CPF',
                    number: (order.customer?.taxId || '').replace(/\D/g, '')
                }
            },
            back_urls: {
                success: `${baseUrl}/checkout.html?payment=completed`,
                failure: `${baseUrl}/checkout.html?payment=failed`,
                pending: `${baseUrl}/checkout.html?payment=pending`
            },
            auto_return: 'approved',
            external_reference: order.externalReference || order.orderId || `natucart_${Date.now()}`,
            statement_descriptor: 'NATUCART',
            notification_url: config.notificationUrl || undefined,
            payment_methods: {
                excluded_payment_methods: config.paymentMethods.excludedPaymentMethods || [],
                excluded_payment_types: config.paymentMethods.excludedPaymentTypes || [],
                installments: config.paymentMethods.installments || 1
            },
            binary_mode: Boolean(config.binaryMode),
            expires: Boolean(config.expires),
            expiration_date_from: config.expirationDateFrom || undefined,
            expiration_date_to: config.expirationDateTo || undefined,
            metadata: {
                orderId: order.orderId || '',
                customerEmail: order.customer?.email || ''
            }
        };
    };

    const requestPreference = async (payload) => {
        const response = await fetch(config.preferenceEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preference: payload })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Erro ao criar preferência (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        if (!data.init_point) {
            throw new Error('Resposta inválida: init_point ausente.');
        }

        return data.init_point;
    };

    const MercadoPagoService = {
        configure(options = {}) {
            Object.assign(config, options);
        },
        async createPreference(order) {
            const payload = buildPreferencePayload(order);
            return requestPreference(payload);
        }
    };

    window.MercadoPagoService = MercadoPagoService;
})(window);
