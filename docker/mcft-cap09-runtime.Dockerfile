FROM node:20-bookworm AS build
WORKDIR /app

ENV CI=1
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/geox-python \
    && /opt/geox-python/bin/python -m pip install --disable-pip-version-check --no-cache-dir \
      'eccodes==2.47.0' \
      'eccodeslib==2.47.3.23' \
      'numpy==1.26.4' \
      'refet==0.4.2' \
    && /opt/geox-python/bin/python -m eccodes selfcheck

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
RUN pnpm --filter @geox/contracts build \
    && pnpm --filter @geox/control-kernel build \
    && pnpm --filter @geox/device-skills build \
    && pnpm --filter @geox/skill-registry build \
    && pnpm --filter @geox/server build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PATH="/opt/geox-python/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/geox-python /opt/geox-python
COPY --from=build /app /app

RUN python -m eccodes selfcheck \
    && python apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py selftest \
    && python apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py selftest
