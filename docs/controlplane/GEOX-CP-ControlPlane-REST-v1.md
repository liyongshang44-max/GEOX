# GEOX Control Plane REST v1 (Wrappers)

本文件定义 **对外** 的 Control Plane REST v1 入口（`/api/v1/...`）。

设计原则：

1) 主入口为 `/api/v1/*`。既有 `/api/control/...` 路径仅保留为 compatibility note，不再作为默认对外主入口。
2) 所有写入均为 append-only facts（不得就地更新/覆盖）。
3) 多租隔离以 `tenant_id/project_id/group_id` 三元组为硬边界；越权/跨租必须返回 404（不可枚举）。
4) v1 入口允许复用 v0 AO-ACT 运行时（task/receipt 的 forbid-list 与校验逻辑不变）。

## Approvals

### Create

`POST /api/v1/approvals`

写入：`approval_request_v1`

Body（最小）：

- `tenant_id, project_id, group_id`
- `issuer` (string)
- `action_type` (string)
- `target` (string, e.g. `field:field_001`)
- `time_window.start_ts/end_ts` (ms)
- `parameter_schema`
- `parameters`
- `constraints`

### Decide

`POST /api/v1/approvals/:request_id/decide`

Body：

- `decision`: `APPROVE|REJECT`
- `reason` (optional)

写入：

- `approval_decision_v1`

当 `APPROVE` 时额外：

- 调用 `/api/v1/actions/task` 创建 `ao_act_task_v0`（legacy `/api/control/ao_act/task` 仅兼容）
- 写入 `ao_act_task_created_v1`（wrapper）

## AO-ACT

### Create task

`POST /api/v1/ao-act/tasks`

行为：

- 委托到 `/api/v1/actions/task` 生成 `ao_act_task_v0`（legacy `/api/control/ao_act/task` 仅兼容）
- 写入 `ao_act_task_created_v1`（wrapper）

### Dispatch intent

`POST /api/v1/ao-act/tasks/:act_task_id/dispatch`

写入：`ao_act_task_dispatched_v1`

注意：该接口只记录“已下发/准备执行”的审计意图，不会自动触发执行。

### Record receipt

`POST /api/v1/ao-act/receipts`

行为：

- 委托到 `/api/v1/actions/receipt` 生成 `ao_act_receipt_v0`（legacy `/api/control/ao_act/receipt` 仅兼容）
- 写入 `ao_act_receipt_recorded_v1`（wrapper）

要求：

- `meta.idempotency_key` 必须提供（用于幂等写入）
