# Payments

API de processamento de pedidos e pagamentos construída como monorepo com DDD e padrão Saga.

## Estrutura

```
payments/
├── apps/
│   └── api-payment/        # API REST (Express)
└── packages/
    ├── db/                 # Schema Drizzle + migrations
    └── shared/             # Domínio, interfaces e utilitários compartilhados
```

## Stack

- **Runtime:** Node.js 22 + TypeScript
- **Framework:** Express 5
- **ORM:** Drizzle ORM + libsql (SQLite/Turso)
- **Validação:** Zod
- **Observabilidade:** OpenTelemetry + Winston
- **Monorepo:** pnpm workspaces + Turborepo

## Arquitetura

O projeto segue **Domain-Driven Design** com repositórios tipados e use cases isolados.

O fluxo de criação de pedido usa **Orchestration Saga** — cada etapa tem uma ação e uma compensação que é executada automaticamente em caso de falha:

```
ReserveStockStep      →  CreateOrderStep    →  ProcessPaymentStep
  action: -estoque       action: cria pedido    action: processa pagamento
  compensate: +estoque   compensate: cancela    compensate: reembolsa
```

Se o pagamento falhar, o estoque é devolvido e o pedido é cancelado automaticamente.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/products` | Criar produto |
| `GET` | `/products` | Listar produtos (paginado) |
| `POST` | `/orders` | Criar pedido e processar pagamento |
| `GET` | `/orders` | Listar pedidos (paginado) |
| `GET` | `/orders/:orderId/status` | Consultar status do pedido e pagamento |

### POST /orders

```json
// Request
{
  "items": [
    { "productId": "prd_...", "quantity": 2 }
  ]
}

// Response 201 — pagamento aprovado
{
  "orderId": "ord_...",
  "paymentId": "pay_...",
  "paymentStatus": "paid"
}

// Response 402 — pagamento recusado
{
  "orderId": "ord_...",
  "paymentId": "pay_...",
  "paymentStatus": "failed"
}
```

### GET /orders/:orderId/status

```json
{
  "orderId": "ord_...",
  "status": "paid",
  "total": 299.90,
  "items": [
    { "productId": "prd_...", "quantity": 2, "price": 149.95 }
  ],
  "payment": {
    "paymentId": "pay_...",
    "status": "paid",
    "type": "pix",
    "amount": 299.90
  }
}
```

## Início rápido

### Pré-requisitos

- Node.js 22+
- pnpm 9+

### Instalação

```bash
pnpm install
```

### Banco de dados

```bash
# Aplicar migrations
pnpm --filter @ledger/db db:migrate

# Ou via script do app
pnpm --filter @ledger/api-payment db:migrate
```

### Desenvolvimento

```bash
# Iniciar API em modo watch
pnpm --filter @ledger/api-payment dev

# Ou rodar tudo com Turborepo
pnpm dev
```

A API sobe em `http://localhost:3000` (padrão).

## Variáveis de ambiente

Crie um `.env` na raiz do projeto. Todas as variáveis têm valores padrão para desenvolvimento local.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta da API |
| `NODE_ENV` | `development` | Ambiente |
| `DATABASE_URL` | `file:local.db` | URL do banco (libsql) |
| `DATABASE_AUTH_TOKEN` | — | Token Turso (produção) |
| `CORS_ORIGIN` | `*` | Origem permitida pelo CORS |
| `OTEL_ENDPOINT` | — | Endpoint OpenTelemetry (opcional) |
| `LOG_LEVEL` | `info` | Nível de log |

> **Nota:** `DATABASE_URL` aceita caminhos relativos (resolvidos a partir da raiz do repo) ou URLs Turso (`libsql://...`).

## Comandos úteis

```bash
# Build completo
pnpm build

# Verificação de tipos
pnpm check-types

# Gerar nova migration após alterar o schema
pnpm --filter @ledger/db db:generate

# Drizzle Studio (visualizar banco)
pnpm --filter @ledger/db db:studio
```
