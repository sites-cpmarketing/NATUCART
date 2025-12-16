(function (window, document) {
    'use strict';

    const PRODUCTS = {
        'natucart-single': {
            id: 'natucart-single',
            name: 'Natucart - 1 Frasco',
            sku: 'NATUCART-1',
            price: 99.90
        },
        'natucart-trio': {
            id: 'natucart-trio',
            name: 'Natucart - 3 Frascos',
            sku: 'NATUCART-3',
            price: 255
        },
        'natucart-six': {
            id: 'natucart-six',
            name: 'Natucart - 6 Frascos',
            sku: 'NATUCART-6',
            price: 450
        },
        // Produto de teste (R$ 0,05) para fluxos de validação
        'natucart-test': {
            id: 'natucart-test',
            name: 'Natucart - Teste (R$ 0,05)',
            sku: 'TEST-005',
            price: 0.05
        }
    };

    const STORAGE_KEY = 'natucart_cart_state';

    const loadState = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    items: parsed.items || {},
                    freight: parsed.freight || null
                };
            }
        } catch (error) {
            console.warn('[Cart] Erro ao carregar estado do localStorage:', error);
        }
        return {
            items: {},
            freight: null
        };
    };

    const saveState = () => {
        try {
            const stateToSave = {
                items: state.items,
                freight: state.freight,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
            console.warn('[Cart] Erro ao salvar estado no localStorage:', error);
        }
    };

    const savedState = loadState();
    const state = {
        items: savedState.items,
        subtotal: 0,
        freight: savedState.freight,
        total: 0
    };

    const subscribers = new Set();

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);

    const getSnapshot = () => ({
        items: Object.values(state.items),
        subtotal: state.subtotal,
        freight: state.freight,
        total: state.total
    });

    const notify = () => {
        const snapshot = getSnapshot();
        subscribers.forEach((cb) => {
            try {
                cb(snapshot);
            } catch (error) {
                console.error('NatucartCart subscriber error:', error);
            }
        });

        document.dispatchEvent(new CustomEvent('natucart:cart:update', {
            detail: snapshot
        }));
    };

    const recalc = () => {
        state.subtotal = Object.values(state.items).reduce((sum, item) => {
            return sum + item.price * item.quantity;
        }, 0);

        const freightValue = state.freight?.price || 0;
        state.total = state.subtotal + freightValue;

        saveState(); // Salvar no localStorage após recalcular
        notify();
    };

    const cart = {
        addItem(productId, quantity = 1) {
            const product = PRODUCTS[productId];
            if (!product) {
                console.warn(`Produto ${productId} não encontrado.`);
                return;
            }

            const existing = state.items[productId] || {
                id: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                quantity: 0
            };

            existing.quantity += quantity;
            state.items[productId] = existing;
            recalc();

            // Rastrear AddToCart no Meta Pixel
            if (window.MetaPixel) {
                window.MetaPixel.trackAddToCart({
                    content_name: product.name,
                    content_ids: [product.sku || product.id],
                    content_type: 'product',
                    value: product.price * quantity,
                    currency: 'BRL',
                    num_items: quantity
                });
            }
        },
        removeItem(productId) {
            if (state.items[productId]) {
                delete state.items[productId];
                recalc();
            }
        },
        updateQuantity(productId, quantity) {
            if (!state.items[productId]) return;
            if (quantity <= 0) {
                this.removeItem(productId);
                return;
            }
            state.items[productId].quantity = quantity;
            recalc();
        },
        clear() {
            state.items = {};
            state.freight = null;
            recalc();
        },
        setFreight(freightData) {
            state.freight = freightData;
            recalc();
        },
        getItems() {
            return Object.values(state.items);
        },
        getSnapshot,
        subscribe(callback) {
            if (typeof callback === 'function') {
                subscribers.add(callback);
                callback(getSnapshot());
                return () => subscribers.delete(callback);
            }
            return () => {};
        }
    };

    const DOM = {
        count: document.querySelector('[data-cart-count]'),
        subtotal: document.querySelector('[data-cart-subtotal]'),
        total: document.querySelector('[data-cart-total]'),
        list: document.querySelector('[data-cart-items]')
    };

    const updateMiniCart = (snapshot) => {
        const itemCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
        if (DOM.count) {
            DOM.count.textContent = itemCount;
        }
        if (DOM.subtotal) {
            DOM.subtotal.textContent = formatCurrency(snapshot.subtotal);
        }
        if (DOM.total) {
            DOM.total.textContent = formatCurrency(snapshot.total);
        }
        if (DOM.list) {
            if (!snapshot.items.length) {
                DOM.list.innerHTML = '<li class="woocommerce-mini-cart-item empty-cart-message"><p>Seu carrinho está vazio.</p></li>';
            } else {
                DOM.list.innerHTML = snapshot.items.map((item) => {
                    return `
                        <li class="woocommerce-mini-cart-item d-flex align-items-center">
                            <div class="mini-cart-content flex-grow-1">
                                <h4 class="product-title">${item.name}</h4>
                                <div class="mini-cart-price">${item.quantity} × ${formatCurrency(item.price)}</div>
                            </div>
                            <button class="remove remove_from_cart_button" data-remove-item="${item.id}" aria-label="Remover ${item.name}">×</button>
                        </li>
                    `;
                }).join('');
            }
        }
    };

    cart.subscribe(updateMiniCart);

    if (DOM.list) {
        DOM.list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-remove-item]');
            if (button) {
                event.preventDefault();
                cart.removeItem(button.dataset.removeItem);
            }
        });
    }

    const toast = document.querySelector('[data-cart-toast]');
    let toastTimeout = null;

    const runAddToCartFeedback = (trigger) => {
        trigger.classList.add('added-to-cart');
        setTimeout(() => trigger.classList.remove('added-to-cart'), 800);
        const cartToggle = document.querySelector('[data-toggle-mini-cart]');
        const headerShopCart = document.querySelector('.header-shop-cart');
        if (cartToggle && headerShopCart) {
            headerShopCart.classList.add('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', 'true');
        }

        if (toast) {
            toast.classList.add('is-visible');
            toast.setAttribute('aria-hidden', 'false');
            if (toastTimeout) {
                clearTimeout(toastTimeout);
            }
            toastTimeout = setTimeout(() => {
                toast.classList.remove('is-visible');
                toast.setAttribute('aria-hidden', 'true');
            }, 1800);
        }
    };

    document.querySelectorAll('[data-add-to-cart]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const productId = trigger.getAttribute('data-add-to-cart');
            cart.addItem(productId);
            runAddToCartFeedback(trigger);
            return false;
        }, true); // Usar capture phase para executar antes de outros handlers
    });

    const headerShopCart = document.querySelector('.header-shop-cart');
    const cartToggle = document.querySelector('[data-toggle-mini-cart]');

    // Criar overlay para mobile
    let cartOverlay = document.querySelector('.cart-overlay');
    if (!cartOverlay) {
        cartOverlay = document.createElement('div');
        cartOverlay.className = 'cart-overlay';
        document.body.appendChild(cartOverlay);
    }

    if (headerShopCart && cartToggle) {
        const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
        
        const closeMiniCart = () => {
            headerShopCart.classList.remove('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', 'false');
            if (cartOverlay) {
                cartOverlay.classList.remove('active');
            }
            // Remover classe do body que previne scroll
            document.body.style.overflow = '';
        };

        const openMiniCart = () => {
            headerShopCart.classList.add('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', 'true');
            if (cartOverlay && isMobile) {
                cartOverlay.classList.add('active');
                // Prevenir scroll do body quando o carrinho estiver aberto no mobile
                document.body.style.overflow = 'hidden';
            }
        };

        cartToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const isOpen = headerShopCart.classList.contains('mini-cart-open');
            if (isOpen) {
                closeMiniCart();
            } else {
                openMiniCart();
            }
        });

        // Fechar ao clicar no overlay (mobile)
        if (cartOverlay) {
            cartOverlay.addEventListener('click', (event) => {
                if (event.target === cartOverlay) {
                    closeMiniCart();
                }
            });
        }

        // Fechar ao clicar fora (desktop)
        document.addEventListener('click', (event) => {
            if (!isMobile) {
                if (!headerShopCart.contains(event.target) && !cartOverlay.contains(event.target)) {
                    closeMiniCart();
                }
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMiniCart();
            }
        });

        // Fechar ao clicar nos botões de fechar
        headerShopCart.querySelectorAll('[data-close-mini-cart]').forEach((el) => {
            el.addEventListener('click', closeMiniCart);
        });

        // Atualizar quando a tela mudar de tamanho
        window.addEventListener('resize', () => {
            const newIsMobile = window.matchMedia('(max-width: 767.98px)').matches;
            if (!newIsMobile && cartOverlay) {
                cartOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Inicializar recalc ao carregar para garantir que os valores estão corretos
    recalc();

    // Função global para adicionar produto de teste (para uso via console)
    window.addTestProduct = function() {
        if (cart) {
            cart.addItem('natucart-test', 1);
            console.log('✅ Produto de teste (R$ 0,05) adicionado ao carrinho!');
            console.log('💡 Este produto não requer cálculo de frete.');
            return true;
        } else {
            console.error('❌ Carrinho não está disponível.');
            return false;
        }
    };

    window.NatucartProducts = PRODUCTS;
    window.NatucartCart = cart;
})(window, document);

