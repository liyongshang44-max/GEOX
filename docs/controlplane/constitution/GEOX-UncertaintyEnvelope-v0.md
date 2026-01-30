GEOX · UncertaintyEnvelope v0

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Descriptive Object + Negative Spec（只读信封对象）

本文件定义一种只用于承载“不确定性来源 + 证据指向”的对象形态。
它的存在目的，是把“不知道什么”从解释文本中剥离为可审计事实，
而不是把不确定性变成判断、排序或行动信号。

0. 文档目的（Purpose）

UncertaintyEnvelope v0 用于：

以对象化方式描述：

系统在某一 ProblemState 下不知道什么

这些未知来自哪些被冻结的来源类型

确保不确定性：

可被引用

可被回放

可被审计

本对象不承担任何“是否可以行动”的含义。

1. 宪法地位（Constitutional Position）

UncertaintyEnvelope 是 ProblemState 的伴随描述对象

它 不独立存在判断意义

它 不进入任何执行、调度、排序或 hash 体系

依赖方向（单向，冻结）：

Evidence / State
        ↓
   ProblemStateV1
        ↓
 UncertaintyEnvelopeV0


明确禁止反向或横向依赖。

2. 对象定义（Contract）
2.1 对象标识

type：固定为 uncertainty_envelope_v0

schema_version：语义版本号（MAJOR.MINOR.PATCH）

2.2 关联锚点（必填）

problem_state_ref

引用一个且仅一个 problem_state_v1

仅用于定位，不得承载任何解释性字段

2.3 不确定性来源列表（核心字段）

uncertainty_sources[]

每一项必须来自：

GEOX-UncertaintySource-Taxonomy-v0.md

不允许重复

不允许排序语义

示例（仅示意，不是实现）：

uncertainty_sources:
  - EVIDENCE_CONFLICT
  - SCALE_POLICY_BLOCKED

2.4 证据指向（可选）

supporting_evidence_refs[]

只允许引用：

Ledger slice

StateVector

ReferenceView

QC Summary

仅用于“为什么我们不知道”

3. 明确禁止的内容（Negative Spec）
3.1 禁止判断暗示

UncertaintyEnvelope 不得包含：

❌ 置信度数值或等级

❌ 严重性描述

❌ 是否“足够好 / 可接受 / 可行动”

3.2 禁止排序与聚合

❌ 不允许对 uncertainty_sources 排序

❌ 不允许计算“总体不确定性”

❌ 不允许推导任何 readiness / gating 信号

本条款直接受制于
GEOX-UncertaintyAggregation-Prohibition.md

3.3 禁止行动含义

❌ 不允许出现：

“建议补观测”

“需要人工介入”

“暂缓 / 可以继续”

UncertaintyEnvelope 不触发任何后续系统行为。

3.4 禁止独立存在

❌ 不允许在没有 ProblemStateV1 的情况下创建

❌ 不允许跨多个 ProblemState 合并

❌ 不允许作为查询入口或队列对象

4. 与其他模块的关系（Hard Separation）
4.1 与 Judge（Apple II）

Judge 不读取 UncertaintyEnvelope

Judge 的输出 不因 Envelope 改变

4.2 与 Agronomy / Decision / Control

不得被消费

不得被解释为：

风险信号

行动前置条件

排序依据

4.3 与 UI

UI 仅可：

展示 Envelope 的存在

原样展示来源枚举

UI 不得：

生成汇总视图

使用颜色 / 图标暗示严重性

5. 为什么必须是“信封”（Rationale）
5.1 信封的隐喻是刻意的

Envelope 的设计含义是：

内容在里面，
但系统 不拆解、不解读、不合并。

5.2 如果不是信封，就会变成工具

任何多一点结构、多一点解释、多一点计算：

都会在工程上被理解为：

“那我们至少可以用它来判断点什么”。

本设计 刻意拒绝这种便利。

6. 冻结声明（Freeze Verdict）

UncertaintyEnvelope v0 是：

描述型

只读

不可聚合

本对象的存在：

不改变系统行为

不缩小不确定性空间

若未来修改本文件：

视为对“不确定性如何被对待”的系统立场改变

必须重新进行宪法级裁定

7. 一句话版本（给工程）

UncertaintyEnvelope 只是一个信封：
系统知道里面装着“不知道”，
但永远不准据此做决定。