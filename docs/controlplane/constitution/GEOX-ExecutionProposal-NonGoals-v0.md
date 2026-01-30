GEOX · Execution Proposal
Non-Goals v0（执行提议层 · 反能力清单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Negative Spec（执行前缓冲层反能力）

0. 文档定位（必须先读）

Execution Proposal 层的存在目的只有一个：

承载“可能的执行想法”，
而不是“正在发生的执行行为”。

本文件定义的是：
Execution Proposal 永远不允许具备的能力，
以防止它成为 Control 与 AO-ACT 之间的“影子执行通道”。

1. 核心裁定（一句话）

Execution Proposal 只能是“提议的记录对象”，
不能是“可被直接执行的对象”。

2. Execution Proposal 明确不具备的能力（Non-Goals）
2.1 不具备执行性（No Executability）

Execution Proposal 不得：

被任何系统组件直接执行

被 AO-ACT 读取并转化为 task

被 Scheduler 当作执行输入

裁定：
❌ Execution Proposal ≠ Execution Task。

2.2 不具备自动生成能力（No Auto-Proposal）

Execution Proposal 不得：

由 ControlVerdict 自动生成

由规则命中时“顺手产生”

作为 Kernel 的输出之一

其生成必须是显式、有意识、可追责的动作。

裁定：
❌ 不存在 verdict → proposal 的自动路径。

2.3 不承担策略或规划职能（No Strategy / Planning）

Execution Proposal 不负责：

选择“最好的”执行方案

在多个方案中做权衡

规划执行顺序或节奏

合并多个执行想法

它不是 Planner，不是 Optimizer。

裁定：
❌ Proposal 层不做策略。

2.4 不填充完整执行参数（No Full Parameterization）

Execution Proposal 不得：

填齐 AO-ACT 所需的全部执行参数

指定精确剂量、路径、轨迹、时刻

锁定具体执行设备或执行体

否则 Proposal 将不可避免地被“顺手执行”。

裁定：
❌ Proposal 必须保持参数不完备性。

3. 不承担调度与触发责任（No Scheduling / Triggering）

Execution Proposal 不负责：

执行时机判断

条件触发

批量下发

重试、回滚、补偿

裁定：
❌ Proposal 层不得触发任何时间或事件。

4. 不承担责任转移（No Responsibility Laundering）
4.1 不为执行背书

Execution Proposal 不得被解读为：

已批准

已确认

已安全评估完成

它只是一个尚未发生的想法记录。

4.2 不消解人类责任

任何系统设计不得使人类可以声称：

“这是系统自动生成的提议，所以我只是照着执行。”

裁定：
❌ Proposal 层不得成为责任漂白工具。

5. 明确禁止的工程反模式（Anti-Patterns）

以下行为一律禁止：

❌ Proposal 结构与 AO-ACT task schema 高度相似

❌ 在 Proposal 中复用 AO-ACT 参数命名

❌ 提供“一键执行 Proposal”的 API

❌ 在 UI 中把 Proposal 渲染为“待执行任务”

❌ 用 Proposal 数量、频率、状态驱动执行决策

6. 允许存在但不在本层定义的能力（Clarification）

本文件不禁止未来系统中存在：

人类审批流程

法律 / 合规 / 安全审查节点

外部调度系统

但这些都不属于 Execution Proposal 层本身，
且必须有各自独立的宪法约束。

7. 与 Control / AO-ACT 的边界裁定

Control 层：

不生成 Proposal（除非显式人工动作）

AO-ACT 层：

不读取 Proposal

不感知 Proposal 的存在

Execution Proposal 层是逻辑隔离层，不是中转站。

8. 冻结声明（Freeze Verdict）

本文件冻结了 Execution Proposal 层的反能力边界

任何使 Proposal 具备执行性、自动性、完整性的设计：

视为治理级越权

修改本文件：

等同于改变“人类在执行前的主权位置”

必须进行全局裁定

9. 一句话版本（给未来实现者）

Execution Proposal 是“想法的档案”，
不是“任务的队列”。