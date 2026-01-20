Apple II · Judge — ProblemStateV1 Schema
Doc ID：GEOX-AII-01
Status：READY TO FREEZE
Applies to：Apple II（Judge）

Depends on：
GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）
GEOX-P0-01 Evidence & QC Policy（FROZEN）
GEOX-P0-02 StateVector Schema v1（FROZEN）
GEOX-AII-00-APP-A Enums & Constraints（Enum 规范真源）

────────────────────────────────

冻结声明（Constitutional Statement）

ProblemStateV1 是 Apple II 的唯一核心锚点输出（本体）。

它只能表达：
证据不足、证据冲突、数据可疑、策略阻断等问题态与不确定性。

它不允许表达：
风险裁决
行动许可或禁止
作业建议
因果诊断

所有解释（LBCandidate）与补观测（AO-SENSE）只能派生自 ProblemStateV1，不得反证或绕过。

────────────────────────────────
	1.	对象定义（Definition）

ProblemStateV1 表达的是：
在给定 SpatialUnit（按 Scale Policy）与给定时间窗内，系统基于当前证据判断，这里存在一个尚不能被可靠理解的问题态。

其职责不是解释发生了什么，而是明确：
系统当前不能可靠判断什么；
不确定性的主要来源；
哪些认知前提尚不成立。

────────────────────────────────
	2.	单向依赖原则（One-way Dependency, FROZEN）

允许的依赖方向：
Evidence / State → ProblemState
ProblemState → LBCandidate
ProblemState → AO-SENSE

明确禁止：
LBCandidate → ProblemState（作为输入或证明）
AO-SENSE 在无 ProblemState 的情况下独立存在
任何 Control / 许可 / 裁决语义进入 Apple II（HardNo / Warn / OK / Priority / legal / allow / deny）

────────────────────────────────
	3.	Enum Authority Rule（冻结级）

规范真源（Normative Source）：GEOX-AII-00-APP-A
机器校验副本（Validation Copy）：本 Schema 中展开的 enum

一致性与发布规则：
若 APP-A 与本 Schema enum 不一致，以 APP-A 为准；
必须先同步更新 Schema enum 并提升 schema_version 后才能发布；
Enum 的增删改必须 bump MINOR 或 MAJOR；
PATCH 仅允许文案、注释、排版修订。

【★新增】
实现中不得新增、推断或自动扩展任何 enum 值；
未覆盖的情形必须回落为既有枚举或使用 UNKNOWN 类别表达不确定性。

────────────────────────────────
	4.	StateVector Optionality Rule（FROZEN）

Apple II v1 允许在 StateVectorV1 尚不可用时，仅基于 Evidence Ledger 生成 ProblemStateV1。

若未使用 StateVector：
state_inputs_used 可缺失或为空。

若使用了 StateVector：
state_inputs_used 必须出现，且必须列出 fields_used 以保证可复算一致性。

────────────────────────────────
	5.	Step1 钩子规则（状态分层 / 变化速率）

以下字段必须存在；不可判定必须填写 unknown，不得省略，不得为 null：
state_layer_hint：atomic / derived / memory / unknown
rate_class_hint：fast / mid / slow / unknown
problem_scope：sensor_point / spatial_unit / reference_view / unknown

【★新增】
以上三个字段是 ProblemStateV1 输出对象的组成字段，
必须作为字段写入 ProblemStateV1，不得仅作为内部推导标签。

────────────────────────────────
	6.	字段语义与审计承诺

subjectRef 仅用于身份锚定，允许字段：projectId、groupId、plotId、blockId。
禁止任何语义字段。

window 永远只针对一个时间窗。

uncertainty_sources 不得为空数组。

supporting_evidence_refs 仅允许引用 Ledger、StateVector、ReferenceView、QC Summary。
禁止引用 LBCandidate、AO、Control。

【★新增】
supporting_evidence_refs 若存在，其 ref_id 必须足以重放出同一证据切片；
不得使用描述性、UI 状态或不可复算的字符串作为引用。

────────────────────────────────
	7.	JSON Schema（结构冻结说明）

本 Schema 以 JSON Schema Draft 2020-12 为基准。
跨字段约束（window.endTs > window.startTs）由 Judge 实现与测试校验。

【★新增】
实现时必须以 problem_state_v1.schema.json 作为唯一机器校验依据；
本文件为冻结宪法文本，不替代 schema 本身。

────────────────────────────────
	8.	Golden Fixtures（语义冻结示例）

以下示例用于语义理解与测试对齐，不在本文中承担 JSON 执行语义。

示例：INSUFFICIENT_EVIDENCE
problem_type = INSUFFICIENT_EVIDENCE
confidence = HIGH
uncertainty_sources = SPARSE_SAMPLING, MISSING_KEY_METRIC

示例：EVIDENCE_CONFLICT
problem_type = EVIDENCE_CONFLICT
confidence = MEDIUM
uncertainty_sources = MULTI_SOURCE_CONFLICT, MULTI_METRIC_CONFLICT

示例：SCALE_POLICY_BLOCKED
problem_type = SCALE_POLICY_BLOCKED
confidence = HIGH
uncertainty_sources = SCALE_POLICY_LIMITATION

────────────────────────────────
	9.	冻结结论（Freeze Verdict）

ProblemStateV1 是 Apple II 的唯一问题锚点。
单向依赖已冻结：Evidence / State → ProblemState → LBCandidate / AO-SENSE。
控制语义与建议语义禁止进入 Apple II。
Step1 钩子已就位且强制 unknown。
Enum Authority Rule 已冻结。

────────────────────────────────