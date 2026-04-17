# GEOX Evidence Export S3 Smoke Runbook（Step2.1 尾项）

本文档用于 Commercial v1（S3_COMPAT）证据导出链路的最小可执行验收步骤。

## 1. 准备 `.env`

在仓库根目录复制模板：

```bash
cp .env.example .env
```

然后编辑 `.env`，至少确认如下变量可用：

- `GEOX_AO_ACT_TOKEN=<your-token>`
- （可选）`GEOX_BASE_URL`，默认通常为 `http://127.0.0.1:3001`

## 2. Token 来源

`GEOX_AO_ACT_TOKEN` 建议从以下来源取得：

1. `config/auth/ao_act_tokens_v0.json`（推荐，选择 `revoked=false` 且同时具备 `evidence_export.read` + `evidence_export.write` scope 的 token）。
2. `config/auth/example_tokens.json`（仅示例格式，若仍是占位值需先替换）。

> `apps/server/scripts/evidence_export_s3_smoke.mjs` 的 fallback 逻辑为：优先环境变量 `GEOX_AO_ACT_TOKEN`，若为空则尝试读取上述两个 token 文件。

## 3. 启动 Commercial Compose

```bash
docker compose -f docker-compose.commercial_v1.yml up -d
```

可选检查：

```bash
docker compose -f docker-compose.commercial_v1.yml ps
```

## 4. 执行 S3 smoke

```bash
pnpm --filter @geox/server run test:evidence-export:s3-smoke
```

## 5. PASS 标准

满足以下条件即视为通过：

- evidence export job 最终状态为 `DONE`。
- job detail 中 `evidence_pack.delivery.storage_mode === "S3_COMPAT"`。
- `evidence_pack.delivery.object_store_key` 非空。
- `bundle` / `manifest` / `checksums` 三个下载分片均成功。
- 运行日志中不出现 `AUTH_INVALID`；若 token 缺失，应明确报 `MISSING_GEOX_AO_ACT_TOKEN`。
