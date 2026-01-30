GEOX · UncertaintySource Taxonomy v0

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Normative Vocabulary + Negative Spec（命名宪法）

本文件定义 系统允许使用的不确定性来源词表，
其唯一作用是：命名未知的来源，而不是衡量、比较或利用未知。

0. 文档目的（Purpose）

本文件用于冻结 Uncertainty Source 的唯一合法词表（taxonomy），
以防止系统在后续演进中：

临时发明新不确定性概念

用模糊自然语言暗中表达“严重性 / 可行动性”

通过词义漂移，绕过 Aggregation 禁令

本文件不定义强度、不定义优先级、不定义处理方式。

1. Taxonomy 的地位（Constitutional Position）

本 Taxonomy 是 不确定性的“命名层”

它 先于 UncertaintyEnvelope

它 不服务于任何决策 / 行动 / 调度

一句话定位：

Taxonomy 负责“叫什么”，
不是“多严重”，
更不是“该不该动”。

2. 冻结的不确定性来源枚举（Allowed Set）

系统 只允许 使用以下枚举值来描述不确定性来源：

2.1 Evidence 相关

EVIDENCE_SPARSE
证据数量不足（采样稀疏、覆盖不足）

EVIDENCE_STALE
证据时间陈旧，与当前窗口脱节

EVIDENCE_CONFLICT
多个证据在同一窗口内相互矛盾

2.2 Reference / Policy 相关

REFERENCE_MISSING
关键参考视图或基准不存在

REFERENCE_CONFLICT
多个参考之间不一致，无法对齐

SCALE_POLICY_BLOCKED
因尺度政策限制，推断被显式阻断

2.3 Quality / Health 相关

QC_CONTAMINATION
证据受到质量控制标记影响

SENSOR_HEALTH_DEGRADED
传感器健康状态下降，可靠性未知

3. 严格禁止的扩展（Negative Spec）
3.1 禁止新增枚举（无治理流程）

❌ 不允许在实现中私自新增不确定性来源

❌ 不允许在 UI / 文本中使用未在此列出的来源名

❌ 不允许用自然语言“补充解释型来源”

任何新增来源，必须走宪法级变更流程。

3.2 禁止表达强度或严重性

以下全部禁止：

❌ high / medium / low

❌ strong / weak

❌ critical / minor

❌ primary / secondary

Taxonomy 不允许带有任何 ordinal / ranking 含义。

3.3 禁止与行动、判断挂钩

❌ 不允许定义：

“哪些来源更危险”

“哪些来源可以忽略”

❌ 不允许基于来源类型触发任何系统行为

❌ 不允许将来源类型映射为 gating / readiness

4. 与 Aggregation 禁令的关系（Explicit Binding）

本文件 受制于：

GEOX-UncertaintyAggregation-Prohibition.md

明确声明：

即便所有不确定性来源都被完整列出，
系统也不得：
合并、排序、评分、总结这些来源。

Taxonomy 的存在 不构成 任何聚合许可。

5. 为什么必须冻结 Taxonomy（Rationale）
5.1 语言是最隐蔽的控制入口

如果不冻结来源词表，系统会自然演化出：

“严重证据不足”

“轻微冲突”

“可接受的不确定性”

这在工程上等价于聚合的前半步。

5.2 冻结词表 = 冻结思考空间

当系统只能说：

“存在 EVIDENCE_CONFLICT”

而不能说：

“这是一个严重冲突”

就等于在语言层面阻断了判断生成。

6. 冻结声明（Freeze Verdict）

本 Taxonomy 是 GEOX 系统中
唯一合法的不确定性来源集合

本文件不随模型升级、数据改善而变化

修改本文件：

视为 系统认知框架的改变

必须走 constitution 级别裁定