01 Evidence & QC Policy (FROZEN)

Doc ID: GEOX-P0-01
Status: FROZEN
Scope: Observables、QC、exclusion_reason、append-only ledger 行为规范
Non-goal: 不把 QC 当作“真值裁决”；QC 只描述证据可用性

1.1 Evidence Ledger（证据账本）
	•	Append-only：任何证据一旦写入，不允许 UPDATE/DELETE（你们已通过 DB guard 实现）
	•	允许的“纠错方式”：
	•	新写入一条 更高优先级的纠正事实（例如 marker / system-source 的替代样本），并在 UI/计算层通过规则处理冲突

1.2 Observable（可观测量）定义

Apple I 允许的 Observable 类型（示例，与现有事实类型对齐）：
	•	raw_sample_v1：时序采样（传感器）
	•	marker_v1：人为/系统标注（点事件）
	•	canopy_frame_v1：照片/图像帧（如启用）

注意：Observable 只表示“看到的东西”，不表示“解释”。

1.3 QC（质量控制）目标

QC 的目标是回答：
	•	这条证据能不能被用于状态表达？
	•	如果不能，为什么？（必须有 exclusion_reason）

1.4 QC 字段与枚举（冻结）

quality（冻结枚举）
	•	ok：可用
	•	suspect：可用但需谨慎（例如轻微漂移/边界条件）
	•	bad：不可用（应排除）

Apple I 允许 UI 展示 suspect/bad，但不得输出“原因结论”。

exclusion_reason（冻结枚举，最小集）
	•	device_fault：设备故障/不可信（断线、校准失效、时间错误等）
	•	single_point_anomaly：单点异常（孤立尖峰）
	•	multi_metric_inconsistency：多指标冲突（同一时刻/窗口内互相矛盾）
	•	out_of_range：物理/契约范围外（明显不可能值）
	•	duplicate：重复记录（同源或不同源重复）
	•	unknown：无法归类（必须伴随 note/refs 以便后续治理）

规则：所有 bad 必须有 exclusion_reason；suspect 建议也给 reason。

1.5 “无数据 ≠ 状态稳定”规则（冻结）

系统必须区分：
	•	No Data：没有证据
	•	Stable：有证据支持“无显著变化”

UI/输出必须允许出现：
	•	readability = unknown/gap/stale（你们 P5 panel 已有雏形）

1.6 时间一致性（冻结）
	•	证据的发生时间必须以 occurred_at 为准（账本排序锚点）
	•	payload 内的时间（如 record_json.occurred_at）视为冗余字段，但必须一致；若不一致：
	•	quality 至少为 suspect
	•	可加 marker 纠正
