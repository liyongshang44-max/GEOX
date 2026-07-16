<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md -->

# GEOX MCFT-CAP-06 — Calibration Candidate and Shadow Evaluation

## 完整任务线 v0.3.1 — Conditional Frozen / P-1 Ready

本任务线以以下权威为依据：

```text
GEOX Complete Agricultural Digital Twin Master Task Line
GEOX DT-02 Frozen Architecture
GEOX DT-02 Canonical Object Set
GEOX DT-02 Atomic Transaction Matrix
GEOX DT-02 to MCFT Implementation Map
MCFT-CAP-03 Observation / Assimilation contracts
MCFT-CAP-04 Forecast / Scenario Runtime contracts
MCFT-CAP-05 Forecast Residual and feedback-loop COMPLETE evidence
current PostgreSQL append-only facts and rebuildable projections
current hourly water-balance Dynamics
existing explicit Runtime Config pin and State-bound Config chain
historical P37–P44 calibration / shadow artifacts as reference-only assets
```

当前状态：

```text
architecture_direction:
CONFORMANT

design_status:
CONDITIONAL_FROZEN_AFTER_P_MINUS_1

implementation_status:
S1_CONTROLLED_DATA_CORRECTION_CANDIDATE

runtime_implementation_status:
S1_MECHANICAL_IMPLEMENTATION_PRESERVED_SUCCESSOR_READINESS_SUPERSEDED

authorization_effective:
true

s0_qualification_authorized:
true

runtime_source_authorized:
true

active_delivery_slice_id:
MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1

predecessor_eligibility:
RESTORED

dt02_architecture_amendment_status:
NOT_REQUIRED

first_permitted_repository_action:
MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
```

本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 已 merged-main effective；原 S1 的机械持久化、幂等和重建证明保留，但后继就绪性已由 additive erratum 撤销，当前为 S1 controlled-data correction candidate。S2 及其后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 均保持未授权。

---

# 0. 核心裁决

```text
capability_line_id:
MCFT-CAP-06

display_alias:
MCFT-6

canonical_name:
Calibration Candidate and Shadow Evaluation

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

predecessor_capability_line_id:
MCFT-CAP-05

successor_capability_line_id:
MCFT-CAP-07

successor_authorized:
false
```

Owner work packages：

```text
primary_owner_work_package_id:
MCFT-12 — Calibration and Model Activation

contributing_owner_work_package_ids:
MCFT-01 — Controlled Replay Evidence
MCFT-02 — Canonical Contracts and Runtime Config
MCFT-03 — Persistence / Idempotency / Projection
MCFT-04 — Orchestration / Recovery / Post-evaluation Tick
MCFT-05 — Existing Evidence Window cutoff and no-future-leakage graph, reuse only
MCFT-06 — Water Dynamics and Parameter Replay
MCFT-07 — Observation Quality and Observation Operator
MCFT-08 — Posterior State Context
MCFT-09 — Forecast Trace and Replay Inputs
MCFT-11 — Forecast Residual
MCFT-16 — Bounded Closed-Loop Orchestration

excluded_owner_work_package_ids:
MCFT-10 — New Scenario semantics
MCFT-13 — New Human Decision semantics
MCFT-14 — New Action Lifecycle semantics
MCFT-15 — New Execution Feedback semantics
MCFT-17 — Runtime Read APIs
MCFT-18 — Operator Integration
```

MCFT-05 在本能力线中仅提供既有 Evidence Window 语义和可用性边界：

```text
REUSE_EXISTING_EVIDENCE_WINDOW_ONLY
NO_NEW_EVIDENCE_WINDOW_SEMANTICS
NO_EVIDENCE_SELECTION_POLICY_CHANGE
```

MCFT-12 在本能力线中的授权被严格限制为：

```text
calibration candidate
historical replay shadow evaluation
model-governance history

not:
model activation
active binding switch
rollback
production promotion
```

---

# 1. 本能力线建立什么

```text
1. 从 canonical Forecast Residual history 中构造严格受控、
   可审计、无未来信息泄漏的 calibration case set。

2. 将 calibration window 与 later holdout window
   按 event time 和 information-availability time 双重分离。

3. 在单一参数、固定搜索边界、固定 Runtime replay numeric policy
   和固定 calibration metric numeric policy 下，
   对每个候选值重放相同 one-step Forecast cases。

4. 对参数敏感度、激励程度、residual bias pattern、
   objective surface、boundary hit、determinism 和 physical invariants
   做 fail-closed 判断。

5. 复用 DT-02：
   twin_calibration_candidate_v1
   D_MODEL_GOVERNANCE_STEP_COMMIT。

6. 将 no-op base retention 作为可 canonicalize 的治理结论。

7. 在完全独立的 later holdout cases 上，
   对 base 与 candidate 执行 paired historical replay。

8. 复用 DT-02：
   twin_shadow_evaluation_v1
   D_MODEL_GOVERNANCE_STEP_COMMIT。

9. 将 8 个 holdout case summaries 直接保存在
   Shadow Evaluation canonical aggregate 中。

10. 建立 Candidate / Evaluation 的 idempotency、并发冲突、
    response-loss recovery、canonical readback、projection rebuild
    和 corruption fail-closed。

11. 执行下一正常 State Tick，
    证明 Candidate / Evaluation 未被自动消费。

12. 建立 bounded end-to-end calibration–shadow chain
    和 completed-chain zero-write replay。

13. 将 controlled mechanism proof 与 repository-history assessment
    明确分离，禁止测试事实污染有效历史。

14. 建立 Capability Completion Effectiveness Activation
    与 Final Effectiveness Reconciliation 两个不同的关闭阶段，
    避免最终证据自引用。
```

必须保持：

```text
State Assimilation
≠
Parameter Calibration

Calibration Candidate
≠
Active Model

Historical Replay Shadow Evaluation
≠
Shadow-Online Runtime

Shadow Evaluation eligibility
≠
Approval
≠
Model Activation
```

---

# 2. 状态、不确定性与下一 Tick 语义

本能力线产生 model-governance history，不直接改变 Twin physical State。

```text
State mutation:
NONE

checkpoint mutation by Candidate / Evaluation:
NONE

active model parameter mutation:
NONE

uncertainty_change:
NONE

process_uncertainty_model:
UNCHANGED

observation_uncertainty_model:
UNCHANGED

representativeness_uncertainty_model:
UNCHANGED

forecast_interval_calibration:
NOT_ESTABLISHED

probabilistic_coverage_calibration:
NOT_ESTABLISHED

state_confidence_change:
NONE

normalized_residual:
DIAGNOSTIC_ONLY
```

Candidate 和 Evaluation 对下一 Tick 的标准消费语义是：

```text
NOT_CONSUMED_AS_RUNTIME_AUTHORITY
```

S9 必须以正常 A1/B Tick 证明：

```text
Candidate ref is absent from Runtime Config authority
Evaluation ref is absent from Runtime Config authority
effective drainage coefficient remains 0.030000
no twin_model_activation_v1 exists
no active-config index is created or modified
```

---

# 3. 本能力线不建立什么

```text
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_AUTOMATIC_PARAMETER_UPDATE
NO_ASSIMILATION_PARAMETER_MUTATION
NO_CANDIDATE_STATE_LINEAGE
NO_SHADOW_STATE_LINEAGE
NO_SHADOW_FORECAST_CANONICAL_OBJECT
NO_SHADOW_ONLINE_CLAIM
NO_CONTINUOUS_CALIBRATION
NO_BACKGROUND_SCHEDULER
NO_LIVE_FIELD_CLAIM
NO_FIELD_CALIBRATION_CLAIM
NO_TRUE_PARAMETER_IDENTIFICATION_CLAIM
NO_STATISTICAL_SIGNIFICANCE_CLAIM
NO_GENERALIZATION_CLAIM
NO_OUT_OF_SAMPLE_FIELD_PERFORMANCE_CLAIM
NO_MODEL_IMPROVEMENT_OUTSIDE_CONTROLLED_REPLAY
NO_UNCERTAINTY_MODEL_CALIBRATION
NO_PROBABILISTIC_COVERAGE_CALIBRATION
NO_FORECAST_INTERVAL_COVERAGE_CALIBRATION
NO_CONFIDENCE_SCORE_CHANGE
NO_ACTIVE_BINDING_IMPLEMENTATION_CLAIM_WHEN_BINDING_IS_ABSENT
NO_CAUSAL_EFFECT_ATTRIBUTION
NO_AUTOMATIC_RECOMMENDATION
NO_AGRONOMIC_POLICY_EVALUATION
NO_AUTOMATIC_APPROVAL
NO_AO_ACT
NO_DISPATCH
NO_DEVICE_COMMAND
NO_ROI
NO_FIELD_MEMORY
NO_PUBLIC_WRITE_ROUTE
NO_WEB_CHANGE
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_AUTOMATIC_HISTORY_REWRITE
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_CONTROLLED_FIELD_TWIN_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE_CLAIM
NO_MCFT_CAP_07_AUTHORIZATION
```

说明：

```text
model-governance threshold evaluation
is not
agronomic Policy Evaluation
```

---

# 4. 当前仓库事实基线

设计核查时的 verified `main`：

```text
predecessor_verified_main_commit:
9c4030e43d3b65857cf40d7936d5dfa8e80c17d1
```

MCFT-CAP-05 当前事实：

```text
status:
COMPLETE

implementation_status:
COMPLETE

closure_effective:
true

capability_complete:
true

active_delivery_slice_id:
null

runtime_source_authorized:
false

effective_completion_claims:
40

pending_completion_claims:
0

next_repository_action:
null

successor:
MCFT-CAP-06

successor_authorized:
false
```

相关最终治理证据：

```text
MCFT-CAP-05 SSOT hygiene:
PR #2494

exact head:
5cfc269b9776cc41b253d99920035a7fe3c8cc5d

exact-head CI:
29412550679 SUCCESS

merge commit:
9c4030e43d3b65857cf40d7936d5dfa8e80c17d1

head-to-merge file delta:
0

proof-only merged-main probe:
PR #2495

proof workflow:
29413029737 SUCCESS

probe disposition:
CLOSED_WITHOUT_MERGE
```

上述 SHA 是本设计版本的 verified baseline，不是实施时可永久硬编码的 baseline。

P-1、P0 和 S0 必须重新记录：

```text
latest verified main at slice execution time
predecessor COMPLETE evidence
exact-head CI
merge commit
head-to-merge file delta
head-to-merge tree equivalence
merged-main Gate
```

P0 必须修复 Vertical Capability Matrix、Implementation Map 或其他跨能力 current-state 投影中仍残留的 CAP-05 陈旧状态，但不得重开或重做 CAP-05 closure。

---

# 5. DT-02 冻结架构

DT-02 已冻结：

```text
twin_calibration_candidate_v1
twin_shadow_evaluation_v1
twin_model_activation_v1
twin_runtime_config_v1
```

其中：

```text
twin_calibration_candidate_v1:
record_class = CANONICAL_MODEL_GOVERNANCE_HISTORY
lineage_member = false
envelope_profile = NON_LINEAGE_CONTEXT
transaction = D_MODEL_GOVERNANCE_STEP_COMMIT
required_refs = residual_refs, base_config_ref
optional_refs = context_lineage_ref, context_revision_ref

twin_shadow_evaluation_v1:
record_class = CANONICAL_MODEL_GOVERNANCE_HISTORY
lineage_member = false
envelope_profile = NON_LINEAGE_CONTEXT
transaction = D_MODEL_GOVERNANCE_STEP_COMMIT
required_refs = candidate_ref, evaluation_dataset_refs
object-specific optional_refs = none
```

D transaction 已冻结：

```text
exactly one listed object type per governance transition

allowed canonical append:
twin_runtime_config_v1
or
twin_calibration_candidate_v1
or
twin_shadow_evaluation_v1
or
twin_model_activation_v1

candidate and evaluation indexes:
projection writes allowed

active config index CAS:
activation only

candidate failure:
active authority unchanged
```

MCFT-CAP-06 不得：

```text
新增第二套 calibration candidate canonical type
新增第二套 shadow evaluation canonical type
新增第九 transaction family
让 Candidate commit 修改 active config index
让 Evaluation commit 修改 active config index
创建 twin_model_activation_v1
```

Shadow Evaluation 是否可直接携带 context refs，必须由 P-1 裁决。

---

# 6. P-1 — DT-02 Object / Transaction / Config-Profile Adjudication

```text
delivery_slice_id:
MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1

slice_kind:
ARCHITECTURE_GOVERNANCE_ONLY

runtime_source_authorized:
false

migration_authorized:
false

canonical_write_authorized:
false
```

P-1 只裁决真正属于 DT-02、canonical envelope 和事务边界的问题：

