# GEOX 运维手册 v1（最小交付版）

本文档对应当前 Commercial v1 最小交付面，用于现场部署、备份恢复、日志排查与验收执行。

## 1. 交付边界

当前最小交付物包括：

- `docker-compose.yml`：默认开发/演示部署
- `docker-compose.delivery.yml`：交付资源边界 overlay
- `docs/delivery/GEOX_Device_Integration_Kit_v1.md`：设备接入手册
- `docs/delivery/GEOX_Operations_Runbook_v1.md`：本运维手册
- `acceptance/`：一键验收脚本集合

当前系统核心服务：

- `geox-postgres`：PostgreSQL 16，默认映射到主机 `5433`
- `geox-server`：Node 20 + tsx 启动的 GEOX API 服务，默认映射到主机 `3001`

## 2. 启动与停止

### 2.1 启动

在仓库根目录执行：

```powershell
cd C:\Users\mylr1\GEOX

docker compose down
docker compose up -d --build server
```

如需连同默认数据库一起启动，使用：

```powershell
docker compose up -d --build
```

### 2.2 查看状态

```powershell
docker compose ps
docker compose logs --tail 120 server
docker compose logs --tail 120 postgres
```

### 2.3 停止

```powershell
docker compose down
```

## 3. 健康检查

### 3.1 API 就绪检查

服务默认暴露 `http://127.0.0.1:3001`。

最小健康检查：

```powershell
curl.exe -i "http://127.0.0.1:3001/api/v1/fields" -H "Authorization: Bearer x"
```

预期：

- 服务已启动时，不应返回 `500`
- 未溈权通常返回 `401/403`

### 3.2 OpenAPI 检查

```powershell
curl.exe -sS "http://127.0.0.1:3001/api/v1/openapi.json"
```

预期：

- 返回 OpenAPI 3.0.3 JSON
- 关键路径至少包含 devices / fields / telemetry / alerts / evidence-export / operations / dashboard

## 4. 备份

### 4.1 PostgreSQL 备份

当前推荐直接执行仓库内脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\backup_db.ps1
```

常用参数示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\backup_db.ps1 -BackupRoot .\backups\ops
powershell -ExecutionPolicy Bypass -File .\scripts\ops\backup_db.ps1 -DatabaseName landos -ContainerName geox-postgres
```

建议频率：

- 演示环境：每天至少一次
- 生产环境：每天全量 + WAL/增量策略（当前仓库未内置自动化，需部署侧补）

### 4.2 Evidence Export 产物备份

当前证据导出默认写入本地目录：

- `apps/server/runtime/evidence_exports_v1`

建议将该目录纳入备份清单。

当前推荐直接执行仓库内脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\backup_evidence.ps1
```

常用参数示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\backup_evidence.ps1 -EvidenceRoot .\apps\server\runtime\evidence_exports_v1 -BackupRoot .\backups\ops
```

## 5. 恢复

### 5.1 PostgreSQL 恢复

先停止服务，避免写入冲突：

```powershell
docker compose down
```

启动数据库：

```powershell
docker compose up -d postgres
```

恢复示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\restore_db.ps1 -DumpFile .\backups\ops\geox_db_landos_20260310_000000.dump
```

如需恢复到指定数据库：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\restore_db.ps1 -DumpFile .\backups\ops\geox_db_landos_20260310_000000.dump -DatabaseName dandos -ContainerName geox-postgres
```

恢复完成后重新启动服务：

```powershell
docker compose up -d --build server
```

### 5.2 Evidence Export 产物恢复

如果仅恢复历史导出包，直接执行仓库内脚本恢复到：

- `apps/server/runtime/evidence_exports_v1`

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\restore_evidence.ps1 -ArchiveFile .\backups\ops\geox_evidence_exports_20260310_000000.zip
```

注意：

- 数据库中的 job 记录与本地导出文件应尽量保持同一时间点
- 当前版本尚未对象存储化，因此文件丢失会直接影响历史下载

## 6. 日志与排障

### 6.1 Server 日志

```powershell
docker compose logs --tail 200 server
```

重点排查：

- 路由注册失败
- SQL 执行错误
- 端口监听失败
- token/tenant scope 导致的 401/403/404

### 6.2 Postgres 日志

```powershell
docker compose logs --tail 200 postgres
```

重点排查：

- 初始化 SQL 未执行
- 表/列缺失
- 连接失败
- 数据卷损坏

### 6.3 常见问题

#### 问题 1：acceptance 提示 `server not ready in time`

先看：

```powershell
docker compose logs --tail 120 server
```

通常原因：

- 新补丁引入路由/TS 语法问题
- 容器重建后仍在安装依赖
- 数据库未 healthy

#### 问题 2：导出任务 DONE 但下载失败

先确认：

- 数据库里 job 已完成
- `apps/server/runtime/evidence_exports_v1` 下存在对应 artifact
- `job.evidence_pack` 的 bundle / manifest / sha256 信息存在

#### 问题 3：跨租户读取返回 404

这是预期行为，不应视为故障。当前系统按 tenant 作用域做对象级隐藏。

## 7. 一键验收清单

建议按以下顺序执行最小商业面验收：

```powershell
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintC5\ACCEPTANCE_sprintC5_export_csv_format_language.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintC6\ACCEPTANCE_sprintC6_export_pdf_minimal.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintA2\ACCEPTANCE_sprintA2_alert_notifications_minimal.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintD2\ACCEPTANCE_sprintD2_device_console_minimal.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintP2\ACCEPTANCE_sprintP2_dashboard_overview.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintF2\ACCEPTANCE_sprintF2_fields_workbench_5tabs.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintO2\ACCEPTANCE_sprintO2_operations_workbench.ps1
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintDocs1\ACCEPTANCE_sprintDocs1_openapi_and_device_kit.ps1
```

如需快速验证“当前交付文档在位”，再补跑：

```powershell
powershell -ExecutionPolicy Bypass -File .\acceptance\sprintDocs2\ACCEPTANCE_sprintDocs2_operations_runbook.ps1
```

## 8. 当前版本已知限制

- PDF 导出为最小摘要版，非复杂商业排版
- Evidence Export 仍为本地文件模式，尚未对象存储化
- OpenAPI 为最小静态交付版，非自动生成全量文档
- Alerts 当前为通知留痕最小闭环，非真实外发系统
- Dashboard / Fields / Devices / Operations 已具产品面，但仍非终态
