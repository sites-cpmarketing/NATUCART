# 🧪 Produto de Teste - Guia de Uso

## 📋 Informações do Produto

- **ID**: `natucart-test`
- **Nome**: Natucart - Teste (R$ 0,05)
- **SKU**: `TEST-005`
- **Preço**: R$ 0,05
- **Características especiais**:
  - ✅ Não requer cálculo de frete
  - ✅ Não requer endereço completo
  - ✅ Ideal para testar fluxo de pagamento completo

---

## 🚀 Como Adicionar o Produto de Teste

### Método 1: Via Console do Navegador (Recomendado)

1. Abra o site no navegador
2. Abra o Console do Desenvolvedor:
   - **Chrome/Edge**: `F12` ou `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: `F12` ou `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
3. Digite o seguinte comando e pressione Enter:

```javascript
addTestProduct()
```

4. O produto será adicionado ao carrinho automaticamente!

### Método 2: Via URL (Adicionar diretamente)

Você pode adicionar o produto diretamente via JavaScript no console:

```javascript
// Verificar se o carrinho está disponível
if (window.NatucartCart) {
    window.NatucartCart.addItem('natucart-test', 1);
    console.log('Produto de teste adicionado!');
} else {
    console.error('Carrinho não está disponível. Aguarde o carregamento da página.');
}
```

---

## ✅ Fluxo de Teste Completo

### Passo a Passo:

1. **Adicionar produto de teste**
   ```javascript
   addTestProduct()
   ```

2. **Ir para o checkout**
   - Clique no ícone do carrinho
   - Clique em "Finalizar Compra"

3. **Preencher dados do cliente**
   - Nome completo
   - E-mail válido
   - Telefone
   - CPF válido

4. **Frete não é necessário!**
   - ⚠️ **IMPORTANTE**: O produto de teste não requer cálculo de frete
   - Você pode pular a etapa de endereço/frete
   - Clique diretamente em "Finalizar Compra"

5. **Finalizar pagamento**
   - O sistema criará um link de pagamento no Mercado Pago
   - Você será redirecionado para o pagamento
   - Use PIX para teste rápido (R$ 0,05)

6. **Aguardar confirmação**
   - Após pagar, aguarde a confirmação do Mercado Pago
   - Você será redirecionado para a página de obrigado

---

## 🔍 Verificações Úteis

### Verificar se o produto está no carrinho:

```javascript
const cart = window.NatucartCart;
if (cart) {
    const snapshot = cart.getSnapshot();
    console.log('Itens no carrinho:', snapshot.items);
    console.log('Total:', snapshot.total);
}
```

### Limpar o carrinho:

```javascript
const cart = window.NatucartCart;
if (cart) {
    cart.clear();
    console.log('Carrinho limpo!');
}
```

### Verificar se é produto de teste:

```javascript
const cart = window.NatucartCart;
if (cart) {
    const snapshot = cart.getSnapshot();
    const isTestProduct = snapshot.items.some(item => item.id === 'natucart-test');
    console.log('É produto de teste?', isTestProduct);
}
```

---

## ⚠️ Observações Importantes

1. **Produto oculto**: O produto de teste não aparece na interface do site
2. **Apenas para testes**: Use apenas para validar fluxos de pagamento
3. **Sem frete**: Não será necessário calcular frete para este produto
4. **Valor mínimo**: R$ 0,05 é o valor mínimo aceito pelo Mercado Pago

---

## 🐛 Troubleshooting

### O produto não foi adicionado:

1. Verifique se o console não mostra erros
2. Aguarde o carregamento completo da página
3. Tente novamente após alguns segundos

### Erro: "Carrinho não está disponível"

- Aguarde o carregamento completo da página
- Recarregue a página (F5)
- Verifique se o arquivo `cart.js` foi carregado corretamente

### O checkout ainda pede frete:

- Verifique se o produto adicionado é realmente `natucart-test`
- Limpe o carrinho e adicione novamente
- Verifique se há outros produtos no carrinho (eles podem exigir frete)

---

## 📝 Exemplo Completo de Teste

```javascript
// 1. Adicionar produto de teste
addTestProduct();

// 2. Verificar carrinho
const cart = window.NatucartCart;
const snapshot = cart.getSnapshot();
console.log('Total no carrinho:', snapshot.total); // Deve mostrar R$ 0,05

// 3. Ir para checkout manualmente (ou clicar no botão)
window.location.href = 'checkout.html';
```

---

**Última atualização**: Dezembro 2025