```text
1. twin_calibration_candidate_v1 是否可直接复用。
2. twin_shadow_evaluation_v1 是否可直接复用。
3. D_MODEL_GOVERNANCE_STEP_COMMIT 是否可直接复用。
4. Candidate NON_LINEAGE_CONTEXT 的 context refs。
5. Evaluation context refs 的直接、间接或 amendment 路径。
6. context_lineage_ref 的身份种类：
   canonical twin_runtime_lineage_v1 object_id
   或现有兼容语义。
7. context_revision_ref 的身份种类。
8. base_config_ref 的 canonical authority 和 nullable rule。
9. 多个 source Runtime Config refs 与单一 base_config_ref 的关系。
10. Candidate / Evaluation envelope source_refs、evidence_refs、
    runtime_config_ref/hash 的映射。
11. 是否需要专用 calibration-governance Runtime Config。
12. S3 是 zero migration 还是 exactly one additive migration。
13. failed calibration/evaluation attempt 是否：
    no persistent attempt object，
    或使用独立 F_OPERATIONAL_ATTEMPT_HEALTH。
14. Candidate-to-Evaluation index 是否允许 one-to-many。
15. 历史 P37–P44 资产的复用等级。
16. twin_model_activation_v1 的明确排除边界。
```

以下内容不在 P-1 冻结：

```text
numeric policy implementation details
search thresholds
Candidate status math
evaluation metric thresholds
idempotency concurrency implementation
projection rebuild implementation
```

它们分别由 S2、S3 冻结和实现。

P-1 允许三种结果：

```text
A.
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_REQUIRED

B.
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED

C.
DT02_AMENDMENT_REQUIRED
```

推定结果为：

```text
PRESUMPTIVE_OUTCOME:
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED
```

只有 P-1 能证明 calibration/search/evaluation policy 必须成为 `twin_runtime_config_v1`，才允许选择 Outcome A。

行为：

```text
Outcome A:
保留 conditional S4。

Outcome B:
删除 S4 运行步骤；
S5 直接依赖 S3 merged-effective；
policy refs/hashes 由 immutable policy artifacts 冻结。

Outcome C:
停止；
进入 P-1A；
P0、S0 和 Runtime slices 全部禁止。
```

## 6.1 P-1A conditional amendment

```text
delivery_slice_id:
MCFT-CAP-06.P-1A.DT02-ARCHITECTURE-AMENDMENT-V1
```

仅在 P-1 输出 `DT02_AMENDMENT_REQUIRED` 时允许。

P-1A 合并、tree equivalence 和 merged-main Architecture Gate 完成之前：

```text
CAP-06 remains NOT_AUTHORIZED
runtime_source_authorized = false
canonical write forbidden
migration forbidden
```

---

# 7. 历史 P37–P44 资产复用裁决

旧资产包括：

```text
offline_calibration_trial_run_v1
calibration_trial_result_v1
model_parameter_delta_candidate_v1
estimator_config_patch_candidate_v1
estimator_model_version_candidate_v1
shadow_estimator_config_v1
shadow_forecast_run_v1
shadow_model_evaluation_v1
active model activation artifacts
```

复用等级：

```text
PURE_ALGORITHM_REFERENCE:
bounded delta search
deterministic hashing
no-op candidate concept
paired metric concept

SEMANTIC_REFERENCE_ONLY:
old policies
old fixture shapes
old gate vocabulary

FORBIDDEN_AS_CANONICAL_AUTHORITY:
local ledger
old record types
artifact-only candidate chain
artifact-only shadow chain
old activation write path
```

MCFT-CAP-06 sole canonical authority：

```text
public.facts
DT-02 canonical object set
D_MODEL_GOVERNANCE_STEP_COMMIT
PostgreSQL canonical readback
```

---

# 8. 标准校准目标

首版只允许一个参数：

```text
parameter_key:
dynamics_parameters.drainage_coefficient_per_hour

base_value:
0.030000
```

当前 Dynamics 语义：

```text
drainage_mm
=
max(storage_before_drainage_mm - field_capacity_storage_mm, 0)
×
drainage_coefficient_per_hour
```

参数范围：

```text
contract_admissible_bounds:
0.000000 .. 1.000000

controlled_search_bounds:
0.020000 .. 0.040000

grid_step:
0.001000

candidate_grid_count:
21

parameter_scale:
6
```

`0..1` 仅表示当前 contract/validator 可接受范围，不声明为普适物理真理。

首版禁止同时校准：

```text
field capacity
wilting point
root-zone depth
sensor bias
ET multiplier
runoff fraction
process variance
observation variance
representativeness variance
multiple parameters
```

---

# 9. 两条数据轨道与隔离规则

MCFT-CAP-06 必须严格区分：

```text
A. CONTROLLED_POSITIVE_MECHANISM_TRACK

B. REPOSITORY_HISTORY_QUALIFICATION_TRACK
```

## 9.1 Controlled positive mechanism track

用途：

```text
证明机制、canonical lifecycle 和 recovery 成立
```

运行环境：

```text
isolated acceptance PostgreSQL database
or
explicitly namespaced controlled fixture scope
```

禁止写入：

```text
effective predecessor operational history
production-like main database
repository-history qualification dataset
```

标准 acceptance DB profile：

```text
PRESEEDED_24_H1_FORECAST_OBSERVATION_PAIRS_NO_RESIDUALS_V1
```

该 profile 在 CAP-06 运行前已经包含：

```text
24 source posterior States
24 source Runtime Config snapshots or equivalent frozen config graph
24 COMPLETED H1-capable Forecast runs
24 exact H1 Forecast points
24 matching observation Evidence records
all forcing / geometry / operator / numeric graph authorities
zero matching canonical Forecast Residuals
```

前置 seed facts 是 acceptance fixture infrastructure，不计入 CAP-06 canonical Runtime delta。

标准 fixture：

```text
24 canonical matched Forecast–Observation Residual cases

first 16:
calibration window

later 8:
holdout window

hidden controlled drainage coefficient:
0.034000

base coefficient:
0.030000

expected positive disposition:
bounded non-zero candidate
```

最终 selected coefficient 必须由 S2 fixed-point reference implementation 冻结，不得仅凭文档直觉硬编码。

## 9.2 Repository history qualification track

用途：

```text
审计当前 canonical history 是否足以支持真实历史校准
```

S0 只输出 structural dataset qualification，不执行候选参数 replay，不计算 sensitivity、excitation 或 objective surface。

S0 dataset qualification 状态只允许：

```text
READY_FOR_CALIBRATION_ASSESSMENT
INSUFFICIENT_MATCHED_PAIRS
CONFIG_OR_MODEL_HETEROGENEITY
AVAILABILITY_ORDER_INVALID
INVALID_CASE_GRAPH
```

S10 可以在只读模式执行 repository-history calibration assessment。该 assessment 不自动 canonicalize Candidate，也不改变任何 Runtime authority。

S10 repository assessment 状态允许：

```text
BOUNDED_NON_ZERO_CANDIDATE_POSSIBLE
NO_OP_BASE_PARAMETER_RETAINED
INSUFFICIENT_MATCHED_PAIRS
INSUFFICIENT_PARAMETER_EXCITATION
CONFIG_OR_MODEL_HETEROGENEITY
AVAILABILITY_ORDER_INVALID
OBJECTIVE_SURFACE_FLAT
OBJECTIVE_MARGIN_INSUFFICIENT
SEARCH_BOUNDARY_HIT_INCONCLUSIVE
BASE_REPLAY_MISMATCH
```

Capability completion 不得要求 repository history 必然产生非零 candidate。

以下命题禁止：

```text
24 successful Forecasts exist
therefore
24 eligible calibration pairs exist
```

两个轨道必须满足：

```text
controlled_fixture_refs
∩
repository_history_refs
=
empty
```

---

# 10. S0 dataset qualification output

S0 必须生成 machine-readable structural qualification：

```yaml
qualification_id: ...
source_scope: ...
qualification_track: REPOSITORY_HISTORY_QUALIFICATION_TRACK

eligible_forecast_count: 0
eligible_observation_count: 0
eligible_matched_pair_count: 0
eligible_residual_count: 0
eligible_calibration_count: 0
eligible_holdout_count: 0

calibration_window_refs: []
holdout_window_refs: []

model_component_hash_count: 0
effective_parameter_bundle_hash_count: 0
observation_operator_hash_count: 0
geometry_hash_count: 0
runtime_replay_numeric_policy_hash_count: 0

case_graph_validation_status: PASS | FAIL

dataset_qualification_status:
  READY_FOR_CALIBRATION_ASSESSMENT
  INSUFFICIENT_MATCHED_PAIRS
  CONFIG_OR_MODEL_HETEROGENEITY
  AVAILABILITY_ORDER_INVALID
  INVALID_CASE_GRAPH

qualification_limitations: []
```

S0 不得输出：

```text
sensitive_case_count
excited_case_count
objective surface status
best-vs-second margin
selected parameter
```

这些属于 S5 或 S10。

S0 只能读取和资格判定，不得创建 Residual、Candidate、Evaluation 或修改 Runtime authority。

---

# 11. Calibration / Holdout 双重时间隔离

每个 case 必须满足：

```text
forecast_target_time
=
observation.observed_at

forecast_issued_at
<
observation.available_to_runtime_at

forecast_as_of
<
observation.available_to_runtime_at

forecast_evidence_cutoff
<=
forecast_as_of
```

禁止使用：

```text
Forecast.created_at
```

作为 anti-leakage authority。

其中：

```text
forecast_as_of:
resolved from the canonical Forecast envelope

forecast_evidence_cutoff:
resolved from the exact A-record-set Evidence Window graph
```

如果当前 canonical graph 无法唯一解析 `forecast_evidence_cutoff`：

```text
P-1 must adjudicate
or
DT02_AMENDMENT_REQUIRED
```

不得通过 operational `created_at` 或 fresh external retrieval 替代。

Calibration / holdout 分割必须同时满足：

```text
max(calibration.forecast_target_time)
<
min(holdout.forecast_target_time)

max(calibration.observation_available_to_runtime_at)
<
min(holdout.observation_available_to_runtime_at)
```

Candidate：

```text
envelope.logical_time
=
max(calibration.forecast_target_time)

envelope.as_of
=
max(calibration.observation_available_to_runtime_at)

candidate.as_of
<
min(holdout.observation_available_to_runtime_at)
```

Candidate compute 不得接收、搜索或读取 holdout refs、holdout index 或 future observations。

---

# 12. Case eligibility

标准 calibration / holdout case 必须：

```text
same tenant/project/group/field/season/zone
same active lineage context
same revision context
Forecast.status = COMPLETED
Forecast point horizon = 1
Forecast target_time = observation observed_at
Forecast issued/as_of before observation availability
exact Forecast point ref resolves
source posterior ref/hash resolves
source Runtime Config ref/hash resolves
forcing authority resolves
observation operator authority resolves
geometry ref/hash resolves
effective model parameter bundle hash matches
runtime replay numeric policy hash matches
observation quality = PASS
observation canonical unit = VWC fraction
no duplicate target_time
no conflicting semantic duplicate
```

`LIMITED` observation：

```text
excluded from standard calibration
excluded from standard holdout
allowed only in independent negative/inconclusive fixtures
```

首版不建立 quality weighting。

---

# 13. Case-input replay authority与派生权威

首版冻结唯一 primary authority：

```text
case_input_authority:
CANONICAL_FORECAST_POINT_TRACE_WITH_GRAPH_VALIDATION_V1
```

Primary replay input：

```text
exact canonical H1 Forecast point trace
```

当前 canonical contract 中存在的 forcing authority：

```text
forcing_cycle_key
forcing_window_hash
weather_snapshot_ref/hash
et0_snapshot_ref/hash
crop_stage_context_ref/hash
```

首版不要求不存在的 `forcing_window_ref`。

Required graph validation：

```text
Forecast run ref/hash
Forecast point ref/hash
source posterior ref/hash
source Runtime Config ref/hash
forcing_cycle_key
forcing_window_hash
weather snapshot ref/hash
ET0 snapshot ref/hash
crop-stage / Kc authority
geometry ref/hash
observation operator authority
runtime replay numeric policy authority
Forecast envelope as_of
A-record-set Evidence Window cutoff
```

派生 authority：

```text
observation_operator_hash
=
semantic hash of:
operator_id
operator_version
operator_h
representativeness policy identity

runtime_replay_numeric_policy_hash
=
semantic hash of:
existing fixed-point water scales
existing variance scales
existing Dynamics rounding policy
relevant immutable Runtime Config numeric fields

calibration_metric_numeric_policy_hash
=
semantic hash of:
metric VWC scale
SSE accumulator scale
ratio comparison policy
integer square-root display policy
```

Base replay requirement：

```text
replay with base coefficient 0.030000
must exactly reproduce
canonical stored base Forecast point storage and mass-balance trace
under the existing Runtime replay numeric policy
```

`BASE_REPLAY_MISMATCH` 首先比较 canonical scale-6 storage、trace 和 determinism basis，不得只比较扩展后的 scale-9 VWC metric。

否则：

```text
BASE_REPLAY_MISMATCH
no Candidate append
```

不得在同一能力线中混用 point-trace reconstruction 与 fresh external forcing retrieval。

---

# 14. Exact-ref-only Candidate data port

Candidate compute 必须依赖窄端口：

```ts
loadExactCalibrationResiduals(
  orderedResidualRefs: readonly string[]
): Promise<readonly CalibrationCaseSource[]>
```

