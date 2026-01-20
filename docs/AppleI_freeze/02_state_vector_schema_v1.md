02 StateVector Schema v1 (FROZEN)

Doc ID: GEOX-P0-02
Status: FROZEN (StateVector v1)
Scope: Apple I 的核心合同（以后 Apple II/III 只能引用，不得破坏）
Hard Rule: StateVector 不允许出现任何建议/有效/应该/行动字段

2.1 定义

StateVector：在给定 SpatialUnit i、给定 metric、给定时间窗内，系统对“证据状态”的中性表达。

2.2 允许字段（冻结）

每个 (subjectRef, metric) 至少输出：
	•	subjectRef：
	•	projectId（必填）
	•	groupId/plotId/blockId（按 Scale Policy）
	•	metric：例如 soil_moisture_vwc
	•	window：
	•	startTs（ms）
	•	endTs（ms）
	•	freshness（证据新鲜度，描述性）
	•	latestTs（ms | null）
	•	ageMs（number | null）
	•	status：ok | stale | gap | unknown
	•	confidence（证据充分度）
	•	level：high | medium | low | unknown
	•	notes（可选，纯描述，不得包含建议）
	•	delta_ref（相对自然参照的偏移；允许为 null）
	•	value（number | null）
	•	ref（string：ref 的来源 id，例如 “seasonal_baseline_v1”）
	•	trend（变化方向，描述性）
	•	label：up | down | flat | unknown
	•	magnitude：slight | mid | strong | unknown
	•	persistence（是否持续，描述性）
	•	label：transient | persistent | unknown
	•	windowMs（用于判定的窗口大小）
	•	exclusion_reason（如果本条 StateVector 无法给出有效表达）
	•	reason：见 QC policy
	•	details（可选）

2.3 明确禁止字段（冻结）

禁止任何：
	•	recommendation
	•	action
	•	should
	•	effective
	•	cause
	•	diagnosis
	•	yield
	•	risk_level
	•	legal/illegal

2.4 示例 JSON（可贴到 contracts/测试中）
{
  "type": "state_vector_v1",
  "schema_version": "1.0.0",
  "subjectRef": { "projectId": "P_DEFAULT", "groupId": "G_DEMO_30S" },
  "metric": "air_temp_c",
  "window": { "startTs": 1766556000000, "endTs": 1766561400000 },
  "freshness": { "latestTs": 1766561400000, "ageMs": 0, "status": "ok" },
  "confidence": { "level": "medium" },
  "delta_ref": { "value": null, "ref": "not_available_in_apple_i" },
  "trend": { "label": "up", "magnitude": "slight" },
  "persistence": { "label": "unknown", "windowMs": 21600000 },
  "exclusion_reason": null
}
2.5 变更治理
	•	schema_version 必须语义化版本
	•	任何新增字段必须证明：
	•	不包含建议/裁决/因果
	•	能回溯证据
