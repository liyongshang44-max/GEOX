# GEOX Runtime Hardening V1

- Runtime env: development/test/staging/production.
- Token source: dev/test 可 fallback；staging/production 必须结构化 secret source。
- CORS: production 禁止 `*` 与 localhost，必须显式 allowlist。
- Secret: Postgres/MinIO/MQTT/app secret 禁止弱默认值。
- 执行默认禁用：`GEOX_EXECUTION_DEFAULT_DISABLED=1`；显式启用需 `GEOX_EXECUTION_ENABLE_EXPLICITLY=1` + reason。
- Compose: commercial_v0 不等于 production；delivery overlay 仅资源，不代表安全达标。
- healthz 暴露 runtime_security 检查项与错误列表。
- 验收命令：运行 runtime/audit/fail-safe/variable/field-memory 安全脚本。