允许：

```text
exact primary-key or exact-ref batch lookup
exact graph traversal from those refs
```

禁止 Candidate service 获得：

```text
listResiduals
searchResiduals
loadResidualsAfter
latestResiduals
holdout projection port
generic facts query port
query by time range
query by scope without exact refs
```

Acceptance 必须检查：

```text
dependency injection graph
repository interface surface
SQL query shape
absence of holdout/search ports
```

Candidate input必须只包含冻结的 16 个 calibration residual refs。调用方未传 holdout ref 不是充分条件；数据端口本身必须无法搜索 holdout。

---

# 15. Algorithm and policy versioning

必须冻结：

```text
calibration_case_builder_id:
MCFT_CAP_06_H1_FORECAST_POINT_TRACE_CASE_BUILDER_V1

calibration_case_builder_version:
1

calibration_engine_id:
MCFT_CAP_06_SINGLE_PARAMETER_GRID_SEARCH_V1

calibration_engine_version:
1

shadow_replay_engine_id:
MCFT_CAP_06_PAIRED_HISTORICAL_REPLAY_V1

shadow_replay_engine_version:
1

metric_policy_id:
MCFT_CAP_06_VWC_METRIC_POLICY_V1

metric_policy_version:
1

candidate_selection_policy_id:
MCFT_CAP_06_CANDIDATE_SELECTION_POLICY_V1

candidate_selection_policy_version:
1

shadow_evaluation_policy_id:
MCFT_CAP_06_SHADOW_EVALUATION_POLICY_V1

shadow_evaluation_policy_version:
1

runtime_replay_numeric_policy_id:
EXISTING_MCFT_FIXED_POINT_WATER_RUNTIME_POLICY_V1

calibration_metric_numeric_policy_id:
MCFT_CAP_06_FIXED_POINT_METRIC_POLICY_V1
```

每次 Candidate / Evaluation 必须保存：

```text
case_input_set_hash
engine identity
policy refs/hashes
runtime replay numeric policy ref/hash
calibration metric numeric policy ref/hash
determinism hash
```

---

# 16. Runtime replay numeric policy 与 calibration metric policy

## 16.1 Runtime replay numeric policy

Runtime replay 复用现有语义：

```text
storage / water-depth scale:
6

variance scale:
12

rounding:
HALF_AWAY_FROM_ZERO

Dynamics mass-balance authority:
existing CAP-02 / CAP-04 fixed-point implementation
```

禁止为了 calibration 改写 Forecast、Dynamics、Assimilation 或 Scenario 的现有数值语义。

## 16.2 Calibration metric numeric policy

```text
parameter scale:
6

VWC prediction / observation / residual metric scale:
9

squared-error accumulator scale:
18

absolute-error accumulator scale:
9

ratio / threshold comparison:
integer cross-multiplication

display metric scale:
9

rounding:
HALF_AWAY_FROM_ZERO
```

转换链必须冻结为：

```text
existing scale-6 Runtime storage / trace result
↓
existing observation operator projection
↓
deterministic rescale to metric VWC scale 9
↓
SSE accumulation at scale 18
```

候选选择 primary authority：

```text
sum_squared_error_scale_18
mean_squared_error_exact_fraction
```

RMSE 只作为 canonical/display metric，不作为 flatness 或 best-second margin 的底层比较 authority。

由于平方根单调：

```text
minimum MSE
and
minimum RMSE
select the same candidate
```

Objective surface Gate：

```text
objective_mse_range
=
worst_mse - best_mse

objective_mse_range_epsilon:
由 S2 以 scale-18 exact integer 单位冻结

best_vs_second_best_mse_margin
=
second_best_mse - best_mse

best_vs_second_best_mse_margin_epsilon:
由 S2 以 scale-18 exact integer 单位冻结
```

Canonical/display RMSE 必须使用冻结的：

```text
integer_square_root_algorithm_id
integer_square_root_scale
integer_square_root_rounding_policy
```

不得使用：

```text
display-rounded RMSE
host floating-point epsilon
Number.toFixed
platform-dependent sqrt
```

作为选择或 Gate authority。

---

# 17. Sensitivity and identifiability

对每个 calibration case：

```text
prediction_span_vwc
=
abs(prediction_at_k_max - prediction_at_k_min)
```

标准阈值：

```text
sensitivity_epsilon_vwc_fraction:
0.000001000

sensitive_case:
prediction_span_vwc >= 0.000001000

minimum_sensitive_case_count:
4
```

Wetness regime：

```text
normalized_excess_ratio
=
excess_above_field_capacity_mm
/
(saturation_storage_mm - field_capacity_storage_mm)
```

当前 Dynamics contract 已要求：

```text
field_capacity_storage_mm
<
saturation_storage_mm
```

因此 denominator 必须为正，不使用 epsilon fallback。

Regimes：

```text
LOW_EXCESS:
0 < ratio < 0.10

MID_EXCESS:
0.10 <= ratio < 0.30

HIGH_EXCESS:
ratio >= 0.30
```

标准要求：

```text
minimum represented sensitive wetness regimes:
2
```

失败状态：

```text
INSUFFICIENT_PARAMETER_EXCITATION
OBJECTIVE_SURFACE_FLAT
OBJECTIVE_MARGIN_INSUFFICIENT
```

---

# 18. Candidate grid search

对 21 个参数值分别执行相同 16-case replay：

```text
0.020000
0.021000
...
0.040000
```

选择顺序：

```text
1. minimum exact MSE
2. minimum absolute mean bias
3. minimum maximum absolute residual
4. minimum absolute parameter delta from base
5. lower parameter value
```

Boundary handling：

```text
selected value = 0.020000
or
selected value = 0.040000

→ SEARCH_BOUNDARY_HIT_INCONCLUSIVE
→ no Candidate append
→ eligible_for_human_activation_review = false
```

No-op handling：

```text
selected value = 0.030000
and surface is sufficiently informative

→ NO_OP_BASE_PARAMETER_RETAINED
→ append twin_calibration_candidate_v1
```

Non-zero handling：

```text
selected value within open search interval
and selected value != base
and all sensitivity / margin / invariant checks pass

→ BOUNDED_PARAMETER_DELTA_CANDIDATE
→ append twin_calibration_candidate_v1
```

---

# 19. Error classification summary

S5 必须形成 non-independent `error_classification_summary`。它不是新的 canonical object type。

当 Candidate 被 canonicalize 时，该 summary 写入 Candidate payload；当无 Candidate append 时，同一 summary 只存在于 deterministic attempt result 或独立 F operational audit，取决于 P-1 裁决。

```yaml
error_classification_summary:
  dominant_error_class:
    PARAMETER_SENSITIVE
    NON_IDENTIFIABLE
    HETEROGENEOUS_CONTEXT
    BASE_MODEL_RETAINED

  parameter_sensitivity_status: ...
  residual_bias_pattern: ...
  objective_surface_status: ...
  boundary_status: ...
  case_graph_status: ...

  uncertainty_change: NONE
  process_uncertainty_model: UNCHANGED
  observation_uncertainty_model: UNCHANGED
  forecast_interval_calibration: NOT_ESTABLISHED
  normalized_residual_role: DIAGNOSTIC_ONLY

  limitations: []
```

该 summary 不得声明：

```text
root cause proven
true physical parameter identified
statistical significance established
generalization established
uncertainty model calibrated
```

---

# 20. Candidate status machine与失败尝试权威

Canonical-appending statuses：

```text
BOUNDED_PARAMETER_DELTA_CANDIDATE
NO_OP_BASE_PARAMETER_RETAINED
```

No-canonical-append attempt results：

```text
INSUFFICIENT_MATCHED_PAIRS
INSUFFICIENT_PARAMETER_EXCITATION
OBJECTIVE_SURFACE_FLAT
OBJECTIVE_MARGIN_INSUFFICIENT
SEARCH_BOUNDARY_HIT_INCONCLUSIVE
INVALID_CASE_SET
CONFIG_OR_MODEL_HETEROGENEITY
AVAILABILITY_ORDER_INVALID
BASE_REPLAY_MISMATCH
DETERMINISM_FAILURE
PHYSICAL_INVARIANT_FAILURE
MASS_BALANCE_FAILURE
```

No-op 是正式治理结论，因此必须 canonicalize；其他失败不得伪装为 canonical Candidate。

Failed attempt persistence policy 由 P-1 在以下两种模式中裁决：

```text
MODE A:
NO_PERSISTENT_ATTEMPT_OBJECT

deterministic function result
+
acceptance evidence only

MODE B:
SEPARATE_F_OPERATIONAL_ATTEMPT_HEALTH

append twin_runtime_attempt_v1
and/or twin_runtime_health_v1
through F_OPERATIONAL_ATTEMPT_HEALTH

never inside failed D transaction
never represented as Candidate or Evaluation
```

无论哪种模式：

```text
failed D transition canonical append delta = 0
Candidate projection delta = 0
Evaluation projection delta = 0
Runtime authority unchanged
State unchanged
checkpoint unchanged
```

---

# 21. Calibration Candidate envelope与canonical profile

## 21.1 Envelope mapping

Candidate 必须满足 DT-02 base envelope。

```text
envelope.logical_time:
max calibration Forecast target time

envelope.as_of:
max calibration observation available_to_runtime_at

envelope.source_refs:
ordered residual refs
+
base_config_ref when non-null

envelope.evidence_refs:
ordered unique actual_observation_refs
resolved from the 16 Residual payloads

envelope.runtime_config_ref/hash:
base_config_ref/hash
unless P-1 explicitly adjudicates nullable profile

envelope.idempotency_key:
CALIBRATION_CANDIDATE:<calibration_run_id>

envelope.limitations:
payload limitations mirrored or strictly consistent
```

Residual canonical objects不得放入 `evidence_refs`。Residual refs属于 `source_refs`；actual Observation Evidence refs属于 `evidence_refs`。

Observation evidence ordering：

```text
follow ordered residual case sequence
then deduplicate by first occurrence
then verify deterministic observation ref/hash pair
```

不得在 payload 中重复建立第二套：

```text
candidate_logical_time
candidate_as_of
```

若实现为了显示保留重复字段，Gate 必须强制其与 envelope 完全相等；首选是不重复。

## 21.2 Context identity

P-1 必须冻结：

```text
context_lineage_identity_kind
context_revision_identity_kind
```

推定目标：

```text
context_lineage_ref:
canonical twin_runtime_lineage_v1 object_id

context_revision_ref:
semantic revision_id
```

若现有 CAP-05 / DT-02 兼容语义不同，P-1 必须明确记录兼容规则或进入 amendment，不得仅依字段名猜测。

## 21.3 Payload profile

```yaml
object_type: twin_calibration_candidate_v1

candidate_status:
  BOUNDED_PARAMETER_DELTA_CANDIDATE
  # or NO_OP_BASE_PARAMETER_RETAINED

residual_refs:
  - exactly 16 ordered canonical residual refs

residual_set_hash: ...

base_config_ref: ...
base_config_hash: ...

source_runtime_config_refs:
  - ordered unique refs
source_runtime_config_set_hash: ...

effective_base_parameter_bundle_hash: ...
model_component_set_hash: ...

context_lineage_ref: ...
context_revision_ref: ...

parameter_key:
  dynamics_parameters.drainage_coefficient_per_hour

base_parameter_value: "0.030000"
candidate_parameter_value: "..."
parameter_delta: "..."

contract_admissible_bounds:
  minimum: "0.000000"
  maximum: "1.000000"

controlled_search_bounds:
  minimum: "0.020000"
  maximum: "0.040000"
  step: "0.001000"

case_input_set_hash: ...

calibration_case_builder_id: ...
calibration_case_builder_version: 1
calibration_engine_id: ...
calibration_engine_version: 1
metric_policy_id: ...
metric_policy_version: 1
candidate_selection_policy_id: ...
candidate_selection_policy_version: 1
runtime_replay_numeric_policy_id: ...
runtime_replay_numeric_policy_hash: ...
calibration_metric_numeric_policy_id: ...
calibration_metric_numeric_policy_hash: ...

baseline_training_metrics: ...
candidate_training_metrics: ...
parameter_excitation_summary: ...
error_classification_summary: ...
mass_balance_validation_summary: ...
physical_invariant_validation_summary: ...

activation_status: NOT_ACTIVE
eligible_for_state_input: false
eligible_for_runtime_config_use: false
eligible_for_human_activation_review: false

limitations:
  - CONTROLLED_REPLAY_ONLY
  - SINGLE_PARAMETER_ONLY
  - NOT_FIELD_CALIBRATED
  - NOT_TRUE_PARAMETER_IDENTIFICATION
  - NOT_STATISTICAL_SIGNIFICANCE
  - NOT_UNCERTAINTY_CALIBRATION
  - NOT_MODEL_ACTIVATION
```

Candidate immutable after commit。Shadow Evaluation 不修改 Candidate；review eligibility 只存在于 Evaluation。

---

# 22. Candidate identity、排序与D commit

Residual ref 排序规则：

```text
forecast_target_time ASC
then observation_available_to_runtime_at ASC
then residual_object_id ASC
```

