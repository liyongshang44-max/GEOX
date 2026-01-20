Apple II · Judge — ReferenceViewV1（对照视图）

Doc ID：GEOX-AII-03
Status：READY TO FREEZE
Applies to：Apple II（Judge）

Depends on：
	•	GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）
	•	GEOX-P0-01 Evidence & QC Policy（FROZEN）
	•	Apple I Phase-5 Evidence Rendering / Series Window Slicing（FROZEN）
	•	GEOX-AII-00-APP-A Enums & Constraints（FROZEN）

────────────────────────────────

一、定位（Constitutional Role）

ReferenceViewV1 不是 Evidence，不是 State，也不是结论。

它是 Apple II 在生成 ProblemState 时允许构建的一种 只读对照视图，用于：
	•	组织参照（baseline / control / neighbor / history）
	•	暴露冲突（REFERENCE_CONFLICT / REFERENCE_MISSING）
	•	为不确定性来源提供可回放引用
（supporting_evidence_refs.kind = reference_view）

硬约束（FROZEN）：
	•	ReferenceViewV1 不得写入 Apple I Evidence Ledger（禁止污染事实账本）
	•	ReferenceViewV1 不得独立生成 ProblemState
（必须是 Evidence / State → ProblemState 的过程组件）
	•	ReferenceViewV1 不得携带控制 / 建议 / 诊断语义
（不出现 risk / allow / deny / should / recommend / cause）
	•	ReferenceViewV1 必须可回放（replayable）：
同一输入与窗口 ⇒ 同一输出

【新增冻结句 · Storage Semantics】
	•	ReferenceViewV1 允许持久化存储，
但仅作为 Apple II 内部派生对象；
存储语义为 append-only（不可修改、不可覆盖），
且 不得回写或影响 Apple I Evidence Ledger。

────────────────────────────────

二、允许的输入（Inputs, FROZEN）

ReferenceViewV1 只能消费以下输入（证据来源）：
	1.	Evidence Ledger（append-only）

	•	raw_sample_v1（metric / ts / value / qc）
	•	marker_v1（人工事实标注）
	•	overlay_v1（维护、设备问题、排除窗等）
	•	QC summary（ok / suspect / bad + exclusion_reason）

	2.	Series / Evidence Rendering（按 window 严格裁剪）

	•	指定 subjectRef + window 的证据切片
	•	不插值、不平滑、不补点
	•	gaps 表示真实缺失

	3.	SpatialUnit & Scale Policy

	•	v1 至少支持 scale = group
	•	不允许跨尺度外推结论
（只能通过 SCALE_POLICY_BLOCKED 声明阻断）

可选输入（非强依赖）：
	•	StateVectorV1（若存在，仅用于“组织视图 / 不确定性说明”）

禁止输入（FROZEN）：
	•	LBCandidateV1（任何形式）
	•	AO / Control 输出（任何形式）
	•	人工主观判断（除 marker_v1 外）

────────────────────────────────

三、ReferenceViewV1 类型（ReferenceViewKindV1, FROZEN）

ReferenceViewV1.kind 枚举：
	1.	WITHIN_UNIT_HISTORY

	•	同一 SpatialUnit 的历史参照（同 metric、同 scale）

	2.	WITHIN_UNIT_CONTROL_SENSOR

	•	同一 SpatialUnit 内的对照传感器 / 对照点视图

	3.	NEIGHBOR_SAME_SCALE

	•	同尺度邻域参照
	•	仅展示对照，不得外推结论

	4.	EXTERNAL_CONTEXT

	•	外部背景参照（如气象）
	•	仅用于冲突提示，不得生成状态或判断

备注（FROZEN）：
	•	kind 只表达“参照来源类型”
	•	不表达可靠性、不表达许可性、不表达优先级

────────────────────────────────

四、ReferenceViewV1 最小对象结构（Minimal Contract）

