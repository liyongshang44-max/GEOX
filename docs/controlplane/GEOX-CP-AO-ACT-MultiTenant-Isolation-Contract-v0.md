# GEOX · Sprint 22
# Apple III · AO-ACT — Multi-Tenant Hard Isolation Contract v0（冻结候选）

适用：Control Plane / Apple III（AO-ACT）

本文件仅定义：
1) AO-ACT 在多租户/多场地场景下的“硬隔离字段”与 SSOT 命名；
2) 读/写 API 的隔离判定语义（HTTP 状态码固定）；
3) 幂等去重键的判定域（防跨租户污染）；
4) device_ref 作为证据引用时的跨租户禁止规则。

------------------------------------------------------------

## 0. 裁定（必须写死，禁止漂移）

1) `tenant_id` 是唯一 SSOT 字段名；禁止使用 `namespace` 作为等价或别名字段。
2) 跨租户访问（scope 不匹配、目标不属于本租户）：统一返回 404
3) 无 token / token 无效：401
4) 必要字段缺失（tenant_id/project_id/group_id 等）：400

说明：Sprint 22 的核心是“隔离是否可证明”，不是“错误是否好调”。调试依赖 acceptance，而不是 HTTP body。

------------------------------------------------------------

## 1. 目的（Purpose）

建立 AO-ACT 的可证明硬隔离，使系统满足：
- 多租户并存时，任何跨租户读/写都必然失败；
- 失败是非枚举的（404），不泄露目标是否存在；
- 隔离是工程事实：由 contract + negative acceptance + tag 锁死。

------------------------------------------------------------

## 2. 非目标（Negative Guarantees）

本 Sprint 明确禁止：
- ❌ IAM / 复杂 RBAC
- ❌ 调度器 / 队列
- ❌ 自动触发执行
- ❌ 多租户聚合视图 / 跨租户查询
- ❌ 共享 executor（token scope 不允许跨 tenant_id/project_id/group_id）

------------------------------------------------------------

## 3. 硬隔离字段（Hard Isolation Fields）

最小字段集（必须同时出现）：

- tenant_id
- project_id
- group_id

它们必须同时出现在：
1) Token 的 scope 绑定域（token record 必须携带三者）
2) 写入的 task / receipt payload
3) index 查询参数

------------------------------------------------------------

## 4. Token（Sprint 19 AuthZ 的 scope 内扩展，不改语义）

AO-ACT 仍然以 Sprint 19 的 token + scope 为门禁：
- ao_act.task.write
- ao_act.receipt.write
- ao_act.index.read

Sprint 22 扩展点：
- token record 必须携带 tenant_id/project_id/group_id
- 请求携带的 tenant_id/project_id/group_id 必须与 token record 完全一致
- 不一致 => 404（不可枚举）

------------------------------------------------------------

## 5. API（读/写都必须 tenant-scoped）

### 5.1 POST /api/control/ao_act/task

请求体必须包含：
- tenant_id, project_id, group_id（required）
- 其余字段沿用 Sprint 10/19/21 冻结契约

隔离判定：
- token scope 不匹配或 tenant triple 不匹配 => 404

### 5.2 POST /api/control/ao_act/receipt

请求体必须包含：
- tenant_id, project_id, group_id（required）
- 其余字段沿用 Sprint 20/21 冻结契约（含 idempotency_key 与 device_refs）

隔离判定：
- token scope 不匹配或 tenant triple 不匹配 => 404
- act_task_id 在本 tenant triple 下不存在 => 404（不可枚举）

### 5.3 GET /api/control/ao_act/index

查询参数必须包含：
- tenant_id, project_id, group_id（required）
- act_task_id（optional）

隔离判定：
- token scope 不匹配或 tenant triple 不匹配 => 404

------------------------------------------------------------

## 6. 幂等性（Idempotency Domain）

幂等去重键的判定域必须至少包含 tenant_id。

推荐完整域（避免未来误解/漂移）：
tenant_id + project_id + group_id + executor_id + idempotency_key

实现纪律：
- 任何去重查询必须在上述域内执行
- 禁止跨租户共享 idempotency 去重结果

------------------------------------------------------------

## 7. device_ref 跨租户禁止（强隔离）

当 receipt.payload.device_refs[] 引用 ao_act_device_ref_v0 时：

- 服务器仅做“存在性校验 + tenant triple 校验”
- device_ref 的 tenant triple 由 ao_act_device_ref_v0.payload.meta 承载（不解析 content）
- 若 device_ref 的 tenant triple 与 receipt 的 tenant triple 不一致：必须失败（404 或 400 均可，但本 Sprint 选择 404 以保持不可枚举）

------------------------------------------------------------

## 8. Acceptance（冻结前必须通过）

最低覆盖（至少 4 类用例）：

1) tokenA 写租户A task/receipt：PASS
2) tokenA 读租户B index：FAIL（404）
3) tokenA 写租户B receipt：FAIL（404）
4) tokenB 写租户B receipt 引用租户A 的 device_ref：FAIL（404）

冻结前必须提供：
- scripts/ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0.ps1
- scripts/ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0_RUNNER.cjs
