GEOX · Control Constitution
Rule Storage Policy v0

（规则落盘载体裁定）

Status

Frozen (v0)
本文件一经合并，即成为 高于 Sprint / 实现的治理约束。

1. Purpose（目的）

本文件裁定 Control RuleSet v0 的唯一合法存储形态与演进路径，以防止：

规则在尚未完成治理前被写入 ledger；

规则通过 API / DB 便利路径被“先用再说”；

规则成为隐式决策、排序、调度的污染源。

本裁定的核心目标是：
让规则的存在本身可审计、可冻结、可回滚，但不可被隐式执行。

2. Scope（适用范围）

本裁定适用于以下对象：

control_ruleset_v0（规则资产对象）

任何未来版本的 Control RuleSet，除非被新宪法显式替代

不适用于：

Control Kernel 的运行时行为（已由其他宪法裁定）

AO-ACT / Scheduler / Execution 层

3. SSOT 决定（唯一真源）
3.1 唯一允许的存储载体（v0）

RuleSet v0 的唯一合法落盘载体是：Repo-Const（代码仓库中的受控文件）。

具体形式：

位于代码仓库内的静态文件（如 JSON / YAML）

通过版本控制（git）进行审计、回溯与冻结

在任何使用前，必须通过 control-constitution-validator 的 admission 校验

Repo 是 RuleSet 的 唯一 SSOT，不是 DB，不是 ledger。

4. 明确禁止项（Hard Prohibitions）

在 v0 阶段，以下行为一律禁止：

4.1 禁止写入 Facts / Ledger

❌ 不得将 RuleSet 写入 facts

❌ 不得为 RuleSet 设计任何 ledger schema

❌ 不得为 RuleSet 提供 append / replay / query 能力

理由：
RuleSet 尚不具备“事实性”，其本质是治理资产，而非世界状态。

4.2 禁止提供 List / Query API

❌ 不得提供 /rules, /rulesets 等 list API

❌ 不得提供按 action / project / window 的查询接口

❌ 不得让 UI / Scheduler / Control Plane “发现”规则集合

理由：
任何 list/query 都会诱发“依赖规则存在”的隐式耦合。

4.3 禁止进入任何 Hash 输入集合

RuleSet 不得进入：

❌ determinism_hash

❌ ssot_hash

❌ effective_config_hash

理由：
规则的变化不应改变系统确定性，否则会被误用为配置或决策输入。

4.4 禁止运行时热加载 / 动态修改

❌ 不得通过 API / RPC / UI 修改规则

❌ 不得在运行中切换规则版本

❌ 不得“临时注入”规则用于测试或演示

理由：
规则一旦可动态修改，即失去治理边界。

4.5 Ruleset Reference Anchoring（规则版本锚定 · 冻结）

尽管 RuleSet 明确 不得进入任何系统级 hash（determinism_hash / ssot_hash / effective_config_hash），
ControlVerdict 的可审计性与可回放性仍必须被显式保障。

因此裁定：

Control Kernel 输出的 control_verdict_v0 必须携带 ruleset_ref

ruleset_ref 用于 唯一定位产生该 verdict 的 RuleSet 版本

允许的 ruleset_ref 形式（v0 三选一，择一即可）：

Git commit SHA

Git annotated tag

RuleSet bundle digest（如 SHA256）

严格约束（Hard Constraints）：

ruleset_ref 仅用于审计、回放、差异解释

❌ 不得作为 gating / 排序 / 触发条件

❌ 不得被 Judge / AO-ACT / Scheduler 消费

❌ 不得反向影响 Control Kernel 的求值结果

该锚点的唯一目的，是回答审计问题：
“这个 verdict 是在什么规则版本下产生的？”

5. 明确允许项（Explicit Allowances）

在 v0 阶段，仅允许以下行为：

5.1 静态文件 + Admission 校验

RuleSet 以静态文件形式存在于 repo

在任何被 Control Kernel 使用前：

必须通过 validateControlRuleSetV0

校验失败即拒绝加载

5.2 只读加载（Read-only Consumption）

Control Kernel 仅允许 只读加载 RuleSet

“加载”不等于“执行”

Kernel 不得假设规则一定存在

5.3 RuleSet Absence & Invalidity Semantics（缺失/无效语义 · 冻结）

在 v0 阶段，RuleSet 的存在 不是系统运行的前提条件。

因此裁定：

当 RuleSet 缺失（未提供、未加载）

或 RuleSet admission 校验失败

Control Kernel 的行为必须为：

输出 control_verdict_v0.verdict = UNDETERMINED

不得抛异常、不终止流程、不降级为 DENY

不得尝试 fallback 到历史规则或默认规则

Meta 标注（受限枚举，非解释）：

在上述情况下，Kernel 可以且仅可以在 verdict 中携带枚举型标注：

ruleset_missing

ruleset_invalid

约束：

该标注必须是 枚举值，不得包含自由文本

❌ 不得包含原因描述、调试信息、推理文本

❌ 不得被任何下游系统当作决策输入

缺规则 ≠ 禁止
未知 ≠ 拒绝
未知必须保持未知

6. 与 Execution / AO-ACT 的关系（明确切断）

在 v0 阶段：

RuleSet 不触发 AO-ACT

RuleSet 不生成 ExecutionProposal

RuleSet 不参与 Scheduler 决策

任何将 RuleSet 与执行直接关联的行为，均视为 越权实现。

7. Future Activation Gate（未来解锁条件）

RuleSet 进入 ledger 或参与执行，必须先完成以下治理前置条件（缺一不可）：

新宪法文件，明确：

Rule 的“事实性”定义

Rule 版本变更的可审计语义

ExecutionProposal v1（已冻结）

Control → AO-ACT 的显式桥接宪法

全负向 acceptance（证明不存在隐式执行路径）

在上述条件完成前，任何提前实现视为破坏冻结。

8. Acceptance Checklist（负向验收清单）

以下问题，答案必须全部为 NO，否则视为违规：

是否能通过 API 列出所有规则？

是否能在不改代码的情况下新增规则？

是否能在运行中切换规则？

是否有规则被写入 facts？

是否有 hash 依赖规则内容？

9. Final Statement（最终裁定）

RuleSet v0 是 治理资产，不是运行时状态。
它可以被审计、被冻结、回滚，
但 不可以被“方便地使用”。