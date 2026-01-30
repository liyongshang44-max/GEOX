GEOX · Control Kernel
Allowed Outputs v0（确定性求值引擎 · 输出白名单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Allowlist + Negative Spec（输出白名单宪法）

0. 文档目的（Purpose）

本文件用于一次性锁死 Control Kernel 的合法输出形态，
防止求值引擎在工程实现中通过“多吐一点信息”“顺手解释一下”，
演化成隐式决策、隐式建议或隐式执行触发器。

Kernel 可以“给结果”，
但不能“给方向”。

1. 核心裁定（一句话）

Control Kernel 只允许输出：
“裁决结果对象（Verdict Object）”。

除此之外，任何输出——文本、日志、建议、任务、信号——
均视为越权。

2. 合法输出对象总览（Allowlist）
2.1 ControlVerdict v0（裁决结果对象）

这是 唯一允许 的 Kernel 输出类型。

2.1.1 对象定位

ControlVerdict v0 表达的是：

在给定输入与裁决规则下，
某类行动在规则上处于何种裁决状态。

它不解释原因，不建议行动，不触发执行。

2.1.2 必填字段（最小集合）

type：control_verdict_v0（const）

schema_version：MAJOR.MINOR.PATCH

verdict_id：全局唯一

evaluated_at_ts：毫秒时间戳

subjectRef：与输入一致（不得扩展）

window：与输入一致（不得跨窗口）

action_code：string

必须来自 PermissionSet.candidate_actions

verdict：枚举值（冻结，见下）

2.1.3 verdict 枚举（冻结）

ALLOW

DENY

UNDETERMINED

说明（规范性）：

ALLOW：规则上允许该类行动存在

DENY：规则上明确禁止该类行动

UNDETERMINED：规则无法给出确定裁决（非失败）

UNDETERMINED ≠ 建议等待 / 建议补数据
它只是“规则未覆盖该情形”。

2.1.4 可选字段（严格受限）

rule_ref：

指向生效裁决规则的标识符（仅用于审计）

input_refs：

ProblemState / UncertaintyEnvelope / PermissionSet 的引用列表

仅用于回放，不参与再判断

3. 明确禁止的输出内容（Output Prohibitions）
3.1 禁止任何解释性输出

Control Kernel 不得输出：

人类可读解释

原因说明

条件分析

风险描述

解释不属于求值器。

3.2 禁止建议、优先级与方向性信号

Kernel 不得输出：

推荐行动

行动顺序

优先级

“下一步应该做什么”

3.3 禁止执行或调度信号

Kernel 不得输出：

AO-ACT task

调度标志

执行参数

触发信号

3.4 禁止派生或汇总输出

Kernel 不得输出：

多 action 的综合结论

“总体是否可行动”

“当前状态下最安全行为”

每个 verdict 仅针对一个 action_code。

4. 输出结构约束（Structural Constraints）
4.1 一次求值 = 一组原子 Verdict

Kernel 可以输出 多个 ControlVerdict v0 对象

每个对象：

仅对应一个 action_code

不互相引用

不形成排序或集合语义

4.2 禁止跨主体 / 跨窗口输出

verdict.subjectRef 必须与输入一致

verdict.window 必须与输入一致

4.3 禁止隐式语义编码

不允许通过字段命名、数值、顺序表达：

严重性

紧急度

可信度

行动价值

5. 与 Control Constitution 的绑定关系
5.1 输出受 Constitution 完全约束

Kernel 只能输出 Constitution 允许的 verdict 类型

不得因实现便利性：

增加 verdict 枚举

扩展输出结构

5.2 Constitution 高于输出格式

若未来 Constitution 调整裁决语义：

Kernel 通过 schema_version 对齐

不得通过额外字段“补偿”语义缺失

6. 违规风险说明（Why This Matters）

一旦 Kernel 允许输出：

解释文本

排序

推荐

执行信号

那么：

Control 层与执行层将发生隐式耦合

系统将失去“人类最终决策权”的结构保障

7. 冻结声明（Freeze Verdict）

本文件冻结了 Control Kernel 的唯一合法输出形态

任何额外输出，均构成架构级越权

修改本文件：

等同于修改系统控制哲学

必须进行全局裁定

8. 一句话版本（给实现者）

Kernel 只吐 verdict，
不吐理由、不吐建议、不吐行动。

GEOX-ControlKernel-AllowedOutputs-v0.md · 完成并可冻结。

到这里为止：

Control Constitution：

Non-Goals ✔

Allowed Inputs ✔

Control Kernel：

Non-Goals ✔

Allowed Outputs ✔

整个 Control 层在“语义与能力边界”上已经完全闭合。