Source Runtime Config refs 排序规则：

```text
first-use forecast_target_time ASC
then config_object_id ASC
deduplicate after first-use ordering
```

`calibration_run_id`：

```text
sha256(
  canonical(
    Reality scope
    + ordered residual refs and hashes
    + ordered actual observation refs and hashes
    + base_config_ref/hash or explicit null authority
    + effective parameter bundle hash
    + case builder identity
    + engine identity
    + metric policy identity
    + selection policy identity
    + Runtime replay numeric policy identity
    + calibration metric numeric policy identity
  )
)
```

D idempotency key：

```text
CALIBRATION_CANDIDATE:
calibration_run_id
```

D commit：

```text
append exactly one twin_calibration_candidate_v1
write Candidate projections/indexes
do not create or modify active config index
do not modify State
do not modify checkpoint
do not create model activation
do not create approval
```

Same key：

```text
same semantic hash
→ return existing canonical success

different semantic hash
→ conflict
```

Concurrency：

```text
concurrent same-key same-hash
→ exactly one append
→ all callers resolve same canonical object

concurrent same-key different-hash
→ exactly one canonical winner
→ conflicting caller fails deterministically
```

---

# 23. Paired historical replay shadow compute

Shadow kind：

```text
PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION
```

Exactly 8 holdout cases。

Base and candidate share：

```text
same source posterior
same Forecast point trace input
same rainfall
same irrigation
same ET0
same Kc
same runoff
same geometry
same observation operator
same process uncertainty
same observation uncertainty
same Runtime replay numeric policy
same calibration metric numeric policy
same Evidence cutoff
same actual observation
```

Only difference：

```text
drainage_coefficient_per_hour
```

S6 compute boundary：

```text
canonical fact writes:
0

projection writes:
0

active authority writes:
0

State writes:
0

checkpoint writes:
0
```

S6 outputs an in-memory / acceptance artifact：

```text
paired_shadow_compute_result_v1
```

它不是 canonical authority。S7 消费 exact deterministic result 并提交 canonical Evaluation。

---

# 24. Shadow metrics and exact Gate

Metrics：

```text
baseline_holdout_sse_vwc
candidate_holdout_sse_vwc

baseline_holdout_mse_vwc
candidate_holdout_mse_vwc

baseline_holdout_rmse_vwc
candidate_holdout_rmse_vwc

baseline_holdout_mae_vwc
candidate_holdout_mae_vwc

baseline_absolute_mean_bias_vwc
candidate_absolute_mean_bias_vwc

baseline_max_absolute_residual_vwc
candidate_max_absolute_residual_vwc

baseline_normalized_residual_summary
candidate_normalized_residual_summary

baseline_physical_failure_count
candidate_physical_failure_count

baseline_mass_balance_failure_count
candidate_mass_balance_failure_count

valid_case_count
excluded_case_count
```

Thresholds：

```text
required valid holdout cases:
8

RMSE relative improvement:
>= 5%

absolute mean bias tolerance:
candidate_abs_bias <= baseline_abs_bias + 0.000001000

maximum absolute residual:
candidate_max_abs <= baseline_max_abs × 1.10 + 0.000001000

candidate physical failures:
0

candidate mass-balance failures:
0

deterministic rerun:
required

future leakage:
0
```

Comparison authority：

```text
candidate_rmse <= baseline_rmse × 0.95
is evaluated as:
candidate_mse × 10000 <= baseline_mse × 9025

10% max-error tolerance:
exact integer cross-product

thresholds are inclusive
rounding occurs after disposition
```

Baseline zero handling：

```text
baseline RMSE = 0
and candidate RMSE = 0
→ BASE_PARAMETER_RETAINED

baseline RMSE = 0
and candidate RMSE > 0
→ NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW
  reason BASELINE_PERFECT_CANDIDATE_REGRESSION
```

No-op Candidate：

```text
candidate value = base value
→ base/candidate replay must be identical
→ evaluation disposition BASE_PARAMETER_RETAINED
→ reason NO_OP_CONFIRMED
```

Normalized residual 仅作 diagnostic comparison，不构成 uncertainty model calibration、coverage calibration 或 State confidence change。

---

# 25. Shadow Evaluation disposition machine

```text
ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW
NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW
BASE_PARAMETER_RETAINED
INCONCLUSIVE
```

Reason codes：

```text
ALL_THRESHOLDS_PASS
NO_OP_CONFIRMED
BASELINE_PERFECT
BASELINE_PERFECT_CANDIDATE_REGRESSION
INSUFFICIENT_VALID_HOLDOUT
RMSE_IMPROVEMENT_BELOW_THRESHOLD
BIAS_REGRESSION
MAX_ERROR_REGRESSION
PHYSICAL_INVARIANT_FAILURE
MASS_BALANCE_FAILURE
DETERMINISM_FAILURE
FUTURE_LEAKAGE_DETECTED
CASE_SET_MISMATCH
CONFIG_OR_MODEL_HETEROGENEITY
AVAILABILITY_ORDER_INVALID
```

无论 disposition：

```text
model_activated = false
active_config_changed = false
approval_created = false
activation_authorized = false
uncertainty_model_changed = false
state_confidence_changed = false
```

---

# 26. Embedded case results

`twin_shadow_evaluation_v1` 必须直接包含 8 个 case summaries：

```yaml
case_results:
  - case_index: 1
    residual_ref: ...
    residual_hash: ...
    source_forecast_ref: ...
    source_forecast_hash: ...
    source_forecast_point_ref: ...
    source_posterior_ref: ...
    source_runtime_config_ref: ...
    forecast_issued_at: ...
    forecast_as_of: ...
    forecast_target_time: ...
    observation_ref: ...
    observation_observed_at: ...
    observation_available_to_runtime_at: ...
    base_parameter_value: "0.030000"
    candidate_parameter_value: "..."
    base_prediction_vwc: "..."
    candidate_prediction_vwc: "..."
    actual_observation_vwc: "..."
    base_residual_vwc: "..."
    candidate_residual_vwc: "..."
    base_normalized_residual: "..."
    candidate_normalized_residual: "..."
    base_mass_balance_hash: ...
    candidate_mass_balance_hash: ...
    base_invariant_status: PASS
    candidate_invariant_status: PASS
```

同时保存：

```text
case_results_hash
```

Hash 不是 summaries 的替代品。

---

# 27. Shadow Evaluation envelope与canonical profile

## 27.1 Envelope mapping

Evaluation 必须满足 DT-02 base envelope：

```text
envelope.logical_time:
max holdout Forecast target time

envelope.as_of:
max holdout observation available_to_runtime_at

envelope.source_refs:
candidate_ref
+
ordered holdout residual refs

envelope.evidence_refs:
ordered unique holdout actual_observation_refs
resolved from the 8 Residual payloads

envelope.runtime_config_ref/hash:
base_config_ref/hash
unless P-1 explicitly adjudicates nullable profile

envelope.idempotency_key:
SHADOW_EVALUATION:<shadow_evaluation_id>

envelope.limitations:
payload limitations mirrored or strictly consistent
```

Residual refs不得直接放入 `evidence_refs`。

Observation evidence ordering：

```text
follow ordered holdout residual sequence
then deduplicate by first occurrence
then verify deterministic observation ref/hash pair
```

不得在 payload 中重复建立第二套：

```text
evaluation_logical_time
evaluation_as_of
```

## 27.2 Context mapping

```text
context_lineage_ref:
CONDITIONAL_PENDING_P_MINUS_1

context_revision_ref:
CONDITIONAL_PENDING_P_MINUS_1
```

P-1 必须选择：

```text
DIRECT_CONTEXT_REFS_ALLOWED
or
CONTEXT_INHERITED_THROUGH_CANDIDATE_ONLY
or
DT02_AMENDMENT_REQUIRED
```

并同时冻结 lineage/revision identity kind。

## 27.3 Payload profile

```yaml
object_type: twin_shadow_evaluation_v1

evaluation_kind:
  PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION

candidate_ref: ...
candidate_hash: ...

evaluation_dataset_refs:
  - exactly 8 ordered holdout residual refs

evaluation_dataset_hash: ...

base_config_ref: ...
base_config_hash: ...
base_model_parameter_bundle_hash: ...
candidate_model_parameter_bundle_hash: ...

# conditional by P-1:
context_lineage_ref: ...
context_revision_ref: ...

shadow_replay_engine_id: ...
shadow_replay_engine_version: 1

evaluation_policy_ref: ...
evaluation_policy_hash: ...
metric_policy_id: ...
metric_policy_version: 1
runtime_replay_numeric_policy_id: ...
runtime_replay_numeric_policy_hash: ...
calibration_metric_numeric_policy_id: ...
calibration_metric_numeric_policy_hash: ...

baseline_metrics: ...
candidate_metrics: ...
metric_deltas: ...

case_results:
  - exactly 8 embedded summaries

case_results_hash: ...
determinism_hash: ...

evaluation_disposition: ...
reason_codes: []

eligible_for_human_activation_review: true | false

model_activation_created: false
active_config_switch_performed: false
approval_created: false
activation_authorized: false
uncertainty_model_changed: false
state_confidence_changed: false

limitations:
  - CONTROLLED_REPLAY_HOLDOUT
  - NOT_SHADOW_ONLINE
  - NOT_FIELD_VALIDATED
  - NOT_TRUE_PARAMETER_IDENTIFICATION
  - NOT_STATISTICAL_SIGNIFICANCE
  - NOT_GENERALIZATION
  - NOT_UNCERTAINTY_CALIBRATION
  - NOT_CAUSAL_EFFECT_EVIDENCE
  - NOT_MODEL_ACTIVATION
```

---

# 28. Evaluation identity、cardinality与D commit

Holdout ref 排序规则：

```text
forecast_target_time ASC
then observation_available_to_runtime_at ASC
then residual_object_id ASC
```

`shadow_evaluation_id`：

```text
sha256(
  canonical(
    candidate_ref/hash
    + ordered holdout residual refs/hashes
    + ordered holdout observation refs/hashes
    + evaluation policy ref/hash
    + replay engine identity
    + metric policy identity
    + Runtime replay numeric policy identity
    + calibration metric numeric policy identity
  )
)
```

D idempotency key：

```text
SHADOW_EVALUATION:
shadow_evaluation_id
```

S7 transaction：

```text
append exactly one twin_shadow_evaluation_v1
write evaluation index
write candidate-to-evaluation index
write case-result projection
all projections in same DB transaction
do not create or modify active config index
do not modify State
do not create Activation
```

Candidate-to-Evaluation cardinality：

```text
one Candidate
→ zero or many Evaluations

uniqueness:
candidate_ref
+
evaluation_dataset_hash
+
evaluation_policy_hash
+
engine identity
+
metric numeric policy hash
```

禁止将 `candidate_ref` 单独设为唯一键。

Concurrency：

```text
concurrent same-key same-hash
→ exactly one Evaluation append
→ all callers resolve same canonical object

concurrent same-key different-hash
→ exactly one canonical winner
→ conflict fails deterministically
```

---

# 29. Runtime Config、explicit replay pin 与可空 active binding

必须分离：

```text
explicit Runtime Config pin:
current established Replay selection authority

immutable per-operation Runtime Config snapshot:
tick/evaluation operation-specific canonical snapshot

effective model parameter bundle:
actual parameters used by Dynamics

active config binding:
optional governance-selected active authority pointer
not assumed to exist
```

S0 必须记录：

```yaml
config_authority_mode:
  EXPLICIT_REPLAY_PIN
  # or ACTIVE_BINDING

state_bound_runtime_config_ref: ...
state_bound_runtime_config_hash: ...

active_binding_status:
  NOT_ESTABLISHED
  # or ESTABLISHED

active_binding_ref: null
active_binding_hash: null
```

当 `active_binding_status = NOT_ESTABLISHED`：

```text
active_binding_ref must be null
active_binding_hash must be null
no active-binding implementation claim is permitted
```

Candidate / Evaluation：

```text
may reference base Runtime Config
may reference policy artifact or conditional policy Config
may carry candidate parameter bundle hash

but:
must not become Runtime selection authority
```

Post-evaluation tick 允许创建新的 immutable Runtime Config snapshot，但必须证明：

```text
no twin_model_activation_v1 appended
no active-config index created or modified
Candidate ref is not Runtime Config authority
Evaluation ref is not Runtime Config authority
candidate parameter bundle hash is not consumed
post-evaluation tick parameter value == 0.030000
post-evaluation Runtime Config derives from existing explicit predecessor chain
```

若 active binding 确实已在未来 predecessor 中建立，还必须证明 before/after 相等；若未建立，不得伪造 pointer snapshot。

---

# 30. Conditional calibration-governance Config

默认：

```text
CONFIG_OBJECT_NOT_REQUIRED
```

仅当 P-1 输出：

```text
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_REQUIRED
```

才执行 S4：

```text
delivery_slice_id:
MCFT-CAP-06.MCFT-02-12.CALIBRATION-GOVERNANCE-CONFIG-V1
```

该 Config 必须满足 DT-02 required refs，并且仅表示 immutable governance policy snapshot：

