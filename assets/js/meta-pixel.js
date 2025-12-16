/**
 * Meta Pixel Helper - Centraliza todos os eventos do Meta Pixel
 * Documentação: https://www.facebook.com/business/help/402791146561655
 */

(function(window) {
    'use strict';

    const META_PIXEL_ID = '1580911486383167';

    /**
     * Verifica se o Meta Pixel está carregado
     */
    const isPixelLoaded = () => {
        return typeof window.fbq !== 'undefined';
    };

    /**
     * Rastreia evento ViewContent (visualização de produto/página)
     * @param {Object} params - Parâmetros do evento
     */
    const trackViewContent = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento ViewContent não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Natucart',
            content_category: params.content_category || 'Suplemento',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product',
            value: params.value || 0,
            currency: params.currency || 'BRL'
        };

        window.fbq('track', 'ViewContent', eventParams);
        console.log('[Meta Pixel] ViewContent rastreado:', eventParams);
    };

    /**
     * Rastreia evento AddToCart (adicionar ao carrinho)
     * @param {Object} params - Parâmetros do evento
     */
    const trackAddToCart = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento AddToCart não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Produto',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product',
            value: params.value || 0,
            currency: params.currency || 'BRL',
            num_items: params.num_items || 1
        };

        window.fbq('track', 'AddToCart', eventParams);
        console.log('[Meta Pixel] AddToCart rastreado:', eventParams);
    };

    /**
     * Rastreia evento InitiateCheckout (iniciar checkout)
     * @param {Object} params - Parâmetros do evento
     */
    const trackInitiateCheckout = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento InitiateCheckout não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Checkout',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product',
            value: params.value || 0,
            currency: params.currency || 'BRL',
            num_items: params.num_items || 0
        };

        window.fbq('track', 'InitiateCheckout', eventParams);
        console.log('[Meta Pixel] InitiateCheckout rastreado:', eventParams);
    };

    /**
     * Rastreia evento AddPaymentInfo (adicionar informação de pagamento)
     * @param {Object} params - Parâmetros do evento
     */
    const trackAddPaymentInfo = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento AddPaymentInfo não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Pagamento',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product',
            value: params.value || 0,
            currency: params.currency || 'BRL',
            num_items: params.num_items || 0
        };

        window.fbq('track', 'AddPaymentInfo', eventParams);
        console.log('[Meta Pixel] AddPaymentInfo rastreado:', eventParams);
    };

    /**
     * Rastreia evento Purchase (compra concluída)
     * @param {Object} params - Parâmetros do evento
     */
    const trackPurchase = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento Purchase não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Compra',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product',
            value: params.value || 0,
            currency: params.currency || 'BRL',
            num_items: params.num_items || 0,
            order_id: params.order_id || null
        };

        window.fbq('track', 'Purchase', eventParams);
        console.log('[Meta Pixel] Purchase rastreado:', eventParams);
    };

    /**
     * Rastreia evento Search (busca)
     * @param {Object} params - Parâmetros do evento
     */
    const trackSearch = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento Search não enviado.');
            return;
        }

        const eventParams = {
            search_string: params.search_string || '',
            content_ids: params.content_ids || [],
            content_type: params.content_type || 'product'
        };

        window.fbq('track', 'Search', eventParams);
        console.log('[Meta Pixel] Search rastreado:', eventParams);
    };

    /**
     * Rastreia evento Contact (contato)
     * @param {Object} params - Parâmetros do evento
     */
    const trackContact = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento Contact não enviado.');
            return;
        }

        window.fbq('track', 'Contact', params);
        console.log('[Meta Pixel] Contact rastreado:', params);
    };

    /**
     * Rastreia evento Lead (lead/conversão)
     * @param {Object} params - Parâmetros do evento
     */
    const trackLead = (params = {}) => {
        if (!isPixelLoaded()) {
            console.warn('[Meta Pixel] Pixel não carregado. Evento Lead não enviado.');
            return;
        }

        const eventParams = {
            content_name: params.content_name || 'Lead',
            value: params.value || 0,
            currency: params.currency || 'BRL'
        };

        window.fbq('track', 'Lead', eventParams);
        console.log('[Meta Pixel] Lead rastreado:', eventParams);
    };

    // Exportar funções globalmente
    window.MetaPixel = {
        trackViewContent,
        trackAddToCart,
        trackInitiateCheckout,
        trackAddPaymentInfo,
        trackPurchase,
        trackSearch,
        trackContact,
        trackLead,
        isPixelLoaded
    };

})(window);

