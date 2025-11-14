(function (window, document) {
    'use strict';

    const cart = window.NatucartCart;
    const abacate = window.AbacatePayService;

    const elements = {
        items: document.querySelector('[data-checkout-items]'),
        total: document.querySelector('[data-checkout-total]'),
        status: document.querySelector('[data-checkout-status]'),
        submit: document.querySelector('[data-checkout-submit]')
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);

    const updateSummary = (snapshot) => {
        if (elements.items) {
            const count = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
            elements.items.textContent = count;
        }
        if (elements.total) {
            elements.total.textContent = formatCurrency(snapshot.total);
        }
        if (elements.status && snapshot.items.length && !snapshot.freight) {
            elements.status.textContent = 'Adicione seu CEP para calcular o frete.';
        } else if (elements.status && snapshot.items.length && snapshot.freight) {
            elements.status.textContent = `Pronto para finalizar: frete ${snapshot.freight.service}.`;
        }
    };

    if (cart) {
        cart.subscribe(updateSummary);
    } else {
        document.addEventListener('natucart:cart:update', (event) => {
            updateSummary(event.detail);
        });
    }

    const setStatus = (message) => {
        if (elements.status) {
            elements.status.textContent = message;
        }
    };

    const toggleButton = (disabled) => {
        if (elements.submit) {
            elements.submit.disabled = disabled;
        }
    };

    const handleCheckout = async () => {
        if (!cart || !abacate) {
            setStatus('Integrações ainda não carregadas.');
            return;
        }

        const snapshot = cart.getSnapshot();
        if (!snapshot.items.length) {
            setStatus('Adicione itens ao carrinho antes de finalizar.');
            return;
        }

        toggleButton(true);
        setStatus('Criando sessão de pagamento...');

        try {
            const session = await abacate.createCheckoutSession(snapshot);
            setStatus('Sessão criada. Enviando pagamento para AbacatePay...');

            const paymentResult = await abacate.submitPayment({
                sessionId: session.sessionId,
                amount: snapshot.total,
                currency: 'BRL',
                metadata: {
                    checkoutUrl: session.checkoutUrl
                }
            });

            setStatus(`Pagamento simulado com sucesso! ID: ${paymentResult.paymentId}`);
        } catch (error) {
            console.error('[Checkout] erro', error);
            setStatus('Não foi possível finalizar o checkout agora. Tente novamente.');
        } finally {
            toggleButton(false);
        }
    };

    if (elements.submit) {
        elements.submit.addEventListener('click', handleCheckout);
    }
})(window, document);