```yaml
object_type: twin_runtime_config_v1

purpose:
  CALIBRATION_CANDIDATE_SHADOW_EVALUATION_POLICY_V1

parent_runtime_config_ref: ...
parent_runtime_config_hash: ...

soil_root_zone_config_refs:
  - exact inherited governed root-zone config refs

model_component_refs:
  - water-balance model component
  - calibration engine component
  - shadow replay engine component
  - metric policy component
  - numeric policy component

base_parameter_bundle_hash: ...
parameter_search_policy_ref: ...
parameter_search_policy_hash: ...
sensitivity_policy_ref: ...
sensitivity_policy_hash: ...
shadow_evaluation_policy_ref: ...
shadow_evaluation_policy_hash: ...
runtime_replay_numeric_policy_ref: ...
runtime_replay_numeric_policy_hash: ...
calibration_metric_numeric_policy_ref: ...
calibration_metric_numeric_policy_hash: ...

active_binding_eligible: false
state_tick_eligible: false
model_activation_created: false

limitations:
  - GOVERNANCE_POLICY_SNAPSHOT_ONLY
  - NOT_ACTIVE_MODEL_CONFIG
  - NOT_STATE_TICK_CONFIG
```

若 P-1 输出：

```text
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED
```

则：

```text
S4 is omitted
S5 depends directly on S3
policy artifacts must be immutable and hash-pinned
canonical Config delta = 0
```

---

# 31. Authorization lifecycle

## P0

```text
P0 merged-effective:
CAP-06 status = NOT_AUTHORIZED
authorization_effective = false
runtime_source_authorized = false
active_delivery_slice_id = null
only S0 governance work eligible
```

## S0 candidate

```text
authorization_effective = false
runtime_source_authorized = false
active_delivery_slice_id = null
S0 changed files = governance, predecessor readback and qualification only
```

## S0 effectiveness

只有同时满足：

```text
S0 exact-head CI PASS
S0 merge
head-to-merge file delta = 0
head-to-merge tree equivalence = PASS
merged-main Authorization Gate = PASS
```

才转换为：

```text
authorization_effective = true
runtime_source_authorized = true
active_delivery_slice_id = MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
only S1 authorized
S2 through closure slices blocked
```

每个后继 Slice 必须：

```text
merge-before-next
head-to-merge-tree-equivalence-before-next
postmerge-Gate-before-next
one active implementation slice
no parallel downstream PR
```

---

# 32. Delivery Slice Graph

基础图：

```text
P-1
DT-02 Object / Transaction / Envelope Adjudication
↓
P-1A
only when amendment required
↓
P0
CAP-05 Terminal SSOT Reconciliation / CAP-06 Provisional SSOT
↓
S0
Authorization / Predecessor Lock / Structural Dataset Qualification
↓
S1
Canonical Matched Residual Windows
↓
S2
Calibration / Shadow Contracts, Fixed-Point Math and Policies
↓
S3
D Persistence, Idempotency, Projection and Recovery
```

P-1 Outcome A：

```text
S3
↓
S4
Calibration Governance Config Commit
↓
S5
Calibration Candidate Compute and D Commit
```

P-1 Outcome B：

```text
S3
↓
S5
Calibration Candidate Compute and D Commit
```

随后统一：

```text
S5
↓
S6
Zero-Write Paired Historical Replay Compute
↓
S7
Shadow Evaluation D Commit
↓
S8
Response-Loss / Readback / Rebuild / Corruption Guards
↓
S9
Post-Evaluation Base-Parameter Non-Consumption Tick
↓
S10
Bounded End-to-End Chain / Zero-Write Replay /
Repository-History Assessment
↓
S11A
Closure Candidate
↓
S11B
S11A Merged-main Finalization Gate
↓
S11C
Capability Completion Effectiveness Activation
↓
S11D
Final Effectiveness Reconciliation
```

---

# 33. 正式 Slice IDs

```text
P-1
MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1

P-1A
MCFT-CAP-06.P-1A.DT02-ARCHITECTURE-AMENDMENT-V1

P0
MCFT-CAP-06.P0.CAP-05-TERMINAL-SSOT-RECONCILIATION-AND-PROVISIONAL-SSOT-V1

S0
MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1

S1
MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1

S2
MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1

S3
MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1

S4 conditional
MCFT-CAP-06.MCFT-02-12.CALIBRATION-GOVERNANCE-CONFIG-V1

S5
MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1

S6
MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1

S7
MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1

S8
MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1

S9
MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1

S10
MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1

S11A
MCFT-CAP-06.CLOSURE-CANDIDATE-V1

S11B
MCFT-CAP-06.CLOSURE-MERGED-MAIN-FINALIZATION-GATE-V1

S11C
MCFT-CAP-06.CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-V1

S11D
MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1
```

---

# 34. Slice scope

## P-1

```text
governance only
architecture and envelope adjudication
no Runtime
no migration
no canonical write
```

## P0

```text
reconcile CAP-05 terminal COMPLETE facts across current-state projections
create CAP-06 provisional SSOT
keep CAP-06 unauthorized
freeze conditional graph from P-1 outcome
do not reopen CAP-05 closure
```

## S0

```text
read PostgreSQL predecessor handoff
lock latest State / checkpoint / Forecast / Scenario / Config authority
record active-binding status as established or not established
structurally qualify repository history
emit machine-readable dataset qualification
authorize only S1 after merged-main Gate
```

## S1

```text
consume preseeded controlled acceptance DB profile
materialize 24 matched Residual cases only
using existing Forecast / Observation / C transaction contracts
freeze 16 calibration refs
freeze 8 later holdout refs
prove dual time separation
prove PASS-only quality
prove no leakage
```

## S2

```text
Candidate profile
Evaluation profile
base-envelope mapping
context identity contract
exact-ref-only Candidate data port
case builder
Runtime replay numeric policy mapping
calibration metric numeric policy
fixed-point grid search
exact SSE/MSE authority
integer sqrt display policy
sensitivity
wetness regimes
objective flatness
best-second MSE margin
boundary handling
no-op semantics
error classification summary
uncertainty unchanged contract
metric formulas
threshold formulas
embedded case summaries
negative fixtures
```

## S3

```text
zero or one additive migration as P-1 adjudicated
D Candidate persistence
D Evaluation persistence
idempotency
concurrent duplicate/conflict handling
Candidate projection
Evaluation projection
candidate-to-evaluation one-to-many index
case-result projection
facts-based recovery
active-index creation/nonmutation guard
```

## S4 conditional

```text
one non-active calibration-governance Config D commit
only when P-1 proves Config object is required
```

## S5

```text
16-case calibration compute
base replay reproduction
21-point grid
sensitivity and identifiability
error classification summary
Candidate state machine
Candidate D commit
canonical readback
```

## S6

```text
8-case paired base/candidate replay
zero canonical writes
zero projection writes
deterministic compute artifact
```

## S7

```text
Evaluation builder
8 embedded case summaries
Evaluation D commit
canonical readback
review eligibility only
no Activation
```

## S8

```text
same-key same-hash recovery
same-key different-hash conflict
concurrent duplicate/conflict
response-loss recovery
projection deletion rebuild
guard deletion rebuild
corrupt projection fail closed
canonical divergence fail closed
Runtime authority unchanged
```

## S9

```text
execute one normal A1/B tick
use base-equivalent effective parameters
prove Candidate/Evaluation non-consumption
prove no Activation and no active-index change
```

## S10

```text
run bounded end-to-end controlled path
freeze actual canonical delta
run completed-chain zero-write replay
run read-only repository-history calibration assessment
retain both-track separation proof
```

## S11A

```text
materialize closure candidate
keep all completion claims pending
keep active slice S11A
keep CAP-07 unauthorized
```

## S11B

```text
checkout exact S11A merge commit
run proof-only merged-main Finalization Gate
close probe PR without merge
```

## S11C

```text
activate frozen capability completion claims
set COMPLETE candidate state
clear active slice only after merge effectiveness
keep CAP-07 unauthorized
never create model activation
```

## S11D

```text
record S11C exact head
record exact-head CI
record merge commit
record head-to-merge zero delta
record tree equivalence
record S11C merged-main probe
record final effective claims
run final proof-only reconciliation probe
close proof PR without merge
no further SSOT writeback
```

---

# 35. Predecessor lock

S0 从 PostgreSQL canonical read path 锁定：

```text
active lineage object ref
semantic lineage ID
active revision context
latest posterior State ref/hash
latest checkpoint ref/hash
latest successful Forecast ref/hash
latest Scenario Set ref/hash
latest State-bound Runtime Config ref/hash
config authority mode
active-binding status and nullable ref/hash
checkpoint sequence
latest logical time
next logical tick
```

Design baseline expected from CAP-05 closure：

```text
checkpoint sequence:
80

historical S10 label, not authoritative State fact count:
81

exact S0 v2 reproduced State fact count:
33

latest logical time:
2026-06-04T09:00:00.000Z

next logical time:
2026-06-04T10:00:00.000Z
```

S0 必须从实际 PostgreSQL 重新证明，不能仅复制 Closure Record。

---

# 36. Base Config authority

Candidate 的单一 `base_config_ref` 由 P-1 冻结 nullable rule，并由 S2/S5 实现确定性选择。

Selection algorithm：

```text
1. collect canonical Runtime Configs referenced by all 16 calibration cases;

2. require every case to share:
   effective drainage coefficient
   effective parameter bundle hash
   model component set hash
   geometry hash
   observation operator hash
   Runtime replay numeric policy hash;

3. resolve config_authority_mode at candidate.as_of;

4. under EXPLICIT_REPLAY_PIN:
   select latest eligible case-referenced canonical Runtime Config
   with matching effective semantics;

5. under ACTIVE_BINDING:
   prefer the config referenced by the active binding
   when it has matching effective semantics;

6. when multiple eligible configs remain:
   logical_time DESC
   then object_id ASC;

7. when no unique eligible config exists:
   CONFIG_OR_MODEL_HETEROGENEITY
   no Candidate append.
```

Candidate 还必须保存：

```text
ordered source_runtime_config_refs
source_runtime_config_set_hash
effective_base_parameter_bundle_hash
config_authority_mode
```

---

# 37. Logical time and as_of

Candidate：

```text
envelope.logical_time:
max calibration Forecast target time

envelope.as_of:
max calibration observation available_to_runtime_at
```

Evaluation：

```text
envelope.logical_time:
max holdout Forecast target time

envelope.as_of:
max holdout observation available_to_runtime_at
```

`created_at` 仅为 operational metadata，排除在 semantic identity 和 anti-leakage authority 之外。

---

# 38. Standard controlled fixture behavior

Standard positive fixture必须形成：

```text
Candidate status:
BOUNDED_PARAMETER_DELTA_CANDIDATE

Candidate parameter:
strictly inside 0.020000..0.040000

Candidate parameter:
not equal to 0.030000

Shadow Evaluation:
ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW

Model activation created:
false

Runtime authority changed:
false
```

Independent no-op fixture必须形成：

```text
Candidate status:
NO_OP_BASE_PARAMETER_RETAINED

Shadow Evaluation disposition:
BASE_PARAMETER_RETAINED

Reason:
NO_OP_CONFIRMED
```

Independent insufficient fixture必须形成：

```text
INSUFFICIENT_PARAMETER_EXCITATION
no Candidate canonical append
```

Repository-history qualification和assessment不要求复制 controlled positive fixture结论。

---

# 39. Post-evaluation non-consumption tick

S9 标准路径：

```text
capture config authority mode and predecessor Config chain
↓
read Candidate and Evaluation as governance history only
↓
build ordinary base-equivalent Runtime Config snapshot
↓
execute existing normal A1 State Tick
↓
execute existing B Scenario commit
↓
re-read config authority and canonical outputs
```

必须证明：

```text
no twin_model_activation_v1 appended
no active-config index created or modified

when active_binding_status = ESTABLISHED:
active binding before == active binding after

when active_binding_status = NOT_ESTABLISHED:
active binding refs remain null
no active-binding implementation claim is made

effective drainage coefficient used by Dynamics:
0.030000

candidate coefficient:
not consumed

candidate_ref:
not present as Runtime authority

evaluation_ref:
not present as Runtime authority

State Tick:
normal A1

Forecast:
normal COMPLETED 72-point Forecast

Scenario:
normal three-option Scenario Set
```

---

# 40. Canonical count formula

不得在 P-1 / S0 前硬编码最终 repository canonical delta。

标准 controlled path公式：

```text
new Residual facts:
R
where 0 <= R <= 24

conditional calibration-governance Config:
C
where C in {0,1}

Calibration Candidate:
1

Shadow Evaluation:
1

post-evaluation tick Runtime Config:
1

post-evaluation A1 record set:
8

post-evaluation B Scenario Set:
1

total canonical delta:
R + C + 12
```

若 controlled acceptance DB 从无 Residual 开始：

```text
R = 24

total:
36 when C = 0
37 when C = 1
```

Projection rows、idempotency rows、lease rows、operational attempt results 和 preseed fixture facts 不计入 CAP-06 canonical Runtime delta。

---

# 41. Required deliverables

