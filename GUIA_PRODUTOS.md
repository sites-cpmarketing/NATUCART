# 📦 Guia Completo: Peso, Dimensões e Insurance dos Produtos

## 🎯 Como Funciona o Sistema

### 1. **Peso e Dimensões (Físicas)**

Os valores de **peso** e **dimensões** são aplicados **igualmente a todos os produtos** no carrinho. Eles são usados para:

- ✅ Calcular o frete corretamente (peso real vs peso cúbico)
- ✅ Determinar o tamanho da embalagem necessária
- ✅ Calcular custos de envio baseados em dimensões

**Onde são usados:**
- **Cálculo de frete** (quando o cliente digita o CEP)
- **Criação de envio** (quando o pedido é finalizado)

---

### 2. **Insurance Value (Valor do Seguro)**

O **insurance_value** é o valor segurado do produto/pedido. Ele é calculado automaticamente:

#### No Cálculo de Frete (Frontend):
```javascript
insurance_value: item.price  // Valor unitário de cada produto
```
- Cada produto individual tem seu próprio seguro = preço unitário
- Se o produto custa R$ 50,00, o seguro é R$ 50,00

#### Na Criação de Envio (Backend):
```php
'insurance_value' => floatval($orderData['totals']['total'] ?? 0)
```
- O seguro é o **valor total do pedido** (produtos + frete)
- Se o pedido total é R$ 150,00, o seguro é R$ 150,00

**Por que isso importa?**
- O seguro protege o valor do produto em caso de perda ou dano
- O Melhor Envio usa esse valor para calcular taxas de seguro (se aplicável)
- Valores maiores podem ter taxas de seguro maiores

---

### 3. **Quantidade (Quantity)**

A quantidade funciona de forma diferente em cada etapa:

#### No Cálculo de Frete:
```javascript
// Se quantity = 3, cria 3 produtos separados
for (let i = 0; i < item.quantity; i++) {
    products.push({
        weight: 1.18,  // Cada unidade tem 1.18kg
        quantity: 1    // Cada produto é quantidade 1
    });
}
```
- **3 unidades** = 3 produtos separados de 1.18kg cada = **3.54kg total**

#### Na Criação de Envio:
```php
'quantity' => intval($item['quantity'] ?? 1)
```
- Mantém a quantidade original do item
- O Melhor Envio calcula o peso total automaticamente

---

## 📝 Como Editar as Dimensões

### Passo 1: Edite o arquivo JavaScript (Frontend)

Abra: `assets/js/config/product-config.js`

```javascript
const ProductConfig = {
    weight: 1.18,    // ← Altere aqui (em kg)
    width: 33,       // ← Altere aqui (em cm)
    height: 2,       // ← Altere aqui (em cm)
    length: 47       // ← Altere aqui (em cm)
};
```

### Passo 2: Edite o arquivo PHP (Backend)

Abra: `inc/product_config.php`

```php
const PRODUCT_WEIGHT_KG = 1.18;    // ← Altere aqui (em kg)
const PRODUCT_WIDTH_CM = 33;       // ← Altere aqui (em cm)
const PRODUCT_HEIGHT_CM = 2;       // ← Altere aqui (em cm)
const PRODUCT_LENGTH_CM = 47;       // ← Altere aqui (em cm)
```

⚠️ **IMPORTANTE**: Mantenha os mesmos valores nos dois arquivos!

---

## 📐 Exemplo Prático

### Produto: Suplemento em Frasco

**Medidas reais:**
- Peso: 200g (0.2 kg)
- Largura: 8 cm
- Altura: 15 cm
- Comprimento: 8 cm

**Configuração:**
```javascript
// assets/js/config/product-config.js
const ProductConfig = {
    weight: 0.2,   // 200g = 0.2kg
    width: 8,      // 8 cm
    height: 15,    // 15 cm
    length: 8      // 8 cm
};
```

```php
// inc/product_config.php
const PRODUCT_WEIGHT_KG = 0.2;
const PRODUCT_WIDTH_CM = 8;
const PRODUCT_HEIGHT_CM = 15;
const PRODUCT_LENGTH_CM = 8;
```

---

## 🔍 Onde Cada Campo é Usado

### 1. **weight (Peso)**
- ✅ Cálculo de frete por peso
- ✅ Cálculo de peso cúbico (junto com dimensões)
- ✅ Determina qual transportadora pode transportar

### 2. **width, height, length (Dimensões)**
- ✅ Cálculo de peso cúbico: `(largura × altura × comprimento) / fator`
- ✅ Determina o tamanho da embalagem
- ✅ Algumas transportadoras têm limites de dimensões

### 3. **insurance_value (Seguro)**
- ✅ Proteção do valor do produto
- ✅ Pode afetar o custo do frete (algumas transportadoras cobram taxa de seguro)
- ✅ Usado em caso de sinistro (perda/dano)

### 4. **quantity (Quantidade)**
- ✅ Multiplica o peso total: `peso × quantidade`
- ✅ Pode afetar o número de volumes
- ✅ Alguns serviços têm limites de quantidade

---

## ⚠️ Observações Importantes

1. **Peso Cúbico**: O Melhor Envio calcula o "peso cúbico" usando as dimensões. Se o peso cúbico for maior que o peso real, ele usa o peso cúbico para calcular o frete.

2. **Valores Mínimos**: 
   - Peso mínimo: geralmente 0.1 kg
   - Dimensões mínimas: geralmente 1 cm cada

3. **Valores Máximos**: Dependem da transportadora:
   - PAC: até 30 kg, dimensões limitadas
   - SEDEX: até 30 kg, dimensões limitadas
   - Outros serviços podem ter limites diferentes

4. **Insurance Automático**: O valor do seguro é calculado automaticamente baseado no preço do produto. Você não precisa editar isso manualmente.

---

## 🛠️ Se Você Tiver Produtos com Dimensões Diferentes

Atualmente, o sistema aplica as mesmas dimensões para todos os produtos. Se você precisar de dimensões diferentes por produto, você precisará:

1. Adicionar campos de peso/dimensões no carrinho (no objeto do produto)
2. Modificar `assets/js/shipping/melhorenvio.js` para usar `item.weight`, `item.width`, etc.
3. Modificar `inc/melhorenvio_shipment.php` para usar os valores do produto

Mas para a maioria dos casos, usar dimensões padrão para todos os produtos funciona perfeitamente!

---

## 📞 Dúvidas?

Se tiver dúvidas sobre qual valor usar, meça fisicamente um produto embalado e use essas medidas. O importante é ser preciso, pois dimensões erradas podem resultar em:
- ❌ Fretes calculados incorretamente
- ❌ Problemas na criação do envio
- ❌ Custos adicionais inesperados

