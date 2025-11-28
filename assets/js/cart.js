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
            const productId = trigger.getAttribute('data-add-to-cart');
            cart.addItem(productId);
            runAddToCartFeedback(trigger);
        });
    });

    const headerShopCart = document.querySelector('.header-shop-cart');
    const cartToggle = document.querySelector('[data-toggle-mini-cart]');

    if (headerShopCart && cartToggle) {
        const closeMiniCart = () => {
            headerShopCart.classList.remove('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', 'false');
        };

        const openMiniCart = () => {
            headerShopCart.classList.add('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', 'true');
        };

        cartToggle.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = headerShopCart.classList.toggle('mini-cart-open');
            cartToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', (event) => {
            if (!headerShopCart.contains(event.target)) {
                closeMiniCart();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMiniCart();
            }
        });

        headerShopCart.querySelectorAll('[data-close-mini-cart]').forEach((el) => {
            el.addEventListener('click', closeMiniCart);
        });
    }

    // Inicializar recalc ao carregar para garantir que os valores estão corretos
    recalc();

    window.NatucartProducts = PRODUCTS;
    window.NatucartCart = cart;
})(window, document);