```text
docs/digital_twin/mcft/cap_06/
  GEOX-MCFT-CAP-06-TASK.md
  GEOX-MCFT-CAP-06-P-1-ADJUDICATION.md
  GEOX-MCFT-CAP-06-P-1-STATUS.json
  GEOX-MCFT-CAP-06-P0-STATUS.json
  GEOX-MCFT-CAP-06-AUTHORIZATION.md
  GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json
  GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json
  GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json
  GEOX-MCFT-CAP-06-REPOSITORY-HISTORY-ASSESSMENT.json
  GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json
  GEOX-MCFT-CAP-06-CALIBRATION-CASE-CONTRACT.json
  GEOX-MCFT-CAP-06-CALIBRATION-CANDIDATE-PROFILE.json
  GEOX-MCFT-CAP-06-SHADOW-EVALUATION-PROFILE.json
  GEOX-MCFT-CAP-06-RUNTIME-REPLAY-NUMERIC-POLICY.json
  GEOX-MCFT-CAP-06-CALIBRATION-METRIC-NUMERIC-POLICY.json
  GEOX-MCFT-CAP-06-SEARCH-POLICY.json
  GEOX-MCFT-CAP-06-SENSITIVITY-POLICY.json
  GEOX-MCFT-CAP-06-SHADOW-EVALUATION-POLICY.json
  GEOX-MCFT-CAP-06-EXACT-REF-DATA-PORT-CONTRACT.md
  GEOX-MCFT-CAP-06-PERSISTENCE-MATRIX.json
  GEOX-MCFT-CAP-06-FAILURE-RECOVERY-CONTRACT.md
  conditional/GEOX-MCFT-CAP-06-GOVERNANCE-CONFIG-CONTRACT.json
  GEOX-MCFT-CAP-06-CLOSURE-RECORD.json
  GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json
  GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json
  GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json

fixtures/mcft/water_state/calibration_shadow_v1/**
fixtures/mcft/water_state/expected/MCFT_CAP_06_*
fixtures/mcft/water_state/negative/MCFT_CAP_06_*

apps/server/scripts/mcft/
  MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts

scripts/runtime_acceptance/
  ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts
  ACCEPTANCE_MCFT_CAP_06_DATASET_QUALIFICATION.ts
  ACCEPTANCE_MCFT_CAP_06_RESIDUAL_WINDOWS_DB.ts
  ACCEPTANCE_MCFT_CAP_06_CONTRACTS_MATH.ts
  ACCEPTANCE_MCFT_CAP_06_EXACT_REF_PORT.ts
  ACCEPTANCE_MCFT_CAP_06_PERSISTENCE_DB.ts
  ACCEPTANCE_MCFT_CAP_06_CANDIDATE_DB.ts
  ACCEPTANCE_MCFT_CAP_06_SHADOW_COMPUTE.ts
  ACCEPTANCE_MCFT_CAP_06_EVALUATION_DB.ts
  ACCEPTANCE_MCFT_CAP_06_RESTART_RECOVERY.ts
  ACCEPTANCE_MCFT_CAP_06_NON_CONSUMPTION_TICK.ts
  ACCEPTANCE_MCFT_CAP_06_BOUNDED_CHAIN.ts

scripts/governance_acceptance/
  ACCEPTANCE_MCFT_CAP_06_P_MINUS_1_ADJUDICATION.cjs
  ACCEPTANCE_MCFT_CAP_06_P0_RECONCILIATION.cjs
  ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs
  ACCEPTANCE_MCFT_CAP_06_CLOSURE.cjs
  ACCEPTANCE_MCFT_CAP_06_FINALIZATION_EFFECTIVENESS.cjs
  ACCEPTANCE_MCFT_CAP_06_FINAL_EFFECTIVENESS_RECONCILIATION.cjs
```

---

# 42. Capability-wide changed-file boundary

默认允许新增：

```text
docs/digital_twin/mcft/cap_06/**
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

apps/server/src/domain/calibration/**
apps/server/src/runtime/calibration/**
apps/server/src/persistence/calibration/**
apps/server/src/projections/calibration/**

apps/server/db/migrations/<zero or one exact CAP-06 additive migration>
apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts
fixtures/mcft/water_state/calibration_shadow_v1/**
fixtures/mcft/water_state/expected/MCFT_CAP_06_*
fixtures/mcft/water_state/negative/MCFT_CAP_06_*
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_*
apps/server/package.json only for exact runner commands
```

仅在 P-1A 明确授权时允许：

```text
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-*.md
```

既有以下目录不得以 capability-wide wildcard 直接授权：

```text
apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**
```

若某 Slice 必须修改既有 adapter 或 contract 文件：

```text
P-1 or the immediately preceding governance Slice must identify the exact file
the Slice must freeze the exact path
the change must be additive or adapter-only
the Slice Gate must reject all other existing-file changes
```

禁止：

```text
apps/web/**
public generated-object write routes
/api/v1/actions/*
AO-ACT source
device runtime
scheduler / daemon
active model activation source
active config switch source
twin_model_activation_v1 write implementation
late-Evidence revision Runtime
historical CAP-05 fact rewrite
historical CAP-05 completion-claim rewrite
Forecast math semantic rewrite
Assimilation semantic rewrite
Scenario semantic rewrite
multi-parameter optimizer
external ML training service
network-based optimizer dependency
```

Capability-wide allowance不等于单 Slice 可修改所有目录。每个 Slice 必须冻结 exact changed files。

---

# 43. Hard Acceptance evidence ledger

Hard Acceptance 的唯一计数权威是 machine-readable evidence ledger，不使用手工维护的 prose 总数。

每项必须具有：

```yaml
acceptance_id: ...
category: ...
status: PASS | FAIL | NOT_APPLICABLE
evidence_refs: []
workflow_refs: []
canonical_refs: []
notes: []
```

Mandatory categories：

## A. Architecture and predecessor

```text
P-1 is the first permitted repository action
P-1 changes no Runtime source
P-1 changes no migration
P-1 appends no canonical fact
P-1 adjudicates Candidate object reuse
P-1 adjudicates Evaluation object reuse
P-1 adjudicates D transaction reuse
P-1 adjudicates Evaluation context refs
P-1 adjudicates lineage/revision identity kinds
P-1 adjudicates base_config_ref authority
P-1 adjudicates envelope source/evidence/config mapping
P-1 adjudicates Config-object requirement
P-1 adjudicates migration count
P-1 adjudicates failed-attempt persistence
P-1 adjudicates Candidate-to-Evaluation cardinality
P-1 outputs one of the three frozen outcomes
P-1A is mandatory when amendment is required
CAP-05 status is COMPLETE
CAP-05 closure_effective is true
CAP-05 capability_complete is true
CAP-05 active slice is null
CAP-05 next repository action is null
CAP-06 remains unauthorized before S0 effectiveness
design baseline records main 9c4030e43d3b65857cf40d7936d5dfa8e80c17d1
execution baseline is re-resolved at Slice runtime
```

## B. Authorization lifecycle

```text
P0 keeps authorization_effective false
P0 keeps runtime_source_authorized false
P0 active slice is null
P0 reconciles stale CAP-05 cross-file projections without reopening CAP-05
S0 candidate remains governance-only
S0 candidate authorization_effective is false
S0 candidate Runtime authority is false
S0 exact-head CI passes
S0 head-to-merge file delta is zero
S0 tree equivalence passes
S0 merged-main Authorization Gate passes
only after S0 effectiveness authorization_effective becomes true
only after S0 effectiveness runtime_source_authorized becomes true
only S1 becomes active after S0
S2 through closure slices remain blocked after S0
one active implementation Slice is enforced
no downstream PR runs in parallel
each Slice merges before the next
each Slice has a postmerge Gate before the next
```

## C. Predecessor lock and structural qualification

```text
predecessor lock comes from PostgreSQL canonical readback
active lineage object ref is recorded
semantic lineage ID is recorded separately
active revision context is recorded
latest posterior State ref/hash is exact
latest checkpoint ref/hash is exact
latest successful Forecast ref/hash is exact
latest Scenario ref/hash is exact
latest State-bound Config ref/hash is exact
config authority mode is recorded
active-binding status is explicit and nullable
expected checkpoint sequence 80 is revalidated
expected global State count 81 is revalidated
expected next logical time 2026-06-04T10:00:00.000Z is revalidated
qualification reports eligible Forecast count
qualification reports eligible Observation count
qualification reports eligible matched-pair count
qualification reports eligible Residual count
qualification reports calibration count
qualification reports holdout count
qualification reports model/config hash cardinalities
S0 does not compute sensitivity or objective surface
dataset qualification status uses only the S0 enum
repository calibration assessment uses a separate S10 enum
24 Forecasts alone never imply 24 eligible pairs
```

## D. Controlled-track isolation and Residual windows

```text
controlled track runs in isolated or namespaced acceptance storage
controlled refs and repository-history refs are disjoint
preseed DB profile is verified
preseed source objects are not counted as CAP-06 Runtime delta
standard controlled track has exactly 24 matched cases
Calibration window has exactly 16 cases
Holdout window has exactly 8 cases
Calibration and holdout refs are disjoint
Calibration target times precede holdout target times
Calibration availability times precede holdout availability times
Candidate as_of equals maximum calibration availability
Candidate as_of precedes minimum holdout availability
Forecast target time equals observation observed_at
Forecast issued_at precedes observation availability
Forecast as_of precedes observation availability
Forecast Evidence cutoff does not exceed Forecast as_of
created_at is not anti-leakage authority
Candidate compute receives no holdout refs
Candidate exact-ref port cannot query holdout or range indexes
Holdout observations are unavailable at Candidate as_of
duplicate target time is rejected
conflicting semantic duplicate is rejected
observation quality PASS is required
LIMITED quality is excluded from standard windows
wrong scope is rejected
wrong lineage context is rejected
wrong revision context is rejected
wrong unit is rejected
```

## E. Case authority and numeric-policy separation

```text
case authority is canonical H1 Forecast point trace
Forecast run ref/hash resolves
Forecast point ref/hash resolves
source posterior ref/hash resolves
source Runtime Config ref/hash resolves
forcing_cycle_key resolves
forcing_window_hash resolves
weather ref/hash resolves
ET0 ref/hash resolves
crop-stage/Kc authority resolves
geometry ref/hash resolves
observation operator authority resolves
Runtime replay numeric policy resolves
calibration metric numeric policy resolves
Forecast as_of resolves
Evidence Window cutoff resolves
base replay reproduces canonical scale-6 storage and trace exactly
base replay mismatch prevents Candidate append
metric scale-9 conversion is deterministic
all cases share effective drainage coefficient
all cases share effective parameter bundle hash
all cases share model component set hash
all cases share observation operator hash
all cases share geometry hash
all cases share Runtime replay numeric policy hash
Config/model heterogeneity prevents Candidate append
fresh external forcing retrieval is not used
case input set hash is deterministic
```

## F. Numeric, sensitivity and search math

```text
Runtime storage/water scale remains 6
Runtime variance scale remains 12
calibration VWC metric scale is 9
squared-error accumulator scale is 18
half-away-from-zero policy is frozen
host floating-point epsilon is not authority
display-rounded metrics are not Gate authority
candidate ranking primary authority is exact MSE
integer sqrt algorithm is frozen for RMSE display
grid starts at 0.020000
grid ends at 0.040000
grid step is 0.001000
grid has exactly 21 points
each grid point replays identical 16 cases
only drainage coefficient differs
prediction span is computed for every case
sensitivity epsilon is 0.000001000 VWC
at least 4 cases are sensitive
wetness regime formula has no undefined epsilon
at least 2 sensitive wetness regimes are represented
objective MSE range threshold is frozen
best-vs-second MSE margin threshold is frozen
secondary metric is absolute mean bias
tertiary metric is maximum absolute residual
tie-break minimizes delta from base then lower value
```

## G. Candidate contract and recovery

```text
insufficient excitation produces no Candidate append
flat surface produces no Candidate append
insufficient margin produces no Candidate append
boundary hit produces no Candidate append
physical invariant failure produces no Candidate append
mass-balance failure produces no Candidate append
determinism failure produces no Candidate append
invalid case set produces no Candidate append
non-zero interior optimum appends Candidate
base optimum appends canonical no-op Candidate
no-op is recoverable governance history
error classification summary is present
uncertainty_change is NONE
Candidate uses twin_calibration_candidate_v1
Candidate uses D transaction
Candidate is NON_LINEAGE_CONTEXT
Candidate context identity matches P-1
Candidate has exactly 16 deterministically ordered residual refs
Candidate source_refs include residual refs
Candidate evidence_refs contain Observation Evidence, not Residual objects
Candidate stores residual set hash
Candidate stores base_config_ref/hash under P-1 rule
Candidate stores source Runtime Config refs/set hash
Candidate stores effective base bundle hash
Candidate stores both numeric policy identities
Candidate stores case-input-set hash
Candidate activation status is NOT_ACTIVE
Candidate is not eligible for State input
Candidate is not eligible for Runtime Config use
Candidate is not eligible for human activation review before Evaluation
Candidate D commit appends exactly one canonical object
Candidate D commit does not modify Runtime authority
same-key and concurrency behavior is deterministic
response loss recovers canonical Candidate
Candidate projections rebuild from facts
corrupt surviving projection fails closed
```

