# GEOX · Sprint 19
# AO-ACT AuthZ Contract v0

适用：Control Plane / Apple III (AO-ACT)

目的

本合约定义 AO-ACT 的最小授权边界，使“写 task / 写 receipt / 读 index”在商用形态下具备：
1) 默认拒绝（deny-all）
2) 最小权限（scope-based）
3) 可撤销（revocation）
4) 可追责（audit fact）

范围

仅覆盖：
1) HTTP API 的认证与授权（AuthN/AuthZ）
2) 授权配置文件（SSOT）
3) 审计事实（append-only）

非目标（必须明确拒绝）

1) 不做全量 IAM（用户/角色/组织/登录），不引入身份提供方。
2) 不引入 server-side 重试、队列、调度、自动触发。
3) 不允许 AO-ACT 写回 Judge / Agronomy / Plan。

授权模型

认证方式：HTTP `Authorization: Bearer <token>`。

授权粒度：scope。

Scope 列表（冻结）

- `ao_act.task.write`：允许 POST `/api/control/ao_act/task`
- `ao_act.receipt.write`：允许 POST `/api/control/ao_act/receipt`
- `ao_act.index.read`：允许 GET `/api/control/ao_act/index`

默认行为（冻结）

- 无 Authorization：401 `AUTH_MISSING`
- token 不存在：401 `AUTH_INVALID`
- token 已撤销：403 `AUTH_REVOKED`
- scope 不足：403 `AUTH_SCOPE_DENIED`

Token SSOT（配置文件）

路径（冻结）：`config/auth/ao_act_tokens_v0.json`

结构：

- `version`: 固定为 `ao_act_tokens_v0`
- `tokens[]`: allowlist
  - `token`: bearer token 字符串（密钥）
  - `token_id`: 稳定 token 标识（用于审计）
  - `actor_id`: 稳定操作者标识（用于审计）
  - `scopes[]`: scope 列表
  - `revoked`: 撤销标记（true => 立即拒绝）

撤销语义（冻结）

server 每次请求均从 SSOT 文件读取 allowlist；对同一进程而言，撤销对后续请求立即生效。

审计事实（append-only）

当请求通过授权时，server 额外写入一条 `ao_act_authz_audit_v0` fact：

- `event`: `task_write` | `receipt_write` | `index_read`
- `actor_id`
- `token_id`
- `target_fact_id`（写 task/receipt 时记录新 fact_id；读 index 为 null）
- `act_task_id`（可选）
- `created_at_ts`

该审计事实不改变 AO-ACT v0 的 task/receipt contract（不回写、不扩字段），仅提供可追责轨迹。
