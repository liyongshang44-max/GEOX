GEOX Control Plane
AO-ACT → Judge Read Contract (v0)
Status

Sprint: 11

Scope: Governance / Contract only

Implementation: Explicitly out of scope

1. Purpose（目的）

本契约定义 Apple II（Judge）如何只读消费 Apple III（AO-ACT）已落盘的执行事实，并将其作为 Evidence / Execution Fact 参与后续判读与不确定性组织。

本契约 只定义读取边界与确定性纪律，不定义任何：

problem_state 变更语义

决策逻辑

agronomy 推理

控制触发机制

2. Non-Goals（显式非目标）

以下行为在 Sprint 11 被明确禁止：

AO-ACT 向 Judge 写回任何状态或信号

Judge 要求 AO-ACT 增加写字段、回调或 side-channel

引入执行效果评估（质量 / 成功率 / 收益 / 优化）

Agronomy 读取 AO-ACT 作为推理输入（仍为 pointer-only）

修改 ao_act_task_v0 / ao_act_receipt_v0 的既有 payload 结构

3. Authoritative Data Source（唯一数据源）

Judge 读取 AO-ACT 的 唯一权威来源 为：

facts append-only ledger

不允许：

缓存副本作为语义输入

非 ledger 表作为判读依据

4. Readable Fact Types（可读事实类型）

Sprint 11 中，Judge 只读 以下事实类型：

record_json.type = "ao_act_task_v0"

record_json.type = "ao_act_receipt_v0"

不得引入新的 AO-ACT 相关事实类型作为 Sprint 11 前置条件。

5. Canonical JSON Access（标准字段定位）

所有 JSON 读取 必须 使用以下规则：

对 facts.record_json 一律使用 (record_json::jsonb)

禁止对未 cast 的 text 使用 -> / ->> / #>>

Canonical pointers

Task（ao_act_task_v0）：

payload.act_task_id

payload.action_type

payload.target.kind / ref

payload.parameter_schema.keys

payload.time_window

Receipt（ao_act_receipt_v0）：

payload.act_task_id

payload.status（可选）

payload.executor_id

payload.execution_time

payload.execution_coverage

payload.constraint_check

payload.observed_parameters

6. Aggregation Unit（聚合主键）

Judge 读取 AO-ACT 时的唯一聚合主键为：

act_task_id


所有 task / receipt 的关联、索引、判读，必须通过 act_task_id 完成。

7. Latest Receipt Rule（冻结）

当同一 act_task_id 存在多条 receipt 时，Judge 必须使用以下确定性规则选择：

排序键（降序）：

facts.occurred_at

facts.fact_id

此规则是 唯一合法规则，用于：

回放

审计

未来 determinism hash 输入

8. Determinism Discipline（确定性纪律）

若 AO-ACT 事实在未来被纳入 Judge 的确定性计算（本 Sprint 不实现），必须遵守：

输入集合：完全由 ledger 查询定义，可枚举、可回放

排序：

occurred_at ASC

fact_id ASC

JSON：使用原始 record_json::jsonb，不做语义重写

meta 字段：默认纳入 determinism，除非另有治理文档明确排除

9. Negative Spec（禁止项）

Sprint 11 明确禁止：

Judge 写入任何 “AO-ACT 已消费/已处理” 标记

新增 ao_act_* 事实类型用于消费确认

AO-ACT receipt 触发 problem_state 自动变化

使用 wall-clock now() 作为 Judge 判读输入

将 receipt 解释为 agronomy 结果或推荐依据

10. Relationship to Sprint 10 Contracts（继承关系）

本契约：

继承并尊重：

GEOX-CP-AO-ACT-Contracts-v0

GEOX-CP-AO-ACT-Execution-Contract-v0

不修改、不覆盖 Sprint 10 的任何写入语义

仅在 Judge 侧定义只读消费纪律
11. Acceptance Scope（非 Sprint 11 交付）

以下内容 不属于 Sprint 11：

代码实现

数据库视图

acceptance 脚本

problem_state 语义变更

12. Semantic Freezing（语义冻结）
12.1 AO-ACT 在 Judge 中的语义身份（冻结）

当 Apple II（Judge）读取 AO-ACT 相关事实时：

ao_act_task_v0 与 ao_act_receipt_v0 仅被视为 Execution Evidence

它们 不是：

ProblemState 的直接输入

State Transition 的触发条件

决策或推荐的依据

AO-ACT 的存在 只能增加或改变证据集合，不得直接改变 Judge 的判定结论或状态机走向。

12.2 act_task_id 的身份边界（冻结）

act_task_id 是 执行域（execution-scoped）标识符，其语义边界被冻结为：

仅用于：

关联 task 与 receipt

AO-ACT 内部聚合与审计

明确禁止：

映射为 problem_state_id

参与 determinism_hash / ssot_hash 的 identity 生成

作为 Judge 内部状态实体的主键或别名

act_task_id 不得被提升为 Judge 的语义身份。

12.3 Latest Receipt Rule 的适用范围（冻结）

Sprint 11 定义的 “Latest Receipt Rule”：

仅适用于 AO-ACT Index / View 层的默认聚合

不构成 Judge 在推理阶段对证据的裁剪规则

Judge 在需要时 可以同时读取多条 receipt 作为并存证据，而不以“最后一条即真相”为前提。

12.4 meta 字段的确定性约束（冻结）

在 AO-ACT facts 中：

payload.meta 默认视为 非语义字段

Judge 不得在 determinism 计算中假定 meta 具有稳定语义

若未来需要将 meta 纳入 determinism 或语义输入，必须通过独立的治理文档显式声明，不得通过实现层隐式引入。

冻结状态说明

本小节为 Sprint 11 的治理冻结补充

不引入新能力

不要求任何代码改动

用于防止 Sprint 12 及以后阶段的“自然但错误实现”