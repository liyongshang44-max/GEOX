GEOX · Control Kernel
Non-Goals v0（确定性求值引擎 · 反能力清单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Negative Spec（执行引擎反能力定义）

0. 文档定位（必须先读）

本文件定义的是：Control Kernel 永远不允许具备的能力。

Control Kernel 的唯一职责是：

在给定输入与既定裁决规则下，做确定性求值。

它不是智能体、不是策略引擎、不是解释器、不是优化器。
任何超出“确定性求值”的能力，都会把系统重新拖回隐式决策与不可审计。

1. Control Kernel 的角色边界（一句话）

Control Kernel 是一个纯求值器（pure evaluator），
不是一个会“想办法”的组件。

2. Control Kernel 明确不具备的能力（Non-Goals）
2.1 不进行任何形式的推理（No Reasoning）

Control Kernel 不进行：

归纳推理

演绎推理

概率推理

情境理解

模糊匹配

它不“理解规则”，只执行规则。

裁定：
❌ Control Kernel 不得包含推理、搜索、规划或逻辑证明能力。

2.2 不解释输入（No Interpretation）

Control Kernel 不解释：

ProblemState 的语义含义

Uncertainty 的来源意义

PermissionSet 的形成原因

它只把输入当作结构化事实。

裁定：
❌ Control Kernel 不得将输入字段解释为“更高层语义”。

2.3 不解决不确定性（No Uncertainty Resolution）

Control Kernel 不做：

不确定性消解

置信度压缩

不确定性聚合

不确定性转风险等级

即使规则中出现“不确定性相关条件”，
Kernel 也只是机械判断条件是否成立。

裁定：
❌ Control Kernel 不得引入任何不确定性处理算法。

2.4 不优化、不比较、不选择（No Optimization / Selection）

Control Kernel 不做：

行动方案比较

多方案择优

成本/收益权衡

风险/回报平衡

Kernel 不会问“哪个更好”。

裁定：
❌ Control Kernel 不得输出排序、评分、推荐或“最优解”。

2.5 不生成新规则（No Rule Creation）

Control Kernel 不允许：

动态生成规则

调整规则参数

学习或更新规则

规则条件的自动修正

规则是 Control Constitution 的专属职责。

裁定：
❌ Kernel 不得成为“活规则”的宿主。

3. 明确禁止的输入行为（Input-side Non-Goals）
3.1 不读取宪法之外的输入

Control Kernel 不得直接读取：

Evidence / raw data

Agronomy Interpretation

Decision / Plan

AO-ACT / AO-SENSE 对象

UI / 人工输入

Kernel 的输入集合 完全继承
GEOX-ControlConstitution-AllowedInputs-v0.md。

裁定：
❌ Kernel 不得扩展或绕过输入白名单。

3.2 不派生中间状态

Kernel 不得：

从输入计算新的“状态对象”

生成派生指标

保存中间判断结果供后续复用

裁定：
❌ Kernel 是单次求值、无状态的。

4. 明确禁止的输出行为（Output-side Non-Goals）
4.1 不生成任务或执行指令

Control Kernel 不生成：

AO-ACT task

执行参数

调度指令

机器动作

Kernel 的输出 不是行动，只是裁决结果。

裁定：
❌ Kernel → 执行 的直接路径永久禁止。

4.2 不触发任何副作用（No Side Effects）

Kernel 不允许：

写数据库

修改 ledger

触发事件

调用外部服务

发送通知

裁定：
❌ Kernel 必须是纯函数（no side effects）。

4.3 不输出解释或理由文本

Kernel 不输出：

人类可读解释

原因分析

决策说明

风险描述

解释属于上游或外部系统，不属于求值器。

裁定：
❌ Kernel 不得成为“解释生成器”。

5. 时间与上下文约束（Temporal & Context Limits）
5.1 不跨时间窗口

Kernel 不得：

回看历史窗口

预测未来窗口

合并多个 window

每次求值只针对一个明确 window。

5.2 不跨主体上下文

Kernel 不得：

跨 subjectRef 汇总

引入其他地块/设备/项目的信息

裁决是局部、封闭、上下文严格限定的。

6. 与 Control Constitution 的关系裁定
6.1 Constitution 高于 Kernel

Constitution 定义规则

Kernel 只执行

Kernel 不得因为实现复杂度要求修改 Constitution。

6.2 Kernel 不得反向塑造治理哲学

不得通过代码技巧“补齐”宪法未定义的行为

不得通过默认值、fallback 逻辑偷渡决策语义

裁定：
❌ Kernel 不得成为治理立场的隐形来源。

7. 违规的系统性风险（Why This Matters）

一旦 Kernel 具备以下任一能力：

推理

优化

解释

学习

副作用

系统就会从：

“可审计的裁决系统”

退化为：

“不可追责的隐式决策系统”

本文件的存在目的，是在代码出现之前，先把这条路封死。

8. 冻结声明（Freeze Verdict）

本文件定义了 Control Kernel 的永久反能力边界

任何实现若违反本文件：

属于架构级越权

必须回滚实现，而非修改宪法

修改本文件：

等同于修改系统治理根本假设

必须进行全局裁定

9. 一句话版本（给未来实现者）

Control Kernel 不是一个“聪明的地方”，
它只是一个“不犯错的地方”。