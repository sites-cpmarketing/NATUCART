(function (window, document) {
    'use strict';

    const cart = window.NatucartCart;
    const mercadoPago = window.MercadoPagoService;

    const elements = {
        items: document.querySelector('[data-checkout-items]'),
        total: document.querySelector('[data-checkout-total]'),
        status: document.querySelector('[data-checkout-status]'),
        submit: document.querySelector('[data-checkout-submit]')
    };

    let latestCartSnapshot = cart ? cart.getSnapshot() : {
        items: [],
        subtotal: 0,
        total: 0,
        freight: null
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);

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

    const updateSummary = (snapshot) => {
        latestCartSnapshot = snapshot;

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

    // ========== VALIDAÇÃO ==========

    const sanitizeCPF = (cpf) => (cpf || '').replace(/\D/g, '');
    const sanitizePhone = (phone) => (phone || '').replace(/\D/g, '');

    const validateCustomerData = () => {
        const customerForm = document.getElementById('customerDataForm');
        if (!customerForm) {
            return { valid: false, error: 'Formulário de dados do cliente não encontrado.' };
        }

        const formData = new FormData(customerForm);
        const name = (formData.get('customerName') || '').trim();
        const email = (formData.get('customerEmail') || '').trim();
        const phone = formData.get('customerPhone') || '';
        const cpf = formData.get('customerCPF') || '';

        if (!name) {
            return { valid: false, error: 'Preencha o nome completo.' };
        }
        if (!email || !email.includes('@')) {
            return { valid: false, error: 'Preencha um e-mail válido.' };
        }
        if (!phone) {
            return { valid: false, error: 'Preencha o telefone.' };
        }
        const sanitizedCPF = sanitizeCPF(cpf);
        if (!sanitizedCPF || sanitizedCPF.length !== 11) {
            return { valid: false, error: 'Preencha um CPF válido.' };
        }

        return {
            valid: true,
            data: {
                name,
                email,
                cellphone: sanitizePhone(phone),
                taxId: sanitizedCPF
            }
        };
    };

    const getAddressData = () => {
        const freightForm = document.querySelector('[data-freight-form]');
        if (!freightForm) {
            return null;
        }

        const formData = new FormData(freightForm);
        return {
            postalCode: (formData.get('postalCode') || '').replace(/\D/g, ''),
            state: formData.get('state') || '',
            city: (formData.get('city') || '').trim(),
            street: (formData.get('street') || '').trim(),
            number: (formData.get('number') || '').trim(),
            district: (formData.get('district') || '').trim(),
            complement: (formData.get('complement') || '').trim()
        };
    };

    // ========== CHECKOUT ==========

    const handleCheckout = async () => {
        if (!cart) {
            setStatus('Carrinho não carregado.');
            return;
        }

        const snapshot = cart.getSnapshot();
        if (!snapshot.items.length) {
            setStatus('Adicione itens ao carrinho antes de finalizar.');
            return;
        }

        // Validar dados do cliente
        const customerValidation = validateCustomerData();
        if (!customerValidation.valid) {
            setStatus(customerValidation.error);
            const customerCard = document.querySelector('#customerDataForm')?.closest('.checkout-card');
            if (customerCard) {
                customerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Validar frete
        if (!snapshot.freight) {
            setStatus('Calcule o frete antes de finalizar a compra.');
            const freightCard = document.querySelector('[data-freight-form]')?.closest('.checkout-card');
            if (freightCard) {
                freightCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Coletar dados do endereço
        const addressData = getAddressData();
        if (!addressData || !addressData.postalCode) {
            setStatus('Preencha o endereço completo antes de finalizar.');
            const freightCard = document.querySelector('[data-freight-form]')?.closest('.checkout-card');
            if (freightCard) {
                freightCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        toggleButton(true);
        setStatus('Criando link de pagamento...');

        try {
            // Preparar contexto do pedido
            const orderId = `natucart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const orderContext = {
                orderId,
                externalReference: orderId,
                transactionAmount: snapshot.total,
                description: `Pedido ${orderId} - Natucart`,
                customer: customerValidation.data,
                address: addressData,
                freight: snapshot.freight,
                items: snapshot.items,
                totals: {
                    subtotal: snapshot.subtotal,
                    freight: snapshot.freight?.price || 0,
                    total: snapshot.total
                },
                metadata: {
                    orderId,
                    freight: {
                        service: snapshot.freight.service,
                        serviceCode: snapshot.freight.serviceCode,
                        carrier: snapshot.freight.carrier,
                        price: snapshot.freight.price,
                        deliveryTime: snapshot.freight.deliveryTime
                    },
                    address: addressData
                }
            };

            // Salvar dados do pedido no localStorage
            const orderDataToSave = {
                customer: customerValidation.data,
                address: addressData,
                freight: snapshot.freight,
                items: snapshot.items,
                totals: orderContext.totals,
                orderId,
                externalReference: orderId,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('natucart_pending_order', JSON.stringify(orderDataToSave));
            console.log('[Checkout] Dados do pedido salvos:', orderDataToSave);

            if (!mercadoPago) {
                throw new Error('Serviço do Mercado Pago não está disponível.');
            }

            // Criar preferência de pagamento (Checkout Pro)
            setStatus('Redirecionando para o pagamento...');
            const paymentUrl = await mercadoPago.createPreference(orderContext);
            
            // Redirecionar para o Mercado Pago
            window.location.href = paymentUrl;

        } catch (error) {
            console.error('[Checkout] Erro ao finalizar compra:', error);
            
            let errorMessage = 'Não foi possível processar o pedido. Tente novamente.';
            
            if (error.message) {
                errorMessage = error.message;
            }
            
            setStatus(`Erro: ${errorMessage}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            toggleButton(false);
        }
    };

    // ========== INICIALIZAÇÃO ==========

    const initialize = () => {
        // Subscribir ao carrinho
        if (cart) {
            cart.subscribe(updateSummary);
            // Atualizar imediatamente
            updateSummary(cart.getSnapshot());
        } else {
            document.addEventListener('natucart:cart:update', (event) => {
                updateSummary(event.detail);
            });
        }

        // Event listener do botão de finalizar
        if (elements.submit) {
            elements.submit.addEventListener('click', handleCheckout);
        }
    };

    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window, document);
