# NATUCART - Landing Page de Produtos Naturais

## Status da Implementação

✅ **index.html** - Criado e personalizado para NATUCART
⏳ **assets/** - Precisa ser copiado
⏳ **inc/** - Precisa ser copiado

## Como Copiar as Pastas Necessárias

### Opção 1: Usando o Script Python (Recomendado)

1. Abra o terminal/Prompt de Comando na pasta NATUCART
2. Execute o comando:
   ```
   python copy_files_simple.py
   ```

### Opção 2: Copiar Manualmente

1. Navegue até a pasta: `envato_3MXB9FG\suxnix\`
2. Copie a pasta `assets` completa para a raiz da pasta NATUCART
3. Copie a pasta `inc` completa para a raiz da pasta NATUCART

### Opção 3: Usando o Explorador do Windows

1. Abra o Explorador do Windows
2. Navegue até: `C:\Users\CP MARKETING\Downloads\LP's\NATUCART\envato_3MXB9FG\suxnix\`
3. Selecione as pastas `assets` e `inc`
4. Copie (Ctrl+C)
5. Navegue até: `C:\Users\CP MARKETING\Downloads\LP's\NATUCART\`
6. Cole (Ctrl+V)

## Estrutura de Arquivos Após a Cópia

```
NATUCART/
├── index.html          ✅ Criado e personalizado
├── assets/             ⏳ Copiar de envato_3MXB9FG/suxnix/assets/
│   ├── css/
│   ├── js/
│   ├── fonts/
│   └── img/
├── inc/                ⏳ Copiar de envato_3MXB9FG/suxnix/inc/
│   └── contact.php
└── envato_3MXB9FG/     (pasta original do template)
```

## Personalizações Realizadas

### ✅ Concluído:
- Título da página: "NATUCART - Produtos Naturais"
- Meta description atualizada
- Idioma alterado para pt-BR
- Header personalizado com menu em português
- Banner adaptado para produtos naturais
- Seções de características personalizadas
- Produtos adaptados para produtos naturais
- Preços convertidos para R$ (Reais)
- Footer atualizado com informações de contato
- Depoimentos adaptados
- FAQ traduzido e adaptado
- Textos gerais traduzidos para português

### ⏳ Pendente:
- Copiar pastas assets/ e inc/
- Verificar caminhos relativos
- Testar funcionalidades (menu, sliders, formulários)
- Substituir logos (se necessário)

## Próximos Passos

1. Copiar as pastas `assets/` e `inc/` para a raiz
2. Abrir o `index.html` no navegador para verificar se está funcionando
3. Verificar se todas as imagens e recursos estão carregando corretamente
4. Testar o menu responsivo
5. Testar formulário de contato (se aplicável)
6. Substituir logos nas pastas `assets/img/logo/` se necessário

## Integrações planejadas (checkout e frete)

### Carrinho unificado
- Estado centralizado em `assets/js/cart.js` via `window.NatucartCart`.
- Escute o evento `natucart:cart:update` ou use `NatucartCart.subscribe` para reagir a alterações.
- Botões com `data-add-to-cart` já acionam o carrinho e atualizam o mini-cart.

### AbacatePay (pagamentos)
- Serviço em `assets/js/payments/abacatepay.js` chamando `POST /billing/create`.
- Configure credenciais reais com `AbacatePayService.configure({ apiKey, baseUrl, methods })`.
- A resposta retorna a URL do checkout seguro; o `checkout.js` redireciona o usuário automaticamente.

### Melhor Envio (frete)
- Serviço em `assets/js/shipping/melhorenvio.js` ligado ao formulário `data-freight-form`.
- Configure com `MelhorEnvioService.configure({ clientId, clientSecret, sellerPostalCode, n8nWebhookUrl })`.
- Usa webhook n8n como proxy para evitar problemas de CORS.
- Configurações de produto (peso e dimensões) centralizadas em `assets/js/config/product-config.js`.

### Orquestração do checkout
- `assets/js/checkout.js` conecta carrinho, Melhor Envio e AbacatePay.
- Resumo e botão `data-checkout-submit` ficam na seção "Calcule o Frete".
- O fluxo atual: itens no carrinho → CEP (Melhor Envio) → sessão AbacatePay → simulação de pagamento.

## Contato

Para dúvidas ou suporte, entre em contato através do email: Natucart1@gmail.com

