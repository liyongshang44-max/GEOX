GEOX-P0-01 — Evidence & QC Policy（MINIMUM, READY TO FREEZE）
Doc ID：GEOX-P0-01
Status：READY TO FREEZE
Applies to：Apple I / Apple II / Apple III
Scope：Evidence Semantics, QC, Replayability

冻结声明（Constitutional Statement）

本政策冻结 GEOX 的证据语义：
Evidence Ledger 是 append-only 的事实账本；Series 渲染必须严格按窗口裁剪；QC 只影响“是否可用/可疑/排除”，不产生任何建议或结论。
	1.	Evidence Ledger（FROZEN）

1.1 Ledger 属性
	•	append-only（不可改写，不可删除）
	•	任何派生对象不得写回 ledger（ReferenceView、ProblemState、LBCandidate、AO-SENSE 均不得写入 Apple I ledger）
	•	必须可回放：同一查询条件应能重建同一证据窗口

1.2 v1 证据类型（最小集合）
	•	raw_sample_v1
	•	marker_v1
	•	overlay_v1
	•	qc_summary（可作为派生统计，但不得改变事实意义）

	2.	Series / Window Slicing（FROZEN）

	•	所有证据读取必须指定 window {startTs,endTs}
	•	严格裁剪：只返回窗口内证据
	•	不插值、不平滑、不补点
	•	gaps 表示真实缺失（缺数据就是缺数据）

	3.	QC 语义（FROZEN）

3.1 QC 状态
v1 QC 允许值：
	•	ok
	•	suspect
	•	bad

3.2 exclusion_reason
当数据被判定为 suspect/bad 或被排除时，可携带 exclusion_reason（字符串或枚举，由 Apple I 冻结实现为准）。
Apple II 不得重新解释 exclusion_reason 的含义，只能用于：
	•	不确定性来源（QC_SUSPECT_OR_BAD / SENSOR_HEALTH_ISSUE）
	•	ProblemState 的声明（QC_CONTAMINATION / SENSOR_HEALTH_DEGRADED 等）

3.3 QC 对判读的影响
	•	QC 只能影响“证据可用性/可信度”
	•	QC 不得触发任何行动语义，不得触发作业建议

	4.	Marker / Overlay 语义（FROZEN）

	•	marker_v1 / overlay_v1 是事实标注，不是结论
	•	Apple II 可以使用 marker/overlay 来生成 ProblemState（例如 MARKER_PRESENT、EXCLUSION_WINDOW_ACTIVE）
	•	Apple II 不得把 marker/overlay 解释为风险或行动许可

	5.	Replayability（FROZEN）

	•	所有 Apple II 输出必须能通过 EvidenceRef（ledger_slice / series_query / qc_summary 等）回放
	•	ref_id 必须足以复算相同窗口切片
	•	禁止 ref_id 仅为 UI 文本、自然语言描述或不可复算字符串

	6.	版本与治理（FROZEN）

	•	任何改变证据语义（插值、补点、平滑、改写）均属违宪
	•	QC 枚举新增/修改必须版本升级
