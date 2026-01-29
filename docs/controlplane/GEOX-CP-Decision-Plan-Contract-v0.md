GEOX · Sprint 15
Decision / Plan v0 — Contract（冻结版）

本文档定义 Decision / Plan v0 的唯一合法语义、使用边界与系统裁定。
本合同优先级高于任何实现、调度器、UI 或模型逻辑。

0. 合同目标（冻结）

Decision / Plan v0 的目标不是“让系统更自动”，而是：

把解释（Interpretation）转译为“可审计的行动候选”，
但不产生任何执行权、控制权或自动触发能力。

本合同用于防止语义被误用、偷用或隐式升级为控制逻辑。

1. 语义定位（冻结）
1.1 定义

decision_plan_v0 是一种 行动候选事实（candidate for execution）。

它表达的是：

在当前证据与解释基础上

如果要行动

可以考虑哪一种行动形式

1.2 明确非目标（冻结）

Decision / Plan v0 不是：

不是控制指令（control）

不是执行任务（task）

不是调度命令（schedule）

不是农技处方（prescription）

不是自动触发条件（trigger）

2. 核心裁定条款（新增 · 冻结）

这是 Sprint 15 的核心裁定条款，不可弱化、不可绕过。

2.1 Execution Authority 裁定（冻结）

Decision / Plan v0 仅是 execution candidate。

是否、何时、如何将 decision_plan_v0 转译为 ao_act_task_v0：

永远不属于 Decision / Plan 层

永远属于外部 decision authority

外部 decision authority 的合法形式仅包括：

人类（Human）

显式策略系统（Policy Engine）

显式决策系统（Decision System）

2.2 禁止隐式转译（冻结）

以下行为 明确禁止：

将 decision_plan_v0 直接自动转译为 ao_act_task_v0

因 “plan 已足够详细” 而省略 decision authority

在 Scheduler / Control 中内置：

if decision_plan exists → execute


任何此类行为在语义上等同于：

绕过决策责任的隐式控制升级

3. Decision / Plan v0（Schema 冻结）
3.1 record_json.type
decision_plan_v0

3.2 payload（结构冻结，不可扩展执行语义）
{
  "type": "decision_plan_v0",
  "payload": {
    "subject_ref": { "groupId": "..." },

    "proposed_action": {
      "action_type": "IRRIGATE",
      "target": { "kind": "field", "ref": "..." },
      "parameters_hint": { }
    },

    "based_on": {
      "evidence_refs": [ { "fact_id": "..." } ]
    },

    "decision_scope": "proposal",
    "confidence": 0.0,
    "created_at_ts": 0,
    "meta": { }
  }
}

3.3 proposed_action 的语义边界（冻结）

描述 “如果要做，会做什么”

允许与 AO-ACT 的 action_type 对齐

但不具备执行完整性

明确禁止在 Decision / Plan 中出现：

executor

execution_time

资源锁定

执行窗口

自动执行条件

4. 与其他系统的关系（冻结）
4.1 与 Agronomy Interpretation

Decision / Plan 可以引用 interpretation

Interpretation 不得引用 decision

方向单向，不可反转

4.2 与 Judge（硬性禁止）

❌ Judge 不得读取 decision_plan_v0

❌ 不得进入 determinism 输入集

❌ 不得影响 problem_state / ao_sense

4.3 与 AO-ACT（硬性禁止）

❌ Decision / Plan 不得直接生成 AO-ACT task

❌ AO-ACT 不得监听 Decision / Plan 自动执行

5. Ledger 规则（冻结）

decision_plan_v0 必须以 facts 形式写入

append-only

不允许修改 / 删除

不允许回写 AO-ACT / Interpretation

6. 使用规范（给未来系统看的话）
合法使用方式：

人类查看 Decision / Plan → 决定是否执行

AI / Scheduler 读取 Decision / Plan → 作为输入之一

Policy Engine 综合 Decision / Plan + 规则 → 产出新 decision / task

非法使用方式：

把 Decision / Plan 当作“已批准任务”

把 confidence 当作阈值

把 proposed_action 当作控制指令

7. Acceptance 冻结锚点（为下一步准备）

必须可被负向验收断言：

写入 Decision / Plan 后：

Judge 输出不变

AO-ACT index 不变

无任何自动路径从 decision_plan_v0 → ao_act_task_v0

8. 冻结总结（裁定级）

Decision / Plan v0 的本质是：

行动之前，责任仍然在人或显式决策系统那里。

任何绕过该责任的设计，均违反本合同。

状态裁定

Sprint 15 · Contract 已冻结

语义风险已被前置阻断

后续 negative acceptance 可严格对照本合同编写