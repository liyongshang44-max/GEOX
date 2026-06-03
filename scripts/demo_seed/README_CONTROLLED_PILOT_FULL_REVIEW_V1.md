# Controlled Pilot Full Review Seed V1

本 seed 用于本地受控试点人工验收，不是生产客户数据，也不是旧 lightweight demo seed 的扩展。

## 命令

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --dry-run --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-json --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-json --tenant tenantA --out artifacts/controlled_pilot_full_review_tenantA.plan.json
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify-api --tenant tenantA --base-url http://127.0.0.1:3001
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-db-json --tenant tenantA --out artifacts/controlled_pilot_full_review_tenantA.actual.json
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --apply --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify-clean --tenant tenantA
```

默认模式是 dry-run。`--apply` 必须显式传入 `--tenant`。允许 tenant 只有 `tenantA` 和 `demo`。

## 连接配置

脚本优先读取 `DATABASE_URL` 或 `POSTGRES_URL`。如果没有连接串，则读取 `PGHOST`、`PGPORT`、`PGUSER`、`PGPASSWORD`、`PGDATABASE`。默认值按 commercial compose 验收口径设置：

```text
PGHOST=127.0.0.1
PGPORT=5433
PGUSER=landos
PGPASSWORD=landos_pwd
PGDATABASE=landos
```

脚本会尝试读取 `.env.ci` 和 `.env`，但不会要求生产连接。

## export-json 输出

`--export-json` 不连接数据库，输出完整计划数据包。顶层包含：

```text
manifest
tables
facts_by_type
derived_expectations
negative_cases
forbidden_customer_dom_text
guards
system_domains
```

`system_domains` 覆盖 A-Z 全系统域，用于审查数据写入目标、消费页面、约束和禁止项。

`--export-db-json` 在 apply 后运行，用于导出数据库中 seed-owned 的实际写入结果。

## 数据范围

seed lane 为 `CONTROLLED_PILOT_FULL_REVIEW`，版本为 `v1`。它会写入或尝试写入：

- `facts`
- `field_index_v1`
- `field_polygon_v1`
- `device_index_v1`
- `device_binding_index_v1`
- `device_status_index_v1`
- `device_capability`
- `telemetry_index_v1`
- `device_observation_index_v1`
- `alert_event_index_v1`
- `field_memory_v1`
- `approval_requests_v1`，表存在时写入，不创建 shadow table
- `operation_state_v1`，表存在时写入，不创建 shadow table
- `roi_ledger_v1`，表存在时写入，不创建 shadow table

## 场景

1. C8 灌溉闭环成功。
2. C8 灌溉待验收。
3. 设备离线，已绑定地块。
4. 设备离线，聚合来源 / 缺少定位，只读。
5. 病虫害巡检建议，待审批。
6. 无地块绑定负例，只在验收脚本中验证，不写入长期队列。
7. 客户报告中心完整入口。

## 字段合同

- `approval_request_v1` 和 `approval_decision_v1` 同时写 `request_id` 与 `approval_request_id`。
- `operation_plan_transition_v1` 写 `status`、`from_status`、`trigger`、`created_ts`。
- `skill_run_v1` 写 `trigger_stage`。
- formal evidence 必须来自正式作业链路，且不得伪造为正式结果。

## 清理边界

cleanup 只清理 manifest 中登记的 seed-owned 记录，以及 `fact_id like 'full_review_seed_<tenant>_%'` 的 facts。禁止 truncate，禁止按 tenant 粗暴清理。cleanup dry-run 会输出将删除的数量；真正清理必须 `--cleanup --apply --tenant`；清理后用 `--verify-clean` 验证。

## 正式链路边界

正式农业作业必须有真实 `field_id` 或 `spatial_scope.field_id`。aggregate-only / missing-location 只能作为只读排查入口，不生成正式 AO-ACT 成功、客户价值结论或田块记忆。
