FROM node:20 AS build
WORKDIR /app
ENV CI=1
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @geox/web build

FROM nginx:alpine
COPY docker/nginx/geox-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
