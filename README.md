# Payments

API de processamento de pedidos e pagamentos construída como monorepo com DDD e padrão Saga distribuída gerenciada via banco de dados.

## Estrutura

```
payments/
├── apps/
│   ├── api-payment/        # API REST (Express) — recebe pedidos e inicia a saga
│   ├── worker-stock/       # Microserviço — reserva de estoque (step 1)
│   └── worker-payment/     # Microserviço — processamento de pagamento (step 2)
└── packages/
    ├── db/                 # Schema Drizzle + migrations
    └── shared/             # Domínio, interfaces e tipos compartilhados
```

## Stack

- **Runtime:** Node.js 22 + TypeScript
- **Framework:** Express 5
- **ORM:** Drizzle ORM + libsql (SQLite/Turso)
- **Filas:** BullMQ + Redis
- **Validação:** Zod
- **Observabilidade:** OpenTelemetry + Winston
- **Monorepo:** pnpm workspaces + Turborepo

## Arquitetura

O projeto segue **Domain-Driven Design** com repositórios tipados e use cases isolados.

O fluxo de criação de pedido usa o padrão **Saga distribuída com estado persistido no banco**. O `POST /orders` retorna `202` imediatamente com `orderId` e `sagaId`; o processamento acontece em background em dois workers independentes. Cada etapa da saga é registrada na tabela `saga_executions`, tornando o estado durável, observável e recuperável.

```
POST /orders
    │
    ├── cria Order (status: "pending")
    ├── cria saga_executions (step: "reserve_stock", status: "pending")
    └── enfileira → [stock-reserve queue]
                          │
                    worker-stock
                    ├── saga → "running"
                    ├── valida estoque (cache → DB)
                    ├── decrementa estoque com optimistic lock (version)
                    ├── saga → step: "process_payment", status: "completed"
                    └── enfileira → [payment-process queue]
                                          │
                                    worker-payment
                                    ├── saga → "running"
                                    ├── simula gateway (50/50)
                                    ├── aprovado → Payment(paid) + Order(paid)
                                    │             saga → "completed"
                                    └── recusado → Payment(failed)
                                                   + restaura estoque
                                                   + Order(cancelled)
                                                   saga → "compensated"
```

### Estados da saga (`saga_executions.status`)

| Status | Significado |
|--------|-------------|
| `pending` | Saga criada, aguardando worker-stock |
| `running` | Worker processando o step atual |
| `completed` | Saga concluída com sucesso (pagamento aprovado) |
| `failed` | Erro técnico (retries esgotados) — campo `error` indica a causa |
| `compensated` | Pagamento recusado — compensação executada (estoque devolvido, pedido cancelado) |

**Compensação automática:**
- Estoque insuficiente → saga `failed` + pedido `cancelled`
- Pagamento recusado → saga `compensated` + estoque devolvido + pedido `cancelled`
- Falha técnica → BullMQ faz até 3 tentativas com backoff exponencial; ao esgotar, saga fica `failed`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/products` | Criar produto |
| `GET` | `/products` | Listar produtos (paginado) |
| `POST` | `/orders` | Criar pedido e iniciar saga (assíncrono) |
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

// Response 202 — pedido aceito, saga iniciada
{
  "orderId": "ord_...",
  "sagaId": "saga_...",
  "status": "pending"
}

// Acompanhe via GET /orders/:orderId/status
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
- Redis (para BullMQ)

### Instalação

```bash
pnpm install
```

### Banco de dados

```bash
# Aplicar migrations (inclui a tabela saga_executions)
pnpm --filter @casecellshop/db db:migrate

# Ou via script do app
pnpm --filter @casecellshop/api-payment db:migrate
```

### Desenvolvimento

```bash
# API
pnpm --filter @casecellshop/api-payment dev

# Workers (em terminais separados)
pnpm --filter @casecellshop/worker-stock dev
pnpm --filter @casecellshop/worker-payment dev

# Ou tudo junto com Turborepo
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
| `REDIS_URL` | `redis://127.0.0.1:6379` | URL do Redis para filas BullMQ |
| `LOG_LEVEL` | `info` | Nível de log |

> **Nota:** `DATABASE_URL` aceita caminhos relativos (resolvidos a partir da raiz do repo) ou URLs Turso (`libsql://...`). Todos os apps (API + workers) devem apontar para o mesmo banco.

## Observabilidade

### Métricas — `GET /metrics`

