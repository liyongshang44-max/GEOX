GEOX · Sprint 14
Agronomy Interpretation v1 — Contract（冻结版）

定位：Agronomy Interpretation 是 解释型事实（interpretation fact）
它用于“说明我们如何理解事实”，而不是“决定要做什么”。

合同目标（冻结）

本合同只解决一件事：

如何把 Agronomy 的“理解”表达成一种：

可被阅读
可被引用
可被审计
但不会被误用为决策或控制

的事实形态。

本合同不追求更准确的算法，只冻结语义边界与使用方式。

语义定位（冻结）

1.1 Interpretation 的系统角色

agronomy_interpretation_v1 是：

基于事实与证据，对农业状态所作的解释性描述

它满足：

是 interpretation
不是 decision
不是 control
不是 prescription

1.2 明确非目标（冻结）

Agronomy Interpretation 不承担以下职责：

不决定是否执行动作
不产生控制指令
不替代人类判断
不替代策略 / 规则 / 权限系统

补充冻结（防误用）：

❌ Interpretation 不得被解释为“候选动作集合”
❌ Interpretation 不得包含“行动建议/行动指令/触发条件”的任何结构化表达
✅ Interpretation 只能表达“我们如何理解证据”，不能表达“因此应当做什么”

与 Judge 的关系（冻结裁定）

2.1 禁止 Judge 读取（硬性冻结）

Judge 不得读取 agronomy_interpretation_v1。

具体冻结如下：

❌ agronomy_interpretation_v1 不得作为 Judge 的判读输入
❌ 不得进入 Judge 的 determinism 输入集
❌ 不得参与：

determinism_hash

effective_config_hash

state_inputs_used

cache / memoization key

❌ 不得影响：

problem_state 的生成

ao_sense 的生成

不确定性结构或优先级

2.2 Judge 的可读事实白名单（冻结）

Judge 仅允许读取以下事实类型：

raw_sample_*
marker_*
ao_sense_*
ao_act_task_v0
ao_act_receipt_v0

明确禁止读取：

agronomy_interpretation_v1
任何 interpretation / explanation / commentary 类型事实

2.3 裁定理由（规范性）

Judge 是：

不确定性组织者（Uncertainty Organizer）

Interpretation 是：

主观理解层（Interpretive Layer）

Judge 读取 Interpretation 将导致系统自我引用，破坏审计与可解释性。
因此该隔离是 结构性安全约束，不是实现选择。

Agronomy Interpretation v1（Schema 冻结）

3.1 record_json 形态（冻结）

{
"type": "agronomy_interpretation_v1",
"payload": {
"subject_ref": { ... },
"dimension": "water_status",
"description": "...",
"evidence_refs": [ ... ],
"confidence": 0.72,
"created_at_ts": 1769xxxxxxx,
"meta": { ... }
}
}

3.2 字段语义（冻结）

subject_ref
解释所针对的主体指针（对象/地块/分组等），仅用于定位，不包含策略/权限。

dimension
表示解释维度（如 water_status / growth_stage），不是结论标签、不是控制类别、不是可执行分类。

description
自然语言解释，仅用于人类或下游系统理解。
冻结红线：
❌ description 不得作为任何自动系统的条件匹配输入（不得用于 contains/regex/keyword rule 触发）。
❌ 不得从 description 解析/抽取出用于执行的结构化条件。
✅ description 仅是解释文本，不具备可执行语义。

evidence_refs
指向 raw_sample / marker / ao_act_receipt 等事实，保证解释可回溯。
冻结要求：Interpretation 的任何断言必须能回指到 evidence_refs（可审计，不要求算法可复现）。

confidence
表示解释置信度。
冻结红线：
❌ confidence 不是行动阈值。
❌ 自动系统不得使用 confidence 作为 if/trigger 条件，也不得作为执行门槛。
❌ confidence 不得被转译为 priority / severity / recommendation。
✅ confidence 仅用于“阅读时的主观程度提示”，不可用于动作派生。

created_at_ts
审计时间戳字段。

meta
审计元数据容器。
冻结红线：meta 不得承载任何决策/控制/农技建议语义（见 forbid list）。

3.3 forbid list（硬性冻结，可静态验收）

agronomy_interpretation_v1 的 payload 顶层与任意嵌套中不得出现以下 key（exact match, case-sensitive；递归遍历 object/array）：

decision, decide, plan, policy, trigger, execute, action, task, ao_act,
recommendation, suggestion, proposal, prescription, next_action, follow_up, autotrigger, auto,
severity, priority, expected_outcome, effectiveness, quality, desirability,
success_criteria, success_score, yield, profit,
problem_state_id, lifecycle_state,
mode, profile, preset

命中任一 forbid key ⇒ reject（不得写入 ledger）。

与自动系统的关系（冻结裁定）

4.1 禁止直接消费（硬性冻结）

任何自动系统不得将 Interpretation 直接作为条件或触发器。

明确禁止以下行为（及所有等价形式）：

IF interpretation.dimension == "water_status"
AND interpretation.description CONTAINS "dry"
THEN irrigate()

以及：

IF interpretation.confidence > X THEN ...

上述逻辑等同于隐式农技决策，明确禁止。

4.2 唯一合法使用路径（冻结）

Interpretation 的唯一合法消费路径为：

Facts
→ Agronomy Interpretation（解释型事实）
→ Decision / Plan / Policy 层（显式）
→ 新的 decision / plan fact
→ 外部 decision authority（人 / policy engine）显式转译
→ Control / AO-ACT / Human

冻结规则：

Interpretation 只能作为输入材料
行动必须由 显式 Decision / Plan / Policy 系统产出
行动结果必须写成 新的事实

补充冻结（防偷渡执行）：

decision_plan_v0 是 candidate for execution，
但 是否、何时、如何 转译为 ao_act_task_v0 永远属于 外部 decision authority（人 / policy engine）。
Interpretation 不得被直接转译为 ao_act_task_v0。

4.3 裁定理由（规范性）

Interpretation 的本质是：

对事实的理解，而不是对行动的授权

允许 Interpretation 直接触发行动，将导致：

农技逻辑被隐式编码
行动责任不可追溯
模型升级风险失控

Ledger 规则（冻结）

agronomy_interpretation_v1 必须以 facts 形式 append-only 写入
不允许修改 / 删除
不允许回写 AO-ACT
不允许旁路写入

冻结总结（裁定级）

本合同冻结以下不可变原则：

Judge 永远不读 Interpretation
Interpretation 永远不直接触发行动
任何行动都必须经过显式 Decision / Plan 层并写成新事实
Interpretation 禁止携带任何决策/控制语义（forbid list 递归拒绝）

违反任一条，视为 系统越权缺陷。

Acceptance 要求（为后续 Sprint 预留）

必须存在 negative acceptance，确保：

注入 Interpretation 后：

Judge 输出与 hash 不发生变化

自动系统：

不得直接以 Interpretation 字段（dimension/description/confidence/meta）作为条件

所有越权路径：

必须被 acceptance 阻断

✅ 状态裁定

Sprint 14 的语义边界已冻结
Interpretation 已被定义为安全可扩展层
系统已具备接入更强模型而不破坏审计性的结构前提