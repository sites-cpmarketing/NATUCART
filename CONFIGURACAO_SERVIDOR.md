# Configuração do Servidor PHP

## Problema: Erro 405 (Method Not Allowed)

Se você está recebendo erro 405 ao tentar finalizar a compra, significa que o servidor não está configurado para executar PHP ou não está aceitando requisições POST.

## Soluções

### Opção 1: Usar servidor PHP local

1. **XAMPP/WAMP/MAMP:**
   - Instale XAMPP, WAMP ou MAMP
   - Coloque o projeto na pasta `htdocs` (XAMPP) ou `www` (WAMP/MAMP)
   - Acesse via `http://localhost/NATUCART/checkout.html`

2. **PHP Built-in Server:**
   ```bash
   cd C:\Users\Gabriell\Downloads\NATUCART
   php -S localhost:8000
   ```
   - Acesse via `http://localhost:8000/checkout.html`

### Opção 2: Configurar Live Server (VS Code)

Se você está usando Live Server do VS Code, ele **não executa PHP**. Você precisa:

1. Instalar extensão "PHP Server" ou "PHP Debug"
2. Ou usar um servidor PHP separado

### Opção 3: Usar servidor de produção

Faça upload dos arquivos para um servidor que suporte PHP (ex: Hostinger, Locaweb, etc.)

## Verificar se PHP está funcionando

Crie um arquivo `test.php` na raiz do projeto:

```php
<?php
phpinfo();
?>
```

Acesse `http://localhost/test.php`. Se mostrar informações do PHP, está funcionando.

## Endpoint de Pagamento

O endpoint está em: `/inc/mercadopago_checkout.php`

Certifique-se de que:
- O arquivo existe
- O servidor executa PHP
- Permissões de leitura estão corretas
- O Access Token está configurado no arquivo PHP

## Access Token

Edite `inc/mercadopago_checkout.php` e configure:

```php
const MP_FALLBACK_ACCESS_TOKEN = 'SEU_ACCESS_TOKEN_AQUI';
```

Ou configure via variável de ambiente `MP_ACCESS_TOKEN`.

