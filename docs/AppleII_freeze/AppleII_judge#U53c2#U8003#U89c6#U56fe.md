Apple II · Judge — ReferenceViewV1
Doc ID：GEOX-AII-03
Status：READY TO FREEZE
Applies to：Apple II（Judge）

Depends on：
	•	GEOX-AII-00 Apple II · Judge Design Overview
	•	GEOX-AII-00-APP-A Enums & Constraints
	•	GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）
	•	GEOX-P0-01 Evidence & QC Policy（FROZEN）
	•	Apple I Phase-5 Evidence Ledger & Series API

────────────────────────────────

冻结声明（Constitutional Statement）

ReferenceViewV1 是 Apple II（Judge）内部使用的中性参照证据对象，
用于在必要时组织“对照/参照视图”，以支持 ProblemStateV1 的形成与审计。

ReferenceViewV1 本身：
	•	不是判断结果
	•	不是问题态
	•	不是失败声明
	•	不具备任何控制、建议或裁决语义

所有关于“参照是否缺失 / 冲突 / 不可用”的断言，
只能由 ProblemStateV1 表达，ReferenceViewV1 不得越权。

────────────────────────────────
	1.	定位（Role Definition）

ReferenceViewV1 表达的是：

在给定 SpatialUnit、尺度与时间窗条件下，
系统如何构建一个可回放的对照证据视图。

它仅描述事实性信息，例如：
	•	参照证据来自哪里
	•	覆盖了多少
	•	质量状况如何
	•	是否可被回放

ReferenceViewV1 不回答：
	•	对照是否“足够”
	•	对照是否“失败”
	•	对照是否“可用于决策”

────────────────────────────────
2. 生成前提（Input Scope）

ReferenceViewV1 只能基于以下输入生成：
	•	Apple I Evidence Ledger（raw_sample / qc / marker / overlay）
	•	Apple I Series API（严格时间窗切片）
	•	SpatialUnit & Scale Policy（P0-00）
	•	Evidence & QC Policy（P0-01）
	•	固定时间窗 {startTs, endTs}

明确禁止作为输入：
	•	ProblemStateV1
	•	LBCandidateV1
	•	AO / Control / 执行结果
	•	任何行动、许可或裁决信息

ReferenceView 是证据组织资产，而非判断对象。

────────────────────────────────
3. 持久化规则（Persistence Rule, FROZEN）
	•	ReferenceViewV1 允许独立持久化，但仅限于 Apple II（Judge）自有存储。
	•	ReferenceViewV1 禁止写入 Apple I Evidence Ledger。
	•	若被持久化，ReferenceViewV1 必须是 append-only，并可被回放。

存储语义说明：
	•	ReferenceViewV1 可以是临时生成对象；
	•	但一旦其 reference_view_id 被 ProblemStateV1 引用，
在约定保留期内 必须可解析、可回放、可审计。

────────────────────────────────
4. 唯一性约束（Uniqueness Rule, FROZEN）

ReferenceViewV1 的自然唯一键定义为：

{ subjectRef, scale, window.startTs, window.endTs, kind, metric }

冻结规则（v1）：
	•	对于同一自然唯一键，Judge 最多生成 1 个 ReferenceViewV1。
	•	v1 不允许为同一 key 生成多个 ReferenceView 并并列引用。

该规则用于防止参照视图爆炸，保证审计与 replay 的可控性。

────────────────────────────────
5. 参照选择规则（Selection Rule, FROZEN, v1）

当存在多个潜在参照来源时，Judge 必须使用确定性规则选择唯一一个：

优先级（高 → 低）：
	1.	覆盖率最高（overlap_ratio 最大）
	2.	QC 质量最佳（ok% 高、bad% 低）
	3.	时间窗内无维护/排除类 marker
	4.	字典序最小的 sensor_id / ref_id（最终兜底）

同一输入重复执行，选择结果必须一致。

────────────────────────────────
6. 失败语义边界（Failure Semantics Rule, FROZEN）

ReferenceViewV1 不得：
	•	声明 “参照缺失 / 参照失败 / 不可用”
	•	输出 status = missing / failed / unavailable
	•	表达任何判断性、结论性语言

ReferenceViewV1 仅允许表达中性事实，例如：
	•	样本点数
	•	覆盖比例
	•	QC 分布
	•	差异统计值

任何以下断言：
	•	参照缺失
	•	参照冲突
	•	参照不可用

必须由 ProblemStateV1 表达（如 REFERENCE_MISSING / REFERENCE_CONFLICT），
ReferenceViewV1 只能作为 supporting evidence。

────────────────────────────────
7. ReferenceViewKindV1（枚举，FROZEN, v1）

v1 允许的 kind 枚举仅包括：
	•	CONTROL_SENSOR
同一 SpatialUnit 内的对照传感器
	•	NEIGHBOR_SPATIAL_UNIT
同尺度、邻接 SpatialUnit
	•	HISTORICAL_SAME_UNIT
同一 SpatialUnit 的历史同类时间窗

冻结规则：
	•	v1 禁止新增 kind
	•	kind 扩展必须走版本升级
	•	v1 强制单 metric：一个 ReferenceView 只能对应一个 metric

────────────────────────────────
8. 最小字段结构（Schema Summary）

ReferenceViewV1 至少包含以下字段：
	•	type = "reference_view_v1"
	•	schema_version
	•	reference_view_id
	•	created_at_ts
	•	subjectRef
	•	scale
	•	window { startTs, endTs }
	•	kind（ReferenceViewKindV1）
	•	metric
	•	source_refs[]（EvidenceRef[]，与 ProblemStateV1 相同结构）
	•	overlap_ratio
	•	sample_count
	•	qc_mix
	•	notes（中性描述，可选）

source_refs 规则（FROZEN）：
	•	必须使用 EvidenceRef 结构
	•	ref_id 必须足以重放相同证据切片或 Series 查询
	•	禁止引用 UI 状态或不可复算字符串

────────────────────────────────
9. 与 ProblemStateV1 的关系（FROZEN）
	•	ProblemStateV1 可以直接由 Evidence / State 生成；
	•	ReferenceViewV1 是可选的证据组织对象，仅在需要对照时生成；
	•	ReferenceViewV1 不得消费 ProblemStateV1；
	•	ReferenceViewV1 不能独立触发 AO-SENSE；
	•	ReferenceViewV1 不能替代 ProblemStateV1。

合法依赖方向保持为：

Evidence / State → ProblemState
Evidence → ReferenceView → ProblemState（可选路径）

────────────────────────────────
10. 验收与 Fixtures（FROZEN）

ReferenceViewV1 v1 实现必须提供至少 2 个 Golden Fixtures：
	1.	可构建参照视图（正常 case）
	2.	无法构建参照视图（触发 ProblemState REFERENCE_MISSING）

Fixtures 要求：
	•	source_refs 必须可回放到相同 Evidence Ledger / Series 切片
	•	相同输入重复执行，ReferenceView 选择结果必须一致

────────────────────────────────
11. 冻结结论（Freeze Verdict）
	•	ReferenceViewV1 是 Judge 的证据组织资产，不是判断对象
	•	允许 append-only 持久化，但不强制
	•	唯一性与选择规则已冻结，防止爆炸
	•	失败语义严格禁止，必须上浮到 ProblemState
	•	不引入任何控制、建议或裁决语义
	•	不污染 Apple I Evidence Ledger
