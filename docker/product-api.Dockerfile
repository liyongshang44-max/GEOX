FROM node:20 AS build
WORKDIR /app
ENV CI=1
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY config ./config
COPY scripts ./scripts
COPY sql ./sql
COPY docker ./docker
COPY docs ./docs
COPY doc ./doc
COPY manifests ./manifests

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @geox/server build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY --from=build /app /app

CMD ["node", "apps/server/dist/apps/server/src/product_api_public_server_v1.js"]
