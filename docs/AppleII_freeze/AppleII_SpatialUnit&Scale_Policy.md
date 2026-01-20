────────────────────────────────
🍎 GEOX-P0-00 — SpatialUnit & Scale Policy（MINIMUM, READY TO FREEZE）
Doc ID：GEOX-P0-00
Status：READY TO FREEZE
Applies to：Apple I / Apple II / Apple III
Scope：Identity Anchoring & Cross-Scale Constraints

冻结声明（Constitutional Statement）

本政策冻结 GEOX 的“空间身份锚点”与“尺度边界”。
所有输出对象（Evidence / StateVector / ProblemState / ReferenceView / AO-SENSE / Control）必须锚定到一个明确 SpatialUnit 与 scale。
禁止跨尺度外推结论。
	1.	核心定义（FROZEN）

1.1 SpatialUnit
SpatialUnit 是系统判读与控制的唯一空间锚点单位。
在同一时间窗内，任何一次判断（ProblemState）必须发生在一个明确 SpatialUnit 内。

1.2 scale
scale 是 SpatialUnit 的类型/层级枚举值。
v1 最小支持：
	•	group
后续可扩展（plot/block/zone(see doc/AppleII for full text)）必须走版本升级。

1.3 subjectRef（Identity Anchor）
subjectRef 是对象的身份锚定字段，只允许携带身份 ID，不允许携带语义字段。
v1 允许字段：
	•	projectId（必填）
	•	groupId（可选，但当 scale=group 时建议必填）
	•	plotId（可选）
	•	blockId（可选）

禁止：在 subjectRef 内出现 risk/advice/control/action/cause 等语义字段（含同义表达）。
	2.	单尺度判读原则（FROZEN）

2.1 单次判读范围
	•	Apple II 的每一个 ProblemStateV1 只能锚定一个 scale 的一个 SpatialUnit。
	•	Apple II 可以“并列展示参照/对照”，但不得跨尺度生成本体判断。

2.2 跨尺度限制
	•	禁止跨尺度外推结论（例如用 plot 推 group 的状态，或用 group 推 block 的状态）。
	•	允许生成 ProblemStateType：SCALE_POLICY_BLOCKED，用于声明“被尺度策略阻断”，但不得输出任何推断结论。

	3.	ReferenceView 的尺度约束（FROZEN）

	•	ReferenceView.kind=NEIGHBOR_SPATIAL_UNIT 仅允许同尺度的邻域对照。
	•	禁止使用不同 scale 的参照来生成“同尺度”的 ProblemState（只能作为展示，不得成为判断证据）。

	4.	版本与治理（FROZEN）

	•	新增 scale 或 subjectRef 字段必须版本升级，不得静默扩展。
	•	若实现层发现未知 scale，必须降级：
	•	不生成跨尺度判断
	•	允许生成 SCALE_POLICY_BLOCKED 或 UNKNOWN 类不确定性声明

────────────────────────────────