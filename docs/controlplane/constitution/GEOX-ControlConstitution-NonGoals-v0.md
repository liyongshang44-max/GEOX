GEOX · Control Constitution
Non-Goals & Negative Scope v0（裁决层非目标清单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Negative Spec（裁决层反能力定义）

0. 文档定位（非常重要）

本文件不定义 Control Constitution 做什么，
而是一次性裁定它永远不做什么。

它的目的，是在 Control Constitution / Control Kernel 正式启动之前，
提前封死那些工程上“看起来很自然”、但会污染整个系统的路径。

这是 Control 层的“刹车系统”，不是发动机。

1. Control Constitution 的角色边界（一句话）

Control Constitution 只负责：
在已被净化的输入之上，定义“裁决规则的合法空间”。

它不是解释层，不是推理层，不是策略层，更不是执行层。

2. Control Constitution 明确不解决的问题（Non-Goals）
2.1 不解释世界（No Interpretation）

Control Constitution 不解释：

发生了什么

为什么会这样

风险来自哪里

哪种理解更合理

这些问题已经且只能在以下层解决：

Evidence / State

ProblemState

Agronomy Interpretation

Uncertainty（Taxonomy / Envelope）

裁定：
❌ Control Constitution 不得包含任何解释性语言或结构。

2.2 不减少不确定性（No Uncertainty Resolution）

Control Constitution 不做任何不确定性消解：

不判断证据是否“已经足够”

不判断冲突是否“可以忽略”

不判断不确定性是否“下降到可行动水平”

这些能力在系统中被永久禁止或已被宪法锁死。

裁定：
❌ Control Constitution 不得引入任何形式的“不确定性阈值”“可信度门槛”。

2.3 不提供建议或优先级（No Recommendation / Priority）

Control Constitution 不输出：

推荐行动

首选方案

行动顺序

优先级列表

即便在语义上“只是规则”，
一旦出现优先级，就已经在替人做选择。

裁定：
❌ Control Constitution 不得包含 priority / ranking / suggestion 语义。

2.4 不决定“是否应该行动”（No Should）

Control Constitution 不回答：

是否应该动

是否现在就动

是否值得动

它只回答一种问题（未来）：

在给定条件下，某类行动是否在规则上被允许 / 被否决。

裁定：
❌ Control Constitution 不得出现 should / recommend / best / advisable 等词。

3. 明确禁止的输入（Input Prohibitions）
3.1 不直接读取 Evidence / Raw Data

Control Constitution 不得直接读取：

raw samples

sensor series

marker 明细

原始 QC 结果

理由：
一旦直接读 evidence，裁决层就会开始“自己判断世界”。

裁定：
❌ Evidence → Control Constitution 的直接依赖路径永久禁止。

3.2 不读取 Agronomy Interpretation 的内容

即便 Agronomy Interpretation 是 explain-only：

Control Constitution 也不得读取其文本、结论或措辞

原因：
解释语言天然带有价值取向，会反向污染裁决规则。

裁定：
❌ Interpretation → Control Constitution 内容依赖永久禁止。

3.3 不读取 Decision / Plan 对象

即便 Decision / Plan 已存在化：

Control Constitution 不得读取其字段

不得以其为输入或上下文

原因：
否则裁决层会变成“验证计划是否合理”的工具。

裁定：
❌ Decision / Plan → Control Constitution 依赖永久禁止。

3.4 不绕过 PermissionSet

Control Constitution 不得：

自行推断行动空间

自行引入 AO

自行扩大或缩小可考虑行动集合

它只能在 PermissionSet v0 已声明的空间内进行裁决。

裁定：
❌ Control Constitution 不得拥有行动空间定义权。

4. 明确禁止的输出（Output Prohibitions）
4.1 不生成任务（No Task Generation）

Control Constitution 不生成：

AO-ACT task

任务模板

执行参数

它输出的最多是：裁决结果或裁决约束（具体对象以后定义）。

裁定：
❌ Control Constitution → Task 的直接输出永久禁止。

4.2 不触发执行或调度（No Trigger）

不触发 Scheduler

不触发 Executor

不触发补观测

裁决 ≠ 行动。

裁定：
❌ Control Constitution 不得具有任何触发能力。

4.3 不生成新的语义对象

Control Constitution 不创造新概念：

不发明新风险类型

不发明新不确定性

不发明新行为类别

它只在既有、冻结的对象体系上工作。

裁定：
❌ 裁决层不得成为“语义发源地”。

5. 与 Control Kernel 的分工边界
5.1 Constitution ≠ Kernel

Constitution：

定义 规则存在的合法空间

Kernel：

在给定输入下 确定性地执行这些规则

Constitution 不写执行逻辑，Kernel 不写规则语义。

5.2 禁止 Kernel 反向塑造 Constitution

在后续阶段，必须遵守：

Kernel 不得因为“实现困难”要求修改宪法规则

Kernel 不得隐式补充宪法未定义的行为

裁定：
❌ 实现便利性不得反向塑造裁决规则。

6. 冻结声明（Freeze Verdict）

本文件定义了 Control Constitution 的永久非目标集合

任何未来规则、代码或接口：

若触及本文件禁止项

视为裁决层越权

修改本文件：

等同于修改系统治理哲学

必须进行全局裁定

7. 一句话版本（给未来的你和工程师）

Control Constitution 不是用来判断世界是否“足够好”，
而只是用来声明：
在规则上，哪些事无论如何都不能做。