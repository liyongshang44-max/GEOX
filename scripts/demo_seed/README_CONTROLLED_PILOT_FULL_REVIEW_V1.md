# Controlled Pilot Full Review Seed V1

本 seed 用于本地受控试点人工验收，不是生产客户数据，也不是旧 lightweight demo seed 的扩展。

核心正式链路 ID：`C8_FORMAL_IRRIGATION_FULL_CHAIN_V1`。

## 命令

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --dry-run --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-json --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-json --tenant tenantA --out artifacts/controlled_pilot_full_review_tenantA.plan.json
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA --base-url http://127.0.0.1:3001
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify-api --tenant tenantA --base-url http://127.0.0.1:3001
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-db-json --tenant tenantA --out artifacts/controlled_pilot_full_review_tenantA.actual.json
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --apply --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify-clean --tenant tenantA
```

默认模式是 dry-run。`--apply` 必须显式传入 `--tenant`。允许 tenant 只有 `tenantA` 和 `demo`。

## Profile

默认 profile 是 `full-review`，保留现有受控试点完整演示范围。

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --dry-run --tenant tenantA --profile full-review
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --export-json --tenant tenantA --profile full-review
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA --profile full-review
```

`c8-formal-chain` profile 只写 C8 正式灌溉闭环必要数据，用于单独验收正式链路，不写 pending irrigation、pest pending、offline gateway、aggregate missing-location、对照田或设备影响田。

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --dry-run --tenant tenantA --profile c8-formal-chain
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA --profile c8-formal-chain
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify-api --tenant tenantA --profile c8-formal-chain --base-url http://127.0.0.1:3001
```

`c8-formal-chain` apply 会先清理该 seed manifest 管理的既有 full-review 行，再写入正式 C8 行，避免旧 pending 作业、offline 设备或 aggregate 排查入口残留到 `/api/v1/reports/field/field_c8_demo`。

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

## C8 formal irrigation full chain

`--export-json` 顶层必须包含：

```json
{
  "profile": "full-review | c8-formal-chain",
  "chain_id": "C8_FORMAL_IRRIGATION_FULL_CHAIN_V1",
  "formal_chain": {
    "chain_id": "C8_FORMAL_IRRIGATION_FULL_CHAIN_V1",
    "field": {},
    "boundary": {},
    "devices": [],
    "observations": [],
    "diagnosis": {},
    "recommendation": {},
    "prescription": {},
    "approval": {},
    "operation_plan": {},
    "ao_act_task": {},
    "receipt": {},
    "as_executed_expected": {},
    "as_applied_expected": {},
    "evidence": [],
    "acceptance": {},
    "roi": {},
    "field_memory": {},
    "report_expectations": {}
  }
}
```

该链路沿现有正式生产出口聚合，不允许新增绕过 `reports_v1.ts` 的平行 field-operational-chain 接口：

`field_index_v1 / field_polygon_v1 → device_* → telemetry/device_observation → decision_recommendation_v1 → prescription_contract_v1 → approval → operation_plan/transition → ao_act_task_v0 → ao_act_receipt_v1 → as_executed_record_v1 / as_applied_map_v1 → evidence → acceptance → roi_ledger_v1 → field_memory_v1 → projectReportV1 → guarded report → /api/v1/reports/operation/:operation_id → /api/v1/reports/field/:field_id → customer 页面`。

## export-json 输出

`--export-json` 不连接数据库，输出完整计划数据包。顶层包含：

```text
profile
chain_id
manifest
formal_chain
tables
facts_by_type
derived_expectations
negative_cases
forbidden_customer_dom_text
guards
system_domains
```

`formal_chain` 显式描述 C8 正式灌溉闭环。`system_domains` 覆盖 A-Z 全系统域，用于审查数据写入目标、消费页面、约束和禁止项。

`--profile c8-formal-chain --export-json` 中：

```text
tables.field_index_v1 只包含 field_c8_demo
facts_by_type.operation_plan_v1 不包含 op_plan_c8_irrigation_pending_001
tables.device_index_v1 不包含 dev_gateway_offline_001
tables.alert_event_index_v1 为空
facts_by_type.decision_recommendation_v1 不包含 rec_c8_pest_inspection_pending_001
derived_expectations.customer_operations 只包含 op_plan_c8_irrigation_formal_001
```

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
- `prescription_contract_v1`，表必须存在；不存在时 `--verify` 报缺口，不创建 shadow table
- `field_memory_v1`
- `approval_requests_v1`，表存在时写入，不创建 shadow table
- `operation_state_v1`，表存在时写入，不创建 shadow table
- `roi_ledger_v1`，表存在时写入，不创建 shadow table

如果 `field_index_v1` 或设备相关表缺少客户可读字段，seed 不强行加列；对应语义也会写入 `field_crop_season_v1`、`device_observation_context_v1` 或 `telemetry_observation_v1` facts，供 report API 后续聚合。

## apply 与 as-executed 派生

`--apply` 会先写基础表、facts、prescription、formal Field Memory 与受控 preview ROI。随后如果传入 `--base-url`，或环境变量 `CONTROLLED_PILOT_VERIFY_API_BASE` / `BASE_URL` / `API_BASE_URL` 可用，脚本会调用：

```text
POST /api/v1/as-executed/from-receipt
POST /api/v1/roi-ledger/formalize-from-acceptance
POST /api/v1/field-memory/from-acceptance
```

API 不可达时只输出 `as-executed derivation skipped` warning，不伪装成功。`--verify-api` 会强制调用 from-receipt，并确认：

```text
/api/v1/as-executed/by-task/act_c8_irrigation_formal_001
/api/v1/reports/operation/op_plan_c8_irrigation_formal_001
/api/v1/reports/field/field_c8_demo
```

都能返回正式链路字段。`--profile c8-formal-chain --verify-api` 还会确认 field report 和 customer operations 中不出现 `op_plan_c8_irrigation_pending_001`、`PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW` 或 `dev_gateway_offline_001`。

## 场景

`full-review` profile 包含：

1. C8 灌溉闭环成功。
2. C8 灌溉待验收。
3. 设备离线，已绑定地块。
4. 设备离线，聚合来源 / 缺少定位，只读。
5. 病虫害巡检建议，待审批。
6. 无地块绑定负例，只在验收脚本中验证，不写入长期队列。
7. 客户报告中心完整入口。

`c8-formal-chain` profile 只包含第 1 项：C8 正式灌溉闭环成功。

## 字段合同

- `field_crop_season_v1` 写 `area_mu`、`crop_code`、`crop_name`、`season_id`、`crop_stage`。
- `device_observation_context_v1` 或设备表字段写 `display_kind_text`、`sensing_role_text`、`capability_text`、`field_role_text`。
- `telemetry_observation_v1` 写 `metric_label`、`metric_role`、`diagnostic_use`、`threshold_ref`。
- `decision_recommendation_v1` 写诊断输入 refs、阈值、expected effect 与客户可读 explain。
- `prescription_contract_v1.operation_amount` 写 `amount=22`、`unit=mm`、`metadata.trace_id=skill_trace_c8_irrigation_001`。
- `operation_plan_v1` 写 `prescription_id`、planned amount、target device、expected evidence。
- `operation_plan_transition_v1` 写 `CREATED → APPROVAL_REQUESTED → APPROVED → READY → DISPATCHED → ACKED → EXECUTED → ACCEPTANCE_REQUESTED → ACCEPTED`。
- `ao_act_task_v0` 写可执行参数、目标水分、执行窗口、安全约束与 evidence requirements。
- `ao_act_receipt_v1.status` 写 `executed`，并写 `task_id`、observed parameters、resource usage、labor、evidence refs。
- `acceptance_result_v1` 写 `formal_acceptance=true`、`formal_evidence_passed=true`、`chain_validation_passed=true`。
- formal ROI 必须是 `FORMAL_ACCEPTANCE / FORMAL_ACCEPTED / customer_visible_value=true`。
- formal Field Memory 必须是 `FORMAL_FIELD_MEMORY / FORMAL_ACCEPTED / customer_visible_memory=true / learning_eligible=true`。

## 清理边界

cleanup 只清理 manifest 中登记的 seed-owned 记录，以及 `fact_id like 'full_review_seed_<tenant>_%'` 的 facts。禁止 truncate，禁止按 tenant 粗暴清理。cleanup dry-run 会输出将删除的数量；真正清理必须 `--cleanup --apply --tenant`；清理后用 `--verify-clean` 验证。

## 正式链路边界

正式农业作业必须有真实 `field_id` 或 `spatial_scope.field_id`。aggregate-only / missing-location 只能作为只读排查入口，不生成正式 AO-ACT 成功、客户价值结论或田块记忆。
