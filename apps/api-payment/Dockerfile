FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/api-payment/ apps/api-payment/

RUN --mount=type=secret,id=npm_token \
  set -e && \
  echo "@mutual-processadora-de-pagamentos:registry=https://npm.pkg.github.com/" > /root/.npmrc && \
  echo "@Mutual-Processadora-de-Pagamentos:registry=https://npm.pkg.github.com/" >> /root/.npmrc && \
  echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" >> /root/.npmrc && \
  echo "always-auth=true" >> /root/.npmrc && \
  pnpm fetch && \
  pnpm install --frozen-lockfile

RUN pnpm --filter "@ledger/api-payment..." build

RUN pnpm --filter @ledger/api-payment deploy --legacy --prod /app/deploy

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api-payment/dist ./dist
COPY --from=builder /app/packages/db/migrations ./migrations
ENV NODE_ENV=production
ENV DB_MIGRATIONS_DIR=/app/migrations
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
