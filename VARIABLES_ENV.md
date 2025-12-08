# Variáveis de Ambiente - NATUCART

Este documento lista todas as variáveis de ambiente necessárias para o funcionamento do NATUCART.

## Variáveis do Mercado Pago

### MP_ACCESS_TOKEN
- **Descrição**: Access Token do Mercado Pago para autenticação na API
- **Onde usar**: `inc/mercadopago_preference.php`, `inc/mercadopago_notification_simple.php`, `inc/mercadopago_checkout.php`
- **Valor de Produção**: `APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520`
- **Valor de Teste**: `TEST-174327649585109-112508-b5556707665f235f4eb8c89fe2ac9346-3000462520`
- **Como configurar no Easypanel**:
  ```
  MP_ACCESS_TOKEN=APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520
  ```

### MP_WEBHOOK_SECRET
- **Descrição**: Assinatura secreta para validar webhooks do Mercado Pago
- **Onde usar**: `inc/mercadopago_notification_simple.php`
- **Valor**: `1df6f2d0ad3243e5e0fa44003aa59f95ec1d67ec4fe082d0ede68a97450ea782`
- **Como configurar no Easypanel**:
  ```
  MP_WEBHOOK_SECRET=1df6f2d0ad3243e5e0fa44003aa59f95ec1d67ec4fe082d0ede68a97450ea782
  ```

## Variáveis do Melhor Envio

### ME_CLIENT_ID
- **Descrição**: Client ID do aplicativo Melhor Envio
- **Onde usar**: `inc/melhorenvio_shipment.php`, `checkout.html` (JavaScript)
- **Valor**: `21160`
- **Como configurar no Easypanel**:
  ```
  ME_CLIENT_ID=21160
  ```

### ME_CLIENT_SECRET
- **Descrição**: Client Secret do aplicativo Melhor Envio
- **Onde usar**: `inc/melhorenvio_shipment.php`, `checkout.html` (JavaScript)
- **Valor**: `466oHb5sHMqmvhc8Etbc70gTWGD75IVeQy3jiF1i`
- **Como configurar no Easypanel**:
  ```
  ME_CLIENT_SECRET=466oHb5sHMqmvhc8Etbc70gTWGD75IVeQy3jiF1i
  ```

## Variáveis do n8n (Webhooks)

### N8N_MELHORENVIO_WEBHOOK_URL
- **Descrição**: URL do webhook n8n para integração com Melhor Envio
- **Onde usar**: `checkout.html` (JavaScript)
- **Valor**: `https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-natucart`
- **Como configurar no Easypanel**:
  ```
  N8N_MELHORENVIO_WEBHOOK_URL=https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-natucart
  ```

### N8N_MELHORENVIO_FINAL_WEBHOOK_URL
- **Descrição**: URL do webhook n8n para finalização do frete
- **Onde usar**: `checkout.html` (JavaScript)
- **Valor**: `https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-final-natucart`
- **Como configurar no Easypanel**:
  ```
  N8N_MELHORENVIO_FINAL_WEBHOOK_URL=https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-final-natucart
  ```

## Variáveis de URLs do Backend

### MP_PREFERENCE_ENDPOINT
- **Descrição**: Endpoint para criar preferência de pagamento
- **Onde usar**: `checkout.html` (JavaScript)
- **Valor**: `https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_preference.php`
- **Como configurar no Easypanel**:
  ```
  MP_PREFERENCE_ENDPOINT=https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_preference.php
  ```

### MP_NOTIFICATION_ENDPOINT
- **Descrição**: Endpoint para receber notificações do Mercado Pago
- **Onde usar**: `checkout.html` (JavaScript)
- **Valor**: `https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_notification_simple.php`
- **Como configurar no Easypanel**:
  ```
  MP_NOTIFICATION_ENDPOINT=https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_notification_simple.php
  ```

### BASE_URL
- **Descrição**: URL base do site
- **Onde usar**: `checkout.html` (JavaScript)
- **Valor**: `https://natucart.com.br`
- **Como configurar no Easypanel**:
  ```
  BASE_URL=https://natucart.com.br
  ```

## Como Configurar no Easypanel

1. Acesse o painel do Easypanel
2. Vá até as configurações do serviço NATUCART
3. Procure pela seção "Environment Variables" ou "Variáveis de Ambiente"
4. Adicione cada variável acima com seus respectivos valores
5. Salve as alterações
6. Reinicie o serviço se necessário

## Arquivo .env (para referência local)

Se estiver desenvolvendo localmente, crie um arquivo `.env` na raiz do projeto:

```env
# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-4377085117917669-112408-2af68f55fefdd24495c2288210b3dd37-3000462520
MP_WEBHOOK_SECRET=1df6f2d0ad3243e5e0fa44003aa59f95ec1d67ec4fe082d0ede68a97450ea782

# Melhor Envio
ME_CLIENT_ID=21160
ME_CLIENT_SECRET=466oHb5sHMqmvhc8Etbc70gTWGD75IVeQy3jiF1i

# n8n Webhooks
N8N_MELHORENVIO_WEBHOOK_URL=https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-natucart
N8N_MELHORENVIO_FINAL_WEBHOOK_URL=https://n8n-auto.cpmarketingbr.com/webhook/melhorenvio-final-natucart

# URLs do Backend
MP_PREFERENCE_ENDPOINT=https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_preference.php
MP_NOTIFICATION_ENDPOINT=https://clientes-natucart-back.8szsdx.easypanel.host/inc/mercadopago_notification_simple.php
BASE_URL=https://natucart.com.br
```

## Notas Importantes

⚠️ **SEGURANÇA**: 
- Nunca commite o arquivo `.env` no repositório Git
- As credenciais acima são de PRODUÇÃO - mantenha-as seguras
- Use variáveis de ambiente no servidor, nunca hardcode no código

📝 **OBSERVAÇÕES**:
- Os arquivos PHP já têm valores fallback caso as variáveis de ambiente não estejam configuradas
- O JavaScript no `checkout.html` usa valores hardcoded como fallback
- Para produção, sempre use variáveis de ambiente