O endpoint `/metrics` expõe métricas no formato Prometheus, compatível com Datadog Agent e OpenTelemetry Collector.

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `checkout_total` | Counter | `status={paid,failed,error}` | Total de checkouts processados |
| `checkout_duration_ms` | Histogram | — | Duração do fluxo completo de checkout |
| `cache_hits_total` | Counter | `entity={product}` | Cache hits no lookup de produtos |
| `cache_misses_total` | Counter | `entity={product}` | Cache misses — requisições ao banco |
| `worker_orders_processed_total` | Counter | `result={approved,rejected}` | Resultados do worker de pagamento |

### Traces — OpenTelemetry

Quando `OTEL_ENDPOINT` está configurado, cada request gera uma árvore de spans:

```
checkout                              ← span raiz (request HTTP)
├── cache.product.findByIds           ← verifica cache em memória
│   └── repository.product.findByIds  ← só se cache miss
├── repository.product.updateStock    ← por produto reservado
├── repository.order.create           ← persiste o pedido
└── worker.payment.process            ← simula gateway de pagamento
    └── repository.order.updateStatus ← atualiza status se aprovado
```

### Dashboard Datadog

```yaml
# widgets sugeridos para um dashboard "Payments API"

- title: "Taxa de checkout aprovado"
  query: "sum:checkout_total{status:paid}.as_rate() / sum:checkout_total{*}.as_rate() * 100"
  viz: query_value
  format: percentage

- title: "Throughput de checkouts (req/min)"
  query: "sum:checkout_total{*}.as_rate()"
  viz: timeseries

- title: "Duração mediana do checkout"
  query: "p50:checkout_duration_ms{*}"
  viz: timeseries

- title: "Cache hit rate de produtos"
  query: "sum:cache_hits_total{entity:product}.as_rate() / (sum:cache_hits_total{entity:product}.as_rate() + sum:cache_misses_total{entity:product}.as_rate()) * 100"
  viz: query_value
  format: percentage

- title: "Pagamentos aprovados vs recusados"
  query: "sum:worker_orders_processed_total{*} by {result}.as_rate()"
  viz: timeseries
```

### Alertas sugeridos

```yaml
# Alerta 1: taxa de falha de checkout > 60%
name: "High checkout failure rate"
query: "sum:checkout_total{status:failed}.as_rate() / sum:checkout_total{*}.as_rate() * 100 > 60"
message: |
  Taxa de pagamentos recusados acima de 60% nos últimos 5 minutos.
  Verificar gateway de pagamento e logs do worker-payment.
thresholds:
  critical: 60
  warning: 40

# Alerta 2: latência p95 do checkout > 2s
name: "Checkout latency degraded"
query: "p95:checkout_duration_ms{*} > 2000"
message: |
  Latência p95 do checkout acima de 2s.
  Verificar spans de `repository.product.findByIds` e `repository.order.create`.

# Alerta 3: cache hit rate < 50%
name: "Product cache hit rate low"
query: "sum:cache_hits_total{entity:product}.as_rate() / (sum:cache_hits_total{entity:product}.as_rate() + sum:cache_misses_total{entity:product}.as_rate()) * 100 < 50"
message: |
  Cache de produtos com hit rate abaixo de 50%.
  Considere aumentar o TTL (padrão: 60s em worker-stock).
```

### Runbook — Checkout com alta taxa de falha

**Sintoma:** alerta `High checkout failure rate` disparado.

1. **Verificar logs recentes**
   ```bash
   grep "worker.payment" logs/app.log | grep '"level":"error"' | tail -20
   ```

2. **Inspecionar estado das sagas no banco**
   ```sql
   -- sagas com falha nas últimas 24h
   SELECT id, order_id, current_step, status, error, updated_at
   FROM saga_executions
   WHERE status IN ('failed', 'compensated')
   ORDER BY updated_at DESC
   LIMIT 20;
   ```

3. **Checar métricas de cache** — hit rate baixo força mais consultas ao banco:
   ```
   GET /metrics | grep cache_
   ```

4. **Verificar estoque** — checkout pode estar falhando por estoque insuficiente:
   ```
   GET /products?limit=50
   ```

5. **Inspecionar spans no Datadog APM** — buscar traces com `worker.payment.process` onde `payment.approved=false`.

## Comandos úteis

```bash
# Build completo
pnpm build

# Verificação de tipos
pnpm check-types

# Gerar nova migration após alterar o schema
pnpm --filter @casecellshop/db db:generate

# Drizzle Studio (visualizar banco, incluindo saga_executions)
pnpm --filter @casecellshop/db db:studio
```
