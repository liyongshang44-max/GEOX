GEOX · Sprint 14
Agronomy Interpretation v1 — Contract（冻结版）

定位：Agronomy Interpretation 是 解释型事实（interpretation fact）
它用于“说明我们如何理解事实”，而不是“决定要做什么”。

0. 合同目标（冻结）

本合同只解决一件事：

如何把 Agronomy 的“理解”表达成一种：

可被阅读

可被引用

可被审计

但不会被误用为决策或控制

的事实形态。

本合同不追求更准确的算法，只冻结语义边界与使用方式。

1. 语义定位（冻结）
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

2. 与 Judge 的关系（冻结裁定）
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

3. Agronomy Interpretation v1（Schema 冻结）
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

dimension
表示解释维度（如 water_status / growth_stage），不是结论标签

description
自然语言解释，仅用于人类或下游系统理解
不具备可执行语义

evidence_refs
指向 raw_sample / marker / ao_act_receipt 等事实
保证解释可回溯

confidence
表示解释置信度
不是行动阈值

4. 与自动系统的关系（冻结裁定）
4.1 禁止直接消费（硬性冻结）

任何自动系统不得将 Interpretation 直接作为条件或触发器。

明确禁止以下行为（及所有等价形式）：

IF interpretation.dimension == "water_status"
AND interpretation.description CONTAINS "dry"
THEN irrigate()


上述逻辑等同于隐式农技决策，明确禁止。

4.2 唯一合法使用路径（冻结）

Interpretation 的唯一合法消费路径为：

Facts
 → Agronomy Interpretation（解释型事实）
   → Decision / Plan / Policy 层（显式）
     → 新的 decision / plan fact
       → Control / AO-ACT / Human


冻结规则：

Interpretation 只能作为输入材料

行动必须由 显式 Decision / Plan 系统产出

行动结果必须写成 新的事实

4.3 裁定理由（规范性）

Interpretation 的本质是：

对事实的理解，而不是对行动的授权

允许 Interpretation 直接触发行动，将导致：

农技逻辑被隐式编码

行动责任不可追溯

模型升级风险失控

5. Ledger 规则（冻结）

agronomy_interpretation_v1 必须以 facts 形式 append-only 写入

不允许修改 / 删除

不允许回写 AO-ACT

不允许旁路写入

6. 冻结总结（裁定级）

本合同冻结以下不可变原则：

Judge 永远不读 Interpretation

Interpretation 永远不直接触发行动

任何行动都必须经过显式 Decision / Plan 层并写成新事实

违反任一条，视为 系统越权缺陷。

7. Acceptance 要求（为后续 Sprint 预留）

必须存在 negative acceptance，确保：

注入 Interpretation 后：

Judge 输出与 hash 不发生变化

自动系统：

不得直接以 Interpretation 字段作为条件

所有越权路径：

必须被 acceptance 阻断

✅ 状态裁定

Sprint 14 的 语义边界已冻结

Interpretation 已被定义为 安全可扩展层

系统已具备 接入更强模型而不破坏审计性的结构前提