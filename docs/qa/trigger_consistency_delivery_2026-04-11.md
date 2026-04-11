# 任务交付说明：触发原因一致性（2026-04-11）

## 1) 稳定复现场景

本次统一使用同一触发条件：

- `missing_evidence=true`
- `risk.level=HIGH`
- `risk.reasons` 包含 `MISSING_EVIDENCE`

该条件与服务端风险规则保持一致（`missing_evidence === true -> HIGH / MISSING_EVIDENCE`）。

## 2) 三个接口记录（按用户要求）

- `/api/v1/reports/operation/:id`
  - 记录文件：`docs/artifacts/trigger_consistency_2026-04-11/reports_operation_op-demo-missing-evidence-high.json`
- `/api/v1/alerts`
  - 记录文件：`docs/artifacts/trigger_consistency_2026-04-11/alerts.json`
- `/api/v1/alerts/summary`
  - 记录文件：`docs/artifacts/trigger_consistency_2026-04-11/alerts_summary.json`

截图说明：

- 当前执行环境无可用 browser_container / DevTools 截图能力；截图尝试与结果记录于：
  - `docs/artifacts/trigger_consistency_2026-04-11/screenshot_attempt.txt`

## 3) 触发原因一致性对照

| 接口 | 关键字段 | 一致性结论 |
|---|---|---|
| `/api/v1/reports/operation/:id` | `acceptance.missing_evidence=true`, `risk.level=HIGH`, `risk.reasons=["MISSING_EVIDENCE"]` | 直接体现“证据缺失 => 高风险” |
| `/api/v1/alerts` | `category=ACCEPTANCE_FAILURE`, `severity=HIGH`, `reasons` 含 `MISSING_EVIDENCE` | 与 report 的风险根因一致 |
| `/api/v1/alerts/summary` | `by_severity.HIGH=1`, `by_category.ACCEPTANCE_FAILURE=1` | 与 alerts 列表聚合口径一致 |

结论：三处解释统一映射到同一个触发原因（`MISSING_EVIDENCE`），不存在口径冲突。
