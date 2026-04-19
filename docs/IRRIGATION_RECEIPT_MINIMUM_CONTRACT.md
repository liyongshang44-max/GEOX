# IRRIGATION RECEIPT MINIMUM CONTRACT (v1)

## 主入口

- receipt 主入口：`/api/v1/actions/receipt`

## 元信息字段来源（冻结）

- `command_id` 来自：`meta.command_id`
- `idempotency_key` 来自：`meta.idempotency_key`

## 合同语义边界

- receipt 是**执行回执技术合同**（execution receipt technical contract）。
- receipt **不等于 acceptance**。
- receipt **不等于 final_status**。

## 适用范围

- simulator receipt 与未来 executor receipt 共用这一公共合同层。

## 灌溉场景最小合同必填（当前冻结）

以下缺失会导致 receipt 拒绝写入：

- `operation_plan_id`
- `act_task_id`
- `executor_id`
- `execution_time`
- `execution_coverage`
- `resource_usage`
- `logs_refs`（且不能为空数组）
- `constraint_check`
- `observed_parameters`
- `meta.idempotency_key`
- `meta.command_id`

以下可缺失仍可写入：

- `status`
- `device_refs`
- `meta` 中除 `idempotency_key` / `command_id` 外其他字段
- `resource_usage` 内部资源值可为 `null`