ReferenceViewV1 是一个可回放对象，最小字段如下（字段名冻结）：
	•	type: 固定 "reference_view_v1"
	•	schema_version: 语义化版本（如 1.0.0）
	•	reference_view_id: 全局唯一（UUID）
	•	created_at_ts: ms
	•	subjectRef: 与 ProblemState 同一 SpatialUnit
	•	scale: 字符串（必须符合 Scale Policy）
	•	window:
	•	startTs (ms)
	•	endTs (ms)
	•	kind: ReferenceViewKindV1
	•	metric: string
（v1 强制单指标，防止语义走私）
	•	primary_series_ref: EvidenceRef
（主序列来源，必须可回放）
	•	reference_series_ref: EvidenceRef
（参照序列来源，必须可回放）
	•	comparison_summary: object（见第五节）
	•	notes: 可选（中性）

硬约束（FROZEN）：
	•	ReferenceViewV1 不得包含 risk_level / recommendation / action / cause 等字段（含同义）

【新增冻结句 · Failure Semantics】
	•	ReferenceViewV1 本身不得表达“失败 / 不可用 / 无效”结论；
参照失败只能通过 ReferenceView 缺席 + ProblemState（REFERENCE_MISSING） 表达。

────────────────────────────────

五、comparison_summary（中性对比摘要, FROZEN）

comparison_summary 只允许表达 中性统计 / 形态描述。

允许字段（建议但不强制）：
	•	overlap_ratio: 0..1
	•	primary_sample_count: int
	•	reference_sample_count: int
	•	qc_mix_primary: { ok_pct, suspect_pct, bad_pct }
	•	qc_mix_reference: { ok_pct, suspect_pct, bad_pct }
	•	delta_hint:
	•	label: aligned | diverging | unknown
	•	magnitude: number | null
	•	conflict_hint:
	•	label: none | possible | clear | unknown
	•	basis_refs: EvidenceRef[]

禁止（FROZEN）：
	•	原因解释
	•	行动暗示
	•	合规 / 许可 / 风险暗示

────────────────────────────────

六、EvidenceRef 对齐规则（FROZEN）

当 ProblemState / AO-SENSE 引用 ReferenceView：
	•	EvidenceRef.kind = “reference_view”
	•	EvidenceRef.ref_id = reference_view_id

ReferenceViewV1 内部的 series_ref 必须是可回放引用，允许两种方式之一：

方式 A（推荐）：ledger_slice
方式 B：series_query snapshot

硬约束（FROZEN）：
	•	ref_id 必须足以 重放相同证据切片
	•	禁止 UI 状态或自然语言描述作为 ref_id

────────────────────────────────

七、生成规则（Assembly Rules, FROZEN）
	•	ReferenceView 仅能在 Apple II Judge 内部生成
	•	不得跨尺度推导
	•	无法构建参照 → 不生成伪参照
	•	直接触发：
	•	ProblemState: REFERENCE_MISSING
	•	uncertainty_sources: REFERENCE_NOT_AVAILABLE

对照冲突最低触发条件（中性）：
	•	在有效重叠区间出现稳定偏离形态
	•	且不能被 QC 问题解释

────────────────────────────────

八、与 AO-SENSE 的接口（FROZEN）
	•	ReferenceView 不直接生成 AO-SENSE
	•	只能作为 ProblemState 的 supporting evidence
	•	AO-SENSE 必须绑定 problem_state_id

────────────────────────────────

九、验收标准（READY）
	•	可回放
	•	不越权
	•	不替代 ProblemState
	•	至少 2 个 Golden fixtures：
	•	REFERENCE_MISSING
	•	REFERENCE_CONFLICT / possible conflict

────────────────────────────────

十、冻结声明（Freeze Rule）
	•	新增 kind / 字段必须 bump MINOR 或 MAJOR
	•	引入控制 / 建议 / 诊断语义 ⇒ 越权（Apple III）
	•	ReferenceViewV1 永远是 对照视图，不是事实，不是控制信号
