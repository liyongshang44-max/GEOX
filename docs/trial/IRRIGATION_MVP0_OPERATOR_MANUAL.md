# IRRIGATION MVP0 Operator Manual

## 1. 如何进入系统
- 启动服务后访问 `BASE_URL`。
- 使用具备对应 scope 的 token（如 `ao_act.index.read`, `ao_act.task.write`, `approval.write`）。

## 2. 如何查看 demo field
- 通过 `field_id` 查询：`GET /api/v1/field-memory?tenant_id=...&project_id=...&group_id=...&field_id=...`。

## 3. 如何识别缺水 observation
- 检查 `device_observation_index_v1` 中 `soil_moisture` 低值。
- 检查派生状态 `derived_sensing_state_index_v1` 的 `irrigation_effectiveness_state=LOW`。

## 4. 如何查看 irrigation recommendation
- 调用 `POST /api/v1/recommendations/generate`，查看返回 `recommendations[0]`。

## 5. 如何查看 prescription
- 调用 `POST /api/v1/prescriptions/from-recommendation`，记录 `prescription_id`。

## 6. 如何完成人工 approval
- `POST /api/v1/prescriptions/{prescription_id}/submit-approval`
- `POST /api/v1/approvals/{approval_id}/decide`（`decision=APPROVE`）。

## 7. 如何查看 mock valve execution
- 触发 `POST /api/v1/skills/mock-valve-control/run`。
- 核对返回 `skill_run_id/run_id`。

## 8. 如何查看 receipt / as-executed
- `POST /api/v1/actions/receipt` 后获取 `receipt fact_id`。
- `POST /api/v1/as-executed/from-receipt` 获取 `as_executed_id`。

## 9. 如何查看 acceptance
- `POST /api/v1/acceptance/evaluate`，核对 `verdict` 和 `fact_id`。

## 10. 如何查看 Field Memory
- Scope 查询：`GET /api/v1/field-memory?tenant_id=...&project_id=...&group_id=...&field_id=...`。
- Operation 查询：`GET /api/v1/field-memory?tenant_id=...&project_id=...&group_id=...&operation_id=...`。

## 11. 如何查看 ROI Ledger
- `POST /api/v1/roi-ledger/from-as-executed` 后读取 `roi_ledgers`。
- 重点确认 `baseline` / `confidence` / `evidence_refs`。

## 12. 如何导出/查看客户报告
- 使用正式路由：`GET /api/v1/reports/operation/{operation_id}?tenant_id=...&project_id=...&group_id=...`。
- 检查报告含 Field Memory、ROI、客户摘要。

## 13. 哪些内容不能当作增产承诺
- 试点期间输出仅为运营与农艺决策辅助，不构成收益或增产保证。
- ROI 为估算结果，受传感质量、样本周期、基线假设影响。
