GEOX · UncertaintyAggregation 禁令

Status：READY TO FREEZE
Scope：System-wide (Facts / Judge / Agronomy / Decision / Control / UI)
Type：Constitutional Negative Spec（反能力宪法条款）

0. 文档目的（Purpose）

本文件用于永久禁止任何形式的 Uncertainty Aggregation（不确定性聚合） 行为，
以防止系统在工程演进过程中，将“不知道”重新压缩为“看起来可以行动”。

本禁令先于、且高于任何不确定性对象、模型、UI、调度或执行逻辑生效。

1. 定义（Normative Definition）
1.1 什么是 Uncertainty Aggregation（被禁止的对象）

在本系统中，凡满足以下任一条件的行为，均被定义为 Uncertainty Aggregation：

将多个不确定性来源合并为：

一个分数

一个等级

一个“总体可信度 / 总体不确定性”

对不确定性进行：

加权

平均

归一化

排序

基于不确定性结果生成：

gating 条件

readiness / readiness-like 信号

“是否可以进入下一步”的判断

无论表现形式、位置或实现方式如何，均属于聚合。

2. 永久禁止项（Hard Prohibitions）

以下能力在系统中永久禁止，不得实现、不得试验、不得作为内部工具存在。

2.1 数值化与评分

❌ 不确定性分数（score）

❌ 不确定性权重（weight）

❌ 加权平均 / 几何平均

❌ 归一化后的“可信度值”

❌ “confidence index / reliability index / readiness index”

2.2 排序与比较

❌ 按不确定性高低排序对象

❌ “最不确定 / 最确定”的队列

❌ 用不确定性决定展示优先级

❌ 用不确定性决定处理顺序

2.3 门控与前置条件（最关键）

❌ “当不确定性低于 X 时，允许……”

❌ “不确定性已降低到可行动水平”

❌ “证据已足够，可以进入下一阶段”

❌ 将不确定性作为：

Judge 输出的 gating

Decision / Plan 的前置条件

Control 的辅助许可条件

2.4 UI / 解释层变体

❌ 不确定性仪表盘（dashboard）

❌ 红黄绿状态灯

❌ 趋势箭头暗示“正在变好 / 变坏”

❌ 汇总视图中出现“总体不确定性”

3. 明确允许的内容（Clarification, NOT Aggregation）

为避免误读，以下不构成 Uncertainty Aggregation，因而允许存在：

✅ 列出不确定性来源列表（taxonomy）

✅ 独立描述每一类不确定性是否存在

✅ 指向具体证据（EvidenceRef）

✅ 并列展示多个不确定性对象（不比较、不排序）

关键差异不在于“数量”，而在于：
是否试图把多个未知压缩为一个“更可用的结论”。

4. 为什么这是宪法级禁令（Rationale）
4.1 聚合不是中性操作

任何聚合行为，都会在事实上完成一件事：

把“我们不知道什么”
偷换成
“我们大致知道到什么程度”。

这一步一旦发生，系统就已经越过了描述边界。

4.2 聚合会天然生成“行动幻觉”

即便没有明确写出 action：

排序会暗示“先处理谁”

分数会暗示“是否够好”

平均会暗示“整体可接受”

这些都会在工程和组织层面，被自动理解为可行动信号。

4.3 禁止聚合，是对未来系统的保护

本系统的风险不在于现在有人滥用不确定性，
而在于 未来某个“优化看板 / 调度效率 / 产品体验”的动机。

Aggregation 禁令的存在，是为了让：

任何未来工程师

任何模型升级

任何 UI 重构

在试图“顺手做点聚合”时，直接触碰红线。

5. 与后续 Uncertainty Engineering 的关系（Precedence Rule）
5.1 先后顺序（冻结）

本文件（Aggregation 禁令）必须先行冻结

之后才允许：

UncertaintySource Taxonomy

UncertaintyEnvelope

5.2 约束效力

本禁令 优先级高于：

任意 Sprint 目标

任意模型能力

任意产品需求

若未来任何文档 / 代码 / 接口与本禁令冲突：

以本禁令为准

冲突项视为系统越权

6. 冻结声明（Freeze Verdict）

UncertaintyAggregation 在 GEOX 系统中 被永久禁止

本禁令不因模型升级、算法成熟、数据充足而失效

若未来修改本文件：

视为 系统哲学与治理立场发生改变

必须重新进行全系统裁定