## H. Shadow compute, Evaluation and recovery

```text
Shadow kind is paired historical replay
exactly 8 holdout cases are used
base and candidate share all inputs except drainage coefficient
S6 canonical fact delta is zero
S6 projection delta is zero
S6 Runtime authority delta is zero
S6 State delta is zero
S6 checkpoint delta is zero
Shadow compute rerun is deterministic
future leakage count is zero
Evaluation requires 8 valid cases
5% RMSE improvement comparison uses squared quantities
bias tolerance is exact
max-error tolerance is exact
baseline RMSE zero handling is frozen
no-op Candidate yields BASE_PARAMETER_RETAINED
normalized residual is diagnostic only
Evaluation uses twin_shadow_evaluation_v1
Evaluation uses D transaction
Evaluation context rule matches P-1
Evaluation has exactly 8 deterministically ordered residual refs
Evaluation source_refs contain Candidate and Residual refs
Evaluation evidence_refs contain Observation Evidence, not Residual objects
Evaluation embeds exactly 8 case summaries
Evaluation stores both numeric policy identities
Evaluation records no uncertainty-model change
Evaluation records no activation or approval
one Candidate may have zero or many Evaluations
Candidate-to-Evaluation index is not unique on candidate_ref alone
same-key and concurrency behavior is deterministic
response loss recovers canonical Evaluation
Evaluation projections rebuild from facts and embedded summaries
corrupt surviving projection and canonical divergence fail closed
```

## I. Runtime authority and post-evaluation Tick

```text
config authority mode is explicit
active-binding absence is represented as NOT_ESTABLISHED with null refs
no active-binding implementation claim is made when absent
no twin_model_activation_v1 is appended
no active-config index is created or modified
when active binding exists, before equals after
post-evaluation Tick uses coefficient 0.030000
Candidate coefficient is not consumed
Candidate ref is not Runtime authority
Evaluation ref is not Runtime authority
a new immutable per-tick Config may exist
same effective parameter does not require same Config object ID
existing A1 State Tick implementation is reused
existing B Scenario implementation is reused
standard Forecast has 72 points
standard Scenario Set has three options
Candidate and Evaluation do not mutate State directly
```

## J. Bounded chain and closure

```text
canonical delta uses R + C + 12 formula
actual R is frozen from S1
actual C is frozen from P-1
projection rows are counted separately
completed-chain rerun adds zero canonical facts
completed-chain rerun adds zero projection divergence
repository-history assessment is retained separately
controlled fixture does not masquerade as field calibration
S11A Closure Candidate keeps claims pending
S11B verifies exact S11A merge commit
S11B proof PR closes without merge
S11C is Capability Completion Effectiveness Activation, not Model Activation
S11C does not claim its own unknown postmerge evidence
S11D records S11C exact-head, merge and postmerge proof
final reconciliation proof PR closes without merge
no SSOT writeback follows final proof success
final active Slice is null
runtime source authority is false after closure
MCFT-CAP-07 remains unauthorized
```

---

# 44. Required negative tests

```text
P-1 missing
P-1 unresolved
amendment required but P-1A absent
P0 starts before adjudication

CAP-05 not COMPLETE
CAP-05 active slice non-null
CAP-06 Runtime write before S0 effectiveness
parallel downstream PR
head-to-merge delta nonzero
postmerge Gate missing

predecessor checkpoint mismatch
predecessor State mismatch
predecessor Forecast mismatch
config authority mode unresolved
active binding marked established with null ref
active binding marked absent with non-null ref
wrong lineage context identity kind
wrong revision context identity kind

controlled fixture writes into repository-history scope
controlled and repository refs overlap
preseed DB profile incomplete
source Forecast/observation prerequisites missing

24 Forecasts but fewer than 24 observations
24 observations but fewer than 24 matches
matched pairs with heterogeneous parameter bundle
availability-order inversion
training/holdout target overlap
training/holdout availability overlap
holdout ref passed to Candidate compute
Candidate repository exposes search/range method
Candidate SQL queries by time range or scope instead of exact refs
Candidate as_of after holdout availability

Forecast target mismatch
Forecast issued after observation availability
Forecast as_of after observation availability
Evidence cutoff unresolved
created_at used as leakage authority
quality LIMITED in standard window
wrong observation unit
duplicate target time
conflicting semantic duplicate

base replay scale-6 storage mismatch
base replay mass-balance trace mismatch
fresh forcing retrieval used
missing point trace
missing source posterior
missing Runtime Config
missing forcing_cycle_key
missing forcing_window_hash
missing weather ref/hash
missing ET0 ref/hash
missing observation operator authority
missing geometry hash
Runtime numeric policy mismatch
metric numeric policy mismatch

host floating point used as selection authority
display RMSE used as flatness authority
integer sqrt policy missing
insufficient sensitive cases
one wetness regime only
flat objective surface
insufficient best-second MSE margin
lower search-bound hit
upper search-bound hit
physical invariant failure
mass-balance failure
determinism failure

Candidate source_refs mismatch
Candidate evidence_refs contain Residual object
Candidate evidence_refs omit Observation Evidence
Candidate duplicate payload time conflicts with envelope
Candidate uses wrong object type
Candidate uses wrong transaction
Candidate modifies Runtime authority
Candidate modifies State
Candidate creates Model Activation
same key different hash Candidate
concurrent duplicate Candidate append
concurrent conflicting Candidate both accepted
failed Candidate attempt persisted contrary to P-1 mode
failed D transaction creates Candidate projection

Shadow compute writes canonical fact
Shadow compute writes projection
base/candidate case mismatch
future observation read before Candidate as_of
holdout case count below 8
baseline RMSE zero with candidate regression
RMSE improvement below 5%
bias regression
max-error regression
Candidate physical failure
Candidate mass-balance failure
normalized residual treated as uncertainty calibration

Evaluation context refs violate P-1 outcome
Evaluation source_refs mismatch
Evaluation evidence_refs contain Residual object
Evaluation evidence_refs omit Observation Evidence
Evaluation omits embedded case summaries
Evaluation case-results hash mismatch
Evaluation wrong Candidate
Evaluation wrong dataset refs
Evaluation uses wrong transaction
Evaluation modifies Runtime authority
Evaluation creates approval
Evaluation creates Model Activation
Candidate-to-Evaluation index unique on candidate_ref alone
same key different hash Evaluation
concurrent duplicate Evaluation append
concurrent conflicting Evaluation both accepted

projection deletion duplicate accepted
guard deletion duplicate accepted
corrupt surviving projection accepted
canonical divergence accepted
response-loss duplicate Candidate
response-loss duplicate Evaluation

post-evaluation Tick consumes Candidate
post-evaluation Tick uses Candidate coefficient
active-config index created or modified
active binding absence treated as established
Candidate ref becomes Runtime authority
Evaluation ref becomes Runtime authority
new Config object ID incorrectly required to equal old Config

canonical count uses R + C + 11
completed-chain rerun writes new facts
S11C named or treated as Model Activation
S11C self-claims unknown merge evidence
final reconciliation missing
public route added
web changed
scheduler added
CAP-07 authorized
```

每个 negative fixture 必须包含：

```yaml
fixture_id: ...
expected_reason_code: ...
expected_failure_stage: ...

expected_candidate_append_delta: 0
expected_evaluation_append_delta: 0
expected_runtime_authority_behavior: UNCHANGED
expected_state_behavior: UNCHANGED_OR_EXPLICIT_EXISTING_TRANSACTION_RESULT
expected_checkpoint_behavior: UNCHANGED_OR_EXPLICIT_EXISTING_TRANSACTION_RESULT

expected_projection_behavior: ...
expected_operational_attempt_result_allowed: true | false
expected_operational_attempt_mode: ...
```

---

# 45. Completion Claims Candidate

只有 merged-main final effectiveness 成立后才允许激活：

```text
MCFT_CAP_06_COMPLETE
DT02_CALIBRATION_CANDIDATE_REUSE_ESTABLISHED
DT02_SHADOW_EVALUATION_REUSE_ESTABLISHED
DT02_D_MODEL_GOVERNANCE_REUSE_ESTABLISHED
CONTROLLED_REPLAY_SINGLE_PARAMETER_DRAINAGE_CALIBRATION_ESTABLISHED
CALIBRATION_HOLDOUT_DUAL_TIME_SEPARATION_ESTABLISHED
ZERO_FUTURE_LEAKAGE_ESTABLISHED
PASS_ONLY_STANDARD_CALIBRATION_DATASET_ESTABLISHED
CANONICAL_FORECAST_POINT_TRACE_REPLAY_AUTHORITY_ESTABLISHED
EXACT_REF_ONLY_CALIBRATION_DATA_PORT_ESTABLISHED
BASE_FORECAST_REPLAY_REPRODUCTION_ESTABLISHED
RUNTIME_AND_METRIC_NUMERIC_POLICY_SEPARATION_ESTABLISHED
MODEL_CONFIG_HOMOGENEITY_GATE_ESTABLISHED
FIXED_POINT_CALIBRATION_METRICS_ESTABLISHED
EXACT_MSE_CANDIDATE_SELECTION_ESTABLISHED
PARAMETER_SENSITIVITY_GATE_ESTABLISHED
WETNESS_REGIME_EXCITATION_GATE_ESTABLISHED
OBJECTIVE_SURFACE_FLATNESS_GATE_ESTABLISHED
BEST_SECOND_MARGIN_GATE_ESTABLISHED
SEARCH_BOUNDARY_HIT_INCONCLUSIVE_ESTABLISHED
ERROR_CLASSIFICATION_SUMMARY_ESTABLISHED
UNCERTAINTY_UNCHANGED_BOUNDARY_ESTABLISHED
CONTROLLED_REPLAY_BOUNDED_NONZERO_CANDIDATE_ESTABLISHED
CANONICAL_NOOP_CANDIDATE_ESTABLISHED
CANDIDATE_NON_ACTIVATION_BOUNDARY_ESTABLISHED
CANDIDATE_D_TRANSACTION_IDEMPOTENCY_ESTABLISHED
CANDIDATE_CONCURRENT_IDEMPOTENCY_ESTABLISHED
CANDIDATE_CANONICAL_RECOVERY_ESTABLISHED
PAIRED_HISTORICAL_REPLAY_SHADOW_ESTABLISHED
ZERO_WRITE_SHADOW_COMPUTE_ESTABLISHED
EMBEDDED_SHADOW_CASE_RESULTS_ESTABLISHED
EXACT_SHADOW_THRESHOLD_EVALUATION_ESTABLISHED
BASELINE_ZERO_METRIC_POLICY_ESTABLISHED
SHADOW_REVIEW_ELIGIBILITY_ESTABLISHED
SHADOW_EVALUATION_NON_ACTIVATION_BOUNDARY_ESTABLISHED
EVALUATION_D_TRANSACTION_IDEMPOTENCY_ESTABLISHED
EVALUATION_CONCURRENT_IDEMPOTENCY_ESTABLISHED
EVALUATION_CANONICAL_RECOVERY_ESTABLISHED
EXPLICIT_REPLAY_CONFIG_AUTHORITY_PRESERVED
ACTIVE_BINDING_NULLABLE_SEMANTICS_ESTABLISHED
POST_EVALUATION_BASE_PARAMETER_TICK_ESTABLISHED
CANDIDATE_NON_CONSUMPTION_ESTABLISHED
CONTROLLED_FIXTURE_REPOSITORY_HISTORY_SEPARATION_ESTABLISHED
REPOSITORY_HISTORY_QUALIFICATION_EXECUTED
CONTROLLED_REPLAY_CALIBRATION_SHADOW_CHAIN_PERSISTED
COMPLETED_CHAIN_ZERO_WRITE_REPLAY_ESTABLISHED
FINAL_EFFECTIVENESS_RECONCILIATION_ESTABLISHED
MCFT_CAP_07_REMAINS_UNAUTHORIZED
```

这些 claims 只证明 controlled deterministic Replay capability，不证明真实田间参数、统计显著性、跨场景泛化、uncertainty calibration 或模型上线。

---

# 46. Closure lifecycle

## S11A — Closure Candidate

```text
status:
CLOSURE_CANDIDATE

completion claims:
all pending

effective claims:
none

active delivery slice:
S11A

CAP-07:
unauthorized
```

## S11B — S11A merged-main proof-only Finalization Gate

```text
checkout exact S11A merge commit

verify:
Hard Acceptance evidence ledger
permanent PostgreSQL regressions
typecheck
build
server selfcheck
standard acceptance
commercial release gate where applicable
Runtime authority unchanged
no Model Activation
CAP-07 unauthorized

close proof PR without merge
```

## S11C — Capability Completion Effectiveness Activation

只有 S11B 全绿后：

```text
status:
CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION_CANDIDATE

implementation_status:
COMPLETE_CANDIDATE

closure_effective:
pending merge effectiveness

capability_complete:
pending merge effectiveness

active_delivery_slice_id:
S11C

runtime_source_authorized:
false

pending_completion_claims:
frozen set

effective_completion_claims:
[]

successor_authorized:
false
```

