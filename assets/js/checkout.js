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

    let currentPaymentMethod = null;
    let installmentsUpdateTimeout = null;

    // ========== FUNÇÕES AUXILIARES ==========

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

    const sanitizeCPF = (cpf) => (cpf || '').replace(/\D/g, '');
    const sanitizePhone = (phone) => (phone || '').replace(/\D/g, '');

    // ========== ATUALIZAÇÃO DE PARCELAS ==========

    const updateInstallmentsIfNeeded = async (amount) => {
        if (!mercadoPago || !amount || amount <= 0) return;
        
        const cardNumberInput = document.getElementById('cardNumber');
        const installmentsSelect = document.getElementById('installments');
        
        if (!cardNumberInput || !installmentsSelect) return;
        
        const cardNumber = (cardNumberInput.value || '').replace(/\s/g, '');
        if (cardNumber.length < 6) return;

        const bin = cardNumber.substring(0, 6);
        
        // Debounce para evitar muitas requisições
        if (installmentsUpdateTimeout) {
            clearTimeout(installmentsUpdateTimeout);
        }
        
        installmentsUpdateTimeout = setTimeout(async () => {
            try {
                const installments = await mercadoPago.getInstallments({
                    amount: amount,
                    bin: bin
                });

                if (installments && installments.length > 0) {
                    installmentsSelect.innerHTML = installments.map(inst => {
                        const label = inst.recommended_message || `${inst.installments}x de ${formatCurrency(inst.installment_amount)}`;
                        return `<option value="${inst.installments}">${label}</option>`;
                    }).join('');
                }
            } catch (error) {
                console.warn('[Checkout] Erro ao atualizar parcelas:', error);
            }
        }, 500);
    };

    // ========== ATUALIZAÇÃO DO RESUMO ==========

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

        // Atualizar parcelas quando o total mudar (apenas se cartão estiver selecionado)
        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        if (selectedPaymentMethod === 'credit_card' && snapshot.total > 0) {
            updateInstallmentsIfNeeded(snapshot.total);
        }
    };

    // ========== CALLBACKS DO MERCADO PAGO ==========

    const handlePaymentSuccess = (paymentData) => {
        setStatus('Pagamento aprovado! Finalizando seu pedido...');

        try {
            const savedOrderRaw = localStorage.getItem('natucart_pending_order');
            if (savedOrderRaw) {
                const savedOrder = JSON.parse(savedOrderRaw);
                savedOrder.payment = paymentData;
                localStorage.setItem('natucart_pending_order', JSON.stringify(savedOrder));
            }
        } catch (storageError) {
            console.warn('[Checkout] Não foi possível atualizar os dados do pedido salvo:', storageError);
        }

        if (cart && typeof cart.clear === 'function') {
            cart.clear();
        }

        setTimeout(() => {
            window.location.href = `${window.location.pathname}?payment=completed`;
        }, 1200);
    };

    const handlePaymentPending = (paymentData) => {
        try {
            const savedOrderRaw = localStorage.getItem('natucart_pending_order');
            if (savedOrderRaw) {
                const savedOrder = JSON.parse(savedOrderRaw);
                savedOrder.payment = paymentData;
                localStorage.setItem('natucart_pending_order', JSON.stringify(savedOrder));
            }
        } catch (storageError) {
            console.warn('[Checkout] Não foi possível atualizar os dados do pedido salvo:', storageError);
        }
    };

    const handlePaymentError = (error) => {
        console.error('[Checkout] Pagamento não concluído:', error);
        const message = error?.message || 'Não foi possível concluir o pagamento. Tente novamente.';
        setStatus(`Erro: ${message}`);
        toggleButton(false);
    };

    const handlePixGenerated = (pixData, paymentResponse) => {
        console.log('[Checkout] PIX gerado:', pixData);
        showPixModal(pixData, paymentResponse);
    };

    const handleBoletoGenerated = (boletoData, paymentResponse) => {
        console.log('[Checkout] Boleto gerado:', boletoData);
        showBoletoModal(boletoData, paymentResponse);
    };

    // ========== MODAIS DE PIX E BOLETO ==========

    const showPixModal = (pixData, paymentResponse) => {
        // Remover modal anterior se existir
        const existingModal = document.getElementById('pixModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'pixModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #161616;
            border: 1px solid #2F2F2F;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
        `;

        const pixCode = pixData.qrCode || pixData.qr_code || '';
        const pixBase64 = pixData.qrCodeBase64 || pixData.qr_code_base64 || '';

        content.innerHTML = `
            <h2 style="color: #22C55E; font-size: 28px; margin-bottom: 20px;">
                <i class="fas fa-qrcode" style="margin-right: 10px;"></i>
                Pague com PIX
            </h2>
            <p style="color: #BFBFBF; margin-bottom: 25px;">Escaneie o QR Code ou copie o código abaixo</p>
            
            ${pixBase64 ? `
                <div style="background: #FFFFFF; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 25px;">
                    <img src="data:image/png;base64,${pixBase64}" alt="QR Code PIX" style="width: 200px; height: 200px; display: block;">
                </div>
            ` : ''}
            
            <div style="margin-bottom: 25px;">
                <p style="color: #BFBFBF; font-size: 12px; margin-bottom: 8px;">Código PIX (Copia e Cola)</p>
                <div style="background: #0A0A0A; border: 1px solid #2F2F2F; border-radius: 8px; padding: 15px; position: relative;">
                    <input type="text" id="pixCode" value="${pixCode}" readonly style="width: calc(100% - 80px); background: transparent; border: none; color: #FFFFFF; font-size: 12px; word-break: break-all;">
                    <button onclick="copyPixCode()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #E24B2F; color: #FFF; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
            </div>
            
            <p style="color: #7A7A7A; font-size: 14px; margin-bottom: 25px;">
                <i class="fas fa-clock" style="color: #E24B2F; margin-right: 8px;"></i>
                O pagamento será confirmado automaticamente
            </p>
            
            <button onclick="closePixModal()" style="background: #E24B2F; color: #FFF; border: none; padding: 15px 40px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 700;">
                Já realizei o pagamento
            </button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Funções globais para o modal
        window.copyPixCode = () => {
            const input = document.getElementById('pixCode');
            if (input) {
                input.select();
                input.setSelectionRange(0, 99999);
                document.execCommand('copy');
                alert('Código PIX copiado!');
            }
        };

        window.closePixModal = () => {
            modal.remove();
            window.location.href = `${window.location.pathname}?payment=pending`;
        };
    };

    const showBoletoModal = (boletoData, paymentResponse) => {
        // Remover modal anterior se existir
        const existingModal = document.getElementById('boletoModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'boletoModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #161616;
            border: 1px solid #2F2F2F;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
        `;

        const barcode = boletoData.barcode || boletoData.barcode?.content || '';
        const ticketUrl = boletoData.ticketUrl || paymentResponse?.transaction_details?.external_resource_url || '';

        content.innerHTML = `
            <h2 style="color: #E24B2F; font-size: 28px; margin-bottom: 20px;">
                <i class="fas fa-barcode" style="margin-right: 10px;"></i>
                Boleto Gerado
            </h2>
            <p style="color: #BFBFBF; margin-bottom: 25px;">Seu boleto foi gerado com sucesso</p>
            
            ${barcode ? `
                <div style="margin-bottom: 25px;">
                    <p style="color: #BFBFBF; font-size: 12px; margin-bottom: 8px;">Linha Digitável</p>
                    <div style="background: #0A0A0A; border: 1px solid #2F2F2F; border-radius: 8px; padding: 15px; position: relative;">
                        <input type="text" id="boletoCode" value="${barcode}" readonly style="width: calc(100% - 80px); background: transparent; border: none; color: #FFFFFF; font-size: 12px; word-break: break-all;">
                        <button onclick="copyBoletoCode()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #E24B2F; color: #FFF; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            <i class="fas fa-copy"></i> Copiar
                        </button>
                    </div>
                </div>
            ` : ''}
            
            <p style="color: #7A7A7A; font-size: 14px; margin-bottom: 25px;">
                <i class="fas fa-calendar" style="color: #E24B2F; margin-right: 8px;"></i>
                Vencimento em 3 dias úteis
            </p>
            
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                ${ticketUrl ? `
                    <a href="${ticketUrl}" target="_blank" style="background: #22C55E; color: #FFF; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 700; text-decoration: none;">
                        <i class="fas fa-download" style="margin-right: 8px;"></i>
                        Baixar Boleto
                    </a>
                ` : ''}
                <button onclick="closeBoletoModal()" style="background: #E24B2F; color: #FFF; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 700;">
                    Fechar
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Funções globais para o modal
        window.copyBoletoCode = () => {
            const input = document.getElementById('boletoCode');
            if (input) {
                input.select();
                input.setSelectionRange(0, 99999);
                document.execCommand('copy');
                alert('Código do boleto copiado!');
            }
        };

        window.closeBoletoModal = () => {
            modal.remove();
            window.location.href = `${window.location.pathname}?payment=pending`;
        };
    };

    // Registrar callbacks
    const registerMercadoPagoCallbacks = () => {
        if (!mercadoPago || typeof mercadoPago.setCallbacks !== 'function') {
            return;
        }

        mercadoPago.setCallbacks({
            onPaymentSuccess: handlePaymentSuccess,
            onPaymentPending: handlePaymentPending,
            onPaymentError: handlePaymentError,
            onPixGenerated: handlePixGenerated,
            onBoletoGenerated: handleBoletoGenerated
        });
    };

    // ========== FORMULÁRIO DE CARTÃO ==========

    const setupPaymentMethodToggle = () => {
        const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
        const cardFormSection = document.getElementById('cardPaymentForm');
        const pixInfoSection = document.getElementById('pixPaymentInfo');
        const boletoInfoSection = document.getElementById('boletoPaymentInfo');

        paymentMethodRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (cardFormSection) cardFormSection.style.display = radio.value === 'credit_card' ? 'block' : 'none';
                if (pixInfoSection) pixInfoSection.style.display = radio.value === 'pix' ? 'block' : 'none';
                if (boletoInfoSection) boletoInfoSection.style.display = radio.value === 'boleto' ? 'block' : 'none';
                
                // Se selecionou cartão e tem total, atualizar parcelas
                if (radio.value === 'credit_card' && latestCartSnapshot.total > 0) {
                    updateInstallmentsIfNeeded(latestCartSnapshot.total);
                }
            });
        });
    };

    const setupCardForm = () => {
        const cardNumberInput = document.getElementById('cardNumber');
        const cardBrandIcon = document.getElementById('cardBrandIcon');
        const installmentsSelect = document.getElementById('installments');
        const expirationInput = document.getElementById('cardExpiration');
        const cvvInput = document.getElementById('cardCVV');
        const cardholderCPFInput = document.getElementById('cardholderCPF');

        // Máscara e detecção de bandeira para número do cartão
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', async (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                e.target.value = value.substring(0, 19);

                // Detectar bandeira quando tiver 6+ dígitos
                const cardNumber = value.replace(/\s/g, '');
                if (cardNumber.length >= 6 && mercadoPago) {
                    const bin = cardNumber.substring(0, 6);
                    try {
                        const paymentMethod = await mercadoPago.getPaymentMethods(bin);
                        if (paymentMethod) {
                            currentPaymentMethod = paymentMethod;
                            if (cardBrandIcon) {
                                cardBrandIcon.innerHTML = `<img src="${paymentMethod.secure_thumbnail}" alt="${paymentMethod.name}" style="height: 24px;">`;
                            }
                            // Atualizar parcelas
                            if (latestCartSnapshot.total > 0) {
                                updateInstallmentsIfNeeded(latestCartSnapshot.total);
                            }
                        }
                    } catch (error) {
                        console.warn('[Checkout] Erro ao detectar bandeira:', error);
                    }
                } else if (cardBrandIcon) {
                    cardBrandIcon.innerHTML = '<i class="fas fa-credit-card" style="color: #7A7A7A;"></i>';
                    currentPaymentMethod = null;
                }
            });
        }

        // Máscara para data de validade
        if (expirationInput) {
            expirationInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.substring(0, 2) + '/' + value.substring(2, 4);
                }
                e.target.value = value;
            });
        }

        // Máscara para CVV
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
            });
        }

        // Máscara para CPF do portador
        if (cardholderCPFInput) {
            cardholderCPFInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 11) {
                    value = value.replace(/(\d{3})(\d)/, '$1.$2');
                    value = value.replace(/(\d{3})(\d)/, '$1.$2');
                    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                    e.target.value = value;
                }
            });
        }
    };

    // ========== VALIDAÇÃO ==========

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

    const validateCardData = () => {
        const cardNumber = (document.getElementById('cardNumber')?.value || '').replace(/\s/g, '');
        const cardholderName = (document.getElementById('cardholderName')?.value || '').trim();
        const expiration = (document.getElementById('cardExpiration')?.value || '').split('/');
        const cvv = (document.getElementById('cardCVV')?.value || '').trim();
        const cardholderCPF = sanitizeCPF(document.getElementById('cardholderCPF')?.value || '');

        if (!cardNumber || cardNumber.length < 13) {
            return { valid: false, error: 'Número do cartão inválido.' };
        }
        if (!cardholderName || cardholderName.length < 3) {
            return { valid: false, error: 'Nome do titular inválido.' };
        }
        if (expiration.length !== 2 || !expiration[0] || !expiration[1]) {
            return { valid: false, error: 'Data de validade inválida. Use MM/AA.' };
        }
        if (!cvv || cvv.length < 3) {
            return { valid: false, error: 'CVV inválido.' };
        }
        if (!cardholderCPF || cardholderCPF.length !== 11) {
            return { valid: false, error: 'CPF do portador inválido.' };
        }

        // Validar data de validade
        const month = parseInt(expiration[0]);
        const year = parseInt(expiration[1].length === 2 ? '20' + expiration[1] : expiration[1]);
        const now = new Date();
        const expiryDate = new Date(year, month - 1);
        
        if (month < 1 || month > 12) {
            return { valid: false, error: 'Mês inválido na data de validade.' };
        }
        if (expiryDate < now) {
            return { valid: false, error: 'Cartão expirado.' };
        }

        return {
            valid: true,
            data: {
                cardNumber,
                cardholderName,
                expirationMonth: expiration[0].padStart(2, '0'),
                expirationYear: expiration[1].length === 2 ? '20' + expiration[1] : expiration[1],
                securityCode: cvv,
                identificationType: 'CPF',
                identificationNumber: cardholderCPF,
                paymentMethodId: currentPaymentMethod?.id || 'visa',
                installments: parseInt(document.getElementById('installments')?.value || '1')
            }
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

        // Obter método de pagamento selecionado
        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        if (!selectedPaymentMethod) {
            setStatus('Selecione uma forma de pagamento.');
            return;
        }

        // Validar dados do cartão se for pagamento com cartão
        let cardData = null;
        if (selectedPaymentMethod === 'credit_card') {
            const cardValidation = validateCardData();
            if (!cardValidation.valid) {
                setStatus(cardValidation.error);
                const cardFormSection = document.getElementById('cardPaymentForm');
                if (cardFormSection) {
                    cardFormSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            cardData = cardValidation.data;
        }

        toggleButton(true);
        setStatus('Processando pagamento...');

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
                },
                notificationUrl: mercadoPago?.getConfig?.()?.notificationUrl || '',
                statementDescriptor: 'NATUCART'
            };

            // Salvar dados do pedido no localStorage
            const orderDataToSave = {
                customer: customerValidation.data,
                address: addressData,
                freight: snapshot.freight,
                items: snapshot.items,
                totals: orderContext.totals,
                orderId,
                paymentId: null,
                externalReference: orderId,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('natucart_pending_order', JSON.stringify(orderDataToSave));
            console.log('[Checkout] Dados do pedido salvos:', orderDataToSave);

            if (!mercadoPago) {
                throw new Error('Serviço do Mercado Pago não está disponível.');
            }

            // Processar pagamento conforme método selecionado
            if (selectedPaymentMethod === 'credit_card') {
                setStatus('Tokenizando dados do cartão...');
                await mercadoPago.payWithCard(cardData, orderContext);
            } else if (selectedPaymentMethod === 'pix') {
                setStatus('Gerando QR Code PIX...');
                await mercadoPago.payWithPix(orderContext);
            } else if (selectedPaymentMethod === 'boleto') {
                setStatus('Gerando boleto...');
                await mercadoPago.payWithBoleto(orderContext);
            }

        } catch (error) {
            console.error('[Checkout] Erro ao finalizar compra:', error);
            
            let errorMessage = 'Não foi possível processar o pedido. Tente novamente.';
            
            if (error.message) {
                    errorMessage = error.message;
            }
            
            setStatus(`Erro: ${errorMessage}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            toggleButton(false);
        }
    };

    // ========== INICIALIZAÇÃO ==========

    const initialize = () => {
        // Registrar callbacks do Mercado Pago
        registerMercadoPagoCallbacks();

        // Configurar formulários de pagamento
        setupPaymentMethodToggle();
        setupCardForm();

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
