GEOX · Control → AO-ACT
Instantiation · Non-Goals v0（裁决到执行的反能力清单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Negative Spec（执行实例化反能力）

0. 文档定位（必须先读）

本文件定义的是：
从 Control 层到 AO-ACT 执行层的“不可做之事”。

它的目标不是描述“如何把裁决变成执行”，
而是在执行尚未启动之前，提前封死所有容易导致隐式执行、自动化滑坡、责任转移的路径。

这是 Control 与 Execution 之间的最后一道治理防线。

1. 核心裁定（一句话）

Control 层的任何产出，都不得自动或隐式实例化为 AO-ACT 的执行任务。

裁决 ≠ 执行。
允许存在“间隔”，不允许存在“直通”。

2. Control → AO-ACT 明确不具备的能力（Non-Goals）
2.1 不存在自动实例化（No Auto-Instantiation）

Control 层 不允许：

根据 ControlVerdict 自动生成 AO-ACT task

根据 ALLOW 判定“顺手”下发执行

将 DENY / UNDETERMINED 转换为任何执行动作

裁定：
❌ 不存在 verdict → task 的自动映射。

2.2 不存在隐式实例化（No Implicit Mapping）

Control 层 不得：

通过默认配置、约定、命名规则

通过“如果只有一个可能行动就直接做”

通过“ALLOW 即可执行”的隐式语义

把裁决结果变成执行行为。

裁定：
❌ 不允许任何“看起来没问题”的快捷路径。

2.3 不填充执行参数（No Parameter Filling）

Control 层 不负责：

执行路径

剂量 / 强度

路线 / 轨迹

设备 / 执行体选择

时间计划

即便这些信息在系统中“看起来已经存在”。

裁定：
❌ Control 层不得构造或补齐 AO-ACT task 的任何参数字段。

2.4 不推断执行意图（No Intent Inference）

Control 层 不推断：

“既然允许了，应该执行”

“现在正是好时机”

“这是唯一合理的下一步”

Control 只裁决规则，不推断意图。

裁定：
❌ Control 层不得表达或暗示执行意图。

3. 明确禁止的输入与触发路径
3.1 不读取 AO-ACT 执行对象（No Back-Reference）

Control 层 不得读取：

ao_act_task

ao_act_receipt

执行状态

执行结果

执行事实不得反向影响裁决与实例化决策。

3.2 不被 AO-ACT 反向触发（No Reverse Trigger）

AO-ACT 不得：

因执行失败请求 Control 重新裁决

因执行成功要求 Control 自动继续

形成“执行 → 再裁决 → 再执行”的闭环

裁定：
❌ 不存在 Control ↔ AO-ACT 的自动反馈回路。

4. 不承担调度与编排责任（No Scheduling / Orchestration）

Control 层 不负责：

调度时机

执行顺序

多任务编排

资源冲突处理

这些能力若未来存在，必须属于：

人类决策层

或独立的 Scheduler（非 Control、非 Kernel）

裁定：
❌ Control 层不具备 orchestration 能力。

5. 不承担责任转移（No Responsibility Shift）
5.1 不为执行结果背书

Control 裁决 不等价于：

安全保证

成功保证

风险兜底

即便裁决为 ALLOW，
执行责任仍属于执行决策者与执行系统。

5.2 不消除人类责任

任何设计不得使人类可以声称：

“系统已经允许了，所以我只是照做。”

裁定：
❌ Control 层不得成为责任卸载工具。

6. 禁止的工程捷径（Explicit Anti-Patterns）

以下工程行为一律禁止：

❌ 在 Control 代码中 import AO-ACT task schema

❌ 在 Kernel 中生成 AO-ACT payload

❌ 在 API 层提供 /control/execute 之类的接口

❌ 在 UI 中把 ControlVerdict 直接渲染为“执行按钮”

7. 允许存在的最小连接（Clarification）

本文件并不禁止未来存在以下中介层：

人类确认界面（Human-in-the-Loop）

明确标注为“提议/草案”的 Execution Proposal 对象

离线审批流程

但这些都不属于 Control → AO-ACT 的直接实例化，
且必须有各自独立的宪法约束。

8. 冻结声明（Freeze Verdict）

本文件冻结了 Control → AO-ACT 的反能力边界

任何自动化、隐式化、快捷化实例化行为：

视为治理级越权

必须回滚实现，而非修改宪法

修改本文件：

等同于放弃“人类最终决策权”的结构保障

必须进行全局裁定

9. 一句话版本（给未来实现者）

Control 只能说“规则上行不行”，
永远不能说“那就去做”。