S11C 是 Capability Completion claim activation，不是 `twin_model_activation_v1`，不得使用 `MODEL_ACTIVATION` 简称。

S11C 文件不得预先记录其未知 merge/postmerge 证据。

## S11D — Final Effectiveness Reconciliation

S11D 必须记录：

```text
S11C exact head
S11C exact-head CI
S11C merge commit
S11C head-to-merge file delta
S11C tree equivalence
S11C postmerge probe PR
S11C postmerge workflow
S11C merged-main Gate result
final effective completion claims
pending completion claims = 0
active slice = null
runtime source authorized = false
CAP-07 unauthorized
```

S11D merge 后运行最终 proof-only reconciliation probe：

```text
checkout exact S11D merge commit
run final reconciliation Gate
run permanent regressions
run typecheck/build/selfcheck
close proof PR without merge
perform no further SSOT writeback
```

最终状态：

```text
status:
COMPLETE

implementation_status:
COMPLETE

closure_effective:
true

capability_complete:
true

active_delivery_slice_id:
null

runtime_source_authorized:
false

pending_completion_claims:
[]

effective_completion_claims:
frozen set

successor_authorized:
false

next_repository_action:
null
```

---

# 47. Existing component reuse

```text
DT-02 twin_calibration_candidate_v1:
REUSE_WITHOUT_AMENDMENT

DT-02 twin_shadow_evaluation_v1:
REUSE_WITHOUT_AMENDMENT

DT-02 D_MODEL_GOVERNANCE_STEP_COMMIT:
REUSE_WITHOUT_AMENDMENT

DT-02 twin_model_activation_v1:
EXPLICITLY_EXCLUDED

existing Runtime Config:
REUSE_AS_EXPLICIT_BASE_AUTHORITY

existing active config binding:
DO_NOT_ASSUME_ESTABLISHED
READ_NULLABLE_STATUS_ONLY

CAP-05 Forecast Residual:
REUSE_AS_DATASET_SOURCE_AUTHORITY
NOT_EVIDENCE_REF

CAP-04 H1 Forecast point trace:
REUSE_AS_CASE_INPUT_AUTHORITY

MCFT Evidence Window:
REUSE_EXISTING_CUTOFF_GRAPH
NO_NEW_EVIDENCE_WINDOW_SEMANTICS

CAP-03 observation quality:
REUSE_PASS
EXCLUDE_LIMITED_FROM_STANDARD_PATH

CAP-03 observation operator:
REUSE_AS_IS
DERIVE_OPERATOR_HASH_BY_FROZEN_POLICY

CAP-02 hourly water Dynamics:
REUSE_AS_IS
PARAMETER OVERRIDE ONLY INSIDE EPHEMERAL REPLAY

CAP-04 A1/B post-evaluation Tick:
REUSE_AS_IS

old P37–P44:
REFERENCE_ONLY
NO_CANONICAL_AUTHORITY
```

---

# 48. 最终任务线判断

MCFT-CAP-06 的目标不是：

```text
自动学习
自动改参数
自动激活模型
用一次 Residual 调参
把历史回放称为 Shadow Online
让 Candidate 进入下一 Tick
把 normalized residual 称为 uncertainty calibration
声称识别了真实物理参数
```

它建立的是：

```text
canonical Forecast Residual history
↓
structural qualification
↓
16-case calibration window
↓
exact-ref-only data access
↓
single-parameter fixed-point grid replay
↓
sensitivity / excitation / objective / boundary gates
↓
error classification summary
↓
twin_calibration_candidate_v1
↓
8 later holdout cases
↓
zero-write paired historical replay
↓
exact metric and invariant evaluation
↓
twin_shadow_evaluation_v1
↓
response-loss / rebuild / canonical recovery
↓
next normal Tick remains on explicit base parameter authority
↓
Capability Completion Effectiveness Activation
↓
Final Effectiveness Reconciliation
```

最终允许声明：

```text
GEOX 在 Level A Controlled Replay 下，
能够从严格时间隔离的 canonical Forecast Residual history
形成一个有界的单参数 Calibration Candidate，
在独立 later holdout cases 上完成配对历史回放 Shadow Evaluation，
并证明 Candidate / Evaluation 不会自动修改 Runtime Config authority、
State Dynamics、uncertainty model 或下一 Tick 的有效参数。
```

仍不可声明：

```text
模型已经激活
模型已经上线
模型已经在真实田间改善
系统会自动学习
系统会自动选择参数
系统已识别真实物理参数
结果具有统计显著性
结果可跨地块或季节泛化
Forecast uncertainty 已经校准
系统已进入 Shadow Online
系统已完成生产闭环
系统已成为 Minimum Complete Field Twin
```

当前准确状态：

```text
architecture_direction:
CONFORMANT

design_status:
CONDITIONAL_FROZEN_AFTER_P_MINUS_1

implementation_status:
P_MINUS_1_COMPLETE

runtime_implementation_status:
NOT_AUTHORIZED

authorization_effective:
false

runtime_source_authorized:
false

dt02_architecture_amendment_status:
NOT_REQUIRED

next_repository_action:
null

automatic_successor_authorization:
NONE
```

<!-- MCFT-CAP-06-P0-CURRENT-STATE-BEGIN -->
# 49. P-1 merged-main effectiveness / P0 provisional state

```text
P-1 outcome:
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED

P-1 implementation PR:
#2496

P-1 implementation exact head:
762764074e62f186921e0aabd5251f53b5f7ce02

P-1 merge commit:
79cd7814eff06ad86f86cdcb379c6f71a77f1ab8

P-1 postmerge probe PR:
#2497 CLOSED_WITHOUT_MERGE

P-1 postmerge workflow:
29418272690 SUCCESS

P-1 status:
MERGED_EFFECTIVE

P-1A:
OMITTED

conditional S4:
OMITTED

P0 status:
PROVISIONAL_SSOT_CANDIDATE

authorization_effective:
false

runtime_source_authorized:
false

active_delivery_slice_id:
null

S0 status:
BLOCKED_PENDING_P0_MERGED_MAIN_EFFECTIVENESS

next_repository_action:
null
```

P0 不重开 CAP-05 closure，不创建 Runtime、migration、canonical object、Model Activation 或 active binding。P0 只有在合并、head-to-merge tree equivalence 和 merged-main P0 Gate 成功后，才使 S0 成为下一项可执行治理工作。
<!-- MCFT-CAP-06-P0-CURRENT-STATE-END -->

---

# 44. S0 v2 Candidate Materialization

```text
baseline_main_commit: ca819ba51bdf3017dbefa96015f76bd3b66a647c
status: S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
dataset_qualification_status: INSUFFICIENT_MATCHED_PAIRS
canonical_residual_count: 1
eligible_residual_count: 1
case_graph_validation_status: PASS
availability_order_validation_status: PASS
homogeneity_validation_status: PASS
checkpoint_sequence: 80
reproduced_state_fact_count: 33
config_authority_mode: EXPLICIT_REPLAY_PIN
active_binding_status: NOT_ESTABLISHED
authorization_effective: false
runtime_source_authorized: false
active_delivery_slice_id: null
```

S0 v2 confirms that the repository-history graph is valid and homogeneous but currently contains only one eligible H1 Residual, so the repository-history track is structurally insufficient for calibration assessment. The controlled positive mechanism track remains independently eligible only after S0 merged-main effectiveness activates S1.

<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->
# 51. S0 merged-main effectiveness and S1 authorization

```text
S0 status: MERGED_EFFECTIVE
implementation PR: 2508
implementation exact head: 375adfa3ba85082c1742b30314951df61b3a1936
exact-head CI: 29471606766 SUCCESS
merge commit: 4c93ec59a6ac0b53b43584cbef1a7e0295d6b58a
head-to-merge file delta count: 0
head-to-merge tree equivalence: PASS
postmerge probe PR: 2511 CLOSED_WITHOUT_MERGE
postmerge workflow: 29472057972 SUCCESS
merged-main Authorization Gate: PASS
dataset qualification: INSUFFICIENT_MATCHED_PAIRS
authorization_effective: true
runtime_source_authorized: true
active_delivery_slice_id: MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
S1 status: AUTHORIZED_NOT_STARTED
S2 and later: BLOCKED
```

S0 effectiveness authorizes only S1 implementation. It does not itself create Residuals, Candidate, Evaluation, Model Activation, an active-config binding, a public route, Web behavior, or MCFT-CAP-07 authority.
<!-- MCFT-CAP-06-S0-EFFECTIVENESS-END -->

<!-- MCFT-CAP-06-S1-CANDIDATE-BEGIN -->
# 52. S1 controlled canonical Residual-window candidate

```text
status: IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
baseline main: b709bfed36ef1efa6d970b349d23a2b0006e4de2
implementation PR: 2514
candidate execution head: 91edc0e7c0d88b5bec1c60aa0d4b249c3cd81cfe
candidate PostgreSQL workflow: 29473868540 SUCCESS
profile: PRESEEDED_24_H1_FORECAST_OBSERVATION_PAIRS_NO_RESIDUALS_V1
canonical Residuals: 24
calibration window: 16
holdout window: 8
residual set hash: sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7
calibration window hash: sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d
holdout window hash: sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a
case input set hash: sha256:fac894cf5a4de2c473523190408933ae25185c6a63b9568cde2d8121add4dc62
S2 authorized: false
```

S1 reuses CAP-02 fixed-point Dynamics, CAP-04 H1 Forecast traces, CAP-05 Residual contracts and the existing C transaction. It introduces no second Residual type, no migration and no calibration search. The controlled mechanism track is disjoint from repository history.
<!-- MCFT-CAP-06-S1-CANDIDATE-END -->

<!-- MCFT-CAP-06-S1-EFFECTIVENESS-BEGIN -->
# 52. S1 merged-main effectiveness and S2 authorization

```text
S1 status: MERGED_EFFECTIVE
implementation PR: 2514
implementation exact head: 57d9844528665a5ae3ecbd0ccf0406bf3c5e91cd
exact-head CI: 29475482824 SUCCESS
merge commit: 6db3f8d0c2b2ba7bcc48993b4b4783332e2ae62b
head-to-merge file delta count: 0
head-to-merge tree equivalence: PASS
postmerge probe PR: 2515 CLOSED_WITHOUT_MERGE
postmerge workflow: 29476027885 SUCCESS
merged-main S1 Gate: PASS
canonical Residual count: 24
calibration window count: 16
holdout window count: 8
active_delivery_slice_id: MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1
S2 status: AUTHORIZED_NOT_STARTED
S3 and later: BLOCKED
```

S1 effectiveness authorizes only S2 contract, fixed-point math and policy implementation. It does not implement the calibration engine, append Candidate or Evaluation objects, create Model Activation, switch active Config, mutate State/checkpoint, expose a public route/Web path/scheduler, or authorize MCFT-CAP-07.
<!-- MCFT-CAP-06-S1-EFFECTIVENESS-END -->

<!-- MCFT-CAP-06-S1-CONTROLLED-DATA-CORRECTION:BEGIN -->
## MCFT-CAP-06 S1 受控数据后继就绪性纠偏

S2 草稿 PR #2518 的专用 probe 证明：原 S1 的 24 个受控案例全部属于 `LOW_EXCESS`，最大归一化超田间持水量比率仅为 `0.093326488`，低于冻结的 `MID_EXCESS` 下界 `0.10`。因此，原 S1 的机械持久化、幂等和重建证明保留，但其对 S2 的后继就绪性授权被撤销。

当前唯一 active slice 回到 `MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1` 的受控数据纠偏。纠偏仅增加 CAP-06 专用 `CAP06_MULTI_REGIME_V1` forcing profile；不修改 Dynamics、固定点策略、湿度分区公式或阈值。修正后的校准窗口为 8 LOW / 2 MID / 6 HIGH，holdout 为 8 HIGH；24 条 Residual refs 保持稳定，Residual hashes、residual-set hash 与 case-input-set hash按新证据重新生成。

在纠偏 exact-head CI、merge、head-to-merge tree equivalence、merged-main Gate 与独立 effectiveness writeback 全部通过前，S2 及其后续 Slice 均保持阻塞。


### S1 后继就绪性永久前置条件

纠偏后的 16 个 calibration case 必须在 `0.020000` 与 `0.040000` endpoint replay 下满足至少 4 个 sensitive cases、至少 2 个 represented sensitive wetness regimes，并保持 24-case base replay exactness。later 8-case holdout 明确限定为 `HIGH_EXCESS_STRESS_HOLDOUT_ONLY`，不建立跨 regime 一般化声明。

`calibration_window_hash` 与 `holdout_window_hash` 的冻结语义为 `ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1`：它们只绑定有序 Residual refs。任何 S2 Candidate 或后续 Evaluation 消费者必须同时 pin 对应 ordered Residual hashes、`residual_set_hash` 与 `case_input_set_hash`；只 pin window hash 不构成数据语义身份。
<!-- MCFT-CAP-06-S1-CONTROLLED-DATA-CORRECTION:END -->
